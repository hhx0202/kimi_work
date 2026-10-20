// ============================================================
// 生成 js/pokemon-moves.js
// 数据源：PokeAPI（https://pokeapi.co/api/v2）
//   1) /pokemon/{1..151} → 等级习得招式 + 属性
//   2) /move/{name}      → 招式中文名 / 属性 / 威力 / 分类 / 中文说明
// 筛选规则：每只取 4 个最像"实战配招"的招式
//   - 本系加成（STAB）+40，威力越高分越高，变化招式 −30
//   - 45 级前能学会 +10（保证是孩子熟悉的招式）
//   - 至少 3 个伤害招式，展示顺序按习得等级
// 用法：node tools/fetch_moves.js
// ============================================================
const fs = require('fs');
const path = require('path');

const API = 'https://pokeapi.co/api/v2';
const MAX_NO = 151;
const CONCURRENCY = 10;

// 属性代表招式（与 app.js 的 TYPE_THEME.skill 对应）：只要这只学得会，就一定放进 4 招里
const THEME_MOVE = {
  normal: '撞击', fire: '喷射火焰', water: '水炮', electric: '十万伏特', grass: '飞叶快刀',
  ice: '冰冻光束', fighting: '百万吨拳', poison: '毒液冲击', ground: '地震', flying: '翅膀攻击',
  psychic: '精神强念', bug: '虫鸣', rock: '岩石爆击', ghost: '暗影球', dragon: '龙之波动',
  steel: '金属爪', fairy: '妖精之风',
};

async function getJSON(url, retry = 3) {
  for (let i = 0; i < retry; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'kimi-task-island/1.0' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      if (i === retry - 1) throw new Error(url + ' -> ' + e.message);
      await new Promise(res => setTimeout(res, 400 * (i + 1)));
    }
  }
}

// 简单并发池
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

function zhName(entries, key = 'name') {
  if (!entries) return '';
  const low = n => String(n || '').toLowerCase();
  const z = entries.find(e => e.language && low(e.language.name) === 'zh-hans')
    || entries.find(e => e.language && low(e.language.name) === 'zh-hant');
  return z ? z[key] : '';
}

function cleanText(s) {
  return String(s || '').replace(/[\n\r\f\u000c]+/g, ' ').replace(/\s+/g, ' ').trim();
}

