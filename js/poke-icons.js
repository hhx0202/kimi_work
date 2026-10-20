// ============================================================
// 宝可梦风 SVG 图标库（手绘，风格统一）
// 用 POKE_ICON.xxx 取单个图标，catIcon(cat) 按类别取图标
// ============================================================
const POKE_ICON = (() => {
  const svg = (inner, vb = '0 0 40 40') =>
    `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

  // 精灵球系：top 顶部颜色，mid 中央按钮点缀色
  const ball = (top, mid) => svg(`
    <circle cx="20" cy="20" r="18" fill="#fff" stroke="#222" stroke-width="2"/>
    <path d="M2 20a18 18 0 0 1 36 0z" fill="${top}" stroke="#222" stroke-width="2"/>
    <rect x="2" y="18.5" width="36" height="3" fill="#222"/>
    <circle cx="20" cy="20" r="6.5" fill="#fff" stroke="#222" stroke-width="2"/>
    <circle cx="20" cy="20" r="2.6" fill="${mid || '#eee'}" stroke="#222" stroke-width="1.2"/>`);

  // 招式学习器 TM：圆盘 + 中心孔
  const tm = c => svg(`
    <circle cx="20" cy="20" r="17" fill="#e0e0e0" stroke="#222" stroke-width="2"/>
    <circle cx="20" cy="20" r="12" fill="${c}"/>
    <circle cx="20" cy="20" r="3.6" fill="#fff" stroke="#222" stroke-width="1.6"/>
    <path d="M8 12l24 16M32 12L8 28" stroke="#fff" stroke-width="1" opacity=".35"/>`);

  // 道馆徽章：盾形 + 十字星光
  const badge = c => svg(`
    <path d="M20 3l14 7v10c0 8-6 14-14 17-8-3-14-9-14-17V10z" fill="${c}" stroke="#222" stroke-width="2"/>
    <path d="M20 12v16M12 20h16" stroke="#fff" stroke-width="2" opacity=".85"/>`);

  // 宝可梦图鉴：红色折叠机 + 屏幕 + 圆钮
  const dex = () => svg(`
    <rect x="4" y="8" width="32" height="24" rx="6" fill="#e53935" stroke="#222" stroke-width="2"/>
    <rect x="8" y="12" width="16" height="12" rx="3" fill="#cfe8ff" stroke="#222" stroke-width="1.6"/>
    <circle cx="30" cy="15" r="2.6" fill="#ffd54f" stroke="#222" stroke-width="1.2"/>
    <rect x="24" y="20" width="10" height="4" rx="1.5" fill="#90caf9" stroke="#222" stroke-width="1"/>`);

  // 神奇糖果
  const candy = () => svg(`
    <path d="M20 4l9 5v10l-9 5-9-5V9z" fill="#80deea" stroke="#222" stroke-width="2"/>
    <path d="M20 12v9M13 15h14" stroke="#fff" stroke-width="1.5" opacity=".7"/>`);

  // 进化石（宝石）
  const stone = c => svg(`
    <path d="M20 3l10 8v18l-10 8-10-8V11z" fill="${c}" stroke="#222" stroke-width="2"/>
    <path d="M14 14l12 12M20 8v5" stroke="#fff" stroke-width="1.6" opacity=".8"/>`);

  return { ball, great: () => ball('#2f6db3', '#e53935'), ultra: () => ball('#2b2b2b', '#ffd54f'), master: () => ball('#7b3fa0', '#fff'), tm, badge, dex, candy, stone };
})();

// 类别 → 图标规则（按关键词匹配，命中即用）
const CAT_ICON_RULES = [
  { match: '校内', icon: () => POKE_ICON.ball('#e53935') },
  { match: '学校', icon: () => POKE_ICON.ball('#e53935') },
  { match: '作业', icon: () => POKE_ICON.ball('#66bb6a') },
  { match: '校外', icon: () => POKE_ICON.ball('#2f6db3') },
  { match: '阅读', icon: () => POKE_ICON.dex() },
  { match: '运动', icon: () => POKE_ICON.badge('#ffb300') },
  { match: '家务', icon: () => POKE_ICON.candy() },
  { match: '英语', icon: () => POKE_ICON.tm('#ec407a') },
  { match: '数学', icon: () => POKE_ICON.stone('#7e57c2') },
  { match: '音乐', icon: () => POKE_ICON.stone('#ef5350') },
  { match: '练字', icon: () => POKE_ICON.tm('#26c6da') },
  { match: '编程', icon: () => POKE_ICON.ultra() },
];

// 名称 → 图标规则（更具体，优先于类别匹配；任务标题里含这些词就用对应图标）
const CAT_ICON_NAME_RULES = [
  { match: '读', icon: () => POKE_ICON.dex() },
  { match: '书', icon: () => POKE_ICON.dex() },
  { match: '绘本', icon: () => POKE_ICON.dex() },
  { match: '故事', icon: () => POKE_ICON.dex() },
  { match: '古诗', icon: () => POKE_ICON.dex() },
  { match: '课文', icon: () => POKE_ICON.dex() },
  { match: '背诵', icon: () => POKE_ICON.dex() },
  { match: '英语', icon: () => POKE_ICON.tm('#ec407a') },
  { match: '英文', icon: () => POKE_ICON.tm('#ec407a') },
  { match: '单词', icon: () => POKE_ICON.tm('#ec407a') },
  { match: '数学', icon: () => POKE_ICON.stone('#7e57c2') },
  { match: '算术', icon: () => POKE_ICON.stone('#7e57c2') },
  { match: '口算', icon: () => POKE_ICON.stone('#7e57c2') },
  { match: '绳', icon: () => POKE_ICON.badge('#ffb300') },
  { match: '跑步', icon: () => POKE_ICON.badge('#ffb300') },
  { match: '球', icon: () => POKE_ICON.badge('#ffb300') },
  { match: '游泳', icon: () => POKE_ICON.badge('#ffb300') },
  { match: '骑车', icon: () => POKE_ICON.badge('#ffb300') },
  { match: '运动', icon: () => POKE_ICON.badge('#ffb300') },
  { match: '锻炼', icon: () => POKE_ICON.badge('#ffb300') },
  { match: '户外', icon: () => POKE_ICON.badge('#ffb300') },
  { match: '琴', icon: () => POKE_ICON.stone('#ef5350') },
  { match: '舞', icon: () => POKE_ICON.stone('#ef5350') },
  { match: '画', icon: () => POKE_ICON.stone('#ef5350') },
  { match: '唱', icon: () => POKE_ICON.stone('#ef5350') },
  { match: '乐器', icon: () => POKE_ICON.stone('#ef5350') },
  { match: '字', icon: () => POKE_ICON.tm('#26c6da') },
  { match: '写字', icon: () => POKE_ICON.tm('#26c6da') },
  { match: '书法', icon: () => POKE_ICON.tm('#26c6da') },
  { match: '碗', icon: () => POKE_ICON.candy() },
  { match: '垃圾', icon: () => POKE_ICON.candy() },
  { match: '扫地', icon: () => POKE_ICON.candy() },
  { match: '拖地', icon: () => POKE_ICON.candy() },
  { match: '洗衣', icon: () => POKE_ICON.candy() },
  { match: '整理', icon: () => POKE_ICON.candy() },
  { match: '叠', icon: () => POKE_ICON.candy() },
  { match: '浇花', icon: () => POKE_ICON.candy() },
  { match: '编程', icon: () => POKE_ICON.ultra() },
  { match: '代码', icon: () => POKE_ICON.ultra() },
  { match: '机器人', icon: () => POKE_ICON.ultra() },
];

// 兜底：按类别名哈希稳定分配一种精灵球颜色
const BALL_COLORS = ['#e53935', '#42a5f5', '#66bb6a', '#fbc02d', '#ab47bc'];
function catIconColor(cat) {
  let h = 0;
  for (const ch of String(cat)) h = (h * 31 + (ch.codePointAt(0) || 0)) % 997;
  return BALL_COLORS[h % BALL_COLORS.length];
}
// 返回任务对应的 SVG 图标 HTML（cat=类别，name=任务名；先按名称精准匹配，再按类别，最后兜底）
function catIcon(cat, name) {
  const n = name || '';
  const byName = CAT_ICON_NAME_RULES.find(x => n.includes(x.match));
  if (byName) return byName.icon();
  const r = CAT_ICON_RULES.find(x => (cat || '').includes(x.match));
  return r ? r.icon() : POKE_ICON.ball(catIconColor(cat));
}

// ---------- 可按 key 存取 / 随机分配的图标（常用任务标签用） ----------
// 存 key 而不是存 SVG：重建列表、换设备后图形都一样，也不会把一大段 SVG 写进 localStorage
const POKE_ICON_KEY_MAP = {
  'ball-red':     () => POKE_ICON.ball('#e53935'),
  'ball-green':   () => POKE_ICON.ball('#66bb6a'),
  'ball-blue':    () => POKE_ICON.ball('#2f6db3'),
  'great':        () => POKE_ICON.great(),
  'ultra':        () => POKE_ICON.ultra(),
  'master':       () => POKE_ICON.master(),
  'tm-pink':      () => POKE_ICON.tm('#ec407a'),
  'tm-cyan':      () => POKE_ICON.tm('#26c6da'),
  'badge':        () => POKE_ICON.badge('#ffb300'),
  'dex':          () => POKE_ICON.dex(),
  'candy':        () => POKE_ICON.candy(),
  'stone-purple': () => POKE_ICON.stone('#7e57c2'),
  'stone-red':    () => POKE_ICON.stone('#ef5350'),
};
const POKE_ICON_KEYS = Object.keys(POKE_ICON_KEY_MAP);
function catIconByKey(key) {
  const f = POKE_ICON_KEY_MAP[key];
  return f ? f() : POKE_ICON.ball(catIconColor(String(key || '?')));
}
// 随机一个图标 key；oldKey=要换掉的旧 key，used=已占用的 key（尽量不重复）
function randomPokeIconKey(oldKey, used) {
  let pool = POKE_ICON_KEYS.filter(k => k !== oldKey && !(used && used.has(k)));
  if (!pool.length) pool = POKE_ICON_KEYS.filter(k => k !== oldKey);
  if (!pool.length) pool = POKE_ICON_KEYS;
  return pool[Math.floor(Math.random() * pool.length)];
}
