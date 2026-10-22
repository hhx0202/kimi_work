// 宝可梦数据完整性 + 进化/闪耀阈值。
// 目的：以后扩充图鉴（加新世代、手改进化链）时，如果漏了基础形态或进化目标，这里会直接报错提醒。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadInto, ok, section } = require('./harness');

const DATA_SRC = fs.readFileSync(path.join(__dirname, '../js/pokemon-data.js'), 'utf8');

function setup() {
  const ctx = {
    console,
    CONFIG: { EVO_EXP_1: 300, EVO_EXP_2: 500, SHINY_EXP: 100 },
    S: { pokemons: [] },
  };
  vm.createContext(ctx);
  vm.runInContext(DATA_SRC, ctx);
  const data = vm.runInContext('({ POKEMON, PK_BY_NO, PK_EVOLVE_FROM, CATCH_POOL, evoStage })', ctx);
  ctx.LK = k => 'km_' + k;
  ctx.localStorage = { _m: {}, getItem(k) { return k in this._m ? this._m[k] : null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } };
  loadInto(ctx, ['lsGet', 'lsSet', 'evoTargets', 'evoAncestors', 'hasNextEvo', 'hasShinyCopy', 'shinyLineageNo', 'willInheritShiny', 'expThreshold', 'canEvolve', 'isMaxed',
    'branchPending', 'dexGot', 'ownedNumbers',
    'artworkPath', 'scenePath', 'savedCardArtMode', 'setCardArtMode', 'cardArtModes', 'currentCardArtMode', 'cardArtSrc', 'cycleCardArt']);
  return { ctx, ...data };
}

const evoTargetsOf = p => (p.ev && p.ev.length ? p.ev : (p.e ? [p.e] : []));