(async () => {
  const CACHE = path.join(__dirname, '_cache_moves.json.tmp');
  let cache = null;
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { }
  const useCache = cache && cache.mons && cache.moveInfo;

  let mons, moveInfo;
  if (useCache) {
    mons = cache.mons; moveInfo = cache.moveInfo;
    console.log(`跳过网络请求，使用缓存 ${CACHE}（删掉它可重新抓取）`);
  } else {
    console.log('① 拉取 151 只宝可梦的等级习得招式…');
    mons = await pool(Array.from({ length: MAX_NO }, (_, i) => i + 1), CONCURRENCY, async no => {
    const p = await getJSON(`${API}/pokemon/${no}`);
    const types = p.types.sort((a, b) => a.slot - b.slot).map(t => t.type.name);
    const moves = [];
    for (const m of p.moves) {
      let minLevel = Infinity;
      for (const d of m.version_group_details) {
        if (d.move_learn_method.name === 'level-up') minLevel = Math.min(minLevel, d.level_learned_at || 0);
      }
      // 等级习得优先；招式学习器 / 教学招式只作补齐（等级记 999，排序自然靠后）
      if (minLevel === Infinity) {
        const canMachine = m.version_group_details.some(d => d.move_learn_method.name === 'machine' || d.move_learn_method.name === 'tutor');
        if (!canMachine) continue;
        minLevel = 999;
      }
      moves.push({ name: m.move.name, level: minLevel });
    }
    // 同名招式去重，保留最低等级
    const seen = new Map();
    for (const m of moves) if (!seen.has(m.name) || seen.get(m.name) > m.level) seen.set(m.name, m.level);
    if (no % 15 === 0) console.log(`   …#${no}`);
    return { no, name: p.name, types, moves: [...seen].map(([name, level]) => ({ name, level })) };
  });

  const allMoveNames = [...new Set(mons.flatMap(m => m.moves.map(x => x.name)))];
  console.log(`② 共 ${allMoveNames.length} 个招式，拉取中文名/威力/分类…`);

  let done = 0;
  moveInfo = {};
  await pool(allMoveNames, CONCURRENCY, async name => {
    const m = await getJSON(`${API}/move/${name}`);
    const zh = zhName(m.names);
    const flavor = (m.flavor_text_entries || []).find(e => e.language.name === 'zh-hans')
      || (m.flavor_text_entries || []).find(e => e.language.name === 'zh-hant');
    moveInfo[name] = {
      n: zh || name,
      t: m.type.name,
      p: m.power || 0,
      c: m.damage_class ? m.damage_class.name : 'status',
      d: cleanText(flavor ? flavor.flavor_text : ''),
    };
    if (++done % 50 === 0) console.log(`   …${done}/${allMoveNames.length}`);
  });
  fs.writeFileSync(CACHE, JSON.stringify({ mons, moveInfo }), 'utf8');
}

  console.log('③ 挑选每只的 4 个招式…');
  const PK = {};
  for (const mon of mons) {
    const mainType = mon.types[0];
    const cand = mon.moves.map(m => ({ ...m, ...moveInfo[m.name] })).filter(m => m.n);
    const scored = cand.map(m => ({
      ...m,
      score: (m.p || 0)
        + (m.t === mainType ? 40 : 0)
        + (mon.types.includes(m.t) ? 12 : 0)
        + (m.level < 999 ? 60 : -80)       // 等级习得的招式才是"这只自己的招式"，学习器招式靠后
        - (m.c === 'status' ? 30 : 0),
    })).sort((a, b) => b.score - a.score || a.level - b.level);

    const picked = [];
    const has = m => picked.some(x => x.name === m.name);
    // 第 0 步：先把「本属性代表招式」放进去（就是卡面属性条上那招，孩子最熟）
    const themeMv = cand.find(m => m.n === THEME_MOVE[mainType]);
    if (themeMv) picked.push(themeMv);
    // 第 1 步：伤害招式，同一属性最多 2 个（本系可以有两招，别四招全一个属性）
    for (const m of scored) {
      if (picked.length >= 3) break;
      if (m.c === 'status' || !m.p || has(m)) continue;
      if (picked.filter(x => x.t === m.t).length >= 2) continue;
      picked.push(m);
    }
    // 第 2 步：补伤害招式（允许同属性）
    for (const m of scored) {
      if (picked.length >= 3) break;
      if (m.c === 'status' || !m.p || has(m)) continue;
      picked.push(m);
    }
    // 第 3 步：第 4 个，优先变化招式（有变化才像真配招），否则最强剩余
    const statusMove = scored.find(m => m.c === 'status' && m.level <= 60 && !has(m));
    const strongest = scored.find(m => !has(m));
    const fourth = (statusMove || strongest) || null;
    if (fourth) picked.push(fourth);
    // 不足 4 个时用剩余招式补齐
    for (const m of scored) {
      if (picked.length >= 4) break;
      if (!has(m)) picked.push(m);
    }

    picked.sort((a, b) => a.level - b.level);
    PK[mon.no] = picked.map(m => [m.n, m.t, m.p || 0, m.c, m.d || '']);
  }

  const lines = [];
  lines.push('// 宝可梦招式表（PokeAPI 自动抓取，勿手改）');
  lines.push('// [中文名, 属性, 威力, 分类(physical/special/status), 中文说明]');
  lines.push('// 由 tools/fetch_moves.js 生成');
  lines.push('const PK_MOVES = {');
  for (const no of Object.keys(PK)) {
    const arr = PK[no].map(m => JSON.stringify(m).replace(/","/g, '","')).join(', ');
    lines.push(`  ${no}: [${arr}],`);
  }
  lines.push('};');
  lines.push('');
  const outPath = path.join(__dirname, '..', 'js', 'pokemon-moves.js');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

  const counts = Object.values(PK).map(a => a.length);
  console.log(`④ 已写入 ${outPath}`);
  console.log(`   招式数：最少 ${Math.min(...counts)} / 最多 ${Math.max(...counts)} / 共 ${counts.reduce((a, b) => a + b, 0)} 条`);
  const short = Object.keys(PK).filter(no => PK[no].length < 4);
  if (short.length) console.log(`   ⚠ 不足 4 个招式的：#${short.join(' #')}`);
  const noZh = Object.entries(PK).flatMap(([no, arr]) => arr.filter(m => !/[\u4e00-\u9fa5]/.test(m[0])).map(m => `#${no} ${m[0]}`));
  if (noZh.length) console.log(`   ⚠ 没有中文名的招式（${noZh.length} 条）：${noZh.slice(0, 10).join(', ')}`);
  console.log(`   示例 #6：${PK[6].map(m => `${m[0]}(${m[1]} ${m[2]})`).join(' / ')}`);
})();