module.exports = async function run() {
  const { ctx, POKEMON, PK_BY_NO, PK_EVOLVE_FROM, CATCH_POOL, evoStage } = setup();

  section('图鉴基础数据');
  ok(POKEMON.length === 151, `共 151 条（实际 ${POKEMON.length}）`);
  const nos = POKEMON.map(p => p.no);
  ok(new Set(nos).size === nos.length, '编号不重复');
  ok(Math.min(...nos) === 1 && Math.max(...nos) === 151, '编号范围 1~151');
  ok(POKEMON.every(p => p.name && p.name.trim()), '每只都有名字');

  section('进化链完整性（扩充数据时的提醒）');
  const missingTargets = [];
  for (const p of POKEMON) {
    for (const t of evoTargetsOf(p)) {
      if (!PK_BY_NO[t]) missingTargets.push(`${p.no}${p.name} → ${t}`);
    }
  }
  ok(missingTargets.length === 0, `所有进化目标都存在${missingTargets.length ? '：' + missingTargets.slice(0, 5).join('、') : ''}`);

  const noRoot = [];
  for (const p of POKEMON) {
    let cur = p.no, guard = 0;
    while (PK_EVOLVE_FROM[cur] !== undefined && guard++ < 20) cur = PK_EVOLVE_FROM[cur];
    if (PK_EVOLVE_FROM[cur] !== undefined || !PK_BY_NO[cur]) noRoot.push(`${p.no}${p.name}（链根 ${cur}）`);
  }
  ok(noRoot.length === 0, `每条进化链都能追溯到存在的基础形态${noRoot.length ? '：' + noRoot.slice(0, 5).join('、') : ''}`);

  const noBaseAncestorCatchable = [];
  for (const p of POKEMON) {
    if (PK_EVOLVE_FROM[p.no] === undefined) continue;   // 基础形态本身
    let cur = p.no, guard = 0;
    while (PK_EVOLVE_FROM[cur] !== undefined && guard++ < 20) cur = PK_EVOLVE_FROM[cur];
    if (!CATCH_POOL.common.includes(cur) && !CATCH_POOL.rare.includes(cur)) {
      noBaseAncestorCatchable.push(`${p.no}${p.name}（根基 ${cur} 不可捕捉）`);
    }
  }
  ok(noBaseAncestorCatchable.length === 0,
    `所有进化形态都能通过"捕捉基础形态→进化"获得${noBaseAncestorCatchable.length ? '：' + noBaseAncestorCatchable.slice(0, 5).join('、') : ''}`);

  section('捕捉池');
  const bases = POKEMON.filter(p => PK_EVOLVE_FROM[p.no] === undefined).map(p => p.no);
  const pool = CATCH_POOL.common.concat(CATCH_POOL.rare);
  ok(new Set(pool).size === pool.length, '捕捉池无重复');
  ok(pool.length === bases.length && bases.every(no => pool.includes(no)), `捕捉池 = 全部基础形态（${bases.length} 只）`);
  ok(POKEMON.filter(p => PK_EVOLVE_FROM[p.no] !== undefined).every(p => !pool.includes(p.no)), '进化形态不在捕捉池里');

  section('经验条阈值');
  ok(ctx.expThreshold({ pokedex_no: 83 }) === 100, '无进化基础形态（大葱鸭）→ 闪耀经验 100');
  ok(ctx.expThreshold({ pokedex_no: 1 }) === 300, '有进化的基础形态（妙蛙种子）→ 一阶进化经验 300');
  ok(ctx.expThreshold({ pokedex_no: 5 }) === 500, '一阶形态（火恐龙）→ 二阶进化经验 500');
  ok(ctx.expThreshold({ pokedex_no: 6 }) === 100, '最终形态（喷火龙）→ 闪耀经验 100');

  section('闪耀 / 封顶判定');
  ok(ctx.canEvolve({ pokedex_no: 83, shiny: false, exp: 99 }).ok === false, '无进化基础形态：99 经验还不能闪');
  const r = ctx.canEvolve({ pokedex_no: 83, shiny: false, exp: 100 });
  ok(r.ok === true && r.shiny === true, '无进化基础形态：满 100 → 进入闪耀形态');
  ok(ctx.canEvolve({ pokedex_no: 5, shiny: false, exp: 500 }).ok === true, '一阶形态：满 500 可进化');
  ok(ctx.isMaxed({ pokedex_no: 83, shiny: true }) === true, '无进化的闪耀卡 = 封顶');
  ok(ctx.isMaxed({ pokedex_no: 1, shiny: true }) === false, '基础形态的闪耀卡仍可继续进化');
  ok(ctx.isMaxed({ pokedex_no: 6, shiny: true }) === true, '最终形态的闪耀卡封顶');
  ctx.S.pokemons = [{ pokedex_no: 83, shiny: true }];
  ok(ctx.isMaxed({ pokedex_no: 83, shiny: false }) === true, '已有同编号闪耀卡后，普通卡不再吃经验');
  ok(ctx.hasShinyCopy(83) === true && ctx.hasShinyCopy(1) === false, '闪耀卡按编号判定');

  section('形态阶数');
  ok(evoStage(1) === 0 && evoStage(2) === 1 && evoStage(3) === 2, '妙蛙种子/草/花 = 基础/一阶/二阶');
  ok(evoStage(133) === 0 && evoStage(134) === 1, '伊布基础、水伊布一阶（分支进化）');

  section('分支进化不会锁死兄弟形态（伊布三选一）');
  const pmOf = no => ({ id: no, pokedex_no: no, name: PK_BY_NO[no].name, shiny: false, exp: 0 });
  const before = ctx.S.pokemons.slice();
  ctx.S.pokemons = [pmOf(134)];
  ok(ctx.ownedNumbers().has(133), '进化成水伊布后，图鉴仍把伊布算作已收集（祖先点亮）');
  ok(ctx.branchPending(133) === true, '但伊布要能再次出现，否则雷/火伊布永远拿不到');
  ctx.S.pokemons = [pmOf(134), pmOf(135)];
  ok(ctx.branchPending(133) === true, '还差火伊布时仍可能出现');
  ctx.S.pokemons = [pmOf(134), pmOf(135), pmOf(136)];
  ok(ctx.branchPending(133) === false, '三条分支集齐后不再回到捕捉池');
  ctx.S.pokemons = [pmOf(2)];
  ok(ctx.branchPending(1) === false, '单线进化（妙蛙种子）不受影响，进化后不会再遇到');
  ctx.S.pokemons = before;

  section('卡牌详情造型：立绘 / 异色动图 / 场景卡');
  const shinyPm = { pokedex_no: 25, shiny: true };
  const normalPm = { pokedex_no: 25, shiny: false };
  ok(ctx.cardArtModes(shinyPm).join() === 'art,sprite,scene', '闪耀卡有三档造型');
  ok(ctx.cardArtModes(normalPm).join() === 'art,scene', '普通卡只有两档（没有异色动图）');
  ctx.setCardArtMode('art');
  ok(ctx.cardArtSrc(shinyPm) === 'assets/artwork/25.png', '默认显示立绘');
  ctx.setCardArtMode('sprite');
  ok(ctx.cardArtSrc(shinyPm) === 'assets/sprites/shiny/25.gif', '闪耀卡切到异色动图');
  ok(ctx.cardArtSrc(normalPm) === 'assets/artwork/25.png', '普通卡即使存了 sprite 也回退立绘');
  ctx.setCardArtMode('scene');
  ok(ctx.cardArtSrc(shinyPm) === 'assets/scenes/25.jpg', '场景卡用 assets/scenes/{图鉴编号}.jpg');
  ok(ctx.cardArtSrc(normalPm) === 'assets/scenes/25.jpg', '普通卡也能用场景卡');
  ok(ctx.localStorage.getItem('km_card_art_mode') === JSON.stringify('scene'), '选择存本机 localStorage');

  section('造型按钮循环');
  ctx.setCardArtMode('art');
  ok(ctx.cycleCardArt(shinyPm) === 'sprite' && ctx.cycleCardArt(shinyPm) === 'scene' && ctx.cycleCardArt(shinyPm) === 'art',
    '闪耀卡：立绘 → 异色动图 → 场景卡 → 立绘');
  ctx.setCardArtMode('art');
  ok(ctx.cycleCardArt(normalPm) === 'scene' && ctx.cycleCardArt(normalPm) === 'art',
    '普通卡：立绘 → 场景卡 → 立绘');
  ctx.setCardArtMode('art');
};
