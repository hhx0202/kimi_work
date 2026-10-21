// ============================================================
// 佑佑 任务岛 - 主程序
// ============================================================

// confetti 安全包装（CDN 加载失败时静默降级，不影响功能）
const confetti = (...args) => window.confetti ? window.confetti(...args) : null;

// ---------- 演示模式隔离 ----------
// 进入演示模式后 localStorage 里写 km_demo=1，所有数据键改用 kmd_ 前缀，与真实数据完全隔离
const DEMO_ACTIVE = (() => { try { return localStorage.getItem('km_demo') === '1'; } catch { return false; } })();
const LK = k => (DEMO_ACTIVE ? 'kmd_' : 'km_') + k;

// 本次会话内已发放的全清奖励 key（必选全清_日期 / 可选全清_日期），防并发打卡重复发；刷新后由 DB 重新加载判定
const awardLocked = new Set();

// ---------- 全局状态 ----------
const S = {
  role: localStorage.getItem(LK('role')) || 'kid',   // kid | parent
  tab: 'tasks',
  tasks: [],            // 全部任务
  logs: {},             // 'YYYY-MM-DD' -> { taskId: completed }
  pokemons: [],
  leadId: Number(localStorage.getItem(LK('lead'))) || null,
  pointLogs: [],
  balance: 0,
  balls: 0,
  shinyCards: 0,        // ✨ 闪耀卡库存
  viewNote: null,       // 孩子端当前查看日期的叮嘱
  parentNote: null,     // 家长端当前查看日期的叮嘱
  // 家长端
  pmId: null,           // 正在操作的宝可梦
  calOffset: 0,         // 日历偏移(月)
  statDim: 'all',       // 完成统计/打卡日历维度（孩子端）
  parentDate: null,     // 家长端当前查看/布置的日期，默认今天
  // 孩子端查看的日期（历史查看用，默认今天）
  viewDate: null,       // 'YYYY-MM-DD'，启动时置为今天
};

// 家长可在「规则设置」里动态调整的数值项（对应 config.js 的键）
const SETTING_FIELDS = [
  { key: 'REQUIRED_DONE_BONUS', label: '必做全清奖（分）' },
  { key: 'OPTIONAL_DONE_BONUS', label: '选做全清奖（分）' },
  { key: 'WEEKLY_DONE_BONUS', label: '多日任务完成奖（分）' },
  { key: 'OVERDUE_DAILY_PENALTY', label: '多日超期每日扣分' },
  { key: 'MAX_POINTS_PER_TASK', label: '单任务积分上限' },
  { key: 'BALL_PRICE', label: '买一个球的价格（分）' },
  { key: 'LEAD_EXP_PER_TASK', label: '出战宝可梦每任务经验' },
  { key: 'POINTS_TO_EXP', label: '1 积分可换经验' },
  { key: 'EVO_EXP_1', label: '进化第1段所需经验' },
  { key: 'EVO_EXP_2', label: '进化第2段所需经验' },
  { key: 'SHINY_EXP', label: '进入闪耀形态所需经验' },
  { key: 'STREAK_DAYS_FOR_BALL', label: '连续几天必做全清' },
  { key: 'STREAK_REWARD_SHINY', label: '达标送几张闪耀卡' },
  { key: 'MAKEUP_DAYS', label: '单次任务可补几天' },
];

// 补卡：允许给最近 N 天（不含今天）漏掉的「单次任务」补完成；补交不发当天全清奖
function makeupDays() { return Math.max(0, Number(CONFIG.MAKEUP_DAYS) || 0); }
function isMakeupDate(date) {
  const n = makeupDays();
  if (!n || !date) return false;
  const today = DB.today();
  return date < today && date > shiftDate(today, -n - 1);
}

// 日期工具
function shiftDate(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// 某任务在指定日期是否已完成
function logOn(taskId, date) { return !!(S.logs[date]?.[taskId]?.done); }
// 孩子是否已提交但家长尚未审批（按钮显示"已提交"按下态，卡片保持原位）
function isSubmitted(t) { const l = S.logs[S.viewDate]?.[t.id]; return !!(l && l.done && !l.approved); }
// 是否已审批完成（家长确认加分后）
function isApprovedDone(t) { const l = S.logs[S.viewDate]?.[t.id]; return !!(l && l.done && l.approved); }

// 顶部趣味短句：宝可梦鼓励话 + 宝可梦小知识（适合小学生），共 100 条，按小时稳定换句，零网络依赖
const MOTTO = [
  // ===== 鼓励话 =====
  '坚持打卡，你的伙伴会越来越强！⚡',
  '每完成一个任务，宝可梦就离进化更近一步！',
  '每天把必做任务做完，也许会有宝可梦闪闪发光！✨',
  '精灵球攒够了，就去捕捉新的伙伴吧！',
  '喂饱你的宝可梦，它会回报你更多经验！',
  '今天的任务做完，明天就能捉新宝可梦！',
  '每只宝可梦都在等你点亮它的图鉴格子！',
  '出战宝可梦每次完成任务都会获得经验哦！',
  '攒积分买精灵球，图鉴收集越多越开心！',
  '把必做任务全清，还有额外加分哦！',
  '选做任务全清也有加分，别小看它们！',
  '多日任务按时完成，奖励更丰厚！',
  '你的皮卡丘正在看着你完成今天的任务！',
  '图鉴每点亮一格，都是了不起的成就！',
  '每一分积分，都是你努力的小脚印！👣',
  '把今天的任务点亮，成就感满满！💡',
  '宝可梦们在等你一起变得更棒！🌟',
  '坚持就是胜利，图鉴会记得你的努力！📖',
  '你的伙伴每次完成任务都在变强！⚔️',
  '完成全部必做任务，拿满全清奖励！🏆',
  '选做任务也别落下，积分多多！💰',
  '每天打卡，你的宝可梦都会为你骄傲！😊',
  '攒够球就去捕捉，图鉴越满越开心！🥚',
  '喂一颗糖果，你的伙伴离进化近一步！🍬',
  '别小看小任务，小步快跑也能赢！🏃',
  '必做任务连清一周，会有惊喜等着你！🎉',
  '今天的你，比昨天的你更厉害！💪',
  '每只宝可梦都有它的闪耀时刻！✨',
  '快去看看图鉴，又有新点亮了！🔆',
  '把任务都清完，今晚能安心睡好觉！😴',
  // ===== 宝可梦小知识 =====
  '皮卡丘脸颊的红色电袋能储存电力！⚡',
  '雷丘的电击威力能击穿一大块钢铁！⚡',
  '小火龙尾巴上的火焰，代表它此刻的心情！🔥',
  '火恐龙的尾巴火焰比小火龙更旺！🔥',
  '杰尼龟遇到危险会把头缩进壳里！🐢',
  '水箭龟背上有两门高压水炮！💦',
  '妙蛙种子背上的种子，据说会吸收阳光！🌱',
  '妙蛙花的香气据说能治愈心情！🌸',
  '绿毛虫嗅觉很灵敏，能找到喜欢的叶子！🍃',
  '铁甲蛹外壳很硬，但里面其实很软！🦋',
  '巴大蝶的翅膀可以散落剧毒粉末！🦋',
  '大针蜂的毒针连大树都能刺穿！🐝',
  '波波会用翅膀掀起沙尘来赶走敌人！🕊️',
  '比比鸟的视力非常好，能看清很远的猎物！🦅',
  '拉达的门牙很大，总想咬坏点东西！🐀',
  '阿柏蛇会吐出毒液吓退敌人！🐍',
  '六尾的名字来自"六根尾巴"的传说！🦊',
  '九尾的九根尾巴据说各有魔力！🦊',
  '胖丁唱歌时，听到的歌者会睡着！🎵',
  '大嘴蝠靠声波探路，几乎不用眼睛！👂',
  '霸王花的花粉会让过敏的人打喷嚏！🌺',
  '地鼠钻地超快，一眨眼就不见了！🐭',
  '猫老大很骄傲，最喜欢被夸漂亮！😼',
  '可达鸭头痛时会释放强大的念力！🤔',
  '哥达鸭游泳的速度非常快！🦆',
  '火爆猴脾气很爆，一点就着！🐒',
  '卡蒂狗嗅觉灵敏，很会追坏人！🐕',
  '风速狗是传说中非常忠诚的宝可梦！🐕',
  '蚊香泳士肌肉发达，是游泳冠军！🐸',
  '凯西整天打盹，靠超能力感知四周！🧘',
  '胡地的智商据说高达 5000！🧠',
  '怪力有四只手臂，力大无穷！💪',
  '大食花会张开大嘴一口吞掉猎物！🌿',
  '毒刺水母的触手有毒，碰不得！🪼',
  '小拳石喜欢滚来滚去，越滚越圆！🪨',
  '隆隆岩从山上滚下来会越滚越大！⛰️',
  '小火马的鬃毛会像火焰一样飘动！🔥',
  '烈焰马奔跑时身后拖着火焰！🏇',
  '呆呆兽的尾巴被咬住时居然不会松口！🐟',
  '呆壳兽的壳据说有剧毒，但它自己不怕！🐌',
  '三合一磁怪由三个磁体组成，磁性超强！🧲',
  '大葱鸭手里总是握着一根大葱！🦆',
  '嘟嘟利有三个头，各自有自己的想法！🐦',
  '白海狮在冰水里游泳也不会冷！🦭',
  '臭臭泥味道很难闻，但特别黏人！🧪',
  '大舌贝的壳像珍珠一样又亮又硬！🦪',
  '刺甲贝会紧紧合上贝壳保护自己！🦪',
  '鬼斯是气体一样的幽灵宝可梦！👻',
  '耿鬼会藏在别人的影子里！👻',
  '大岩蛇全身都是岩石，坚硬无比！⛰️',
  '催眠貘会吃掉别人的梦！😴',
  '大钳蟹的两只大钳子力气惊人！🦀',
  '顽皮雷弹一碰就会爆炸，要小心！💥',
  '蛋蛋们聚在一起，很像一串葡萄！🥚',
  '椰蛋树有很多头，每个头都有自己的想法！🥥',
  '卡拉卡拉总抱着一根骨头当武器！🦴',
  '嘎啦嘎啦手里的骨棒是它的武器！🦴',
  '飞腿郎用腿踢击，脚力惊人！🥋',
  '快拳郎是拳击冠军，出拳飞快！🥊',
  '大舌头的舌头特别长，能伸很远！👅',
  '双弹瓦斯是两个瓦斯球叠在一起！💨',
  '钻角犀兽的角能轻松钻穿岩石！🦏',
  '吉利蛋的蛋据说是治疗百病的良药！🥚',
  '袋兽妈妈的口袋里有一只小袋兽！🦘',
  '墨海马在水里会轻轻地跳舞！🐴',
  '海刺龙身上的尖刺是有毒的！🦔',
  '角金鱼的鳞片在阳光下闪闪发光！🐠',
  '宝石海星中间的宝石据说很神秘！⭐',
  '魔墙人偶能变出一堵看不见的墙！🤡',
  '飞天螳螂的两把镰刀锋利无比！🦗',
  '迷唇姐唱起歌来很动听！💋',
  '电击兽全身都能释放高压电！⚡',
  '鸭嘴火兽嘴巴附近的温度非常高！🔥',
  '凯罗斯有大钳子和一对大角！🪲',
  '肯泰罗是特别有冲劲的公牛！🐂',
  '鲤鱼王虽然弱，进化成暴鲤龙超厉害！🐉',
  '暴鲤龙是鲤鱼王进化来的，很凶！🐉',
  '拉普拉斯会驮着人安稳渡过大海！🐋',
  '百变怪能变成任何宝可梦的样子！🎭',
  '伊布能进化成好几种属性的宝可梦！🐾',
  '水伊布在水里游得特别快！💧',
  '雷伊布的毛刺能噼里啪啦发电！⚡',
  '火伊布浑身的毛像燃烧的火焰！🔥',
  '多边兽是程序制造出来的人工宝可梦！💻',
  '化石盔是从化石里复原的古代宝可梦！🪸',
  '化石翼龙是生活在远古的飞行宝可梦！🦖',
  '卡比兽每天要睡 18 个小时！😴',
  '急冻鸟是冰系的神鸟，翅膀带寒气！❄️',
  '闪电鸟扇动翅膀就能带来雷暴！⛈️',
  '火焰鸟是火系的神鸟，燃着烈焰！🔥',
  '快龙速度极快，传说能环绕地球一周！🐲',
  '超梦是科学家制造出来的强大宝可梦！🧬',
  '梦幻据说拥有所有宝可梦的基因！✨',
];
// 顶部短句：按「当前小时」稳定选一句（同一小时内不变，每小时换新句，不会一直闪换）
function mottoText() {
  const now = new Date();
  const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return MOTTO[h % MOTTO.length];
}

const TPL = [ // 常用任务模板
  { title: '语文作业', category: '作业', points: 10 },
  { title: '数学作业', category: '作业', points: 10 },
  { title: '英语作业', category: '作业', points: 10 },
  { title: '跳绳 500 个', category: '打卡', points: 5 },
  { title: '阅读 20 分钟', category: '打卡', points: 5 },
  { title: '练字一页', category: '打卡', points: 5 },
  { title: '口算一页', category: '作业', points: 5 },
  { title: '背单词 10 个', category: '打卡', points: 5 },
];

// ---------- 属性主题（卡牌边框色 + 场景背景 + 技能） ----------
const TYPE_THEME = {
  normal:   { name: '一般', color: '#a8a878', bg1: '#eceadf', bg2: '#a8a878', skill: '撞击', damage: 20, desc: '用身体撞向对手，简单又可靠。' },
  fire:     { name: '火',   color: '#f08030', bg1: '#ffd9b8', bg2: '#e25822', skill: '喷射火焰', damage: 80, desc: '喷出灼热的火焰，让对手无处可逃。' },
  water:    { name: '水',   color: '#6890f0', bg1: '#cfe0ff', bg2: '#3b5fc0', skill: '水炮', damage: 70, desc: '喷射高压水流，冲击力惊人。' },
  electric: { name: '电',   color: '#f8d030', bg1: '#fff3c4', bg2: '#b89b1a', skill: '十万伏特', damage: 60, desc: '释放强烈的电流，闪耀金色雷光。' },
  grass:    { name: '草',   color: '#78c850', bg1: '#d9f2c2', bg2: '#4a8f2b', skill: '飞叶快刀', damage: 50, desc: '甩出锋利的叶片，像刀一样切割。' },
  ice:      { name: '冰',   color: '#98d8d8', bg1: '#e8fafa', bg2: '#5bc0c0', skill: '冰冻光束', damage: 60, desc: '射出寒气，把对手冻成冰雕。' },
  fighting: { name: '格斗', color: '#c03028', bg1: '#f0c8c8', bg2: '#8f1d14', skill: '百万吨拳', damage: 90, desc: '汇聚全身力量的一记重拳。' },
  poison:   { name: '毒',   color: '#a040a0', bg1: '#e0c8e0', bg2: '#6a236a', skill: '毒液冲击', damage: 50, desc: '喷出有毒的液体，让对手中毒。' },
  ground:   { name: '地面', color: '#e0c068', bg1: '#f5e8c8', bg2: '#8a6d1d', skill: '地震', damage: 100, desc: '引发大地震，撼动整个战场。' },
  flying:   { name: '飞行', color: '#a890f0', bg1: '#e0d8ff', bg2: '#5a3bb0', skill: '翅膀攻击', damage: 45, desc: '扇动翅膀，从空中俯冲攻击。' },
  psychic:  { name: '超能', color: '#f85888', bg1: '#ffd6e0', bg2: '#b0183e', skill: '精神强念', damage: 70, desc: '用意念扭曲空间，直接打击心灵。' },
  bug:      { name: '虫',   color: '#a8b820', bg1: '#e8f0c8', bg2: '#5a6512', skill: '虫鸣', damage: 50, desc: '发出刺耳鸣叫，扰乱对手。' },
  rock:     { name: '岩石', color: '#b8a038', bg1: '#f0e8c8', bg2: '#6a5c1d', skill: '岩石爆击', damage: 80, desc: '投出坚硬的岩石，砸向对手。' },
  ghost:    { name: '幽灵', color: '#705898', bg1: '#e0d8f0', bg2: '#3a2b56', skill: '暗影球', damage: 60, desc: '放出暗影能量球，吞噬一切。' },
  dragon:   { name: '龙',   color: '#7038f8', bg1: '#e0d8ff', bg2: '#3a1aa0', skill: '龙之波动', damage: 90, desc: '从口中喷出龙族能量的波动。' },
  steel:    { name: '钢',   color: '#b8b8d0', bg1: '#f0f0f8', bg2: '#5a5a70', skill: '金属爪', damage: 55, desc: '用金属化的爪子撕裂对手。' },
  fairy:    { name: '妖精', color: '#ee99ac', bg1: '#ffe0e8', bg2: '#a84a62', skill: '妖精之风', damage: 45, desc: '吹出梦幻的妖精之风。' },
};
const TYPE_COLOR = {}, TYPE_NAME = {};
Object.keys(TYPE_THEME).forEach(t => { TYPE_COLOR[t] = TYPE_THEME[t].color; TYPE_NAME[t] = TYPE_THEME[t].name; });

// ---------- 招式（每只 4 个，官方习得表筛选） ----------
const MOVE_CLASS = { physical: '物理', special: '特殊', status: '变化' };
// 取某只宝可梦的招式表；没有数据时返回空数组（回落到属性默认招式）
function movesOf(no) {
  const arr = (typeof PK_MOVES !== 'undefined' && PK_MOVES[no]) || null;
  if (!arr) return [];
  return arr.map(m => ({ name: m[0], type: m[1], power: m[2] || 0, cls: m[3] || 'status', desc: m[4] || '' }));
}
// 详情卡里的招式区（4 行紧凑列表，点一行展开说明）
function movesBlockHTML(no, theme) {
  const list = movesOf(no);
  if (!list.length) {
    return `<div class="ptcg-skill">
      <b><span class="ptcg-move" style="background:${theme.color}">${theme.skill}</span><em>${theme.damage}</em></b>
      <p>${theme.desc}</p>
    </div>`;
  }
  return `<div class="ptcg-moves">
    <div class="pmv-head">⚔️ 招式 <small>点一行看说明</small></div>
    ${list.map((m, i) => `
      <div class="pmv" data-mv="${i}">
        <span class="pmv-t" style="background:${TYPE_COLOR[m.type] || '#a8a878'}">${TYPE_NAME[m.type] || m.type}</span>
        <span class="pmv-n">${m.name}</span>
        <em class="pmv-p${m.power ? '' : ' none'}">${m.power || '—'}</em>
        <span class="pmv-c ${m.cls}">${MOVE_CLASS[m.cls] || ''}</span>
        ${m.desc ? `<p class="pmv-d">${m.desc}</p>` : ''}
      </div>`).join('')}
  </div>`;
}
// 点招式行展开/收起说明
function bindMoveClicks(ov) {
  ov.querySelectorAll('.ptcg-moves .pmv').forEach(row => {
    row.onclick = e => {
      e.stopPropagation();
      if (!row.querySelector('.pmv-d')) return;
      row.classList.toggle('open');
    };
  });
}

function pmType(no) { return (typeof PK_TYPES !== 'undefined' && PK_TYPES[no]) || 'normal'; }
function artworkPath(no) { return `assets/artwork/${no}.png`; }

const $ = id => document.getElementById(id);
const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------- 数据加载 ----------
async function refreshAll() {
  const vDate = S.viewDate || DB.today(), pDate = S.parentDate || DB.today();
  const [tasks, logs, pokemons, pointLogs, balls, shinyCards, vNote, pNote, settings] = await Promise.all([
    DB.getTasks(),
    DB.getLogsBetween('2000-01-01', '2099-12-31'),
    DB.getPokemons(),
    DB.getPointLogs(500),
    DB.getItemCount('ball'),
    DB.getItemCount('shiny'),
    DB.getNote(vDate),
    DB.getNote(pDate),
    DB.getSettings(),
  ]);
  // 家长设置的规则数值覆盖默认 config（只覆盖配置过的 key）
  Object.keys(settings || {}).forEach(k => { if (CONFIG[k] !== undefined && settings[k] !== '') CONFIG[k] = Number(settings[k]); });
  S.viewNote = vNote || null;
  S.parentNote = pNote || null;
  S.tasks = tasks;
  S.logs = {};
  logs.forEach(l => {
    const d = l.log_date;
    S.logs[d] = S.logs[d] || {};
    // approved=false 表示孩子已提交、待家长审批；旧数据/未迁移时默认视为已审批（true）
    S.logs[d][l.task_id] = { done: !!l.completed, progress: l.progress || 0, approved: l.approved === false ? false : true };
  });
  S.pokemons = pokemons;
  // 老数据兜底：pokedex_no 缺失/写错时按名字找回并回写（否则阶段角标会误标成「基础」）
  const badPms = S.pokemons.filter(p => { const no = pkNoOf(p); return no !== null && no !== Number(p.pokedex_no); });
  if (badPms.length) {
    await Promise.all(badPms.map(p => DB.updatePokemon(p.id, { pokedex_no: pkNoOf(p) })));
    badPms.forEach(p => { p.pokedex_no = pkNoOf(p); });
  }
  // 已封顶的闪耀形态宝可梦经验归零（修正历史遗留的溢出经验）
  const cappedPms = S.pokemons.filter(p => isMaxed(p) && p.exp);
  if (cappedPms.length) {
    await Promise.all(cappedPms.map(p => DB.updatePokemon(p.id, { exp: 0 })));
    cappedPms.forEach(p => { p.exp = 0; });
  }
  S.pointLogs = pointLogs;
  // 余额只算家长已确认发放的积分（confirmed=false 的"待确认"不计入）
  S.balance = pointLogs.reduce((s, l) => s + (l.confirmed === false ? 0 : l.amount), 0);
  S.balls = balls;
  S.shinyCards = shinyCards;   // ✨ 闪耀卡库存（只在连续必做全清领奖时产出，用一张让一只宝可梦多一张闪耀卡）
  if (S.leadId && !pokemons.some(p => p.id === S.leadId)) { S.leadId = null; localStorage.removeItem(LK('lead')); }
  // 有宝可梦但没选出战（演示数据/首次进入）→ 自动选第一只当伙伴，省得手动设置
  if (!S.leadId && pokemons.length) { S.leadId = pokemons[0].id; localStorage.setItem(LK('lead'), S.leadId); }
}

function activeTasks() { return S.tasks.filter(t => t.active); }

// 任务在某日期是否生效（start_date/end_date 均为空 = 一直生效）
function inEffect(t, d) {
  if (t.start_date && d < t.start_date) return false;
  if (t.end_date && d > t.end_date) return false;
  return true;
}

// 属性按日期取版本：编辑重复任务只对「今天及之后」生效，昨天及以前用 history 里的旧属性快照渲染。
// history: [{ from, to, title, points, required, category, hint, schedule, start_date, end_date, parent_id }]，
// from/to 为闭区间（from 空 = 从最早开始；按顺序匹配，先命中的版本胜出）
function taskAttrFor(t, date) {
  const h = t.history;
  if (!Array.isArray(h) || !h.length || !date) return t;
  const v = h.find(x => (!x.from || date >= x.from) && (!x.to || date <= x.to));
  return v ? { ...t, ...v } : t;
}
// 编辑保存时调用：任务在昨天及以前已生效过，就把旧属性追加成历史快照（写进 patch.history）
function pushAttrHistory(t, next, patch) {
  const yesterday = shiftDate(DB.today(), -1);
  const hadPast = !t.start_date || t.start_date <= yesterday;   // 今天才布置的任务没有历史，随便改
  const attrsChanged =
    next.title !== (t.title || '') ||
    next.points !== t.points ||
    next.required !== (t.required !== false) ||
    next.category !== (t.category || '') ||
    (next.hint || '') !== (t.hint || '');
  const scheduleChanged = !!patch.schedule && patch.schedule !== t.schedule;
  if (!hadPast || (!attrsChanged && !scheduleChanged)) return false;
  const hist = Array.isArray(t.history) ? t.history.slice() : [];
  hist.push({
    from: t.start_date || '', to: yesterday,
    title: t.title || '', points: t.points, required: t.required !== false,
    category: t.category, hint: t.hint || null,
    schedule: t.schedule, start_date: t.start_date || null, end_date: t.end_date || null,
    parent_id: t.parent_id || null,
  });
  patch.history = hist;
  return true;
}

// 某日期的常规任务 = 每日/单次/子任务 且在生效日期范围内（不管 active，已完成/待审核都保留展示）
// 先取该日期的属性版本，再判是否生效/展示（这样编辑改名改分不会串到历史日期）
function tasksOnDate(date) {
  return S.tasks
    .map(t => taskAttrFor(t, date))
    .filter(t => (t.schedule === 'daily' || t.schedule === 'once' || t.schedule === 'child') && inEffect(t, date));
}
// 今日常规任务
function todayTasks() { return tasksOnDate(DB.today()); }
// 某日期用于「进度条/全清判定」的任务集合：每日/单次/子任务 且在生效期内。
// 任务不再因完成而下架，这里无需再用打卡记录找回；保留该兜底兼容历史已下架数据。
function dayTasksForProgress(date) {
  return S.tasks
    .map(t => taskAttrFor(t, date))
    .filter(t => {
      if (!(t.schedule === 'daily' || t.schedule === 'once' || t.schedule === 'child')) return false;
      if (!inEffect(t, date)) return false;
      if (t.active) return true;
      return !!(S.logs[date]?.[t.id]?.done);
    });
}
// 多日(长期)任务 = 父任务，各自带截止日期（不管 active，完成后保留展示）
function weeklyTasks() { return S.tasks.filter(t => t.schedule === 'weekly'); }
// 某父任务的子任务（含已完成，完成后保留展示）
function childTasks(parentId) { return S.tasks.filter(t => t.parent_id === parentId); }
// 某父任务的全部子任务（含已完成，用于进度统计）
function allChildTasks(parentId) { return S.tasks.filter(t => t.parent_id === parentId); }

function logToday(taskId) { return !!(S.logs[DB.today()]?.[taskId]?.done); }
// 该任务今天的加分是否还在"待家长确认"
function taskPending(taskId) {
  const d = DB.today();
  return S.pointLogs.some(l => l.log_date === d && l.task_id === taskId && l.confirmed === false);
}
// 子任务在父任务里的权重：优先分数；旧数据/演示数据可能全是 0 分，则退回 percent，最后按条数均分
function childWeight(k, mode) {
  if (mode === 'points') return k.points || 0;
  if (mode === 'percent') return k.percent || 0;
  return 1;
}
function childWeightMode(kids) {
  if (kids.some(k => (k.points || 0) > 0)) return 'points';
  if (kids.some(k => (k.percent || 0) > 0)) return 'percent';
  return 'count';
}
function taskProgress(taskId) { // 多日任务按子任务权重算进度；普通任务按 progress 累计
  const kids = allChildTasks(taskId);
  if (kids.length) {
    const mode = childWeightMode(kids);
    const total = kids.reduce((s, k) => s + childWeight(k, mode), 0);
    if (!total) return 0;
    let got = 0;
    kids.forEach(k => { if (isTaskDoneEver(k.id)) got += childWeight(k, mode); });
    return Math.min(100, Math.round(got / total * 100));
  }
  let sum = 0;
  for (const d in S.logs) { const l = S.logs[d][taskId]; if (l && l.progress) sum += l.progress; }
  return Math.min(100, sum);
}
function deadlineDaysLeft(deadline) {
  if (!deadline) return null;
  const a = new Date(DB.today()), b = new Date(deadline);
  return Math.ceil((b - a) / 86400000);
}
// 多日任务超期后每天自动扣分（从截止次日算起，补扣漏掉的天）
async function applyOverduePenalty() {
  const today = DB.today();
  let late = 0, latePts = 0;
  for (const t of weeklyTasks()) {
    if (!t.deadline || t.deadline >= today) continue;
    let d = shiftDate(t.deadline, 1);
    while (d <= today) {
      const reason = `多日超期:${t.title}`;
      if (!S.pointLogs.some(l => l.log_date === d && l.reason === reason)) {
        const pid = await DB.addPointLog(-CONFIG.OVERDUE_DAILY_PENALTY, reason, d);
        S.pointLogs.push({ id: pid, log_date: d, amount: -CONFIG.OVERDUE_DAILY_PENALTY, reason, confirmed: true });
        late++; latePts += CONFIG.OVERDUE_DAILY_PENALTY;
      }
      d = shiftDate(d, 1);
    }
  }
  S.balance = S.pointLogs.reduce((s, l) => s + (l.confirmed === false ? 0 : l.amount), 0);
  if (late) pushNotice('minus', `多日任务超期，自动扣了 ${latePts} 积分`, '请在截止日期前完成任务哦');
}

// ---------- 计算：全清 / 连击 ----------
function isAllDone(dates) {
  const ts = dayTasksForProgress(dates);
  if (!ts.length) return false;
  return ts.every(t => S.logs[dates]?.[t.id]?.done === true);
}
// 某天「必做任务是否全部完成」：和进度条同一个分母（dayTasksForProgress），口径不会打架
function reqDayDone(date) {
  const ts = dayTasksForProgress(date).filter(t => t.required !== false);
  if (!ts.length) return false;                 // 没有必做任务的一天不算「必做全清」
  return ts.every(t => S.logs[date]?.[t.id]?.done === true);
}
// 连续几天「必做全清」：今天还没做完就从昨天开始数，进度条不会一到零点就归零
function reqStreakDays() {
  const today = DB.today();
  const d = new Date(today + 'T00:00:00');
  if (!reqDayDone(today)) d.setDate(d.getDate() - 1);
  let n = 0;
  for (let i = 0; i < 400; i++) {
    if (!reqDayDone(fmtDate(d))) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
function calcStreak() { return reqStreakDays(); }
// 本轮（上次领奖之后）已经连了几天必做全清
const K_STREAK_CLAIM = LK('streak_claim');
function streakClaimedOn() { return lsGet(K_STREAK_CLAIM, '') || ''; }
function streakCycleDays() {
  const stop = streakClaimedOn();
  const today = DB.today();
  const d = new Date(today + 'T00:00:00');
  if (!reqDayDone(today)) d.setDate(d.getDate() - 1);
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const ds = fmtDate(d);
    if (stop && ds <= stop) break;              // 领过的那天之前不算新一轮
    if (!reqDayDone(ds)) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
function streakGoal() { return Math.max(1, Number(CONFIG.STREAK_DAYS_FOR_BALL) || 7); }
function shinyReward() { return Math.max(1, Number(CONFIG.STREAK_REWARD_SHINY) || 1); }
// 某任务的连续打卡天数（从今天往前连续完成）
function taskStreak(taskId) {
  let n = 0;
  const d = new Date(DB.today() + 'T00:00:00');
  for (let i = 0; i < 730; i++) {
    const ds = fmtDate(d);
    const l = S.logs[ds] && S.logs[ds][taskId];
    if (l && (l.done || l.completed)) { n++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return n;
}
// 维度文案：体现「必做/选做任务全清」；单任务维度显示任务名
function statDimLabel(dim) {
  if (dim === 'req') return '必做任务全清';
  if (dim === 'opt') return '选做任务全清';
  if (dim && dim !== 'all') { const t = S.tasks.find(x => x.id === Number(dim)); return t ? t.title : '全部每日任务'; }
  return '全部每日任务';
}
// 完成统计：累计 / 近一周 / 近一月（只统计「每日打卡」任务，单次/多日/子任务不算打卡）
function doneStats(dim = 'all') {
  const today = DB.today();
  const wStart = shiftDate(today, -6), mStart = shiftDate(today, -29);
  // 维度：all=全部每日 / req=必做全清 / opt=选做全清 / 任务id=单个重复任务
  let tasks = S.tasks.filter(t => t.schedule === 'daily');
  if (dim === 'req') tasks = tasks.filter(t => t.required !== false);
  else if (dim === 'opt') tasks = tasks.filter(t => t.required === false);
  else if (dim && dim !== 'all') tasks = tasks.filter(t => t.id === Number(dim));
  const ids = new Set(tasks.map(t => t.id));
  let total = 0, week = 0, month = 0;
  for (const d in S.logs) {
    let n = 0;
    for (const tid in S.logs[d]) { const l = S.logs[d][tid]; if (ids.has(Number(tid)) && l && (l.completed || l.done)) n++; }
    if (!n) continue;
    total += n;
    if (d >= wStart) week += n;
    if (d >= mStart) month += n;
  }
  return { total, week, month };
}

// ---------- 打卡 ----------
// 后台执行数据库写入：本地已乐观更新（按钮/提示立即响应），这里只负责落库；
// 数据库异常时弹错误提示，不阻塞界面。
function bgWrite(desc, fn) {
  Promise.resolve().then(fn).catch(err => {
    console.error(`[bgWrite:${desc}]`, err);
    toast(`⚠️ ${desc}保存失败，请刷新确认`);
    if (typeof reportError === 'function') reportError('db', `${desc}保存失败`, err && (err.stack || err.message) || String(err), '');
  });
}

async function checkin(taskId, btn, progress = null) {
  const rawTask = S.tasks.find(t => t.id === taskId);
  if (!rawTask) return;
  const today = DB.today();
  // 补卡：翻到补卡窗口内的历史日期时，记录写到那一天（day = 实际记账日期）
  const makeupMode = S.viewDate !== today && isMakeupDate(S.viewDate);
  const day = makeupMode ? S.viewDate : today;
  // 补交历史日期时用那天的属性版本（当时的名称/分值），别把今天改过的新分值算到过去
  const task = makeupMode ? taskAttrFor(rawTask, day) : rawTask;
  if (logOn(taskId, day)) return;
  if (task.schedule === 'once' && isTaskDoneEver(taskId)) { toast('这个任务已经完成过啦'); return; }

  // ===== 子任务打卡（独立计分，多日任务的一部分）=====
  // 和 daily/once 一致走"提交-审批"：approved=false，任务留卡片显示「已提交」，审批通过后仍保留展示
  if (task.parent_id) {
    // 乐观更新：先改本地状态立即反馈，数据库写放后台
    S.logs[day] = S.logs[day] || {};
    S.logs[day][taskId] = { done: true, progress: 0, approved: false };
    const pts = task.points || 0;
    const parent = S.tasks.find(t => t.id === task.parent_id);
    const total = parent ? taskProgress(parent.id) : taskProgress(taskId);
    const fullKey = parent ? `多日完成奖:${parent.title}` : '';
    const full = total >= 100 && parent && !S.pointLogs.some(l => l.reason === fullKey) && !awardLocked.has(fullKey);
    if (full) awardLocked.add(fullKey);
    const card = btn ? btn.closest('.task-card') : null;
    if (card) card.classList.add('just-done');
    // 提交后不下架，审批通过后也不下架（任务保留在列表展示完成状态）
    if (full) {
      const bonus = parent.bonus || CONFIG.WEEKLY_DONE_BONUS;
      confetti({ particleCount: 120, spread: 100, origin: { y: .5 } });
      toast(`🎉 多日任务「${parent.title}」已全部提交！${bonus > 0 ? '+' + bonus + '分' : ''}（待家长确认）`);
    } else {
      confetti({ particleCount: 40, spread: 60, scalar: .8, origin: { y: .5 } });
      toast(`📝 「${task.title}」已提交，等家长确认～「${parent ? parent.title : ''}」进度 ${total}%`);
    }
    renderTop(); renderProgress(); renderTasks();
    // 后台落库：打卡记录 + 积分 + 经验 + 多日完成奖（full 已在同步阶段锁定）
    // 这些写入互不依赖，并发发出（跨境网络下串行会累加成好几秒）
    bgWrite('打卡', async () => {
      const lead = S.leadId ? S.pokemons.find(p => p.id === S.leadId) : null;
      const bonus = full ? (parent.bonus || CONFIG.WEEKLY_DONE_BONUS) : 0;
      const [, pid, , bpid] = await Promise.all([
        DB.setLog(taskId, day, true, null, null, false),
        pts > 0 ? DB.addPointLog(pts, `完成:${task.title}`, day, { confirmed: false, task_id: taskId }) : null,
        lead ? grantExp(lead, CONFIG.LEAD_EXP_PER_TASK) : null,
        (full && bonus > 0) ? DB.addPointLog(bonus, `多日完成奖:${parent.title}`, day, { confirmed: false }) : null,
      ]);
      if (pts > 0 && pid != null) S.pointLogs.push({ id: pid, log_date: day, amount: pts, reason: `完成:${task.title}`, confirmed: false, task_id: taskId });
      if (bpid != null) S.pointLogs.push({ id: bpid, log_date: day, amount: bonus, reason: `多日完成奖:${parent.title}`, confirmed: false });
    });
    return;
  }

  // ===== 进度型打卡（带百分比按钮的普通进度任务）=====
  if (progress) {
    // 乐观更新：先改本地状态立即反馈，数据库写放后台
    S.logs[day] = S.logs[day] || {};
    S.logs[day][taskId] = { done: true, progress };

    const parent = task.parent_id ? S.tasks.find(t => t.id === task.parent_id) : null;
    const ptsSource = parent || task;
    const pts = Math.round(ptsSource.points * progress / 100);
    const label = parent ? parent.title : task.title;
    const total = parent ? taskProgress(parent.id) : taskProgress(taskId);
    // 完成 100% 后不再下架任务，保留在列表里展示完成状态
    if (total >= 100) {
      confetti({ particleCount: 110, spread: 90, origin: { y: .5 } });
      toast(`🎉 「${label}」完成！`);
    } else {
      toast(`⏰ 「${label}」已完成 ${total}%，还差 ${100 - total}%`);
    }
    renderTop(); render();
    // 后台落库：打卡记录 + 积分 + 经验（并发发出，互不依赖）
    bgWrite('打卡', async () => {
      const lead = S.leadId ? S.pokemons.find(p => p.id === S.leadId) : null;
      const [, pid] = await Promise.all([
        DB.setLog(taskId, day, true, null, progress),
        // 待家长确认后发放：先记"待确认"流水，余额不变
        pts > 0 ? DB.addPointLog(pts, `完成:${label} ${progress}%`, day, { confirmed: false, task_id: taskId }) : null,
        lead ? grantExp(lead, CONFIG.LEAD_EXP_PER_TASK) : null,
      ]);
      if (pts > 0 && pid != null) S.pointLogs.push({ id: pid, log_date: day, amount: pts, reason: `完成:${label} ${progress}%`, confirmed: false, task_id: taskId });
    });
    return;
  }

  // ===== 常规打卡（孩子提交，待家长审批） =====
  // 提交：approved=false，任务仍保留在页面上展示为「已提交」，待家长审批后才标记完成
  // 乐观更新：先改本地状态立即反馈，数据库写放后台
  S.logs[day] = S.logs[day] || {};
  S.logs[day][taskId] = { done: true, progress: 0, approved: false };

  // 注意：提交后不下架任务，审批通过后任务也保留在列表里展示完成状态

  // 全清判定 + 奖励（必做/选做分开）；补卡只拿任务本身的分，不参与当天的全清奖
  const dayTasks = dayTasksForProgress(day);
  const reqTasks = dayTasks.filter(t => t.required !== false);
  const optTasks = dayTasks.filter(t => t.required === false);
  const isDayDone = arr => arr.length > 0 && arr.every(t => S.logs[day]?.[t.id]?.done === true);
  const reqDone = isDayDone(reqTasks);
  const optDone = isDayDone(optTasks);
  // 全清奖励每日只发一次：同步阶段锁定（内存 Set，避免本次会话内并发打卡重复发）
  const awardReq = !makeupMode && reqDone && !S.pointLogs.some(l => l.reason === `必选全清_${day}`) && !awardLocked.has(`必选全清_${day}`);
  const awardOpt = !makeupMode && optDone && !S.pointLogs.some(l => l.reason === `可选全清_${day}`) && !awardLocked.has(`可选全清_${day}`);
  if (awardReq) awardLocked.add(`必选全清_${day}`);
  if (awardOpt) awardLocked.add(`可选全清_${day}`);

  // 7 天必做全清达标：这里只庆祝 + 提示，奖励改成在最下方进度条点「领取」（不再自动发）
  let celebrating = false;
  if (awardReq) {
    if (streakCycleDays() >= streakGoal()) {
      celebrating = true;
      showStreakReady();   // 不 await：庆祝动画播着，后面的任务卡/进度条照常刷新
    } else {
      confetti({ particleCount: 90, spread: 80, origin: { y: .6 } });
      toast(`🎉 今日必做任务全部完成！+${CONFIG.REQUIRED_DONE_BONUS}（待家长确认）`);
    }
  }
  if (awardOpt) {
    confetti({ particleCount: 50, spread: 60, origin: { y: .5 } });
    toast(`🎁 选做任务也全部完成！+${CONFIG.OPTIONAL_DONE_BONUS}（待家长确认）`);
  }

  // 提交反馈（不下架、不显示"已完成"，保持"已提交"态，等待家长审批）
  const card = btn ? btn.closest('.task-card') : null;
  if (card) card.classList.add('just-done');
  confetti({ particleCount: 40, spread: 60, scalar: .8, origin: { y: .5 } });
  if (!celebrating) toast(makeupMode
    ? `⏪ 已补交 ${day.slice(5)} 的「${task.title}」，等家长确认～（补卡不发全清奖）`
    : `📝 「${task.title}」已提交，等家长确认～`);
  renderTop();
  renderProgress();
  renderTasks();

  // 后台落库：打卡记录 + 积分 + 经验 + 全清奖励（awardReq/awardOpt 已在同步阶段锁定）
  // 最多 5 次写库互不依赖 → 并发发出，跨境网络下从"5 次往返相加"变成"1 次往返"
  bgWrite('打卡', async () => {
    const lead = S.leadId ? S.pokemons.find(p => p.id === S.leadId) : null;
    const [, pid, , rpid, opid] = await Promise.all([
      DB.setLog(taskId, day, true, null, null, false),
      // 加分先记"待确认"流水，家长审批后才到账（余额不变）
      DB.addPointLog(task.points, `完成:${task.title}`, day, { confirmed: false, task_id: taskId }),
      // 出战宝可梦加经验
      lead ? grantExp(lead, CONFIG.LEAD_EXP_PER_TASK) : null,
      awardReq ? DB.addPointLog(CONFIG.REQUIRED_DONE_BONUS, `必选全清_${day}`, day, { confirmed: false }) : null,
      awardOpt ? DB.addPointLog(CONFIG.OPTIONAL_DONE_BONUS, `可选全清_${day}`, day, { confirmed: false }) : null,
    ]);
    S.pointLogs.push({ id: pid, log_date: day, amount: task.points, reason: `完成:${task.title}`, confirmed: false, task_id: taskId });
    if (rpid != null) S.pointLogs.push({ id: rpid, log_date: day, amount: CONFIG.REQUIRED_DONE_BONUS, reason: `必选全清_${day}`, confirmed: false });
    if (opid != null) S.pointLogs.push({ id: opid, log_date: day, amount: CONFIG.OPTIONAL_DONE_BONUS, reason: `可选全清_${day}`, confirmed: false });
  });
}

// ---------- 撤销提交（孩子再点"已提交"） ----------
async function cancelSubmission(taskId) {
  const today = DB.today();
  const day = S.viewDate;
  // 今天随时可撤；补卡窗口内的历史日期只允许撤单次任务的提交（撤了还能再补交）
  if (day !== today && !isMakeupDate(day)) { toast('只能撤销今天或补卡期内的提交'); return; }
  const task = S.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (day !== today && task.schedule !== 'once') { toast('补卡只支持单次任务'); return; }
  // 先在本地清掉提交状态和待确认积分，后面的判定（父任务进度、全清）都按新状态算
  const pend = S.pointLogs.filter(l => l.task_id === taskId && l.log_date === day && l.confirmed === false);
  S.pointLogs = S.pointLogs.filter(l => !pend.some(p => p.id === l.id));
  if (S.logs[day]) S.logs[day][taskId] = { done: false, progress: 0, approved: true };
  // 撤销子任务提交后，若父任务进度回落 < 100%，回收尚未发放的多日完成奖
  const parent = task.parent_id ? S.tasks.find(t => t.id === task.parent_id) : null;
  const bonusPend = (parent && taskProgress(parent.id) < 100)
    ? S.pointLogs.filter(l => l.confirmed === false && l.reason === `多日完成奖:${parent.title}`)
    : [];
  if (bonusPend.length) {
    S.pointLogs = S.pointLogs.filter(l => !bonusPend.some(p => p.id === l.id));
    awardLocked.delete(`多日完成奖:${parent.title}`);
  }
  // 删除待确认积分 + 清打卡状态：互不依赖 → 并发发出
  await Promise.all([
    ...pend.map(l => DB.deletePointLog(l.id)),
    ...bonusPend.map(l => DB.deletePointLog(l.id)),
    DB.setLog(taskId, day, false, null, null, true),
  ]);
  // 撤销后若不再全清，回收还未发放的对应待确认奖励
  await cleanupAllClearPending(day);
  toast('已撤销提交');
  renderTop();
  renderProgress();
  renderTasks();
}

// 撤销提交后，若必做/选做不再全清，回收尚未发放的待确认全清奖励
async function cleanupAllClearPending(date) {
  const dayTasks = dayTasksForProgress(date);
  const reqTasks = dayTasks.filter(t => t.required !== false);
  const optTasks = dayTasks.filter(t => t.required === false);
  const isDayDone = arr => arr.length > 0 && arr.every(t => S.logs[date]?.[t.id]?.done === true);
  const reqDone = isDayDone(reqTasks), optDone = isDayDone(optTasks);
  const drop = [];
  if (!reqDone) drop.push(`必选全清_${date}`);
  if (!optDone) drop.push(`可选全清_${date}`);
  if (!drop.length) return;
  const pend = S.pointLogs.filter(l => l.confirmed === false && drop.includes(l.reason));
  await Promise.all(pend.map(l => DB.deletePointLog(l.id)));   // 并发删除，别再一条一条等
  S.pointLogs = S.pointLogs.filter(l => !pend.some(p => p.id === l.id));
  // 释放本次会话的锁定，撤销后重新达成全清仍可再发
  drop.forEach(key => awardLocked.delete(key));
}

// ---------- 经验 / 进化（不再有等级，经验满一管即进化） ----------
// 下一阶进化目标：单线用 e，分支（伊布）用 ev 数组
function evoTargets(no) {
  const info = PK_BY_NO[no];
  if (!info) return [];
  if (info.ev && info.ev.length) return info.ev.slice();
  return info.e ? [info.e] : [];
}
function hasNextEvo(no) { return evoTargets(no).length > 0; }
// 祖先链：从最初形态一路到自己（含自己）
function evoAncestors(no) {
  const list = [no];
  let cur = no, guard = 0;
  while (PK_EVOLVE_FROM[cur] !== undefined && guard++ < 20) { cur = PK_EVOLVE_FROM[cur]; list.unshift(cur); }
  return list;
}
// 所有后代形态（分支全部展开）
function evoDescendants(no) {
  const out = [];
  const walk = n => evoTargets(n).forEach(t => { out.push(t); walk(t); });
  walk(no);
  return out;
}
function expThreshold(pm) {
  if (!hasNextEvo(pm.pokedex_no)) return CONFIG.SHINY_EXP;   // 没有后续进化：攒满即进入闪耀形态
  const stage = evoStage(pm.pokedex_no);
  if (stage === 0) return CONFIG.EVO_EXP_1;       // 基础形态
  if (stage === 1) return CONFIG.EVO_EXP_2;       // 一阶形态
  return CONFIG.SHINY_EXP;                        // 二阶（最终）形态：再攒满即进入闪耀形态
}
// 是否已经有这只（同名编号）的闪耀卡
function hasShinyCopy(no) { return S.pokemons.some(p => p.pokedex_no === no && p.shiny); }
// 闪耀形态统一「额外多一张卡」：原来的普通卡留着，另建一张 ✨ 卡（和演示数据里 ‹皮卡丘 + ✨皮卡丘› 一致）
async function addShinyCopy(pm) {
  const copy = await DB.addPokemon({ pokedex_no: pm.pokedex_no, shiny: true });
  S.pokemons.push(copy);
  return copy;
}
// 是否已封顶：闪耀形态且没有后续进化（基础/一阶的闪耀形态还能继续进化，不算封顶）
function isMaxed(pm) {
  if (!pm.shiny) {
    // 已经有同编号闪耀卡的普通卡：不再吃经验，否则会一直「经验满」却进化不了
    return !!PK_BY_NO[pm.pokedex_no] && !hasNextEvo(pm.pokedex_no) && hasShinyCopy(pm.pokedex_no);
  }
  if (!PK_BY_NO[pm.pokedex_no]) return false;
  if (!hasNextEvo(pm.pokedex_no)) return true;      // 没有后续进化：闪耀形态即最终形态
  return evoStage(pm.pokedex_no) >= 2;              // 二阶（最终形态）闪耀形态即封顶
}
// 进化阶段标签：✨ / 基础 / 一阶 / 二阶
function evoStageLabel(pm) {
  if (pm.shiny) return '✨';
  const no = pkNoOf(pm);                 // 旧数据 pokedex_no 缺失时按名字找回，避免误标「基础」
  if (no === null) return '基础';
  const s = evoStage(no);
  return s === 0 ? '基础' : (s === 1 ? '一阶' : '二阶');
}
// 下一管经验满时会怎样：进化 / 进入闪耀形态
function nextStageWord(pm) {
  if (!hasNextEvo(pm.pokedex_no)) return '闪耀';
  return evoStage(pm.pokedex_no) >= 2 ? '闪耀' : '进化';
}
async function grantExp(pm, exp) {
  if (isMaxed(pm)) return;   // 已进入闪耀形态并封顶：不再获得经验
  pm.exp += exp;
  await DB.updatePokemon(pm.id, { exp: pm.exp });
  // 经验满一管即进化/进入闪耀形态（自动触发，更有成就感）
  const c = canEvolve(pm);
  if (c.ok) await evolvePm(pm);
}

// ---------- 喂养 ----------
async function feedPm(pm, pts) {
  if (isMaxed(pm)) { hideModal(); toast(pm.shiny ? '它已经是闪耀形态（满级）啦，不需要再喂糖果～' : '它已经有闪耀卡啦，这张普通卡不用再喂～'); return; }
  pts = Math.floor(Number(pts) || 0);
  if (pts <= 0) { toast('请输入要喂的积分数'); return; }
  if (pts > S.balance) { toast(`积分不够啦，你最多只能喂 ${S.balance} 分`); return; }
  const pid = await DB.addPointLog(-pts, `喂养:${pm.name}`, DB.today());
  S.pointLogs.push({ id: pid, log_date: DB.today(), amount: -pts, reason: `喂养:${pm.name}` });
  S.balance -= pts;
  await grantExp(pm, pts * CONFIG.POINTS_TO_EXP);
  renderTop();
  hideModal();
  render();
  const card = document.querySelector(`.pm-card-mini[data-pmid="${pm.id}"]`);
  if (card) sparkleOn(card);
  // 喂完停在它的详情页（如果刚进化，显示的就是进化后的形态）
  if (S.role !== 'parent' && S.tab === 'pokemon') showCardDetail(pm);
}

// ---------- 进化 ----------
function evoStage(no) { // 0基础 1一段 2二段（祖先有几个就是第几阶）
  return Math.max(0, evoAncestors(no).length - 1);
}
function canEvolve(pm) {
  // 没有后续进化的宝可梦：经验满 SHINY_EXP 即进入闪耀形态
  if (!hasNextEvo(pm.pokedex_no)) {
    if (pm.shiny) return { ok: false };
    if (hasShinyCopy(pm.pokedex_no)) return { ok: false, why: '已拥有闪耀形态' };  // 别再重复生成闪耀卡
    return pm.exp >= CONFIG.SHINY_EXP ? { ok: true, shiny: true } : { ok: false, why: `经验 ${pm.exp}/${CONFIG.SHINY_EXP}` };
  }
  const stage = evoStage(pm.pokedex_no);
  const needExp = stage === 0 ? CONFIG.EVO_EXP_1 : CONFIG.EVO_EXP_2;  // 各段进化所需经验
  if (pm.exp < needExp) return { ok: false, why: `经验 ${pm.exp}/${needExp}` };
  return { ok: true, needExp, stage };
}
// 分支进化：让玩家选要进成哪一只（伊布）
function pickEvoTarget(pm, targets) {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'modal-mask';
    modal.innerHTML = `
      <div class="modal" style="max-width:420px;width:calc(100% - 40px)">
        <h3>✨ ${pm.name} 要进化成哪一只？</h3>
        <div class="form-hint" style="margin-top:6px">它有 ${targets.length} 种进化形态，选一只吧（经验已经够了）</div>
        <div class="evo-pick">
          ${targets.map(no => {
            const t = pmType(no);
            return `<button class="evo-pick-item" data-pick="${no}">
              <img src="${spritePath(no, false)}" alt="">
              <b>${PK_BY_NO[no].name}</b>
              <small style="color:${TYPE_COLOR[t] || '#888'}">${TYPE_NAME[t] || ''}</small>
            </button>`;
          }).join('')}
        </div>
        <div style="margin-top:12px;display:flex;gap:8px">
          <button class="btn-cancel" data-cancel style="flex:1">先不进化</button>
        </div>
      </div>`;
    const done = v => { modal.remove(); resolve(v); };
    modal.querySelectorAll('[data-pick]').forEach(b => { b.onclick = () => done(Number(b.dataset.pick)); });
    modal.querySelector('[data-cancel]').onclick = () => done(null);
    modal.addEventListener('click', e => { if (e.target === modal) done(null); });
    document.body.appendChild(modal);
  });
}
async function evolvePm(pm) {
  const c = canEvolve(pm);
  if (!c.ok) return;
  // 闪耀形态：最终形态再攒满一管 → 额外多一张闪耀卡（普通卡保留，和图鉴里的「皮卡丘 + ✨皮卡丘」一致）
  if (c.shiny) {
    const copy = await addShinyCopy(pm);
    await DB.updatePokemon(pm.id, { exp: 0 });
    pm.exp = 0;
    await showShiny(copy, `${pm.name} 经验满格，多了一张闪耀形态卡✨`);
    renderTop();
    render();
    return;
  }
  const fromNo = pm.pokedex_no;
  const targets = evoTargets(fromNo);
  if (!targets.length) return;
  let toNo = targets[0];
  if (targets.length > 1) {
    const picked = await pickEvoTarget(pm, targets);
    if (picked == null) return;        // 选择取消：经验保持不变，下次还能进
    toNo = picked;
  }
  // 进化消耗掉这管经验（不再花积分，越往后进化需要越多经验）
  const leftExp = pm.exp - c.needExp;
  await DB.updatePokemon(pm.id, { pokedex_no: toNo, name: (pm.shiny ? '✨' : '') + PK_BY_NO[toNo].name, exp: leftExp });
  pm.pokedex_no = toNo; pm.name = (pm.shiny ? '✨' : '') + PK_BY_NO[toNo].name; pm.exp = leftExp;
  await showEvolve(fromNo, toNo, pm.shiny);
  renderTop();
  render();
  if (!pm.shiny && S.pokemons.filter(p => p.pokedex_no === toNo && !p.shiny).length === 1) {
    confetti({ particleCount: 120, spread: 100, origin: { y: .4 } });
  }
}

// ---------- 捕捉（必出新：每次一定抓到没抓过的；只出基础形态） ----------
// 基础形态 = 没有任何宝可梦能进化成它（进化后的形态只能靠进化获得）
function isBaseForm(no) { return PK_EVOLVE_FROM[no] === undefined; }
async function catchOne() {
  if (S.balls < 1) { toast('没有精灵球啦～攒积分买一个吧'); return; }
  // 从候选池里剔除已经拥有的编号（闪耀家族整链视为已收集）
  const owned = ownedNumbers();
  const baseOnly = list => list.filter(no => isBaseForm(no) && !owned.has(no));
  const rare = Math.random() < CONFIG.RARITY.rare;
  let pool = baseOnly(CATCH_POOL[rare ? 'rare' : 'common']);
  if (!pool.length) pool = baseOnly(CATCH_POOL.common.concat(CATCH_POOL.rare));
  if (!pool.length) { toast('🏆 基础形态都抓齐啦，剩下的要靠进化获得！'); return; }  // 集满不扣球
  await DB.addItemLog('ball', -1, '捕捉消耗', DB.today());
  S.balls--;
  const no = pool[Math.floor(Math.random() * pool.length)];
  const info = PK_BY_NO[no];
  const newPm = await DB.addPokemon({ pokedex_no: no, shiny: false });
  S.pokemons.push(newPm);
  if (!S.leadId) { S.leadId = newPm.id; localStorage.setItem(LK('lead'), newPm.id); }
  await showCatch(false, no, `收服了新宝可梦 ${info.name}！`);
  renderTop(); renderPokemons();
}

// ---------- 动画：多一张闪耀形态卡（进化满经验 / 连清奖励时触发） ----------
function showShiny(pm, sub = null) {
  return new Promise(resolve => {
    const ov = $('overlay');
    delete ov.dataset.done;               // 上一次的 done 标记会让这次的关闭逻辑失效
    ov.classList.remove('hidden');
    ov.className = 'overlay gold';
    // 全屏星光雨：数量/大小/速度/横向偏移都随机；用负延迟让开场就已经铺满整屏
    const glyphs = ['✦', '✧', '★', '✩', '✨', '❋'];
    const stars = Array.from({ length: 46 }).map((_, i) => {
      const g = glyphs[i % glyphs.length];
      const left = (i * 37 + (i % 5) * 11) % 100;
      const size = 10 + (i % 5) * 5;
      const dur = (2.2 + (i % 7) * 0.45).toFixed(2);
      const delay = (-((i * 0.31) % 3.2)).toFixed(2);
      const drift = (i % 2 ? 1 : -1) * (12 + (i % 6) * 8);
      return `<i class="rain" style="left:${left}%;font-size:${size}px;--dur:${dur}s;--delay:${delay}s;--drift:${drift}px">${g}</i>`;
    }).join('');
    ov.innerHTML = `
      <div class="shiny-bg"><div class="shiny-rays"></div><div class="shiny-halo"></div></div>
      <div class="shiny-rain">${stars}</div>
      <div class="ov-stage">
        <div class="shiny-ring"></div>
        <div class="shiny-ring r2"></div>
        <img class="ov-mon reveal shiny-mon" src="${spritePath(pm.pokedex_no, true)}">
      </div>
      <div class="ov-badge">SHINY!</div>
      <div class="ov-title">✨ 进入闪耀形态！✨</div>
      <div class="ov-sub">${sub || `${pm.name} 在欢呼中多了一张闪耀形态卡！`}</div>
      <button class="ov-skip">哇！！🌟</button>
    `;
    sparkleBurst(ov.querySelector('.ov-stage'), 30);
    confetti({ particleCount: 200, spread: 140, scalar: 1.1, colors: ['#ffe082', '#fff176', '#ffd54f', '#ffffff', '#ffb300'], origin: { y: .4 } });
    const finish = () => { if (!ov.dataset.done) { ov.dataset.done = '1'; ov.classList.add('hidden'); resolve(); } };
    ov.querySelector('.ov-skip').onclick = finish;
    setTimeout(finish, 4200);
  });
}

// ---------- 买球 ----------
async function buyBall() {
  if (S.balance < CONFIG.BALL_PRICE) { toast('积分不够（球要 ' + CONFIG.BALL_PRICE + ' 分）'); return; }
  const pid = await DB.addPointLog(-CONFIG.BALL_PRICE, '购买精灵球', DB.today());
  S.pointLogs.push({ id: pid, log_date: DB.today(), amount: -CONFIG.BALL_PRICE, reason: '购买精灵球' });
  S.balance -= CONFIG.BALL_PRICE;
  await DB.addItemLog('ball', 1, '购买', DB.today());
  S.balls++;
  renderTop(); renderPokemons();
  toast('🔴 精灵球 +1');
}

// ---------- 动画：捕捉 ----------
function showCatch(shiny, no, sub) {
  return new Promise(resolve => {
    const ov = $('overlay');
    ov.classList.remove('hidden'); ov.className = 'overlay' + (shiny ? ' gold' : '');
    ov.innerHTML = `
      <div class="ov-stage">
        <div class="catch-ball"></div>
        <img class="ov-mon" src="${spritePath(no, shiny)}">
        <div class="ov-flash"></div>
      </div>
      <div class="ov-title"></div>
      <div class="ov-sub">${sub || ''}</div>
      <button class="ov-skip">跳过 ⏭</button>
    `;
    const ball = ov.querySelector('.catch-ball');
    const mon = ov.querySelector('.ov-mon');
    const title = ov.querySelector('.ov-title');
    const flash = ov.querySelector('.ov-flash');
    let done = false;
    const finish = () => { if (!done) { done = true; ov.classList.add('hidden'); resolve(); } };
    ov.querySelector('.ov-skip').onclick = finish;

    ball.classList.add('fly');
    setTimeout(() => {
      ball.classList.remove('fly'); ball.classList.add('shaking');
      const shakeDur = 1500;
      flash.classList.add('go');
      setTimeout(() => {
        ball.style.display = 'none';
        mon.classList.add('reveal');
        title.textContent = infoName(no, shiny);
        if (shiny) title.textContent = '✨ ' + PK_BY_NO[no].name + ' ✨';
        else title.textContent = PK_BY_NO[no].name + '!';
        sparkleBurst(ov.querySelector('.ov-stage'), 14);
        setTimeout(finish, 1800);
      }, shakeDur);
    }, 950);
  });
}
function infoName(no, shiny) { return (shiny ? '✨' : '') + PK_BY_NO[no].name; }

// ---------- 动画：进化 ----------
function showEvolve(fromNo, toNo, shiny) {
  return new Promise(resolve => {
    const ov = $('overlay');
    ov.classList.remove('hidden'); ov.className = 'overlay';
    ov.innerHTML = `
      <div class="ov-stage">
        <img class="evo-mon glowing" src="${spritePath(fromNo, shiny)}">
        <div class="ov-flash"></div>
      </div>
      <div class="ov-title">怎么...?!</div>
      <div class="ov-sub"></div>
      <button class="ov-skip">跳过 ⏭</button>
    `;
    const mon = ov.querySelector('.evo-mon');
    const title = ov.querySelector('.ov-title');
    const sub = ov.querySelector('.ov-sub');
    let done = false;
    const finish = () => { if (!done) { done = true; ov.classList.add('hidden'); resolve(); } };
    ov.querySelector('.ov-skip').onclick = finish;

    setTimeout(() => {
      title.textContent = '进化!!!';
      mon.style.filter = 'none';
      mon.src = spritePath(toNo, shiny);
      sparkleBurst(ov.querySelector('.ov-stage'), 18);
      confetti({ particleCount: 140, spread: 110, origin: { y: .4 } });
      sub.textContent = `进化成 ${PK_BY_NO[toNo].name} 了！`;
      setTimeout(finish, 2200);
    }, 2000);
  });
}

// ---------- 动画：升级 ----------
function showLevelUp(pm) {
  return new Promise(resolve => {
    const ov = $('overlay');
    ov.classList.remove('hidden'); ov.className = 'overlay';
    ov.innerHTML = `
      <div class="levelup-wrap">
        <div class="lv-txt">LEVEL UP!</div>
        <img src="${spritePath(pm.pokedex_no, pm.shiny)}">
        <div class="ov-title">${evoStageLabel(pm)}</div>
      </div>
      <button class="ov-skip">太棒了 👏</button>
    `;
    sparkleBurst(ov, 12);
    confetti({ particleCount: 80, spread: 90, origin: { y: .4 } });
    const finish = () => { ov.classList.add('hidden'); resolve(); };
    ov.querySelector('.ov-skip').onclick = finish;
    setTimeout(finish, 2200);
  });
}

// ---------- 星光特效 ----------
function sparkleBurst(container, n = 10) {
  const r = container.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'sparkle';
    s.textContent = ['✦', '✧', '✨', '⭐'][i % 4];
    s.style.left = (Math.random() * 100) + '%';
    s.style.top = (Math.random() * 100) + '%';
    s.style.fontSize = (12 + Math.random() * 14) + 'px';
    container.appendChild(s);
    setTimeout(() => s.remove(), 1400);
  }
}
function sparkleOn(card) {
  sparkleBurst(card, 6);
}
// 闪耀形态卡面：一层持续飘落的星星 + 扫过的全息光带
// 注意：位移用 px（--fall），不能用 translateY(%)——百分比是按伪元素自身高度算的，
// 高度只有一行字时只会移动几十像素，星星几乎进不了卡面，看起来就"几帧就没了"
function cardGlitterHTML() {
  const CHARS = ['✦', '✧', '✨', '★', '✩', '❋', '⋆'];
  const stars = Array.from({ length: 18 }).map((_, i) => {
    const x = 3 + (i * 6.4) % 94;                          // 横向铺开
    const size = 10 + (i * 7) % 15;                        // 大小不一
    const dur = (2.4 + (i % 5) * 0.5).toFixed(2);          // 快慢不一
    const delay = (-(i % 9) * 0.31).toFixed(2);            // 负延迟：一打开就铺满整面
    const fall = 280 + (i * 41) % 140;                     // 落到底部（px）
    const drift = ((i % 5) - 2) * 9;
    return `<i style="--x:${x.toFixed(1)}%;--fall:${fall}px;--drift:${drift}px;--dur:${dur}s;--delay:${delay}s;font-size:${size}px">${CHARS[i % CHARS.length]}</i>`;
  }).join('');
  return `<div class="ptcg-glitter">${stars}</div>`;
}

// ---------- 卡面属性特效：不同属性配不同的动态氛围 ----------
// 特效家族（18 个属性归到 8 种表现，避免样式爆炸）
const FX_BY_TYPE = {
  fire: 'ember',                                              // 火星上飘
  water: 'wave',                                              // 整卡水波：浪花纹底 + 水滴波纹 + 气泡 + 水光
  electric: 'spark',                                          // 电网闪烁
  grass: 'leaf', bug: 'leaf',                                 // 叶片飘落
  ice: 'snow',                                                // 雪花飘落
  poison: 'toxic',                                            // 紫绿毒雾成团上飘
  psychic: 'aura', fairy: 'aura', dragon: 'aura', ghost: 'aura', // 灵光脉动
  rock: 'dust', ground: 'dust', steel: 'dust', fighting: 'dust',  // 尘土碎屑
  flying: 'wind', normal: 'wind',                             // 气流掠过
};
function fxKeyOf(type) { return FX_BY_TYPE[type] || 'wind'; }
// 卡面特效层：纯 CSS 无限循环（不占 JS 定时器，手机上也稳）
// 水系多一层子元素：伪元素只有两个不够用（浪花纹底 + 水滴波纹 + 气泡要各自跑各自的动画）
function cardFxHTML(type) {
  const key = fxKeyOf(type);
  const extra = key === 'wave' ? '<span class="wv wv-ripple"></span><span class="wv wv-bubble"></span>' : '';
  return `<div class="ptcg-fx fx-${key}">${extra}</div>`;
}

// ---------- Toast ----------
let toastTimer;
function toast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

// ---------- 孩子端「家长消息」卡：加球 / 扣分 / 审批通过 → 任务页顶端，孩子点一下确认 ----------
const NOTICE_META = {
  ball: { ic: '🔴', cls: 'ball', tag: '精灵球' },
  minus: { ic: '➖', cls: 'minus', tag: '扣分' },
  points: { ic: '🏅', cls: 'points', tag: '积分到账' },
  bonus: { ic: '🎁', cls: 'bonus', tag: '奖励积分' },
};
const NOTICE_MAX = 20;
function noticeTime(n) {
  const d = new Date(n.at || Date.now());
  const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
  const t = new Date();
  const sameDay = d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  return sameDay ? `${hh}:${mm}` : `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}
function loadNotices() {
  try {
    const list = lsGet(LK('notices'), []);
    return Array.isArray(list) ? list.filter(n => n && n.id && n.text) : [];
  } catch (e) { return []; }
}
function saveNotices(list) {
  try { lsSet(LK('notices'), list.slice(-NOTICE_MAX)); } catch (e) {}
}
// 记一条家长消息（孩子下次打开任务页会在顶端看到，点「知道啦」才消失）
function pushNotice(type, text, sub) {
  try {
    const list = loadNotices();
    list.push({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type, text: String(text || '').slice(0, 120), sub: String(sub || '').slice(0, 120), at: Date.now(),
    });
    saveNotices(list);
  } catch (e) {}
  if (S.role === 'kid' && S.tab === 'tasks' && $('page')) renderTasks();
}
function ackNotice(id) {
  const list = loadNotices();
  saveNotices(id === '*' ? [] : list.filter(n => n.id !== id));
  if (S.role !== 'kid') return;
  if (S.tab === 'tasks') renderTasks(); else render();
}
function noticesHTML() {
  const list = loadNotices();
  if (!list.length) return '';
  return `
    <div class="notice-stack">
      <div class="notice-head">🔔 家长消息<small>${list.length} 条待确认</small></div>
      ${list.map(n => {
        const m = NOTICE_META[n.type] || NOTICE_META.points;
        return `
        <div class="notice-card ${m.cls}" data-action="notice-ack" data-nid="${n.id}" role="button" tabindex="0">
          <span class="notice-ic">${m.ic}</span>
          <div class="notice-body">
            <div class="notice-title">${escHTML(n.text)}</div>
            <div class="notice-meta">${m.tag} · ${noticeTime(n)}${n.sub ? ' · ' + escHTML(n.sub) : ''}</div>
          </div>
          <span class="notice-ok">知道啦</span>
        </div>`;
      }).join('')}
      ${list.length > 1 ? `<button class="notice-all" data-action="notice-ack-all">全部知道啦（${list.length}）</button>` : ''}
    </div>`;
}

// ---------- 异常上报：出错弹提示 + 本地留档，方便下次排查 ----------
const ERR_MAX = 30;
function loadErrors() {
  try { const l = lsGet(LK('errors'), []); return Array.isArray(l) ? l : []; } catch (e) { return []; }
}
function saveErrors(l) { try { lsSet(LK('errors'), l.slice(-ERR_MAX)); } catch (e) {} }
function errText(e) {
  if (!e) return '';
  const head = `${e.date || ''} [${e.kind || '异常'}]${e.count > 1 ? ` ×${e.count}` : ''} ${e.message || ''}`;
  return [head, e.extra, e.stack].filter(Boolean).join('\n');
}
// 兜底：细节不丢，先存本地再弹提示；同类错误 5 秒内只累计次数，避免刷屏
function reportError(kind, message, stack, extra) {
  if (window.__reportingError) return;      // 防止报错处理本身再报错造成递归
  window.__reportingError = true;
  let rec = null;
  try {
    const msg = String(message || '未知错误').slice(0, 300);
    const list = loadErrors();
    const now = Date.now();
    const last = list[list.length - 1];
    if (last && last.message === msg && now - (last.at || 0) < 5000) {
      last.count = (last.count || 1) + 1; last.at = now; last.date = new Date().toLocaleString('zh-CN');
      rec = last;
    } else {
      rec = {
        id: `${now}_${Math.random().toString(36).slice(2, 6)}`,
        kind: kind || '异常', message: msg,
        stack: String(stack || '').slice(0, 1500), extra: String(extra || '').slice(0, 240),
        date: new Date().toLocaleString('zh-CN'), at: now, count: 1,
      };
      list.push(rec);
    }
    saveErrors(list);
  } catch (e) {}
  try { showErrBanner(rec || { kind, message: String(message || ''), count: 1 }); } catch (e) {}
  window.__reportingError = false;
}
function showErrBanner(rec) {
  let el = document.getElementById('err-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'err-banner';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="err-row">
      <span class="err-ic">⚠️</span>
      <div class="err-main">
        <b>出错了 · ${escHTML(rec.kind || '异常')}${rec.count > 1 ? ` ×${rec.count}` : ''}</b>
        <span>${escHTML(rec.message || '')}</span>
      </div>
      <button class="err-btn" data-err="detail">详情</button>
      <button class="err-btn" data-err="copy">复制</button>
      <button class="err-btn ghost" data-err="close">知道了</button>
    </div>
    <pre class="err-stack hidden">${escHTML([rec.date, rec.extra, rec.stack].filter(Boolean).join('\n'))}</pre>
  `;
  el.classList.remove('hidden');
  const stackEl = el.querySelector('.err-stack');
  el.querySelector('[data-err="close"]').onclick = () => el.classList.add('hidden');
  el.querySelector('[data-err="detail"]').onclick = () => stackEl.classList.toggle('hidden');
  el.querySelector('[data-err="copy"]').onclick = () => copyText(errText(rec));
}
// 复制文本（http 环境下用兜底方案，老浏览器也能用）
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      toast('已复制，把它发给我就能排查');
      return true;
    }
  } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    toast(ok ? '已复制，把它发给我就能排查' : '复制失败，请长按文字手动复制');
    return ok;
  } catch (e) { toast('复制失败，请长按文字手动复制'); return false; }
}
// 全局兜底：脚本错误 / 未处理的异步错误 / 数据库调用失败
window.addEventListener('error', e => {
  if (!e || !e.message) return;    // 资源加载失败（图片缺失等）不打扰
  reportError('脚本错误', e.message, e.error && e.error.stack, e.filename ? `${e.filename}:${e.lineno || 0}` : '');
});
window.addEventListener('unhandledrejection', e => {
  const r = e && e.reason;
  reportError('异步错误', (r && (r.message || String(r))) || '未知异步错误', r && r.stack, '');
});
const __origConsoleError = console.error.bind(console);
console.error = function (...args) {
  __origConsoleError(...args);
  try {
    const first = args[0];
    if (typeof first === 'string' && first.indexOf('[DB ') === 0) {
      const err = args[1];
      const detail = err ? [err.message || err.error_description || String(err), err.code && `code=${err.code}`, err.details, err.hint].filter(Boolean).join(' | ') : '';
      reportError('数据库错误', `${first} ${detail}`, err && err.stack, '');
    }
  } catch (e) {}
};

// ---------- 渲染 ----------
function renderTop() {
  const pt = $('pt'), bl = $('bl');
  if (!pt || !bl) return;
  pt.textContent = S.balance;
  bl.textContent = S.balls;
  pt.parentElement.classList.remove('shake-it'); void pt.parentElement.offsetWidth; pt.parentElement.classList.add('shake-it');
  bl.parentElement.classList.remove('shake-it'); void bl.parentElement.offsetWidth; bl.parentElement.classList.add('shake-it');
}

// 日期文本：宽屏显示完整日期，窄屏（≤380）自动换成短格式（同一年只显示 MM-DD），免得被压成三行
function dateCurHTML(date, isToday) {
  const full = `${date}${isToday ? '（今天）' : ''}`;
  const short = `${date.slice(0, 4) === DB.today().slice(0, 4) ? date.slice(5) : date}${isToday ? ' 今天' : ''}`;
  return `<span class="date-cur" title="${full}"><span class="dc-full">${full}</span><span class="dc-short">${short}</span></span>`;
}
// 孩子端日期导航条（查看历史某天的完成情况，历史日期只读）
function dateNavHTML() {
  const today = DB.today();
  return `
    <div class="date-nav">
      <button class="chip" data-action="date-prev">◀ 前一天</button>
      ${dateCurHTML(S.viewDate, S.viewDate === today)}
      <button class="chip" data-action="date-next" ${S.viewDate >= today ? 'disabled' : ''}>后一天 ▶</button>
      ${S.viewDate !== today ? `<button class="chip red" data-action="date-today">回到今天</button>` : ''}
    </div>
  `;
}

// 进度条随完成度变色：淡蓝（刚布置）→ 淡青（做了一半）→ 绿（快完成）；完成后绿色 + 光带扫过。
// 不再从红色起：0~10% 一片红看着像报警，孩子刚看到任务就是「出事了」的观感。
const PROG_STOPS = [
  [0,   [172, 201, 234]],   // 淡雾蓝：还没动（不是红色，别把「刚布置」做成警报）
  [50,  [130, 206, 197]],   // 淡青绿：做了一半
  [100, [86,  183, 111]],   // 绿：快完成
];
function progFillStyle(pct, full) {
  if (full) return '';
  const p = Math.max(0, Math.min(100, pct));
  // 在 RGB 上分段线性插值：色相走蓝→青→绿，全程不经过红/橙
  let i = 0;
  while (i < PROG_STOPS.length - 2 && p > PROG_STOPS[i + 1][0]) i++;
  const [p0, c0] = PROG_STOPS[i], [p1, c1] = PROG_STOPS[i + 1];
  const k = (p - p0) / (p1 - p0 || 1);
  const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
  const light = c.map(v => Math.min(255, Math.round(v + (255 - v) * 0.35)));   // 左端更淡，出一点渐变层次
  return `;background:linear-gradient(90deg,rgb(${light.join(',')}),rgb(${c.join(',')}))`;
}

function renderProgress() {
  const el = $('progress-wrap');
  if (!el) return;
  const all = dayTasksForProgress(S.viewDate);
  const req = all.filter(t => t.required !== false);
  const opt = all.filter(t => t.required === false);
  const wts = weeklyTasks();
  if (!all.length && !wts.length) { el.innerHTML = ''; return; }
  // kind: req / opt，点进度条可弹出这一组的任务清单（含截止日期）
  const bar = (list, title, doneText, bonusText, kind) => {
    const done = list.filter(t => logOn(t.id, S.viewDate)).length;
    const full = list.length > 0 && done === list.length;
    const pct = list.length ? Math.round(done / list.length * 100) : 0;
    return `
      <div class="progress-item clickable" data-action="progress-detail" data-kind="${kind}" title="点开看这一组的任务清单">
        <div class="progress-head">
          <b>${title}</b>
          <span>${done}/${list.length} 已完成 ${full ? `🎉 ${bonusText}` : doneText}</span>
        </div>
        <div class="progress-track"><div class="progress-fill ${full ? 'full' : ''}" style="width:${pct}%${progFillStyle(pct, full)}"></div></div>
        <div class="pd-tap">点开看清单 ›</div>
      </div>
    `;
  };
  // 必做 / 选做 独立两条进度条（补卡日期：若全清奖没在当天发过，达成也不补发，文案如实提示）
  const mk = isMakeupDate(S.viewDate);
  const reqBonusPaid = S.pointLogs.some(l => l.reason === `必选全清_${S.viewDate}`);
  const optBonusPaid = S.pointLogs.some(l => l.reason === `可选全清_${S.viewDate}`);
  let html = `<div class="progress-card">
    ${bar(req, '🔴 必做任务全清', `全清 +${CONFIG.REQUIRED_DONE_BONUS} 分`, mk && !reqBonusPaid ? '补卡完成不发全清奖' : `🎉 全清 +${CONFIG.REQUIRED_DONE_BONUS} 分`, 'req')}
    ${opt.length ? bar(opt, '🟢 选做任务全清', `全清 +${CONFIG.OPTIONAL_DONE_BONUS} 分`, mk && !optBonusPaid ? '补卡完成不发全清奖' : `🎉 全清 +${CONFIG.OPTIONAL_DONE_BONUS} 分`, 'opt') : ''}
  </div>`;
  // 多日任务进度条挨着增加
  if (wts.length) html += `<div class="progress-card">${wts.map(weeklyProgressBar).join('')}</div>`;
  el.innerHTML = html;
}

// ---------- 连续「必做全清」进度 + 领取（放在孩子端任务页最下方） ----------
function streakCardHTML() {
  const goal = streakGoal();
  const days = Math.min(streakCycleDays(), goal);
  const ready = days >= goal;
  const pct = Math.round(days / goal * 100);
  const left = Math.max(0, goal - days);
  return `
    <div class="progress-card streak-card${ready ? ' ready' : ''}">
      <div class="streak-head">
        <b>🏆 ${goal} 天必做全清</b>
        <span>${days}/${goal} 天${ready ? ' · 可以领奖啦' : ''}</span>
      </div>
      <div class="streak-row">
        <div class="progress-track"><div class="progress-fill ${ready ? 'full' : ''}" style="width:${pct}%${progFillStyle(pct, ready)}"></div></div>
        ${ready
          ? `<button class="streak-btn ready" data-action="streak-claim">🎁 领取</button>`
          : `<button class="streak-btn" disabled>还差 ${left} 天</button>`}
      </div>
      <div class="streak-tip">每天把<b>必做任务全部做完</b>算 1 天，连满 ${goal} 天送 ✨ <b>闪耀卡</b> ×${shinyReward()}，到宝可梦页选一只用掉（中间断一天就重新数）</div>
    </div>`;
}

// 达标瞬间的庆祝动画（一次性，点一下或 2.6 秒后自动消失，不挡领奖按钮）
function showStreakReady() {
  return new Promise(resolve => {
    const ov = $('overlay');
    ov.classList.remove('hidden');
    ov.className = 'overlay gold';
    ov.innerHTML = `
      <div class="streak-fx">
        <div class="streak-fx-badge">🏆</div>
        <div class="streak-fx-title">连续 ${streakGoal()} 天必做全清！</div>
        <div class="streak-fx-sub">✨ 闪耀卡 ×${shinyReward()} 在下面等你领</div>
        <div class="catch-tap">点一下继续</div>
      </div>`;
    confetti({ particleCount: 220, spread: 140, origin: { y: .5 } });
    let closed = false;
    const done = () => {
      if (closed) return;
      closed = true;
      ov.classList.add('hidden');
      ov.innerHTML = '';
      ov.onclick = null;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 2600);
    ov.onclick = done;
  });
}

// 点「领取」：发球 + 随机多一张闪耀卡，然后把这一轮清零重新数
async function claimStreak() {
  const goal = streakGoal();
  const days = streakCycleDays();
  if (days < goal) { toast(`还差 ${goal - days} 天必做全清`); return; }
  const today = DB.today();
  const n = shinyReward();
  const reason = `必做全清${goal}天_${today}`;
  if (!await DB.hasItemReason(reason)) {      // 同一天只发一次，防止重复点「领取」刷卡
    await DB.addItemLog('shiny', n, reason, today);
    S.shinyCards += n;
  }
  lsSet(K_STREAK_CLAIM, today);
  confetti({ particleCount: 180, spread: 130, origin: { y: .5 } });
  renderTop(); render();
  toast(`🏆 领到闪耀卡 ×${n}，去宝可梦页点「✨ 闪耀卡」选一只宝可梦用掉吧`);
}

function renderTasks() {
  const page = $('page');
  const ts = tasksOnDate(S.viewDate);   // 渲染当前查看日期的任务（翻历史时显示那天的任务，而不是今天的）
  const wts = weeklyTasks();
  const req = ts.filter(t => t.required !== false);
  const opt = ts.filter(t => t.required === false);
  // 家长消息卡固定在最顶端：加球 / 扣分 / 审批通过，孩子点「知道啦」才消失
  const notices = noticesHTML();
  // 每日叮嘱：即使今天没有任务也要显示（家长的话比任务列表更重要）
  const note = S.viewNote ? noteCardHTML() : '';
  // 连续必做全清进度条固定在这页最下方（只看今天，翻历史日期时不显示）
  const streak = S.viewDate === DB.today() ? streakCardHTML() : '';
  if (!ts.length && !wts.length) {
    page.innerHTML = notices + dateNavHTML() + note + `<div class="empty-tip">${S.viewDate === DB.today() ? '今天' : '这天'}还没有任务哦，让家长去布置吧～</div>` + streak;
    return;
  }
  let html = notices + dateNavHTML() + note;
  html += `<div id="progress-wrap"></div>`;
  html += rulesHintHTML();
  // 必做任务：按类别分区展示（校内在先，孩子先做完校内）
  html += catSectionHTML(req, '🔴 必做任务');
  // 选做任务：同样按类别分区
  if (opt.length) html += catSectionHTML(opt, '🟢 选做任务');
  html += streak;
  page.innerHTML = html;
  renderProgress();
}

// 任务属性统一叫法：单次(once) / 重复(daily) / 多日(weekly) / 子任务(child)
function taskTypeLabel(t) {
  if (t.schedule === 'once') return '单次';
  if (t.schedule === 'daily') return '重复';
  if (t.schedule === 'child') return '子任务';
  if (t.schedule === 'weekly') return '多日';
  return '';
}
// 同名任务拦截：名称完全一样的不再重复布置（手滑点两次、批量粘贴重复行都拦掉）。
// date 只在「单次任务」时传：单次任务按天去重，批量布置多天里不同天允许同名；
// 不传 date 时：任何仍在使用中的同名任务都算重复（重复/多日任务全局唯一）。
function sameTitleTask(title, opts) {
  const o = opts || {};
  const name = String(title || '').trim();
  if (!name) return null;
  return S.tasks.find(x => {
    if (x.active === false || x.id === o.ignoreId) return false;
    if (x.end_date && x.end_date < DB.today()) return false;   // 已结束的（含删除的重复任务）不再挡同名新任务
    if (String(x.title || '').trim() !== name) return false;
    if (o.parentId !== undefined && (x.parent_id || null) !== (o.parentId || null)) return false;
    if (o.date && x.schedule === 'once' && x.start_date && x.start_date !== o.date) return false;
    return true;
  }) || null;
}
// 某天视为重复时的提示文案
function dupTitleMsg(title) { return `已经有同名任务「${title}」，不用再加一次`; }

// 任务排序（家长端、孩子端、进度详情共用同一套，家长拖完孩子端才会跟着变）：
// 家长调整的 sort 优先 → 类别顺序（全未排序时的默认观感）→ 名称
function taskSort(a, b) {
  const sa = a.sort || 0, sb = b.sort || 0;
  if (sa !== sb) return sa - sb;
  const ca = catOrder(a.category), cb = catOrder(b.category);
  if (ca !== cb) return ca - cb;
  return (a.title || '').localeCompare(b.title || '', 'zh');
}
// 必做/选做分区内直接平铺任务（不再按类别分组块），排序交给 taskSort
function catSectionHTML(tasks, title) {
  if (!tasks.length) return '';
  const arr = tasks.slice().sort(taskSort);
  return `<div class="section-title" style="margin:16px 4px 6px">${title}</div>
    <div class="task-list">${arr.map(taskCardHTML).join('')}</div>`;
}

// 孩子端规则说明（可折叠）
function rulesHintHTML() {
  return `
    <details class="rules-hint">
      <summary>${POKE_ICON.dex()} 规则小抄 <small style="font-weight:400">点开看看怎么拿分</small></summary>
      <ul>
        <li>✅ 完成任务 → +积分（家长确认后才到账）</li>
        <li>🎯 今日 <b>必做</b> 全部完成 → +${CONFIG.REQUIRED_DONE_BONUS} 分</li>
        <li>🎁 <b>选做</b> 也全部完成 → 再 +${CONFIG.OPTIONAL_DONE_BONUS} 分</li>
        <li>🏆 连续 ${CONFIG.STREAK_DAYS_FOR_BALL} 天<b>必做任务全清</b> → 送 ✨ 闪耀卡，到宝可梦页选一只用掉（断一天重数）</li>
        <li>🥚 1 个精灵球一定抓到 1 只<b>新</b>宝可梦（绝不重复）</li>
        <li>🍬 喂糖果攒经验：1 分 = ${CONFIG.POINTS_TO_EXP} exp；经验满了一管就能进化，越进化需要的经验越多</li>
        <li>⭐ 出战的宝可梦是你的伙伴，每次完成任务它 +${CONFIG.LEAD_EXP_PER_TASK} 经验</li>
        <li>⏳ 积分要家长确认才到账，别乱点哦</li>
      </ul>
    </details>
  `;
}

// 小字里的日期：单次/子任务只在当天出现，写日期纯属噪音（所以「口算一页」比别的小任务多一行日期就是这里有值）；
// 重复任务只在「不是今天才开始」时提示一下起始日。
function taskStartText(t) {
  if (!t.start_date || t.schedule !== 'daily') return '';
  if (t.start_date === S.viewDate) return '';
  return ` · 🚩 ${t.start_date.slice(5)} 起`;
}
function taskCardHTML(t) {
  const isToday = S.viewDate === DB.today();
  const submitted = isSubmitted(t);
  const done = isApprovedDone(t);
  const isChild = !!t.parent_id;
  const streak = t.schedule === 'daily' ? taskStreak(t.id) : 0;  // 每日任务连续打卡天数
  // 必做/选做明显标记（卡片上部）
  const reqTag = t.required === false
    ? '<span class="req-tag opt">🟢 选做</span>'
    : '<span class="req-tag">🔴 必做</span>';
  // 家长小提示
  const hint = t.hint ? `<div class="task-hint">💡 ${t.hint}</div>` : '';
  // 补卡：查看日期在补卡窗口内时，漏掉的「单次任务」可补交（重复/子任务不可补，更早的日期锁定只读）
  const mkOnce = !isToday && isMakeupDate(S.viewDate) && t.schedule === 'once';
  // 三种状态：已审批完成(done) / 已提交待审批(submitted) / 未做
  let btnHtml, statusClass = '';
  if (done) {
    btnHtml = `<button class="btn-done" disabled>✅ 已完成</button>`;
    statusClass = 'done';
  } else if (submitted) {
    // 补卡期内单次任务的待审批提交可撤销（撤了还能再补）；重复任务历史提交不可撤，撤了就没法重新提交
    btnHtml = `<button class="btn-done submitted-btn" data-action="cancel-submit" data-tid="${t.id}" ${(isToday || mkOnce) ? '' : 'disabled'}>🟦 已提交</button>`;
    statusClass = 'submitted';
  } else if (!isToday) {
    btnHtml = mkOnce && !isTaskDoneEver(t.id)
      ? `<button class="btn-done" data-action="checkin" data-tid="${t.id}">⏪ 补完成</button>`
      : `<button class="btn-done" disabled>未完成</button>`;
  } else {
    btnHtml = `<button class="btn-done" data-action="checkin" data-tid="${t.id}">✅ 完成</button>`;
  }
  return `
  <div class="task-card ${statusClass} ${t.required === false ? 'optional' : ''} ${isChild ? 'child-card' : ''}" data-action="task-detail" data-tid="${t.id}">
    <div class="emoji">${catIcon(t.category, t.title)}</div>
    <div class="info">
      <b>${t.title}</b>${reqTag}
      ${hint}
      <span>${t.category} · ${taskTypeLabel(t)}${streak > 0 ? ` · 🔥连续 ${streak} 天` : ''}${taskStartText(t)}</span>
    </div>
    <div class="pts">+${t.points}</div>
    ${btnHtml}
  </div>`;
}

// 某天某个任务的完成状态（孩子端详情/清单共用）
function taskStatusOf(taskId, date) {
  const l = S.logs[date]?.[taskId];
  if (l && l.done && l.approved) return { key: 'ok', text: '✅ 已完成' };
  if (l && l.done) return { key: 'pend', text: '🟦 已提交，等家长确认' };
  return { key: 'todo', text: '⬜ 还没完成' };
}

// 任务详情弹窗（手机上看不清时点卡片查看完整信息）
function showTaskDetail(id, date) {
  const raw = S.tasks.find(x => x.id === id);
  if (!raw) return;
  // date 有值时按那天取属性版本（孩子翻历史点开卡片看到的是当时的名称/分值）
  const t = taskAttrFor(raw, date);
  const isChild = !!t.parent_id;
  const parent = isChild ? S.tasks.find(x => x.id === t.parent_id) : null;
  const isParent = S.role === 'parent';
  // 截止日期：优先用自己的，子任务则跟随所属多日任务的截止日期
  const deadline = t.deadline || (parent && parent.deadline) || '';
  const fromParent = !t.deadline && !!deadline;
  const left = deadline ? deadlineDaysLeft(deadline) : null;
  const leftText = left === null ? '' : left < 0 ? `（已超期 ${-left} 天）` : left === 0 ? '（今天截止）' : `（剩 ${left} 天）`;
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal" style="max-width:420px;width:calc(100% - 40px)">
      <h3>${t.title}${t.required === false ? ' <span class="req-tag opt">选做</span>' : ' <span class="req-tag">必做</span>'}</h3>
      <div class="form-hint" style="margin-top:10px">${t.category} · +${t.points}分 · ${taskTypeLabel(t)}${t.start_date ? ` · 🚩 ${t.start_date} 开始` : ''}${deadline ? ` · 📅 截止 ${deadline}${leftText}${fromParent ? '（随多日任务）' : ''}` : ''}</div>
      ${parent ? `<div class="form-hint">📋 属于多日任务「${parent.title}」</div>` : ''}
      ${t.hint ? `<div class="form-hint" style="color:#ef6c00">💡 ${t.hint}</div>` : ''}
      ${isParent ? `
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-ghost" data-act="up" style="font-size:13px;padding:6px 12px">↑ 上移</button>
        <button class="btn-ghost" data-act="down" style="font-size:13px;padding:6px 12px">↓ 下移</button>
        <button class="btn-primary" data-act="edit" style="font-size:13px;padding:6px 12px">✏️ 编辑</button>
        <button class="btn-danger" data-act="del" style="font-size:13px;padding:6px 12px">删除</button>
      </div>` : ''}
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn-primary" data-close style="flex:1">关闭</button>
      </div>
    </div>
  `;
  modal.querySelector('[data-close]').onclick = () => modal.remove();
  const up = modal.querySelector('[data-act="up"]');
  if (up) up.onclick = () => { modal.remove(); moveTask(t.id, 'up'); };
  const down = modal.querySelector('[data-act="down"]');
  if (down) down.onclick = () => { modal.remove(); moveTask(t.id, 'down'); };
  const edit = modal.querySelector('[data-act="edit"]');
  if (edit) edit.onclick = () => { modal.remove(); openTaskEditor(t.id); };
  const del = modal.querySelector('[data-act="del"]');
  if (del) del.onclick = () => { modal.remove(); delTask(t.id); };
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// 必做 / 选做 进度条弹窗：这一组今天有哪些任务、各自状态、截止日期
function showProgressDetail(kind) {
  const isReq = kind !== 'opt';
  const date = S.viewDate;
  const list = dayTasksForProgress(date)
    .filter(t => (t.required !== false) === isReq)
    .sort(taskSort);
  const done = list.filter(t => logOn(t.id, date)).length;
  const full = list.length > 0 && done === list.length;
  const bonus = isReq ? CONFIG.REQUIRED_DONE_BONUS : CONFIG.OPTIONAL_DONE_BONUS;
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal" style="max-width:420px;width:calc(100% - 40px)">
      <h3>${isReq ? '🔴 必做任务清单' : '🟢 选做任务清单'}</h3>
      <div class="form-hint" style="margin-top:2px">${date} · 已完成 <b>${done}</b>/${list.length} 个${full ? ` · 🎉 全清 +${bonus} 分` : ` · 全清 +${bonus} 分`}</div>
      <div class="pd-list">
        ${list.length ? list.map(t => {
          const st = taskStatusOf(t.id, date);
          const parent = t.parent_id ? S.tasks.find(x => x.id === t.parent_id) : null;
          const deadline = t.deadline || (parent && parent.deadline) || '';
          return `<div class="pd-row ${st.key}" data-id="${t.id}">
            <span class="pd-ico">${catIcon(t.category, t.title)}</span>
            <span class="pd-name">${t.title}${deadline ? `<small class="pd-dl">📅 ${deadline}</small>` : ''}</span>
            <span class="pd-pts">+${t.points}</span>
            <span class="pd-st ${st.key}">${st.text}</span>
          </div>`;
        }).join('') : '<div class="empty-tip">这一组今天没有任务</div>'}
      </div>
      <div class="pd-foot">👉 点任意一行，看这个任务的详情和截止日期</div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <button class="btn-primary" data-close style="flex:1">关闭</button>
      </div>
    </div>
  `;
  modal.querySelector('[data-close]').onclick = () => modal.remove();
  modal.querySelectorAll('.pd-row').forEach(row => {
    row.onclick = () => { modal.remove(); showTaskDetail(Number(row.dataset.id), date); };
  });
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}
// 删除任务（家长）
async function delTask(id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  // 重复任务「删除」= 停止布置：结束日期设为昨天，之前日期的打卡记录/进度/积分原样保留（软停用）
  if (t.schedule === 'daily') {
    if (!await askConfirm('删除后从今天起不再布置这个任务，之前日期的完成记录和积分原样保留。确定删除？', { okText: '删除' })) return;
    await DB.updateTask(id, { end_date: shiftDate(DB.today(), -1) });
    await refreshAll(); render();
    toast('已删除，之前的记录保留');
    return;
  }
  if (!await askConfirm('确定删除这个任务？', { okText: '删除' })) return;
  await DB.deleteTask(id);
  await refreshAll(); render();
  toast('已删除');
}

// ---------- 多日任务进度条（统一风格，挨着每日进度条增加） ----------
function dlBadgeHTML(t, left) {
  if (!t.deadline) return '';
  if (left < 0) return `<span class="dl-badge overdue">🚫 已超期 ${-left} 天</span>`;
  if (left === 0) return `<span class="dl-badge urgent">🔥 今天截止！</span>`;
  if (left <= 2) return `<span class="dl-badge urgent">⏳ 剩 ${left} 天</span>`;
  return `<span class="dl-badge">⏳ 剩 ${left} 天</span>`;
}
function weeklyProgressBar(t) {
  const prog = taskProgress(t.id);
  const left = deadlineDaysLeft(t.deadline);
  const full = prog >= 100;
  return `
    <div class="progress-item">
      <div class="progress-head" data-action="weekly-detail" data-tid="${t.id}" style="cursor:pointer" title="点开看子任务状态">
        <b>${t.title}${dlBadgeHTML(t, left)}</b>
        <span>${prog}%${full ? ' 🎉' : ''} · 全清 +${t.bonus || CONFIG.WEEKLY_DONE_BONUS} 分</span>
      </div>
      <div class="progress-track"><div class="progress-fill ${full ? 'full' : ''}" style="width:${prog}%${progFillStyle(prog, full)}"></div></div>
      ${t.deadline ? `<div class="dl-penalty">⏰ 超期每天扣 ${CONFIG.OVERDUE_DAILY_PENALTY} 分</div>` : ''}
    </div>
  `;
}
// 子任务是否完成过（跨天累计）
function isTaskDoneEver(taskId) {
  for (const d in S.logs) { const l = S.logs[d][taskId]; if (l && (l.completed || l.done)) return true; }
  return false;
}
// 多日任务子任务状态弹窗（孩子点进度条查看）
function showWeeklyChildren(id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  const kids = allChildTasks(id);
  const prog = taskProgress(t.id);
  const left = deadlineDaysLeft(t.deadline);
  const dlText = t.deadline
    ? `📅 截止 ${t.deadline}${left < 0 ? `（已超期 ${-left} 天）` : left === 0 ? '（今天截止）' : `（剩 ${left} 天）`}`
    : '不限日期';
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal" style="max-width:420px;width:calc(100% - 40px)">
      <h3>${t.title}</h3>
      <div class="form-hint" style="margin-top:6px">${t.category ? `${t.category} · ` : ''}${dlText}${t.deadline ? ' ' + dlBadgeHTML(t, left) : ''} · 已完成 ${prog}% · 全清 +${t.bonus || CONFIG.WEEKLY_DONE_BONUS} 分</div>
      <div style="margin-top:8px">
        ${kids.map(k => {
          const done = isTaskDoneEver(k.id);
          const pend = done && taskPending(k.id);
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f5f5f5">
            <span>${done ? '✅' : '⬜'} ${k.title}${k.required === false ? ' <small style="color:#2e7d32">选做</small>' : ''}</span>
            <span style="color:#f57f17;font-weight:800">+${k.points}${pend ? ' ⏳' : ''}</span>
          </div>`;
        }).join('') || '<div class="empty-tip">这个多日任务还没有子任务</div>'}
      </div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn-primary" data-close style="flex:1">关闭</button>
      </div>
    </div>
  `;
  modal.querySelector('[data-close]').onclick = () => modal.remove();
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ✨ 闪耀卡：只在「连续 N 天必做全清」领奖时产出，用一张让一只宝可梦多一张闪耀形态卡
let shinyPickOn = false;   // 是否处于「挑一只用闪耀卡」的选择态
function shinyBarHTML() {
  if (!S.shinyCards) return '';
  if (shinyPickOn) {
    return `
    <div class="shiny-bar picking">
      <div class="shiny-bar-main"><b>✨ 闪耀卡 ×${S.shinyCards}</b><span>点下面一只宝可梦给它用掉（已经闪的不能再选）</span></div>
      <button class="shiny-btn ghost" data-action="shiny-cancel">取消</button>
    </div>`;
  }
  return `
    <div class="shiny-bar">
      <div class="shiny-bar-main"><b>✨ 闪耀卡 ×${S.shinyCards}</b><span>用一张，给一只宝可梦多一张 ✨ 卡</span></div>
      <button class="shiny-btn" data-action="shiny-pick">使用</button>
    </div>`;
}

// 用一张闪耀卡：给选中的这只额外生成一张 ✨ 卡（原来的普通卡保留）
async function applyShinyCard(pmId) {
  const pm = S.pokemons.find(p => p.id === Number(pmId));
  if (!pm) return;
  if (!S.shinyCards) { toast('没有闪耀卡啦'); shinyPickOn = false; renderPokemons(); return; }
  if (pm.shiny || hasShinyCopy(pm.pokedex_no)) { toast(`「${PK_BY_NO[pm.pokedex_no].name}」已经有闪耀卡了，换一只吧`); return; }
  await DB.addItemLog('shiny', -1, `使用闪耀卡_${pm.id}_${DB.today()}`, DB.today());
  S.shinyCards = Math.max(0, S.shinyCards - 1);
  const copy = await addShinyCopy(pm);
  shinyPickOn = false;
  renderTop(); renderPokemons();
  await showShiny(copy, `${PK_BY_NO[copy.pokedex_no].name} 变成了闪耀形态，卡册里多了一张 ✨ 卡！`);
}

function renderPokemons() {
  const page = $('page');
  // 按获取先后排：先抓到的在前（同时间按 id 兜底，演示数据都是同一批种下的）
  const list = S.pokemons.slice().sort((a, b) => {
    const ca = String(a.caught_at || ''), cb = String(b.caught_at || '');
    if (ca !== cb) return ca < cb ? -1 : 1;
    return (a.id || 0) - (b.id || 0);
  });
  page.innerHTML = `
    ${shinyBarHTML()}
    <div class="catch-zone">${catchZoneHTML()}</div>
    <div class="catch-hint" style="text-align:center;margin-bottom:12px">⭐ 卡上带 ⭐ 的「出战」宝可梦是你的伙伴，每次完成任务它都会 +${CONFIG.LEAD_EXP_PER_TASK} 经验。</div>
    ${list.length ? `
      <div class="section-title">我的宝可梦 <small>${list.length} 只 · 按获取先后 · 点卡查看</small></div>
      <div class="pm-grid">
        ${list.map(pmCardHTML).join('')}
      </div>
    ` : '<div class="empty-tip">还没有宝可梦！<br><br>先去捉一只吧 🥚</div>'}
    <div class="section-title" style="margin-top:24px">宝可梦图鉴 <small>${dexGotCount()}/151</small></div>
    ${dexHTML()}
  `;
}

// 获取时间：小卡上放「年-月-日 时:分」，title 里放同样的完整时间
function caughtShort(iso) {
  if (!iso) return '时间未知';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 16);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function caughtFull(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 获取时间前的小图标：按宝可梦 id 稳定随机选一种精灵球（不随重渲染跳动）
function pmBallIcon(pmId) {
  const balls = [
    () => POKE_ICON.ball('#e53935'),   // 红白球
    () => POKE_ICON.great(),           // 超级球
    () => POKE_ICON.ultra(),           // 高级球
    () => POKE_ICON.master(),          // 大师球
  ];
  const i = Math.abs(Number(pmId) || 0) % balls.length;
  return balls[i]();
}

// 小卡牌（列表）：第一行「属性 + 名字」，第二行获取时间
function pmCardHTML(pm) {
  const info = PK_BY_NO[pm.pokedex_no];
  const type = pmType(pm.pokedex_no);
  // 选择态：已经闪的（自己就是 ✨ 或同编号已有 ✨ 卡）不能再选
  const locked = shinyPickOn && (pm.shiny || hasShinyCopy(pm.pokedex_no));
  const act = shinyPickOn ? (locked ? 'shiny-locked' : 'shiny-apply') : 'card';
  return `
  <div class="pm-card-mini ${pm.shiny ? 'shiny' : ''} ${shinyPickOn ? 'picking' : ''} ${locked ? 'locked' : ''}" data-action="${act}" data-pmid="${pm.id}" title="获取于 ${caughtFull(pm.caught_at)}">
    <div class="mini-frame" style="--tc:${TYPE_COLOR[type] || '#a8a878'}">
      <img src="${artworkPath(pm.pokedex_no)}" alt="${info.name}" loading="lazy">
      ${pm.shiny ? '<span class="mini-shiny">✨</span>' : ''}
      ${pm.id === S.leadId ? '<span class="mini-lead">⭐</span>' : ''}
      <span class="mini-lv-badge">${evoStageLabel(pm)}</span>
      ${shinyPickOn && !locked ? '<span class="mini-pick">用它 ✨</span>' : ''}
    </div>
    <div class="mini-line">
      <span class="mini-type" style="background:${TYPE_COLOR[type] || '#a8a878'}">${TYPE_NAME[type] || type}</span>
      <span class="mini-name">${info.name}</span>
    </div>
    <div class="mini-time"><span class="ball-ico">${pmBallIcon(pm.id)}</span> ${caughtShort(pm.caught_at)}</div>
  </div>`;
}

// 卡牌详情（PTCG 风格全屏）
function showCardDetail(pm) {
  const info = PK_BY_NO[pm.pokedex_no];
  const type = pmType(pm.pokedex_no);
  const theme = TYPE_THEME[type] || TYPE_THEME.normal;
  const maxed = isMaxed(pm);
  const expPct = maxed ? 100 : Math.min(100, pm.exp / expThreshold(pm) * 100);
  const evo = canEvolve(pm);
  const isLead = pm.id === S.leadId;
  const ov = $('overlay');
  ov.classList.remove('hidden');
  ov.className = 'overlay card-view';
  ov.innerHTML = `
    <div class="ptcg" style="--tc:${theme.color}; --bg1:${theme.bg1}; --bg2:${theme.bg2}">
      <div class="ptcg-top">
        <span class="ptcg-name">${info.name}</span>
        ${pm.shiny ? '<span class="ptcg-shiny">✨ 闪耀形态</span>' : ''}
        <span class="ptcg-lv">${evoStageLabel(pm)}</span>
      </div>
      <div class="ptcg-art${pm.shiny ? ' shiny-art' : ''}">
        <img src="${artworkPath(pm.pokedex_no)}">
        ${cardFxHTML(type)}
        <span class="ptcg-type">${TYPE_NAME[type] || type}</span>
        ${pm.shiny ? cardGlitterHTML() : ''}
      </div>
      ${movesBlockHTML(pm.pokedex_no, theme)}
      ${typeof PK_FLAVOR !== 'undefined' && PK_FLAVOR[pm.pokedex_no] ? `
      <div class="ptcg-flavor">📖 ${PK_FLAVOR[pm.pokedex_no]}</div>` : ''}
      <div class="ptcg-foot">
        <div class="ptcg-caught"><span class="ball-ico">${pmBallIcon(pm.id)}</span> ${caughtFull(pm.caught_at)}</div>
        <div class="ptcg-exprow">${maxed ? (pm.shiny ? '✨ 已满级（封顶）' : '✅ 已进入闪耀形态（这张是普通卡）') : `EXP ${pm.exp}/${expThreshold(pm)}`}</div>
        <div class="exp-track"><div class="exp-fill" style="width:${expPct}%"></div></div>
        ${evoChainLine(pm.pokedex_no)}
        ${evoFamily(pm.pokedex_no).length > 1 ? '<div class="chain-tip">👆 点上面的名字，可以看每个形态的详情</div>' : ''}
        ${((hasNextEvo(pm.pokedex_no) || !pm.shiny)) ? `<div class="ptcg-evo ${evo.ok ? 'ok' : ''}">${evo.ok ? (evo.shiny ? '✨ 可以进入闪耀形态啦！' : '✨ 可以进化啦！') : (evo.why ? '『' + evo.why + '』' : '')}</div>` : ''}
      </div>
      <div class="ptcg-btns">
        <button class="btn-lead" ${isLead ? 'disabled' : ''}>${isLead ? '⭐ 出战' : '出战'}</button>
        <button class="btn-feed" ${maxed ? 'disabled' : ''}>${maxed ? '✨ 已满级' : '🍬 喂糖果'}</button>
        ${(hasNextEvo(pm.pokedex_no) || evo.ok) ? `<button class="btn-evo" ${evo.ok ? '' : 'disabled'}>${evo.shiny ? '✨ 闪耀' : '进化'}</button>` : ''}
        <button class="btn-close">✕ 关闭</button>
      </div>
    </div>
  `;
  ov.querySelector('.btn-close').onclick = () => ov.classList.add('hidden');
  ov.querySelector('.btn-lead').onclick = () => { setLead(pm.id); ov.classList.add('hidden'); };
  ov.querySelector('.btn-feed').onclick = () => { if (maxed) return; ov.classList.add('hidden'); openFeed(pm.id); };
  const evoBtn = ov.querySelector('.btn-evo');
  if (evoBtn) evoBtn.onclick = async () => { ov.classList.add('hidden'); await evolvePm(pm); };
  bindChainClicks(ov);
  bindMoveClicks(ov);
}

// 图鉴里点开某一形态的详情：进化后前一阶也能看（没有对应个体时用只读卡）
function showDexDetail(no) {
  const info = PK_BY_NO[no];
  if (!info) return;
  const owned = S.pokemons.find(p => p.pokedex_no === no);
  if (owned) { showCardDetail(owned); return; }          // 正好拥有这只 → 完整详情
  const { got, shinyOwned } = dexGot();
  if (!got[no]) { showDexMissing(no); return; }          // 还没收集到 → 也点得开（剪刀影卡，不剧透）
  const type = pmType(no);
  const theme = TYPE_THEME[type] || TYPE_THEME.normal;
  const shiny = shinyOwned.has(no);
  const famPm = S.pokemons.find(p => evoFamily(p.pokedex_no).includes(no));
  const famName = famPm ? PK_BY_NO[famPm.pokedex_no].name + (famPm.shiny ? ' ✨' : '') : '';
  const ov = $('overlay');
  ov.classList.remove('hidden');
  ov.className = 'overlay card-view';
  ov.innerHTML = `
    <div class="ptcg" style="--tc:${theme.color}; --bg1:${theme.bg1}; --bg2:${theme.bg2}">
      <div class="ptcg-top">
        <span class="ptcg-name">${info.name}</span>
        ${shiny ? '<span class="ptcg-shiny">✨ 闪耀家族</span>' : ''}
        <span class="ptcg-lv">图鉴</span>
      </div>
      <div class="ptcg-art${shiny ? ' shiny-art' : ''}">
        <img src="${artworkPath(no)}">
        ${cardFxHTML(type)}
        <span class="ptcg-type">${TYPE_NAME[type] || type}</span>
        ${shiny ? cardGlitterHTML() : ''}
      </div>
      ${movesBlockHTML(no, theme)}
      ${typeof PK_FLAVOR !== 'undefined' && PK_FLAVOR[no] ? `
      <div class="ptcg-flavor">📖 ${PK_FLAVOR[no]}</div>` : ''}
      <div class="ptcg-foot">
        <div class="ptcg-exprow">📚 ${stageLabelByNo(no)}${famPm ? ` · 同家族你拥有 ${famName}` : ''}</div>
        ${evoChainLine(no)}
        ${evoFamily(no).length > 1 ? '<div class="chain-tip">👆 点上面的名字，可以切换查看其它形态</div>' : ''}
      </div>
      <div class="ptcg-btns dex-btns" style="grid-template-columns:repeat(${famPm ? 2 : 1}, 1fr)">
        ${famPm ? `<button class="btn-lead btn-owned">看我的 ${famName}</button>` : ''}
        <button class="btn-close">✕ 关闭</button>
      </div>
    </div>
  `;
  ov.querySelector('.btn-close').onclick = () => ov.classList.add('hidden');
  const ob = ov.querySelector('.btn-owned');
  if (ob) ob.onclick = () => showCardDetail(famPm);
  bindChainClicks(ov);
  bindMoveClicks(ov);
}

// 图鉴里还没收集到的：给一张「剪影卡」，不剧透名字/属性/招式
function showDexMissing(no) {
  const ov = $('overlay');
  ov.classList.remove('hidden');
  ov.className = 'overlay card-view';
  ov.innerHTML = `
    <div class="ptcg ptcg-missing" style="--tc:#90a4ae; --bg1:#e6ebee; --bg2:#8fa3ad">
      <div class="ptcg-top">
        <span class="ptcg-name">？？？</span>
        <span class="ptcg-lv">#${no}</span>
      </div>
      <div class="ptcg-art">
        <img src="${artworkPath(no)}" alt="">
        <span class="ptcg-type">未收集</span>
      </div>
      <div class="ptcg-moves">
        <div class="pmv-head">⚔️ 招式 <small>收集后解锁</small></div>
        ${[0, 1, 2, 3].map(() => `<div class="pmv locked">
          <span class="pmv-t" style="background:#b0bec5">？</span>
          <span class="pmv-n">？？？</span>
          <em class="pmv-p none">—</em>
          <span class="pmv-c">？？</span>
        </div>`).join('')}
      </div>
      <div class="ptcg-foot">
        <div class="ptcg-exprow">📚 这只还没收集到</div>
        <div class="chain-tip">${isBaseForm(no)
          ? '🥚 基础形态 · 用精灵球就能直接抓到，图鉴会自动点亮'
          : `🧬 由 ${PK_BY_NO[PK_EVOLVE_FROM[no]] ? PK_BY_NO[PK_EVOLVE_FROM[no]].name : '前一个形态'} 进化而来 · 精灵球抓不到，得把它养大`}</div>
        ${(() => {                                        // 后续进化方向：让人知道抓到之后能变成什么
          const evs = evoTargets(no);
          if (!evs.length) return '';
          const names = evs.map(n => PK_BY_NO[n].name).join(' / ');
          return `<div class="chain-tip">${evs.length > 1 ? `🔀 养大后可以在「${names}」里选一个` : `🧬 养大后会进化成 ${names}`}</div>`;
        })()}
      </div>
      <div class="ptcg-btns dex-btns" style="grid-template-columns:1fr">
        <button class="btn-close">✕ 关闭</button>
      </div>
    </div>
  `;
  ov.querySelector('.btn-close').onclick = () => ov.classList.add('hidden');
}

// 进化链展示（每个形态都可点开自己的详情，进化后前一阶也能看；分支用「/」并列，如伊布）
function evoChainLine(no) {
  const node = (c, isCur) => `<span class="tap ${isCur ? 'cur' : ''}" data-evo="${c}" title="查看 ${PK_BY_NO[c].name} 的详情"><img src="${spritePath(c, false)}" alt="">${PK_BY_NO[c].name}</span>`;
  const parts = evoAncestors(no).filter(c => c !== no).map(c => node(c, false));
  parts.push(node(no, true));
  // 往下走：单线继续延伸，遇到分支则把几个分支并列显示后停止
  let cur = no;
  for (let guard = 0; guard < 20; guard++) {
    const t = evoTargets(cur);
    if (!t.length) break;
    if (t.length > 1) { parts.push(t.map(c => node(c, false)).join('<i>/</i>')); break; }
    parts.push(node(t[0], false));
    cur = t[0];
  }
  // 自己是分支里的某一支：把"兄弟姐妹"也并列出来（伊布家族）
  if (!hasNextEvo(no)) {
    const parent = PK_EVOLVE_FROM[no];
    const sibs = parent !== undefined ? evoTargets(parent).filter(c => c !== no) : [];
    if (sibs.length) parts.push(sibs.map(c => node(c, false)).join('<i>/</i>'));
  }
  return `<div class="ptcg-chain">${parts.join('<i>→</i>')}</div>`;
}
// 把详情卡里的进化链做成可点（点某一形态 → 打开它的详情）
function bindChainClicks(ov) {
  ov.querySelectorAll('.ptcg-chain span[data-evo]').forEach(el => {
    el.onclick = e => { e.stopPropagation(); showDexDetail(Number(el.dataset.evo)); };
  });
}
// 阶段文案（按图鉴编号）
function stageLabelByNo(no) {
  const info = PK_BY_NO[no];
  if (!info) return '';
  const s = evoStage(no);
  if (!hasNextEvo(no)) return s === 0 ? '无进化' : '最终形态';
  return s === 0 ? '基础形态' : (s === 1 ? '一阶形态' : '最终形态');
}

function catchZoneHTML() {
  const ballIcons = Array.from({ length: Math.min(S.balls, 24) }).map(() => '<span class="mini-ball"></span>').join('');
  return `
    <div class="ball-row">${ballIcons || '<span style="font-size:12px;color:#8d6e63">0 个球</span>'}</div>
    <div class="catch-actions">
      <button class="btn-big" data-action="catch" ${S.balls < 1 ? 'disabled' : ''}>${POKE_ICON.ball('#e53935')} 捕捉宝可梦（1 个球）</button>
      <button class="btn-big buy" data-action="buyball" ${S.balance < CONFIG.BALL_PRICE ? 'disabled' : ''}>${POKE_ICON.master()} 买精灵球（${CONFIG.BALL_PRICE} 分）</button>
    </div>
    <div class="catch-hint">每次必抓到「没抓过的基础形态」（不重复）· 进化后的形态要靠喂养进化获得 · 连续 ${CONFIG.STREAK_DAYS_FOR_BALL} 天必做全清送 ✨ 闪耀卡，选一只宝可梦用掉就能多一张闪耀形态卡</div>
  `;
}

// ---------- 图鉴 ----------
// 某编号的整个家族（祖先 + 自己 + 所有后代，分支全部展开；仅用于"是否同族"判断）
function evoFamily(no) {
  return evoAncestors(no).concat(evoDescendants(no));
}
function dexGot() {
  const got = {};
  const shinyOwned = new Set();
  S.pokemons.forEach(p => {
    // 进化不会抹掉走过的形态：当前形态 + 它的所有前置形态都算已收集
    evoAncestors(p.pokedex_no).forEach(no => { got[no] = true; });
    if (p.shiny) {
      // 闪耀形态按整条进化链生效：祖先和后代（含分支）都点亮并标 ✨
      evoAncestors(p.pokedex_no).forEach(no => { got[no] = true; shinyOwned.add(no); });
      evoDescendants(p.pokedex_no).forEach(no => { got[no] = true; shinyOwned.add(no); });
    }
  });
  return { got, shinyOwned };
}
// 已收集（含闪耀家族的整链）编号集合，供"捕捉必新"使用，避免图鉴与可捕捉池不一致
function ownedNumbers() {
  const { got } = dexGot();
  const s = new Set();
  Object.keys(got).forEach(k => s.add(Number(k)));
  return s;
}
function dexGotCount() { return Object.keys(dexGot().got).length; }
function dexHTML() {
  const { got, shinyOwned } = dexGot();
  // POKEMON 数组按属性分组定义（组内升序、组间乱序），图鉴展示必须严格按编号 1-151
  const ordered = POKEMON.slice().sort((a, b) => a.no - b.no);
  return `
    <div class="dex-grid">
      ${ordered.map(p => {
        const has = got[p.no];
        const shiny = shinyOwned.has(p.no);
        return `
        <div class="dex-cell ${has ? '' : 'unknown'} ${shiny ? 'shiny-cell' : ''}" data-action="dex" data-no="${p.no}" title="${has ? `查看 ${p.name} 的详情` : '还没收集到，点开看看'}">
          ${has ? `<img src="${spritePath(p.no, shiny)}" loading="lazy">` : `<span class="q">?</span><img src="${spritePath(p.no, false)}" loading="lazy" style="display:none">`}
          <span class="no">#${p.no}</span>
          ${shiny ? '<span class="star">✨</span>' : ''}
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderMe() {
  const page = $('page');
  const streak = calcStreak();
  const weekDone = weekDoneCount();
  const pendCount = S.pointLogs.filter(l => l.confirmed === false && l.amount > 0).length;
  const ds = doneStats(S.statDim);
  page.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><b>${S.balance}</b><span>当前积分</span></div>
      <div class="stat-card"><b>${streak}</b><span>必做全清连击(天)</span></div>
      <div class="stat-card"><b>${S.pokemons.length}</b><span>我的宝可梦</span></div>
      <div class="stat-card"><b>${Object.values(ownDexCount()).length}</b><span>图鉴收集</span></div>
    </div>
    <div class="section-title" style="margin-top:16px">完成统计 <small>${statDimLabel(S.statDim)} · 打卡记录数</small></div>
    <div class="stat-grid">
      <div class="stat-card"><b>${ds.total}</b><span>累计完成</span></div>
      <div class="stat-card"><b>${ds.week}</b><span>近一周</span></div>
      <div class="stat-card"><b>${ds.month}</b><span>近一月</span></div>
    </div>
    ${pendCount ? `<div class="form-hint" style="text-align:center;margin-top:10px">⏳ 有 ${pendCount} 条积分在等家长确认，确认后才到账哦</div>` : ''}
    <div class="section-title">本周表现 <small>${weekDone}/7 天全清</small></div>
    <div class="catch-zone">
      <button class="btn-big" data-action="share" style="margin-bottom:8px">📸 生成成就图，发朋友圈</button>
      <button class="btn-big buy" data-action="catch" ${S.balls < 1 ? 'disabled' : ''}>🥚 去捕捉宝可梦</button>
    </div>
    ${kidCalPanel()}
    ${submissionListHTML()}
    ${approvedPointsHTML()}
    ${bonusLogsHTML()}
    ${minusLogsHTML()}
    <div class="section-title" style="margin-top:20px">积分记录</div>
    <div class="log-list">
      ${S.pointLogs.slice(0, 30).map(logItemHTML).join('') || '<div class="empty-tip">还没有积分记录</div>'}
    </div>
  `;
  renderKidCal();
}
// 孩子端「我的」页打卡日历（与统计同一维度）
function kidCalPanel() {
  const dailyTasks = S.tasks.filter(t => t.schedule === 'daily');
  return `
    <div class="panel" style="margin-top:16px">
      <h3>📅 打卡日历 <small style="font-weight:400">按每日任务</small></h3>
      <select id="kid-cal-dim" onchange="S.statDim=this.value;renderMe()" style="width:100%;margin-bottom:8px">
        <option value="all" ${S.statDim === 'all' ? 'selected' : ''}>全部每日任务</option>
        <option value="req" ${S.statDim === 'req' ? 'selected' : ''}>必做任务全清</option>
        <option value="opt" ${S.statDim === 'opt' ? 'selected' : ''}>选做任务全清</option>
        ${dailyTasks.map(t => `<option value="${t.id}" ${S.statDim === String(t.id) ? 'selected' : ''}>${t.title}</option>`).join('')}
      </select>
      <div id="kid-cal-root"></div>
      ${dailyTasks.length ? `
      <h3 style="margin-top:12px;font-size:13px">📋 打卡记录</h3>
      <select id="kid-log-task" onchange="showTaskLogs('kid-log-list', this.value)" style="width:100%">
        <option value="">选择打卡项</option>
        <option value="__all">全部每日任务</option>
        <option value="__req">必做任务全清</option>
        <option value="__opt">选做任务全清</option>
        ${dailyTasks.map(t => `<option value="${t.id}">${t.title}</option>`).join('')}
      </select>
      <div id="kid-log-list"></div>` : ''}
    </div>
  `;
}
// 每日任务打卡记录面板（孩子「我的」和家长端共用，下拉选任务看历史打卡）
function checkinLogPanel(title, idPrefix) {
  const dailyTasks = S.tasks.filter(t => t.schedule === 'daily');
  if (!dailyTasks.length) return '';
  const selId = idPrefix + '-log-task', listId = idPrefix + '-log-list';
  return `
    <div class="panel" style="margin-top:16px">
      <h3>${title}</h3>
      <select id="${selId}" onchange="showTaskLogs('${listId}', this.value)" style="width:100%">
        <option value="">选择打卡项</option>
        <option value="__all">全部每日任务</option>
        <option value="__req">必做任务全清</option>
        <option value="__opt">选做任务全清</option>
        ${dailyTasks.map(t => `<option value="${t.id}">${t.title}</option>`).join('')}
      </select>
      <div id="${listId}"></div>
    </div>
  `;
}
// 某组每日任务全部完成（全清）的日子
function allClearDates(tasks) {
  if (!tasks.length) return [];
  const dates = [];
  for (const d in S.logs) {
    let all = true;
    for (const t of tasks) { const l = S.logs[d][t.id]; if (!(l && (l.completed || l.done))) { all = false; break; } }
    if (all) dates.push(d);
  }
  return dates;
}
// 展示打卡记录（支持全部每日/必做全清/选做全清/单个任务）
function showTaskLogs(listId, key) {
  const el = document.getElementById(listId);
  if (!el) return;
  if (!key) { el.innerHTML = ''; return; }
  const daily = S.tasks.filter(t => t.schedule === 'daily');
  let dates = [];
  if (key === '__all') {
    // 全部每日任务的打卡日（去重）
    const set = new Set();
    daily.forEach(t => { for (const d in S.logs) { const l = S.logs[d][t.id]; if (l && (l.completed || l.done)) set.add(d); } });
    dates = [...set];
  } else if (key === '__req') {
    dates = allClearDates(daily.filter(t => t.required !== false));
  } else if (key === '__opt') {
    dates = allClearDates(daily.filter(t => t.required === false));
  } else {
    for (const d in S.logs) { const l = S.logs[d][key]; if (l && (l.completed || l.done)) dates.push(d); }
  }
  dates.sort();
  el.innerHTML = dates.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${dates.map(d => `<span class="chip" style="font-size:12px">✓ ${d.slice(5)}</span>`).join('')}</div><div class="form-hint" style="margin-top:6px">共 ${dates.length} 次打卡</div>`
    : '<div class="form-hint" style="margin-top:8px">还没有打卡记录</div>';
}
// 一条积分流水（孩子端）
function logItemHTML(l) {
  return `<div class="log-item"><span>${l.confirmed === false ? '⏳ ' : ''}${l.reason}</span><span class="when">${l.log_date} ${fmtTime(l.created_at)} <b class="amt ${l.amount >= 0 ? 'plus' : 'minus'}">${l.amount >= 0 ? '+' : ''}${l.amount}</b></span></div>`;
}
// 额外奖励（全清奖 / 家长奖励等）
function bonusLogsHTML() {
  const rows = S.pointLogs.filter(l => l.amount > 0 && /全清|家长奖励|全勤/.test(l.reason)).slice(0, 10);
  return `
    <div class="section-title" style="margin-top:20px">⭐ 额外奖励</div>
    <div class="log-list">${rows.map(logItemHTML).join('') || '<div class="empty-tip">还没有额外奖励</div>'}</div>
  `;
}
// 扣分（喂养 / 买球 / 家长扣分等）
function minusLogsHTML() {
  const rows = S.pointLogs.filter(l => l.amount < 0).slice(0, 10);
  return `
    <div class="section-title" style="margin-top:20px">➖ 扣分</div>
    <div class="log-list">${rows.map(logItemHTML).join('') || '<div class="empty-tip">还没有扣分</div>'}</div>
  `;
}
// 轻量 HTML 转义（任务名可能含 < & 等字符）
function escHTML(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// 「我的」页①：任务提交记录（孩子提交过哪些任务、待确认 / 已确认）
function submissionListHTML() {
  const titleOf = id => { const t = S.tasks.find(x => String(x.id) === String(id)); return t ? t.title : `任务 #${id}`; };
  const rows = [];
  for (const d in S.logs) {
    for (const tid in S.logs[d]) {
      const l = S.logs[d][tid];
      if (!l || !l.done) continue;
      rows.push({ date: d, title: titleOf(tid), approved: l.approved !== false });
    }
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const pend = rows.filter(r => !r.approved).length;
  const head = rows.length ? (pend ? `${pend} 条待家长确认` : '全部已确认') : '暂无提交';
  return `
    <div class="section-title" style="margin-top:20px">📤 任务提交 <small>${head}</small></div>
    <div class="log-list">
      ${rows.slice(0, 30).map(r => `
        <div class="log-item">
          <span>${r.approved ? '✅' : '⏳'} ${escHTML(r.title)}</span>
          <span class="when">${r.date.slice(5)} <b style="color:${r.approved ? '#43a047' : '#fb8c00'}">${r.approved ? '已确认' : '待确认'}</b></span>
        </div>`).join('') || '<div class="empty-tip">还没有提交过任务</div>'}
      ${rows.length > 30 ? `<div class="form-hint" style="padding:10px 16px">仅显示最近 30 条，共 ${rows.length} 条</div>` : ''}
    </div>
  `;
}
// 「我的」页②：家长确认后到账的任务积分（显示具体是哪项任务）
function approvedPointsHTML() {
  const taskRe = /^(完成|多日完成奖)[:：]/;
  const all = S.pointLogs.filter(l => l.amount > 0 && l.confirmed !== false && (l.task_id || taskRe.test(l.reason || '')));
  const rows = all.slice(0, 30);
  const sum = all.reduce((s, l) => s + l.amount, 0);
  const nameOf = l => {
    const t = l.task_id ? S.tasks.find(x => String(x.id) === String(l.task_id)) : null;
    if (t) return t.title;
    return String(l.reason || '').replace(/^(完成|多日完成奖)[:：]\s*/, '');
  };
  return `
    <div class="section-title" style="margin-top:20px">🏅 家长确认获得积分 <small>${all.length ? `共 ${all.length} 笔 · 合计 +${sum}` : '暂无'}</small></div>
    <div class="log-list">
      ${rows.map(l => `
        <div class="log-item">
          <span>🏅 ${escHTML(nameOf(l))}</span>
          <span class="when">${String(l.log_date || '').slice(5)} <b class="amt plus">+${l.amount}</b></span>
        </div>`).join('') || '<div class="empty-tip">家长还没有确认过任务积分</div>'}
    </div>
  `;
}
function ownDexCount() {
  return dexGot().got;
}
function weekDoneCount() {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now); monday.setDate(now.getDate() - (day - 1));
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const ds = fmtDate(d);
    const dayLogs = S.logs[ds];
    if (dayLogs && Object.keys(dayLogs).length && Object.values(dayLogs).every(l => l && l.done)) n++;
  }
  return n;
}

// ---------- 渲染调度 ----------
function render() {
  if (S.role === 'parent') { renderParent(); return; }
  if (S.tab !== 'pokemon') shinyPickOn = false;   // 离开宝可梦页就退出「选一只用闪耀卡」
  $('app').innerHTML = kidShellHTML();
  bindKidTabs();
  if (S.tab === 'tasks') renderTasks();
  else if (S.tab === 'pokemon') renderPokemons();
  else renderMe();
  renderTop();
  makeDraggableFab('#kid-logout-fab');
}
function kidShellHTML() {
  const pend = loadNotices().length;
  return `
    <div class="topbar">
      ${DEMO_ACTIVE ? '<div class="demo-tag">🎬 演示模式</div>' : ''}
      <div class="title">🏝️ 佑佑的任务岛<small>${mottoText()}</small></div>
      <div class="badges">
        <span class="badge">⭐ <b id="pt">0</b></span>
        <span class="badge ball">🔴 <b id="bl">0</b></span>
      </div>
    </div>
    ${pend ? '' : ptsNoticeHTML()}
    <div class="page" id="page"></div>
    <nav class="tabbar">
      <button class="${S.tab === 'tasks' ? 'on' : ''}" data-tab="tasks"><span class="ico">${POKE_ICON.ball('#e53935')}</span>任务${pend ? `<i class="tab-dot">${pend > 9 ? '9+' : pend}</i>` : ''}</button>
      <button class="${S.tab === 'pokemon' ? 'on' : ''}" data-tab="pokemon"><span class="ico">${POKE_ICON.ultra()}</span>宝可梦</button>
      <button class="${S.tab === 'me' ? 'on' : ''}" data-tab="me"><span class="ico">${POKE_ICON.dex()}</span>我的</button>
      <button class="secret" id="btn-parent"><span class="ico">${POKE_ICON.master()}</span>家长</button>
    </nav>
    ${kidShellLogout()}
  `;
}
// 孩子端：家长已登录状态时，右下角悬浮「登出」便于退出家长身份
function kidShellLogout() {
  // 只要本机记住过家长身份（真实/演示模式都算），孩子页就保留「登出」
  // 注意：演示模式下点「家长」是免密直进的，不写 parent_authed，所以不能再用 DEMO_ACTIVE 提前 return
  if (localStorage.getItem(LK('parent_authed')) !== '1') return '';
  // 给悬浮按钮一个 id，便于做成可拖动；位置在 tabbar 上方
  return `<div class="fab-col" id="kid-logout-fab"><button class="fab-btn logout" data-action="kid-logout">登出</button></div>`;
}
// 孩子端顶部：家长新发放积分到账提示条（按已读记录过滤）
function ptsNoticeHTML() {
  const seen = Number(lsGet(LK('seen_pts'), 0)) || 0;
  const unread = S.pointLogs
    .filter(l => l.id > seen && l.amount > 0 && l.confirmed !== false && l.reason !== '演示初始积分')
    .reduce((s, l) => s + l.amount, 0);
  if (!unread) return '';
  return `<div class="pts-notice">🔔 家长发来 <b>+${unread}</b> 积分！<button class="chip red" data-action="pts-dismiss">知道了</button></div>`;
}
// 切换查看日期后加载当天叮嘱（孩子端/家长端）
async function refreshViewNote() { S.viewNote = await DB.getNote(S.viewDate) || null; render(); }
async function refreshParentNote() { S.parentNote = await DB.getNote(S.parentDate) || null; render(); }
// 叮嘱每行的图标：按「行号 + 文字」稳定哈希，从宝可梦道具里挑一个。
// 用哈希不用 Math.random —— 刷新/切日期回来图标不会乱跳，同一句话永远配同一个图标。
function noteLineIconKey(text, idx, used) {
  const keys = (typeof POKE_ICON_KEYS !== 'undefined' && POKE_ICON_KEYS.length) ? POKE_ICON_KEYS : null;
  if (!keys) return null;
  let h = 17 + idx * 131;
  for (const ch of String(text)) h = (h * 31 + (ch.codePointAt(0) || 0)) % 100003;
  let key = keys[h % keys.length];
  if (used && used.has(key)) {                     // 相邻几行别撞成同一个图标
    const pool = keys.filter(k => !used.has(k));
    if (pool.length) key = pool[h % pool.length];
  }
  return key;
}
// 孩子端：当日叮嘱卡片（等宽圆角，和任务列表一致），随日期切换；一行一句话，每行配一个宝可梦道具图标
function noteCardHTML() {
  const txt = String(S.viewNote == null ? '' : S.viewNote).trim();
  if (!txt) return '';
  const lines = txt.split('\n').map(l => l.trim()).filter(Boolean);
  const used = new Set();
  const rows = lines.map((l, i) => {
    const key = noteLineIconKey(l, i, used);
    if (key) used.add(key);
    const ico = key && typeof catIconByKey === 'function' ? catIconByKey(key) : '';
    return `<li><span class="note-ico">${ico}</span><span class="note-line">${escHTML(l)}</span></li>`;
  }).join('');
  return `<div class="note-card"><div class="note-head">💬 每日叮嘱</div><ul class="note-lines">${rows}</ul></div>`;
}
function bindKidTabs() {
  const tabs = document.querySelectorAll('.tabbar button[data-tab]');
  tabs.forEach(b => b.onclick = () => { S.tab = b.dataset.tab; render(); });
  $('btn-parent').onclick = () => {
    // 演示模式下已具备家长身份，直接进入不再要密码
    if (DEMO_ACTIVE) { S.role = 'parent'; localStorage.setItem(LK('role'), 'parent'); localStorage.setItem(LK('parent_authed'), '1'); render(); return; }
    // 本机已验证过家长密码（或从家长端切换过来）→ 免密直接进入
    if (localStorage.getItem(LK('parent_authed')) === '1') { S.role = 'parent'; localStorage.setItem(LK('role'), 'parent'); render(); return; }
    // 快速进入：家长密码（自绘弹窗，不用 prompt —— 预览面板/内嵌 WebView 会禁用原生弹窗）
    openParentAuth();
  };
}
// 孩子端"登出"悬浮按钮：可拖动，避免遮挡底部入口
function makeDraggableFab(sel) {
  const el = document.querySelector(sel);
  if (!el) return;
  let startX = 0, startY = 0, ox = 0, oy = 0, dragging = false, moved = false;
  const onStart = (x, y) => {
    dragging = true; moved = false;
    startX = x; startY = y;
    const r = el.getBoundingClientRect();
    ox = r.left; oy = r.top;
    el.style.transition = 'none';
  };
  const onMove = (x, y) => {
    if (!dragging) return;
    const dx = x - startX, dy = y - startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
    el.style.left = (ox + dx) + 'px';
    el.style.top = (oy + dy) + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    if (moved) { window.__fabDragged = true; setTimeout(() => { window.__fabDragged = false; }, 350); }
  };
  el.addEventListener('touchstart', e => { onStart(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  el.addEventListener('touchmove', e => { onMove(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); }, { passive: false });
  el.addEventListener('touchend', onEnd);
  el.addEventListener('mousedown', e => {
    onStart(e.clientX, e.clientY);
    const mm = ev => onMove(ev.clientX, ev.clientY);
    const mu = () => { onEnd(); document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
  });
}

// 家长端任务列表：长按/按住拖动排序（手机 touch + 桌面 mouse）
// 行外层包了 .swipe-item（左滑删除用），所以拖动单位是 .swipe-item，没包的直接拖 .prow
function enableDragSort(sel) {
  const list = document.querySelector(sel);
  if (!list) return;
  const itemOf = node => (node && (node.closest('.swipe-item') || node.closest('.prow'))) || null;
  const rows = () => [...list.children].filter(c => c.classList.contains('swipe-item') || c.classList.contains('prow'));
  let drag = null;
  // 手机长按会弹「选择文字/复制」菜单，必须先禁用，否则系统选中会打断长按排序
  list.addEventListener('contextmenu', e => {
    if (itemOf(e.target)) e.preventDefault();
  });
  list.addEventListener('selectstart', e => {
    if (itemOf(e.target)) e.preventDefault();
  });
  function moveBy(dy) {
    const r = rows();
    const h = (r[0] ? r[0].offsetHeight : 40) + 4;
    let cur = r.indexOf(drag.el);
    let target = Math.min(r.length - 1, Math.max(0, cur + Math.round(dy / h)));
    if (target !== cur && r[target]) {
      drag.moved = true;
      list.insertBefore(drag.el, target > cur ? r[target].nextSibling : r[target]);
      drag.startY += (target - cur) * h;  // 行已移动，起始基准同步，继续拖能连续换位
      drag.el.classList.add('dragging');
    }
  }
  async function saveSort() {
    const r = rows();
    for (let i = 0; i < r.length; i++) await DB.updateTask(Number(r[i].dataset.tid), { sort: i });
    await refreshAll(); render();
  }
  // 手机：长按 650ms 且按下后基本没移动，才进入拖动（避免滑动页面时误触发排序）
  list.addEventListener('touchstart', e => {
    const el = itemOf(e.target);
    if (!el) return;
    const t = e.touches[0];
    drag = { el, startY: t.clientY, startX: t.clientX, armed: false, moved: false, timer: null };
    drag.timer = setTimeout(() => { if (drag) { drag.armed = true; el.classList.add('dragging'); } }, 650);
  }, { passive: true });
  list.addEventListener('touchmove', e => {
    if (!drag) return;
    const t = e.touches[0];
    if (!drag.armed) {
      // 按下后若移动较多（像在滑动页面），取消长按计时，不当成排序
      if (Math.abs(t.clientY - drag.startY) > 12 || Math.abs(t.clientX - drag.startX) > 24) {
        clearTimeout(drag.timer); drag.armed = false;
      }
      return;
    }
    e.preventDefault();
    moveBy(t.clientY - drag.startY);
  }, { passive: false });
  list.addEventListener('touchend', () => {
    if (!drag) return;
    clearTimeout(drag.timer);
    if (drag.armed && drag.moved) saveSort();
    if (drag.el) drag.el.classList.remove('dragging');
    drag = null;
  });
  // 桌面：鼠标直接按住拖动
  list.addEventListener('mousedown', e => {
    if (e.target.closest('.swipe-del')) return;
    const el = itemOf(e.target);
    if (!el) return;
    e.preventDefault();
    drag = { el, startY: e.clientY, armed: true, moved: false, timer: null };
    el.classList.add('dragging');
    const onMove = ev => { if (!drag) return; moveBy(ev.clientY - drag.startY); };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (drag && drag.moved) saveSort();
      if (drag && drag.el) drag.el.classList.remove('dragging');
      drag = null;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// 家长端任务行左滑：手指左推 ≥40px 松手，行停在左侧、右侧露出「删除」；点行或点别处收起
function bindSwipeDelete(sel) {
  const list = document.querySelector(sel);
  if (!list) return;
  const OPEN = 78;
  let cur = null, startX = 0, startY = 0, dx = 0, dir = '';
  const closeAll = except => {
    list.querySelectorAll('.swipe-item.open').forEach(el => { if (el !== except) el.classList.remove('open'); });
  };
  list.addEventListener('touchstart', e => {
    const item = e.target.closest('.swipe-item');
    if (!item || e.target.closest('.swipe-del')) return;
    closeAll(item);
    const t = e.touches[0];
    cur = item; startX = t.clientX; startY = t.clientY; dx = 0; dir = '';
  }, { passive: true });
  list.addEventListener('touchmove', e => {
    if (!cur) return;
    const t = e.touches[0];
    const mx = t.clientX - startX, my = t.clientY - startY;
    if (!dir) {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.2) dir = 'x';
      else if (Math.abs(my) > 10) { dir = 'y'; cur = null; return; }   // 竖向 = 滚页面/拖动排序，不接管
    }
    if (dir !== 'x') return;
    const base = cur.classList.contains('open') ? -OPEN : 0;
    dx = Math.max(-OPEN - 12, Math.min(0, mx + base));
    const row = cur.querySelector('.prow');
    if (row) row.style.transform = `translateX(${dx}px)`;
    e.preventDefault();
  }, { passive: false });
  const end = () => {
    if (!cur) { dir = ''; dx = 0; return; }
    const item = cur; cur = null;
    const row = item.querySelector('.prow');
    if (row) row.style.transform = '';
    if (dir === 'x') item.classList.toggle('open', dx <= -40);
    dir = ''; dx = 0;
  };
  list.addEventListener('touchend', end);
  list.addEventListener('touchcancel', end);
}

// 家长端上移/下移调整任务展示顺序（重排 sort）
async function moveTask(id, dir) {
  const all = tasksOnDate(S.parentDate);
  const t = all.find(x => x.id === id);
  if (!t) return;
  // 只在必做/选做各自分区内移动，不会跨区
  const list = all.filter(x => (x.required === false) === (t.required === false)).sort(taskSort);
  const i = list.findIndex(x => x.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) { toast('已经是边缘了'); return; }
  const arr = [...list];
  [arr[i], arr[j]] = [arr[j], arr[i]];
  for (let k = 0; k < arr.length; k++) await DB.updateTask(arr[k].id, { sort: k });
  await refreshAll(); render();
}

function bindActions() {
  document.body.onclick = async e => {
    // 左滑打开的任务行：点行本身（不是删除按钮）= 先收起，不弹编辑
    const openRow = e.target.closest('.swipe-item.open');
    if (openRow && !e.target.closest('.swipe-del')) { openRow.classList.remove('open'); return; }
    // 常用任务排序模式：点到标签区域以外的地方就退出（点「确认」走下面的 action）
    if (quickSorting && !e.target.closest('#pt-quick-list, .quick-sort, .quick-add')) {
      saveQuickOrderFromDom();
      setQuickSort(false);
      render();
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    const tid = btn.dataset.tid, pmid = btn.dataset.pmid;
    if (act === 'checkin') await checkin(Number(tid), btn, btn.dataset.prog ? Number(btn.dataset.prog) : null);
    else if (act === 'streak-claim') await claimStreak();
    else if (act === 'shiny-pick') { shinyPickOn = true; renderPokemons(); }
    else if (act === 'shiny-cancel') { shinyPickOn = false; renderPokemons(); }
    else if (act === 'shiny-apply') await applyShinyCard(pmid);
    else if (act === 'shiny-locked') toast('这只已经有闪耀卡啦，换一只吧');
    else if (act === 'cancel-submit') await cancelSubmission(Number(tid));
    else if (act === 'notice-ack') ackNotice(btn.dataset.nid);
    else if (act === 'notice-ack-all') ackNotice('*');
    else if (act === 'task-detail') showTaskDetail(Number(tid), S.viewDate);
    else if (act === 'progress-detail') showProgressDetail(btn.dataset.kind);
    else if (act === 'weekly-detail') showWeeklyChildren(Number(tid));
    else if (act === 'date-prev') { S.viewDate = shiftDate(S.viewDate, -1); render(); refreshViewNote(); }
    else if (act === 'date-next') { if (S.viewDate < DB.today()) { S.viewDate = shiftDate(S.viewDate, 1); render(); refreshViewNote(); } }
    else if (act === 'date-today') { S.viewDate = DB.today(); render(); refreshViewNote(); }
    else if (act === 'card') { const pm = S.pokemons.find(p => p.id === Number(pmid)); if (pm) showCardDetail(pm); }
    else if (act === 'dex') showDexDetail(Number(btn.dataset.no));
    else if (act === 'feed') openFeed(Number(pmid));
    else if (act === 'evolve') { const pm = S.pokemons.find(p => p.id === Number(pmid)); if (pm) evolvePm(pm); }
    else if (act === 'lead') { setLead(Number(pmid)); }
    else if (act === 'catch') catchOne();
    else if (act === 'buyball') buyBall();
    else if (act === 'parent-save') saveParentTask(btn);
    else if (act === 'parent-del') {
      const dt = S.tasks.find(x => x.id === Number(tid));
      await DB.deleteTask(Number(tid));
      await refreshAll(); render();
      toast(dt ? `已删除「${dt.title}」` : '已删除');
    }
    else if (act === 'parent-del-cat') { deleteCat(btn.dataset.cat); render(); }
    else if (act === 'parent-add-cat') { const c = ($('pt-newcat').value || '').trim(); if (c) { saveCat(c); $('pt-newcat').value = ''; render(); } }
    else if (act === 'parent-edit-weekly') openWeeklyEditor(Number(tid));
    else if (act === 'parent-quick') openQuickAddTask(Number(btn.dataset.idx));
    else if (act === 'parent-quick-sort') {
      if (quickSorting) { saveQuickOrderFromDom(); setQuickSort(false); render(); }
      else { setQuickSort(true); toast('长按标签拖动就能改顺序，点「确认」结束'); }
    }
    else if (act === 'parent-quick-edit') openQuickEdit(Number(btn.dataset.idx));
    else if (act === 'parent-quick-add') { if (quickSorting) setQuickSort(false); openQuickEdit(-1); }
    else if (act === 'parent-del-quick') delQuick(Number(btn.dataset.idx));
    else if (act === 'parent-parse') parseBatch();
    else if (act === 'parent-exit') { S.role = 'kid'; localStorage.setItem(LK('role'), 'kid'); localStorage.setItem(LK('parent_authed'), '1'); render(); }
    else if (act === 'parent-lock') { localStorage.removeItem(LK('parent_authed')); S.role = 'kid'; localStorage.setItem(LK('role'), 'kid'); toast('已登出，进家长端需重新输入密码'); render(); }
    else if (act === 'kid-logout') { if (window.__fabDragged) return; localStorage.removeItem(LK('parent_authed')); toast('已登出家长身份'); render(); }
    else if (act === 'parent-cal') { S.calOffset += Number(btn.dataset.step || 0); renderKidCal(); }
    else if (act === 'parent-date-prev') { S.parentDate = shiftDate(S.parentDate, -1); render(); refreshParentNote(); }
    else if (act === 'parent-date-next') { S.parentDate = shiftDate(S.parentDate, 1); render(); refreshParentNote(); }
    else if (act === 'parent-date-today') { S.parentDate = DB.today(); render(); refreshParentNote(); }
    else if (act === 'parent-multi') openMultiDayAssign();
    else if (act === 'parent-move') moveTask(Number(tid), btn.dataset.dir);
    else if (act === 'parent-edit') openTaskEditor(Number(tid));
    else if (act === 'parent-edit-note') openNoteEditor();
    else if (act === 'parent-settings') openSettings();
    else if (act === 'err-view') openErrorLog();
    else if (act === 'err-clear') { if (await askConfirm('清空错误日志？', { okText: '清空' })) { saveErrors([]); toast('已清空错误日志'); render(); } }
    else if (act === 'pts-dismiss') { lsSet(LK('seen_pts'), Math.max(0, ...S.pointLogs.filter(l => l.amount > 0 && l.confirmed !== false).map(l => l.id))); render(); }
    else if (act === 'parent-giveball') giveBall();
    else if (act === 'parent-givepts') givePts();
    else if (act === 'parent-minuspts') minusPts();
    else if (act === 'parent-reset-demo') await resetDemo();
    else if (act === 'parent-demo-enter') await enterDemoMode();
    else if (act === 'parent-demo-exit') await exitDemoMode();
    // 家长端已移除「放生」入口（防误点），deletePokemon 保留给未来扩展
    else if (act === 'parent-confirm') confirmPending();
    else if (act === 'parent-undo') await undoPoint(Number(btn.dataset.plid));
    else if (act === 'share') shareCard();
  };
}
function setLead(id) {
  S.leadId = id; localStorage.setItem(LK('lead'), id);
  render();
  toast(`⭐ 它成为你的伙伴了！完成任务会帮它 +${CONFIG.LEAD_EXP_PER_TASK} 经验`);
}
function openFeed(pmId) {
  const pm = S.pokemons.find(p => p.id === pmId);
  if (!pm) return;
  if (isMaxed(pm)) { toast('它已经是闪耀形态啦～'); return; }
  const bal = S.balance;
  if (bal <= 0) { toast('还没有积分，先去做任务赚积分吧～'); return; }
  const thr = expThreshold(pm);
  const need = Math.max(0, thr - pm.exp);     // 距离下一阶段还差多少经验（1 分 = 1 经验）
  const word = nextStageWord(pm);
  // 快捷面额：不超过余额，也不和"刚好够"重复
  const quick = [10, 25, 50, 100].filter((v, i, a) => a.indexOf(v) === i && v > 0 && v <= bal && v !== need);
  // 一键喂到下一阶段：余额够就正好补齐，不够则提示还差多少
  const exact = need > 0
    ? (bal >= need
      ? `<button class="feed-exact" data-v="${need}">🚀 刚好${word}（${need} 分）</button>`
      : `<button class="feed-exact" disabled>🚀 还差 ${need - bal} 分可${word}</button>`)
    : '';
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal">
      <h3>🍬 喂 ${pm.name} 糖果</h3>
      <p class="feed-sub">当前积分 <b>${bal}</b> · 经验 <b>${pm.exp}/${thr}</b>${need > 0 ? ` · 还差 <b>${need}</b> 分${word}` : ''}</p>
      <div class="feed-opts">
        ${exact}
        ${quick.map(v => `<button data-v="${v}">${v} 分</button>`).join('')}
        <button class="feed-all" data-v="${bal}">全部（${bal} 分）</button>
      </div>
      <div class="feed-custom">
        <input id="feed-amt" type="number" inputmode="numeric" min="1" max="${bal}" placeholder="自定义积分，最多 ${bal}">
        <button class="feed-go">喂</button>
      </div>
      <div class="feed-hint">1 积分 = 1 经验，喂满一管自动${word}；喂完会停在它的详情页</div>
      <div style="margin-top:12px"><button class="btn-cancel" style="width:100%">取消</button></div>
    </div>
  `;
  modal.querySelectorAll('.feed-opts button[data-v]').forEach(b => {
    b.onclick = () => feedPm(pm, Number(b.dataset.v));
  });
  const input = modal.querySelector('#feed-amt');
  const submit = () => feedPm(pm, Math.floor(Number(input.value) || 0));
  modal.querySelector('.feed-go').onclick = submit;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  modal.querySelector('.btn-cancel').onclick = () => modal.remove();
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}
function hideModal() { document.querySelectorAll('.modal-mask').forEach(m => m.remove()); }

// ---------- 自绘确认框 / 密码框 ----------
// 为什么不用原生 prompt()/confirm()：网页被嵌在预览面板、iframe、部分 App 的 WebView 里时
// 原生弹窗会被宿主禁用（报 "prompt() is not supported"），手机上却一切正常。
// 所以统一用页面内的 .modal-mask 自己画，任何环境表现一致。
function askConfirm(msg, opt = {}) {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'modal-mask';
    const okText = opt.okText || '确定';
    const danger = opt.danger !== false;
    const lines = String(msg == null ? '' : msg).split('\n').map(l => escHTML(l)).join('<br>');
    modal.innerHTML = `
      <div class="modal" style="max-width:340px">
        <h3>${escHTML(opt.title || '请确认')}</h3>
        <div class="ask-msg">${lines}</div>
        <div class="row" style="margin-top:16px">
          <button class="btn-cancel" data-no>取消</button>
          <button class="${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${escHTML(okText)}</button>
        </div>
      </div>`;
    let done = false;
    const fin = v => {
      if (done) return;
      done = true;
      document.removeEventListener('keydown', onKey);
      modal.remove();
      resolve(v);
    };
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); fin(false); }
      else if (e.key === 'Enter') { e.preventDefault(); fin(true); }
    };
    modal.querySelector('[data-yes]').onclick = () => fin(true);
    modal.querySelector('[data-no]').onclick = () => fin(false);
    modal.addEventListener('click', e => { if (e.target === modal) fin(false); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(modal);
    setTimeout(() => { const b = modal.querySelector('[data-yes]'); if (b) b.focus(); }, 50);
  });
}

// 家长密码（替代 prompt：内置预览面板里 prompt 被禁用）
function openParentAuth() {
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal" style="max-width:330px">
      <h3>🔒 家长验证</h3>
      <div class="ask-msg" style="margin-bottom:10px">输入家长密码进入家长端</div>
      <input id="pw-input" type="password" inputmode="numeric" autocomplete="off"
             placeholder="家长密码" maxlength="20" style="text-align:center;letter-spacing:4px;font-size:16px">
      <div class="pw-err" id="pw-err"></div>
      <div class="row" style="margin-top:6px">
        <button class="btn-cancel" data-no>取消</button>
        <button class="btn-primary" data-yes>进入</button>
      </div>
    </div>`;
  const box = modal.querySelector('.modal');
  const input = modal.querySelector('#pw-input');
  const err = modal.querySelector('#pw-err');
  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    document.removeEventListener('keydown', onKey);
    modal.remove();
  };
  const submit = () => {
    const val = String(input.value || '').trim();
    if (!val) { failTip('请输入密码'); return; }
    if (val === String(CONFIG.PARENT_PASSWORD)) {
      close();
      S.role = 'parent';
      localStorage.setItem(LK('role'), 'parent');
      localStorage.setItem(LK('parent_authed'), '1');   // 记住身份，以后往返免密
      render();
      return;
    }
    failTip('密码不对，再试一次');
  };
  const failTip = t => {
    err.textContent = t;
    box.classList.remove('shake');
    void box.offsetWidth;      // 强制重排，否则同一个动画类不会重放
    box.classList.add('shake');
    input.select();
  };
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  };
  modal.querySelector('[data-yes]').onclick = submit;
  modal.querySelector('[data-no]').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(modal);
  setTimeout(() => input.focus(), 60);
}

// ---------- 家长端 ----------
function renderParent() {
  // 重渲染时保留批量输入框里正在编辑的草稿
  const draft = (document.getElementById('pt-batch') || {}).value || '';
  $('app').innerHTML = `
    <div class="topbar">
      <div class="title">🛠️ 家长中心${DEMO_ACTIVE ? '<em class="demo-tag">🎬 演示模式</em>' : ''}</div>
      <div class="badges">
        <span class="badge">⭐ <b id="pt">${S.balance}</b></span>
        <span class="badge ball">🔴 <b id="bl">${S.balls}</b></span>
      </div>
    </div>
    <div class="page">
      ${pendingPointsPanel()}
      ${parentTaskPanel()}
      ${parentPmPanel()}
      ${parentSettingsPanel()}
      ${checkinLogPanel('📋 每日任务打卡记录', 'parent')}
      ${pointLogPanel()}
      ${errorLogPanel()}
      ${modePanel()}
    </div>
    <div class="fab-col">
      <button class="fab-btn" data-action="parent-exit">返回</button>
      <button class="fab-btn logout" data-action="parent-lock">登出</button>
    </div>
  `;
  if (draft) { const ta = document.getElementById('pt-batch'); if (ta) ta.value = draft; }
  bindActions();
  enableDragSort('#pt-task-list-req');
  enableDragSort('#pt-task-list-opt');
  bindSwipeDelete('#pt-task-list-req');
  bindSwipeDelete('#pt-task-list-opt');
  bindQuickLongPress();
}

// 长按标签的时间戳：手机 touchend 后合成 click 有时绕过捕获拦截，openQuickAddTask 里再兜一层
let quickLongPressAt = 0;
// 常用任务「排序模式」：开启后长按标签 = 拖动换位，单击不再添加；点确认或点别处退出
let quickSorting = false;

// 按当前 DOM 顺序把常用任务顺序写回 localStorage（data-idx 是上一次渲染时的下标）
function saveQuickOrderFromDom() {
  const box = document.getElementById('pt-quick-list');
  if (!box) return;
  const list = quickTasks();
  const els = [...box.querySelectorAll('.quick-chip')];
  const order = els.map(el => Number(el.dataset.idx));
  const next = order.map(i => list[i]).filter(Boolean);
  if (next.length !== list.length) return;   // 有标签增删时不动，避免顺序错乱
  // 存完要把 data-idx 重排成新下标，否则再判一次序会把同一套交换用两遍，顺序又转回去
  els.forEach((el, i) => { el.dataset.idx = i; });
  if (next.some((it, i) => it.title !== list[i].title || it.points !== list[i].points)) saveQuickList(next);
}
// 切换排序模式：只改 DOM 状态，不整页重渲染（重渲染会把滚动位置顶掉）
function setQuickSort(on) {
  quickSorting = !!on;
  const btn = document.querySelector('.quick-sort');
  const box = document.getElementById('pt-quick-list');
  const hint = document.getElementById('pt-quick-hint');
  if (btn) { btn.textContent = quickSorting ? '确认' : '排序'; btn.classList.toggle('active', quickSorting); }
  if (box) box.classList.toggle('sorting', quickSorting);
  if (hint) hint.textContent = quickSorting ? '长按标签拖动排序' : '单击添加 · 长按编辑标签';
}

// 常用任务标签手势：
//   普通模式：单击 = 添加任务（body 委托处理）、长按 = 编辑标签
//   排序模式：长按（桌面可直接按住）= 拖动换位，松手即写回顺序
function bindQuickLongPress() {
  const box = document.getElementById('pt-quick-list');
  if (!box || box.dataset.bound === '1') return;
  box.dataset.bound = '1';
  const HOLD = 420;   // 比系统长按（约 500ms）早触发，避免被「选择文字」抢走
  let timer = null, startX = 0, startY = 0, fired = false, cur = null;
  // 触摸时浏览器会补发 mousedown / mouseleave，若也当成手势开始/取消，长按会被自己清掉
  let touchMode = false, touchOff = null;
  // 排序拖动：stimer 是「按住多久才进入拖动」的计时
  let sdrag = null, stimer = null;

  const clearSel = () => {
    try { const s = window.getSelection && window.getSelection(); if (s && s.rangeCount) s.removeAllRanges(); } catch (e) {}
  };
  const cancel = () => {
    clearTimeout(timer); timer = null;
    if (cur) cur.classList.remove('pressed');
    cur = null;
  };
  // 拖动中把被拖的标签插到手指下方的标签前后
  const sortMove = (x, y) => {
    if (!sdrag || !sdrag.armed) return;
    const el = sdrag.el;
    const under = document.elementFromPoint(x, y);
    const target = under && under.closest ? under.closest('.quick-chip') : null;
    if (!target || target === el) return;
    // 拖动中 DOM 正在被移动，elementFromPoint 命中的元素关系可能瞬时失效；
    // 若 el / target / 插入参照点不属于当前列表，直接跳过这次换位，避免 insertBefore 抛 NotFoundError
    if (el.parentNode !== box || target.parentNode !== box) return;
    const r = target.getBoundingClientRect();
    const ref = x > r.left + r.width / 2 ? target.nextSibling : target;
    if (ref !== null && ref.parentNode !== box) return;
    try {
      box.insertBefore(el, ref);
      sdrag.moved = true;
    } catch (err) {
      // 拖太快 DOM 瞬时不一致，忽略这一次即可
    }
  };
  const sortEnd = () => {
    clearTimeout(stimer); stimer = null;
    if (!sdrag) return;
    const { el, moved } = sdrag;
    el.classList.remove('dragging');
    sdrag = null;
    if (moved) { saveQuickOrderFromDom(); swallowNextClick(); }
  };
  const start = (el, x, y) => {
    if (!el) return;
    if (quickSorting) {
      // 排序模式：先按住 200ms 再拖，避免点一下就误换位
      clearTimeout(stimer);
      sdrag = { el, x, y, armed: false, moved: false };
      stimer = setTimeout(() => {
        if (!sdrag) return;
        sdrag.armed = true;
        sdrag.el.classList.add('dragging');
        clearSel();
        if (navigator.vibrate) { try { navigator.vibrate(10); } catch (e) {} }
      }, 200);
      return;
    }
    if (timer) clearTimeout(timer);
    cur = el;
    el.classList.add('pressed');
    startX = x; startY = y; fired = false;
    timer = setTimeout(() => {
      timer = null; fired = true;
      quickLongPressAt = Date.now();
      el.classList.remove('pressed');
      clearSel();   // 系统若已开始选字，先把选区清掉再弹编辑框
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
      openQuickEdit(Number(el.dataset.idx));
      swallowNextClick();   // 松手后浏览器补发的 click 会点在遮罩上把弹窗关掉，这里吞掉这一次
    }, HOLD);
  };
  const moved = (x, y) => Math.abs(x - startX) > 14 || Math.abs(y - startY) > 12;
  // 只吞掉「长按/拖动之后浏览器补发的那次 click」（它落在标签或刚弹出的遮罩上，会误关弹窗/误开添加框）；
  // 落在「确认」「＋」等按钮上的点击要放行，否则拖完马上点确认会没反应
  const swallowNextClick = () => {
    const t0 = Date.now();
    const fn = ev => {
      document.removeEventListener('click', fn, true);
      if (Date.now() - t0 > 500) return;
      const el = ev.target;
      const inside = el && el.closest && (el.closest('.modal-mask') || el.closest('#pt-quick-list'));
      if (!inside) return;
      ev.stopPropagation(); ev.preventDefault();
    };
    document.addEventListener('click', fn, true);
    setTimeout(() => document.removeEventListener('click', fn, true), 900);
  };

  box.addEventListener('touchstart', e => {
    if (quickSorting) return;   // 排序模式交给下面那个非 passive 的处理器
    touchMode = true;
    clearTimeout(touchOff);
    if (e.target.closest('.qc-x')) return;
    const t = e.touches[0];
    start(e.target.closest('.quick-chip'), t.clientX, t.clientY);
  }, { passive: true });
  // 排序模式专用：passive 的 touchstart 拦不住系统「长按选字」，手机上就是那个放大镜/选区手柄，
  // 它一旦接管手势，后面的 touchmove 就全被吞掉 —— 表现就是「长按出来个放大镜，动不了」。
  // 所以这里必须非 passive + preventDefault。
  box.addEventListener('touchstart', e => {
    if (!quickSorting) return;
    const chip = e.target.closest('.quick-chip');
    if (!chip) return;
    e.preventDefault();
    touchMode = true;
    clearTimeout(touchOff);
    clearSel();
    const t = e.touches[0];
    start(chip, t.clientX, t.clientY);
  }, { passive: false });
  box.addEventListener('touchmove', e => {
    const t = e.touches[0];
    if (sdrag) {
      if (!sdrag.armed) {
        if (Math.abs(t.clientX - sdrag.x) > 10 || Math.abs(t.clientY - sdrag.y) > 10) { clearTimeout(stimer); sdrag = null; }
        return;
      }
      e.preventDefault();       // 拖动时不要跟着滚页面
      sortMove(t.clientX, t.clientY);
      return;
    }
    if (!timer) return;
    if (moved(t.clientX, t.clientY)) cancel();
  }, { passive: false });
  const endTouch = () => {
    sortEnd();
    cancel();
    clearTimeout(touchOff);
    touchOff = setTimeout(() => { touchMode = false; }, 700);
  };
  box.addEventListener('touchend', endTouch);
  box.addEventListener('touchcancel', endTouch);   // 长按已触发时 timer 已清空，这里只清理按压态
  box.addEventListener('mousedown', e => {
    if (touchMode || e.button !== 0 || e.target.closest('.qc-x')) return;
    start(e.target.closest('.quick-chip'), e.clientX, e.clientY);
  });
  box.addEventListener('mousemove', e => {
    if (touchMode) return;
    if (sdrag) {
      if (sdrag.armed) sortMove(e.clientX, e.clientY);
      else if (Math.abs(e.clientX - sdrag.x) > 10 || Math.abs(e.clientY - sdrag.y) > 10) { clearTimeout(stimer); sdrag = null; }
      return;
    }
    if (timer && moved(e.clientX, e.clientY)) cancel();
  });
  box.addEventListener('mouseup', () => { if (!touchMode) { sortEnd(); cancel(); } });
  box.addEventListener('mouseleave', () => { if (!touchMode) { sortEnd(); cancel(); } });
  // 关键：手机长按会弹「选择文字/复制」菜单，必须先禁用，否则系统选中会打断长按计时
  box.addEventListener('contextmenu', e => {
    if (e.target.closest('.quick-chip')) e.preventDefault();
  });
  box.addEventListener('selectstart', e => {
    if (e.target.closest('.quick-chip')) e.preventDefault();
  });
  // 长按触发后浏览器还会补一次 click —— 捕获阶段拦掉，避免又打开「添加任务」
  box.addEventListener('click', e => {
    if (!fired) return;
    fired = false;
    e.stopPropagation(); e.preventDefault();
  }, true);
}
// 家长端日期导航条（切换后任务面板/布置都针对所选日期）
function parentDateNav() {
  const today = DB.today();
  return `
    <div class="date-nav">
      <button class="chip" data-action="parent-date-prev">◀ 前一天</button>
      ${dateCurHTML(S.parentDate, S.parentDate === today)}
      <button class="chip" data-action="parent-date-next">后一天 ▶</button>
      ${S.parentDate !== today ? `<button class="chip red" data-action="parent-date-today">回到今天</button>` : ''}
    </div>
  `;
}
// 家长端任务行模板（小字标出必做/选做；外层 swipe-item 负责左滑露出删除按钮）
function prowRowHTML(t) {
  return `
    <div class="swipe-item" data-tid="${t.id}">
      <button class="swipe-del" data-action="parent-del" data-tid="${t.id}" title="删除这个任务">删除</button>
      <div class="prow prow-click" data-action="parent-edit" data-tid="${t.id}" title="点开编辑">
        <span>${catIcon(t.category, t.title)}</span>
        <div class="grow"><b>${t.title}</b><small style="display:block;color:#90a4ae">${t.category} · ${taskTypeLabel(t)} · ${t.required === false ? '选做' : '必做'} · +${t.points}分${t.hint ? ` · 💡 ${t.hint}` : ''}</small></div>
        <span class="${logOn(t.id, S.parentDate) ? 'ok' : 'miss'}">${logOn(t.id, S.parentDate) ? '✓' : '·'}</span>
        <button class="btn-ghost mini" data-action="parent-move" data-tid="${t.id}" data-dir="up" title="上移">↑</button>
        <button class="btn-ghost mini" data-action="parent-move" data-tid="${t.id}" data-dir="down" title="下移">↓</button>
      </div>
    </div>`;
}
function parentTaskPanel() {
  const ts = tasksOnDate(S.parentDate);
  const reqTs = ts.filter(t => t.required !== false).sort(taskSort);
  const optTs = ts.filter(t => t.required === false).sort(taskSort);
  const wts = weeklyTasks();
  const qts = quickTasks();
  // 叮嘱预览：多行压成一行（换行符直接塞进按钮会把按钮撑成两行）
  const notePrev = S.parentNote ? String(S.parentNote).replace(/\s+/g, ' ').trim() : '';
  return `
    <div class="panel">
      <h3 style="margin-top:12px">布置任务 <small style="font-weight:400">先选日期，再布置那天的任务</small></h3>
      ${parentDateNav()}
      <div class="input-row" style="margin-top:8px">
        <button class="btn-primary" data-action="parent-edit-note" style="flex:2">${notePrev ? `📝 编辑叮嘱（${notePrev.slice(0, 12)}${notePrev.length > 12 ? '…' : ''}）` : '✍️ 写今天的叮嘱'}</button>
      </div>
      <div class="prow sec-head" style="margin-top:10px">🔴 必做</div>
      <div id="pt-task-list-req">
      ${reqTs.map(prowRowHTML).join('') || '<div class="empty-tip" style="padding:4px 0">没有必做任务</div>'}
      </div>
      <div class="prow sec-head" style="margin-top:6px">🟢 选做</div>
      <div id="pt-task-list-opt">
      ${optTs.map(prowRowHTML).join('') || '<div class="empty-tip" style="padding:4px 0">没有选做任务</div>'}
      </div>
      ${wts.length ? `
        <h3 style="margin-top:12px">📅 多日任务</h3>
        ${wts.map(t => {
          const prog = taskProgress(t.id);
          const left = deadlineDaysLeft(t.deadline);
          const kids = allChildTasks(t.id);
          return `
          <div class="prow prow-click" data-action="parent-edit" data-tid="${t.id}" title="点开编辑">
            <span>${catIcon(t.category, t.title)}</span>
            <div class="grow"><b>${t.title}</b><small style="display:block;color:#90a4ae">${t.deadline ? `截止 ${t.deadline}·剩${left}天` : ''} · 进度 ${prog}% · +${t.points}分</small></div>
            <span class="${prog >= 100 ? 'ok' : 'miss'}">${prog >= 100 ? '✓' : prog + '%'}</span>
          </div>
          ${kids.map(k => {
            const kdone = isTaskDoneEver(k.id);
            const wMode = childWeightMode(kids);
            const wTotal = kids.reduce((s, x) => s + childWeight(x, wMode), 0) || 1;
            const share = Math.round(childWeight(k, wMode) / wTotal * 100);
            const ptsText = (k.points || 0) > 0 ? `+${k.points}分 · ` : '';
            return `
            <div class="prow" style="padding-left:26px">
              <span>${kdone ? '✅' : '·'}</span>
              <div class="grow">${k.title} <small style="color:#90a4ae">${ptsText}占 ${share}%</small></div>
              <button class="btn-danger" data-action="parent-del" data-tid="${k.id}">删</button>
            </div>`;
          }).join('')}`;
        }).join('')}
      ` : ''}
      <div class="quick-head" style="margin-top:16px;display:flex;align-items:center;gap:8px">
        <h3 style="margin:0;flex:1">⭐ 常用任务 <small style="font-weight:400" id="pt-quick-hint">${quickSorting ? '长按标签拖动排序' : '单击添加 · 长按编辑标签'}</small></h3>
        <button class="chip quick-sort${quickSorting ? ' active' : ''}" data-action="parent-quick-sort" title="拖动排序常用任务">${quickSorting ? '确认' : '排序'}</button>
        <button class="chip quick-add" data-action="parent-quick-add" title="新增一个常用任务标签">＋</button>
      </div>
      <div class="tpl-row${quickSorting ? ' sorting' : ''}" id="pt-quick-list" style="margin-top:8px">
        ${qts.length
          ? qts.map((it, i) => `
            <div class="chip quick-chip" data-action="parent-quick" data-idx="${i}" title="单击=添加任务，长按=编辑标签">
              ${catIconByKey(it.iconKey)}
              <span class="qc-name">${escHTML(it.title)}</span>
              <span class="qc-pts">+${it.points}</span>
              <span class="qc-x" data-action="parent-del-quick" data-idx="${i}" title="从常用任务里删掉">✕</span>
            </div>`).join('')
          : '<div class="empty-tip" style="padding:4px 0">还没有常用任务，点右上角 ＋ 加一个</div>'}
      </div>
      <h3 style="margin-top:16px">🆕 新建任务</h3>
      <div class="input-row">
        <textarea id="pt-title" placeholder="任务名称（末尾可加 {提示}）" style="flex:2;min-height:44px"></textarea>
      </div>
      <div class="input-row">
        ${catSelectHTML('pt-cat', '作业', 'flex:1.5')}
        <input id="pt-pts" type="number" placeholder="积分" value="10" style="width:90px">
      </div>
      <div class="input-row">
        <select id="pt-req" style="flex:1">
          <option value="1">必做</option>
          <option value="0">选做</option>
        </select>
        <select id="pt-schedule" onchange="var d=document.getElementById('pt-deadline'),c=document.getElementById('pt-children-wrap');var w=this.value==='weekly';if(d)d.style.display=w?'':'none';if(c)c.style.display=w?'':'none';" style="flex:1.5">
          <option value="once">单次（当天做完消失）</option>
          <option value="daily">重复（每天都有）</option>
          <option value="weekly">多日（带截止，拆子任务）</option>
        </select>
      </div>
      <div class="input-row">
        <input id="pt-deadline" type="date" style="display:none;flex:1">
        <button class="btn-primary" data-action="parent-save" style="flex:1">添加</button>
      </div>
      <div id="pt-children-wrap" style="display:none;margin-top:8px">
        <textarea id="pt-children" placeholder="拆子任务：每行 名称,分数（分数可省，默认10分）&#10;第1篇课文,10&#10;第2篇课文,10&#10;习作,15,选做&#10;&#10;· 每个子任务完成得自己的分数，进度按已得/总分算&#10;· 想标选做：名称,分数,选做"></textarea>
        <div class="input-row" style="margin-top:8px">
          <span style="font-size:13px;color:var(--ink-soft);white-space:nowrap">完成奖励</span>
          <input id="pt-bonus" type="number" placeholder="全清额外分（留空=默认${CONFIG.WEEKLY_DONE_BONUS}）" style="flex:2">
        </div>
        <div class="form-hint">孩子逐个勾选子任务独立计分，勾满后多日任务自动完成并额外加分（难的任务可设更高）</div>
      </div>
      <details style="margin-top:10px">
        <summary style="font-size:13px;color:var(--ink-soft);cursor:pointer">🏷️ 管理历史类别（${allCategories().length} 个，含任务里用过的；删掉的不再出现在下拉里）</summary>
        <div class="cat-tags">
          ${allCategories().map(c => `
            <span class="cat-tag">
              <span class="cat-tag-ico">${catIcon(c)}</span>
              <span class="cat-tag-name">${c}</span>
              <button class="cat-tag-x" data-action="parent-del-cat" data-cat="${escHTML(c)}" title="从下拉里移除">✕</button>
            </span>
          `).join('')}
          <span class="cat-add">
            <input id="pt-newcat" class="cat-add-inp" placeholder="新增类别">
            <button class="chip" data-action="parent-add-cat">添加</button>
          </span>
        </div>
      </details>
      <button class="btn-primary" data-action="parent-multi" style="width:100%;margin-top:16px">📅 批量布置多天任务</button>
      <h3 style="margin-top:16px">📥 批量添加单次任务</h3>
      <div class="form-hint" style="margin-bottom:6px">格式：<b>每行一个任务</b>；类别 / 分数 / 选做用 <b>[中括号] 或 (小括号)</b> 指定（不写用默认）<br>· 名称末尾 <b>{花括号}</b> 会识别成小提示，如 <b>语文作业{先复习生字}</b><br>· 行尾 <b>空格+数字</b> 会识别成分数（上限100），如 <b>练字一页 10</b><br>这里添加的是<b>单次任务</b>（当前日期做一次、做完消失）；<b>重复任务（每天都有）</b>请用上方「新建任务 → 重复（每天都有）」单独建，避免批量复制重复建出很多条。</div>
      <textarea id="pt-batch" placeholder="每行一个任务，整行就是任务名&#10;语文作业{先复习生字}[校内作业][10]&#10;跳绳500个(运动)(5)(选做)&#10;练字一页 10&#10;&#10;[类别] 默认「作业」　[分数] 默认 10　加「选做」= 非必做&#10;名称末尾 {花括号} = 小提示　行尾「空格+数字」= 分数"></textarea>
      <button class="btn-primary" data-action="parent-parse" style="margin-top:8px">解析并添加</button>
      <div class="form-hint">批量添加的都是当天的一次性任务，不会重复出现在以后的每天里。</div>
    </div>
  `;
}
async function saveParentTask() {
  const { title, hint } = splitHint($('pt-title').value.trim());
  if (!title) { toast('请填任务名称'); return; }
  const category = readCat('pt-cat');
  const points = Math.max(1, Math.min(CONFIG.MAX_POINTS_PER_TASK, parseInt($('pt-pts').value) || 10));
  const schedule = $('pt-schedule').value;
  const deadline = (schedule === 'weekly' && $('pt-deadline').value) ? $('pt-deadline').value : null;
  const required = $('pt-req').value !== '0';
  // 同名拦截：单次任务按「这一天」判重，重复/多日任务全局判重
  if (sameTitleTask(title, { parentId: null, date: schedule === 'once' ? S.parentDate : null })) {
    toast(dupTitleMsg(title)); return;
  }
  saveCat(category);
  if (schedule === 'weekly') {
    const text = ($('pt-children') ? $('pt-children').value : '') || '';
    const rawItems = parseSubtasks(text);
    // 子任务里两行写同一个名字也拦一下，不然进度条分母会被重复项搅乱
    const seenKid = new Set();
    const items = rawItems.filter(x => !seenKid.has(x.title) && seenKid.add(x.title));
    if (!items.length) { toast('子任务为空，先填拆分子任务'); return; }
    if (items.length < rawItems.length) toast(`有 ${rawItems.length - items.length} 行子任务同名，已合并`);
    const totalPts = items.reduce((s, x) => s + x.points, 0);
    const bonusEl = $('pt-bonus');
    const bonusVal = bonusEl && parseInt(bonusEl.value);
    const bonus = bonusVal ? Math.min(CONFIG.MAX_POINTS_PER_TASK, Math.max(1, bonusVal)) : null;
    const parent = await DB.addTask({ title, hint, category, points: totalPts, schedule: 'weekly', deadline, required: true, bonus });
    for (const x of items) {
      await DB.addTask({ title: x.title, hint: x.hint, category, points: x.points, schedule: 'child', parent_id: parent.id, percent: null, required: x.required });
    }
  } else {
    // once = 单次 → 绑定家长当前查看/布置的日期（当天专属）
    const bindDate = schedule === 'once' ? S.parentDate : null;
    await DB.addTask({ title, hint, category, points, schedule, deadline, required, start_date: bindDate, end_date: bindDate });
  }
  $('pt-title').value = '';
  $('pt-deadline').value = '';
  $('pt-children').value = '';
  await refreshAll(); render();
  toast('已添加');
}
// 智能分隔：| 逗号 分号 顿号 都认；"名称 数字"空一格也认
function parseFields(line) {
  const s = line.trim();
  if (!/[|,，;；、]/.test(s) && /\s+\d+$/.test(s)) {
    const m = s.match(/^(.*?)\s+(\d+)$/);
    if (m) return [m[1].trim(), m[2]];
  }
  return s.split(/[|,，;；、]+/).map(x => x.trim()).filter(Boolean);
}

// 从名称里提取 {提示}：如「语文作业{先复习生字}」→ { title: 语文作业, hint: 先复习生字 }
function splitHint(title) {
  if (!title) return { title: '', hint: '' };
  const m = title.match(/^(.*?)\{([^}]*)\}\s*$/);
  if (m) return { title: m[1].trim(), hint: m[2].trim() };
  return { title: title.trim(), hint: '' };
}

// ---------- 子任务解析（独立分数，格式：名称, 分数, 选做） ----------
function parseSubtasks(text) {
  return (text || '').split('\n').map(s => s.trim()).filter(Boolean)
    .map(l => {
      const p = parseFields(l);
      if (!p || !p[0]) return null;
      const { title, hint } = splitHint(p[0]);
      if (!title) return null;
      const points = p[1] ? Math.max(1, Math.min(CONFIG.MAX_POINTS_PER_TASK, parseInt(p[1]) || 10)) : 10;
      const required = !(p[2] && ['选做', '可选', '0', '选'].includes(p[2]));
      return { title, hint, points, required };
    })
    .filter(Boolean);
}

// ---------- 长期任务编辑（父任务元信息 + 子任务列表） ----------
function openWeeklyEditor(id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  const kids = allChildTasks(id);
  const kidsText = kids.map(k => `${k.title},${k.points}${k.required === false ? ',选做' : ''}`).join('\n');
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal" style="max-width:440px;width:calc(100% - 40px)">
      <h3>✏️ 编辑多日任务</h3>
      <div class="input-row">
        <input id="we-title" value="${escHTML(t.title)}" placeholder="任务名称" style="flex:2">
        ${catSelectHTML('we-cat', t.category, 'flex:1')}
      </div>
      <div class="input-row">
        <input id="we-hint" value="${t.hint || ''}" placeholder="小提示（如：先复习生字）" style="flex:1">
        <input id="we-deadline" type="date" value="${t.deadline || ''}" style="flex:1">
      </div>
      <div class="input-row">
        <input id="we-bonus" type="number" value="${t.bonus || ''}" placeholder="完成奖励（留空=默认${CONFIG.WEEKLY_DONE_BONUS}分）" style="flex:1">
      </div>
      <div class="form-hint">子任务每行「名称,分数」（分数可省默认10分，可加 {提示}，末尾写「选做」为非必做）。总分自动 = 子任务分之和。改子任务会重置它的进度。</div>
      <textarea id="we-kids" style="min-height:110px" placeholder="第1篇课文,10&#10;第2篇课文,10&#10;习作,15,选做">${kidsText}</textarea>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn-cancel" data-cancel style="flex:1">取消</button>
        <button class="btn-primary" data-save style="flex:2">保存修改</button>
      </div>
    </div>
  `;
  modal.querySelector('[data-cancel]').onclick = () => modal.remove();
  modal.querySelector('[data-save]').onclick = async () => {
    const title = modal.querySelector('#we-title').value.trim();
    if (!title) { toast('任务名称不能为空'); return; }
    if (sameTitleTask(title, { ignoreId: id, parentId: null })) { toast(dupTitleMsg(title)); return; }
    const hint = modal.querySelector('#we-hint').value.trim() || null;
    const category = readCat('we-cat');
    const deadline = modal.querySelector('#we-deadline').value || null;
    const bonusVal = parseInt(modal.querySelector('#we-bonus').value);
    const bonus = bonusVal ? Math.min(CONFIG.MAX_POINTS_PER_TASK, Math.max(1, bonusVal)) : null;
    saveCat(category);
    const items = parseSubtasks(modal.querySelector('#we-kids').value);
    if (!items.length) { toast('子任务为空，先填拆分子任务'); return; }
    const totalPts = items.reduce((s, x) => s + x.points, 0);
    await DB.updateTask(id, { title, hint, category, points: totalPts, deadline, bonus });
    Object.assign(t, { title, hint, category, points: totalPts, deadline, bonus });
    // 重建子任务：删旧子任务（连同打卡记录），按新配置创建（删除顺序无关 → 并发）
    await Promise.all(allChildTasks(id).map(k => DB.deleteTask(k.id)));
    for (const it of items) {
      await DB.addTask({ title: it.title, hint: it.hint, category, points: it.points, schedule: 'child', parent_id: id, percent: null, required: it.required });
    }
    modal.remove();
    await refreshAll(); render();
    toast('已保存');
  };
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ---------- 通用任务编辑（普通任务：改名/类别/分数/必做选做/类型/提示） ----------
// 重算多日任务总分 = 子任务分数之和
async function syncParentPoints(parentId) {
  const kids = allChildTasks(parentId);
  const total = kids.reduce((s, k) => s + (k.points || 0), 0);
  await DB.updateTask(parentId, { points: total });
  const p = S.tasks.find(x => x.id === parentId);
  if (p) p.points = total;
}

function openTaskEditor(id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  if (t.schedule === 'weekly') { openWeeklyEditor(id); return; }  // 多日任务走子任务编辑
  const isChild = t.schedule === 'child';
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal" style="max-width:440px;width:calc(100% - 40px)">
      <h3>✏️ 编辑任务</h3>
      <label>任务名称</label>
      <textarea id="te-title" rows="2" placeholder="任务名称">${t.title}</textarea>
      <label>类别</label>
      <div class="input-row" style="margin-top:0">
        ${catSelectHTML('te-cat', t.category, 'flex:1')}
      </div>
      <div class="input-row" style="margin-top:10px">
        <input id="te-pts" type="number" value="${t.points}" placeholder="积分">
        <select id="te-req">
          <option value="1" ${t.required !== false ? 'selected' : ''}>必做</option>
          <option value="0" ${t.required === false ? 'selected' : ''}>选做</option>
        </select>
      </div>
      <label>小提示</label>
      <textarea id="te-hint" rows="2" placeholder="给孩子的小提示（如：先复习生字）">${t.hint || ''}</textarea>
      <label>所属多日任务</label>
      <select id="te-parent">
        <option value="">独立任务（不关联）</option>
        ${weeklyTasks().map(w => `<option value="${w.id}" ${t.parent_id === w.id ? 'selected' : ''}>${w.title}</option>`).join('')}
      </select>
      ${isChild ? '' : `
      <label>任务类型</label>
      <select id="te-schedule">
        <option value="daily" ${t.schedule === 'daily' ? 'selected' : ''}>重复（每天都有）</option>
        <option value="once" ${t.schedule === 'once' ? 'selected' : ''}>单次（当天做完消失）</option>
      </select>`}
      <div class="form-hint">选「多日任务」后，本任务成为它的子任务，孩子按完成度独立计分。</div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn-danger" data-del style="flex:1">删除</button>
        <button class="btn-cancel" data-cancel style="flex:1">取消</button>
        <button class="btn-primary" data-save style="flex:2">保存修改</button>
      </div>
    </div>
  `;
  modal.querySelector('[data-cancel]').onclick = () => modal.remove();
  const delBtn = modal.querySelector('[data-del]');
  if (delBtn) delBtn.onclick = () => { modal.remove(); delTask(t.id); };
  modal.querySelector('[data-save]').onclick = async () => {
    const title = modal.querySelector('#te-title').value.trim();
    if (!title) { toast('任务名称不能为空'); return; }
    const hint = modal.querySelector('#te-hint').value.trim() || null;
    const category = readCat('te-cat');
    const points = Math.max(1, Math.min(CONFIG.MAX_POINTS_PER_TASK, parseInt(modal.querySelector('#te-pts').value) || 10));
    const required = modal.querySelector('#te-req').value !== '0';
    const oldParent = t.parent_id;
    const parentVal = (modal.querySelector('#te-parent').value || '').trim();
    const newParent = parentVal ? Number(parentVal) : null;
    if (sameTitleTask(title, { ignoreId: t.id, parentId: newParent })) { toast(dupTitleMsg(title)); return; }
    const patch = { title, hint, category, points, required };
    if (newParent) {
      // 关联到多日任务：变成它的子任务（独立计分，不绑日期）
      patch.parent_id = newParent;
      patch.schedule = 'child';
      patch.start_date = null; patch.end_date = null;
    } else {
      patch.parent_id = null;
      if (t.schedule === 'child') {
        patch.schedule = 'daily';  // 子任务取消关联 → 恢复独立每天
      } else if (!isChild) {
        const schedule = modal.querySelector('#te-schedule').value;
        if (schedule !== t.schedule) {
          if (schedule === 'once') { patch.start_date = S.parentDate; patch.end_date = S.parentDate; }
          else if (schedule === 'daily') { patch.start_date = null; patch.end_date = null; }
          patch.schedule = schedule;
        }
      }
    }
    saveCat(category);
    // 编辑只对「今天及之后」生效：昨天及以前生效过的日子存成快照，历史日期照旧渲染旧名称/旧分值
    // （打卡记录、积分、连续天数都按任务 id 走，本来就不受影响）
    const versioned = pushAttrHistory(t, { title, points, required, category, hint }, patch);
    await DB.updateTask(id, patch);
    Object.assign(t, patch);
    // 关联变化时重算相关多日任务的总分
    if (oldParent && oldParent !== newParent) await syncParentPoints(oldParent);
    if (newParent) await syncParentPoints(newParent);
    modal.remove();
    await refreshAll(); render();
    toast(versioned ? '已保存，改动从今天起生效（之前的日期保持原样）' : '已保存');
  };
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ---------- 常用任务：家长自己维护的快捷标签（单击→弹窗确认添加，长按→改名称/分数） ----------
const K_QUICK = LK('quick_tasks');
function lsGet(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } }
function lsSet(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

// ---------- 类别记忆：新输入的类别会记住，用于下拉和孩子端分区排序 ----------
const K_CATS = LK('categories');
const K_CATS_HIDE = LK('categories_hidden');
function loadCats() { return lsGet(K_CATS, CONFIG.DEFAULT_CATEGORIES); }
// 被家长从下拉里删掉的类别（只是隐藏，任务本身不受影响）
function hiddenCats() { return lsGet(K_CATS_HIDE, []); }
// 全部可用类别 = 记忆类别 + 现有任务实际用过的历史类别（去重保序，去掉隐藏的）
// 这样：从批量/演示/旧数据里来的类别，即使没走过 saveCat，也能在下拉里选到
function allCategories() {
  const hide = new Set(hiddenCats());
  const seen = new Set(), out = [];
  const push = c => {
    c = String(c == null ? '' : c).trim();
    if (!c || seen.has(c) || hide.has(c)) return;
    seen.add(c); out.push(c);
  };
  loadCats().forEach(push);
  (S.tasks || []).forEach(t => push(t.category));
  return out;
}
function saveCat(cat) {
  cat = String(cat || '').trim();
  if (!cat) return;
  // 重新启用一个曾被删掉的类别
  const hide = hiddenCats();
  if (hide.includes(cat)) lsSet(K_CATS_HIDE, hide.filter(c => c !== cat));
  const cats = loadCats();
  if (!cats.includes(cat)) { cats.push(cat); lsSet(K_CATS, cats); }
}
function deleteCat(cat) {
  cat = String(cat || '').trim();
  if (!cat) return;
  lsSet(K_CATS, loadCats().filter(c => c !== cat));
  const hide = hiddenCats();
  if (!hide.includes(cat)) { hide.push(cat); lsSet(K_CATS_HIDE, hide); }
}
// 类别选择控件：用原生 <select>（手机上是系统选择器，任何浏览器都能选）
// 末尾附「自定义类别…」，选中后显示输入框；历史类别全部在内
function catSelectHTML(id, cur, extraStyle = '') {
  const cats = allCategories();
  const val = String(cur == null ? '' : cur).trim();
  const isCustom = !!val && !cats.includes(val);
  return `
    <select id="${id}" onchange="onCatSelectChange(this)" style="${extraStyle}">
      ${cats.map(c => `<option value="${c}"${c === val ? ' selected' : ''}>${c}</option>`).join('')}
      <option value="__custom__"${isCustom ? ' selected' : ''}>＋ 自定义类别…</option>
    </select>
    <input id="${id}-custom" class="cat-custom" placeholder="输入新类别名" value="${isCustom ? escHTML(val) : ''}" style="display:${isCustom ? '' : 'none'}">
  `;
}
function onCatSelectChange(sel) {
  const inp = document.getElementById(sel.id + '-custom');
  if (!inp) return;
  const custom = sel.value === '__custom__';
  inp.style.display = custom ? '' : 'none';
  if (custom) { inp.focus(); inp.select && inp.select(); }
}
// 读取 catSelectHTML 的最终值
function readCat(id) {
  const sel = document.getElementById(id);
  if (!sel) return '作业';
  if (sel.value === '__custom__') {
    const inp = document.getElementById(id + '-custom');
    return String((inp && inp.value) || '').trim() || '作业';
  }
  return String(sel.value || '').trim() || '作业';
}
// 类别排序索引：按记忆顺序 + 历史类别，未记录的排最后
function catOrder(cat) {
  const i = allCategories().indexOf(cat);
  return i >= 0 ? i : 1000;
}

// 常用任务列表：老数据没有 iconKey 的补一个随机图标并回写（同一标签之后图标固定）
function quickTasks() {
  let q = lsGet(K_QUICK, null);
  if (q === null) {
    // 首次使用：用默认模板 + 老的「最近用过」初始化一次（图标随机且尽量不重样）
    const seed = TPL.map(t => ({ title: t.title, category: t.category, points: t.points, required: true }));
    const old = lsGet(LK('recent_tasks'), []);
    const seen = new Set(); const used = new Set(); const out = [];
    for (const it of [...old, ...seed]) {
      const k = `${it.title}|${it.points}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const key = it.iconKey && POKE_ICON_KEYS.includes(it.iconKey) ? it.iconKey : randomPokeIconKey(null, used);
      used.add(key);
      out.push({ ...it, iconKey: key });
    }
    q = out; lsSet(K_QUICK, q);
    return q;
  }
  if (!Array.isArray(q)) { q = []; lsSet(K_QUICK, q); return q; }
  // 老数据没图标 key（或 key 已失效）→ 补一个随机的并回写
  const used = new Set(q.map(it => it.iconKey).filter(k => POKE_ICON_KEYS.includes(k)));
  let changed = false;
  q = q.map(it => {
    if (it.iconKey && POKE_ICON_KEYS.includes(it.iconKey)) return it;
    changed = true;
    const key = randomPokeIconKey(null, used);
    used.add(key);
    return { ...it, iconKey: key };
  });
  if (changed) lsSet(K_QUICK, q);
  return q;
}
function saveQuickList(list) { lsSet(K_QUICK, list); }

function delQuick(idx) {
  const q = quickTasks();
  if (!q[idx]) return;
  q.splice(idx, 1);
  saveQuickList(q);
  render();
  toast('已从常用任务删除（只是删标签，不影响已布置的任务）');
}

// 长按 / ＋：新建（idx=-1）或编辑常用任务标签（只改名称和分数，图标不变）
function openQuickEdit(idx) {
  const isNew = idx < 0;
  const q = quickTasks();
  const it = isNew ? { title: '', points: 10, category: '作业', required: true } : q[idx];
  if (!it) return;
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal" style="max-width:400px;width:calc(100% - 40px)">
      <h3>${isNew ? '➕ 新增常用任务' : '✏️ 编辑常用任务'}</h3>
      <label>任务名称</label>
      <input id="qe-title" value="${escHTML(it.title)}" placeholder="如：语文作业" style="width:100%">
      <label>分数</label>
      <input id="qe-pts" type="number" value="${it.points || 10}" placeholder="10" style="width:100%">
      <div class="form-hint">这里只是保存一个标签，点它时才真正添加任务。</div>
      <div style="margin-top:12px;display:flex;gap:8px">
        ${isNew ? '' : '<button class="btn-danger" data-del style="flex:1">删除</button>'}
        <button class="btn-cancel" data-cancel style="flex:1">取消</button>
        <button class="btn-primary" data-save style="flex:2">保存</button>
      </div>
    </div>
  `;
  const close = () => modal.remove();
  modal.querySelector('[data-cancel]').onclick = close;
  const delBtn = modal.querySelector('[data-del]');
  if (delBtn) delBtn.onclick = () => { close(); delQuick(idx); };
  modal.querySelector('[data-save]').onclick = () => {
    const title = modal.querySelector('#qe-title').value.trim();
    if (!title) { toast('任务名称不能为空'); return; }
    const points = Math.max(1, Math.min(CONFIG.MAX_POINTS_PER_TASK, parseInt(modal.querySelector('#qe-pts').value) || 10));
    const list = quickTasks();
    if (isNew) {
      if (list.some(x => x.title === title && Number(x.points) === points)) { toast('已有同名的常用任务了'); return; }
      list.push({ title, points, category: it.category, required: true, iconKey: randomPokeIconKey(null, new Set(list.map(x => x.iconKey))) });
    } else {
      list[idx] = { ...list[idx], title, points };
    }
    saveQuickList(list);
    close(); render();
    toast(isNew ? '已加到常用任务' : '已更新标签');
  };
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  const inp = modal.querySelector('#qe-title');
  // 手机上不自动弹键盘（长按后键盘会顶起遮住弹窗），桌面才自动聚焦
  if (inp && !('ontouchstart' in window)) { inp.focus(); inp.select && inp.select(); }
}

// 单击标签：弹出添加任务表单，确认后按当前日期落任务
function openQuickAddTask(idx) {
  if (quickSorting) return;                          // 排序模式下点标签不添加任务
  if (Date.now() - quickLongPressAt < 800) return;   // 长按刚弹过编辑框，忽略紧随的合成 click
  const it = quickTasks()[idx];
  if (!it) return;
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal" style="max-width:420px;width:calc(100% - 40px)">
      <h3>➕ 添加任务</h3>
      <label>任务名称</label>
      <textarea id="qa-title" rows="2" style="width:100%">${escHTML(it.title)}</textarea>
      <label>小提示（可留空，孩子会在任务卡上看到）</label>
      <div class="input-row" style="margin-top:0">
        <input id="qa-hint" value="${escHTML(it.hint || '')}" placeholder="如：先复习生字再写">
      </div>
      <label>类别</label>
      <div class="input-row" style="margin-top:0">
        ${catSelectHTML('qa-cat', it.category || '作业', 'flex:1')}
      </div>
      <label>分数 / 必做</label>
      <div class="input-row" style="margin-top:0">
        <input id="qa-pts" type="number" value="${it.points || 10}" placeholder="积分">
        <select id="qa-req">
          <option value="1" ${it.required !== false ? 'selected' : ''}>必做</option>
          <option value="0" ${it.required === false ? 'selected' : ''}>选做</option>
        </select>
      </div>
      <label>布置到</label>
      <select id="qa-schedule">
        <option value="once">只 ${S.parentDate} 这一次</option>
        <option value="daily">每天都有（重复）</option>
      </select>
      <div class="form-hint">确认后立刻加到 ${S.parentDate} 的任务里。</div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn-cancel" data-cancel style="flex:1">取消</button>
        <button class="btn-primary" data-ok style="flex:2">确认添加</button>
      </div>
    </div>
  `;
  const close = () => modal.remove();
  modal.querySelector('[data-cancel]').onclick = close;
  modal.querySelector('[data-ok]').onclick = async () => {
    const raw = modal.querySelector('#qa-title').value.trim();
    const { title, hint: inlineHint } = splitHint(raw);
    if (!title) { toast('任务名称不能为空'); return; }
    // 小提示：输入框里写了就用它；没写但名称里带 {提示} 也认
    const typedHint = modal.querySelector('#qa-hint').value.trim();
    const hint = typedHint || inlineHint || null;
    const category = readCat('qa-cat');
    const points = Math.max(1, Math.min(CONFIG.MAX_POINTS_PER_TASK, parseInt(modal.querySelector('#qa-pts').value) || 10));
    const required = modal.querySelector('#qa-req').value !== '0';
    const schedule = modal.querySelector('#qa-schedule').value === 'daily' ? 'daily' : 'once';
    const bindDate = schedule === 'once' ? S.parentDate : null;
    if (sameTitleTask(title, { parentId: null, date: bindDate })) { toast(dupTitleMsg(title)); return; }
    saveCat(category);
    await DB.addTask({ title, hint, category, points, schedule, required, start_date: bindDate, end_date: bindDate });
    close();
    await refreshAll(); render();
    toast(`已添加「${title}」`);
  };
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  const inp = modal.querySelector('#qa-title');
  if (inp && !('ontouchstart' in window)) { inp.focus(); inp.select && inp.select(); }
}

// 解析一行批量任务：整行 = 任务名；类别/分数/选做用 [中括号] 或 (小括号) 指定。
// 也兼容旧格式「名称, 类别, 分数, 选做」和「名称 分数」——但只在行尾是数字/选做时才拆，
// 避免把真实文案里的逗号（如「英背诵书P34,上传视频。」）拆成两个任务。
// 类别别名（小括号严格模式里认这些词，方便中文输入法直接写括号）
const CAT_ALIASES = ['语文', '数学', '英语', '科学', '作文', '书法', '单词', '校内', '校外', '打卡', '阅读', '运动', '家务', '音乐', '练字', '编程', '作业'];
function isKnownCat(c) { return allCategories().includes(c) || CAT_ALIASES.includes(c); }
function parseTaskLine(line) {
  let s = line.trim();
  let category = null, points = null, required = null;
  // 1) [中括号]：宽松，什么内容都认（数字=分数，选做=选做，其余=类别）
  s = s.replace(/\[([^\]]*)\]/g, (m, inner) => {
    inner = inner.trim();
    if (!inner) return '';
    if (['选做', '可选', '选', '0'].includes(inner)) required = false;
    else if (/^\d+$/.test(inner)) points = parseInt(inner);
    else category = inner;
    return '';
  }).trim();
  // 2) (小括号) 中英文：中文输入法便利，只认明确模式（数字/选做/已认识的类别），
  //    其余括号内容保留在原位，避免误删任务名里的括号（如「背诵(2-4段)」）
  const pickParen = (inner, m) => {
    inner = inner.trim();
    if (!inner) return '';
    if (['选做', '可选', '选', '0'].includes(inner)) { required = false; return ''; }
    if (/^\d+$/.test(inner)) { points = parseInt(inner); return ''; }
    if (isKnownCat(inner)) { category = inner; return ''; }
    return m;
  };
  s = s.replace(/（([^）]*)）/g, (m, inner) => pickParen(inner, m))
        .replace(/\(([^)]*)\)/g, (m, inner) => pickParen(inner, m)).trim();
  // 3) 旧格式「名称, 类别, 分数, 选做」
  if (category === null && points === null && required === null && /[|,，;；、]/.test(s)) {
    const parts = s.split(/[|,，;；、]+/).map(x => x.trim()).filter(Boolean);
    const last = parts[parts.length - 1] || '';
    if (parts.length >= 2 && (/^\d+$/.test(last) || ['选做', '可选', '选', '0'].includes(last))) {
      s = parts[0];
      if (['选做', '可选', '选', '0'].includes(parts[1] || '') && parts.length === 2) required = false;
      else if (/^\d+$/.test(parts[1] || '')) points = parseInt(parts[1]);
      else category = parts[1];
      if (/^\d+$/.test(parts[2] || '')) points = parseInt(parts[2]);
      if (['选做', '可选', '选', '0'].includes(parts[3] || '')) required = false;
    }
  }
  // 4) 旧格式「名称 分数」（空格隔开）
  if (category === null && points === null && required === null && /\s+\d+$/.test(s)) {
    const m = s.match(/^(.*?)\s+(\d+)$/);
    if (m) { s = m[1].trim(); points = parseInt(m[2]); }
  }
  const { title, hint } = splitHint(s);
  if (!title) return null;
  return {
    title,
    hint,
    category: category || '作业',
    points: Math.max(1, Math.min(CONFIG.MAX_POINTS_PER_TASK, points || 10)),
    required: required === false ? false : true,
  };
}

// 把输入框文本解析成任务项（与 parseBatch 同规则）
function parseBatchLines(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(parseTaskLine).filter(Boolean);
}

async function parseBatch() {
  const text = $('pt-batch').value.trim();
  if (!text) { toast('粘贴内容为空'); return; }
  const items = parseBatchLines(text);
  if (!items.length) { toast('没解析到有效任务'); return; }
  let n = 0, dup = 0;
  const added = new Set();
  for (const it of items) {
    // 同名拦截：当天已有同名任务 / 粘贴内容里自己重复了
    if (added.has(it.title) || sameTitleTask(it.title, { parentId: null, date: S.parentDate })) { dup++; continue; }
    saveCat(it.category);
    // 批量添加固定为单次任务（当前日期做一次、做完消失），避免批量复制重复建重复任务
    await DB.addTask({ title: it.title, hint: it.hint, category: it.category, points: it.points, schedule: 'once', required: it.required, start_date: S.parentDate, end_date: S.parentDate });
    added.add(it.title);
    n++;
  }
  $('pt-batch').value = '';
  await refreshAll();
  render();
  if (!n) toast(`都是同名任务，没有新增（跳过 ${dup} 个）`);
  else toast(dup ? `添加 ${n} 个，跳过 ${dup} 个同名` : `成功添加 ${n} 个单次任务`);
}
// ---------- 批量布置多天：日期分隔行 ----------
function pad2(n) { return String(n).padStart(2, '0'); }
// 解析日期行 → 'YYYY-MM-DD'（支持 2026-10-20 / 10-20 / 10月20日 / 今天 / 明天 / 后天 / 周X）
function parseDateToken(s, base) {
  s = s.trim();
  if (!s) return null;
  if (s === '今天') return base;
  if (s === '明天') return shiftDate(base, 1);
  if (s === '后天') return shiftDate(base, 2);
  if (s === '大后天') return shiftDate(base, 3);
  if (/^周[一二三四五六日天]$/.test(s)) {
    const map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
    const target = map[s[1]];
    const now = new Date(base + 'T00:00:00');
    let diff = (target - now.getDay() + 7) % 7;
    if (diff === 0) diff = 7; // 只找最近的一个未来周X
    return shiftDate(base, diff);
  }
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (m) { const y = new Date(base + 'T00:00:00').getFullYear(); return `${y}-${pad2(m[1])}-${pad2(m[2])}`; }
  m = s.match(/^(\d{1,2})月(\d{1,2})日?$/);
  if (m) { const y = new Date(base + 'T00:00:00').getFullYear(); return `${y}-${pad2(m[1])}-${pad2(m[2])}`; }
  return null;
}
// 解析日期分隔行：每行一个日期，其后到下一个日期前的行归该日期
function parseMultiDay(text) {
  const base = DB.today();
  const groups = [];
  let cur = null;
  text.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
    const dt = parseDateToken(line, base);
    if (dt) { cur = { date: dt, items: [] }; groups.push(cur); return; }
    if (!cur) return; // 开头不是日期就跳过
    const item = parseTaskLine(line);
    if (item) cur.items.push(item);
  });
  return groups.filter(g => g.items.length);
}
// 弹窗：一次规划多天
function openMultiDayAssign() {
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal" style="max-width:460px;width:calc(100% - 40px)">
      <h3>📅 批量布置多天任务</h3>
      <p class="form-hint">一次规划好几天：每行写一个日期（如 <b>10-20</b> / <b>周一</b> / <b>明天</b>），下面几行是那天要做的任务，直到下一个日期行。<br>布置后任务只出现在对应的那天，<b>错过当天就不再出现</b>。</p>
      <textarea id="md-input" style="min-height:180px" placeholder="10-20&#10;语文作业{先复习生字}[校内作业][10]&#10;跳绳500个[运动][5][选做]&#10;10-21&#10;英语作业[校内作业][10]&#10;阅读20分钟[阅读][5]"></textarea>
      <div class="form-hint">任务格式同「批量添加」：每行一个任务，[类别] [分数] [选做] 用中括号或小括号指定（不写用默认；名称末尾 {花括号}=小提示；行尾空格+数字当分数）</div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn-cancel" data-cancel style="flex:1">取消</button>
        <button class="btn-primary" data-ok style="flex:2">解析并布置</button>
      </div>
    </div>
  `;
  modal.querySelector('[data-cancel]').onclick = () => modal.remove();
  modal.querySelector('[data-ok]').onclick = async () => {
    const text = modal.querySelector('#md-input').value.trim();
    if (!text) { toast('内容为空'); return; }
    const groups = parseMultiDay(text);
    if (!groups.length) { toast('没解析到有效的日期分组，第一行请先写日期'); return; }
    let n = 0, dup = 0;
    const toAdd = [];
    for (const g of groups) {
      const added = new Set();
      for (const it of g.items) {
        // 同名拦截：同一天里重名的只留一个（不同天允许同名，那是两天的独立任务）
        if (added.has(it.title) || sameTitleTask(it.title, { parentId: null, date: g.date })) { dup++; continue; }
        saveCat(it.category);
        toAdd.push({ title: it.title, hint: it.hint, category: it.category, points: it.points, schedule: 'once', required: it.required, start_date: g.date, end_date: g.date });
        added.add(it.title);
        n++;
      }
    }
    // 逐天逐条 await 在跨境网络下会拖很久（10 个任务 ≈ 16 秒），一次并发发出
    await Promise.all(toAdd.map(x => DB.addTask(x)));
    modal.remove();
    await refreshAll(); render();
    if (!n) toast(`都是同名任务，没有布置（跳过 ${dup} 个）`);
    else toast(`已布置 ${n} 个任务（${groups.length} 天）${dup ? `，跳过 ${dup} 个同名` : ''}`);
  };
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}
// 家长中心顶部：当前数据模式提示（demo 演示模式才显示重置按钮）
function modePanel() {
  if (DEMO_ACTIVE) {
    // 正在演示模式：孩子可随便玩，用的是独立演示数据
    return `
      <div class="panel" style="border:2px solid #a5d6a7;background:#f1f8e9">
        <div class="prow" style="border:0;padding:4px 0">
          <span style="font-size:24px">🎬</span>
          <div class="grow">
            <b>正在演示模式</b>
            <small style="color:#607d8b;display:block">现在用的是独立的演示数据，不联网、不影响真实数据。演示完记得退出。</small>
          </div>
          <button class="btn-primary" data-action="parent-demo-exit">↩ 退出演示</button>
        </div>
        <button class="btn-danger btn-pts" data-action="parent-reset-demo" style="width:100%;margin-top:8px">🔄 重置演示数据（重新生成示例）</button>
      </div>
    `;
  }
  // 未在演示：给别的家长/孩子演示时进入（无论 demo 还是数据库模式都可进入）
  return `
    <div class="panel" style="border:2px solid #a5d6a7;background:#f1f8e9">
      <div class="prow" style="border:0;padding:4px 0">
        <span style="font-size:24px">🎮</span>
        <div class="grow">
          <b>给别人演示</b>
          <small style="color:#607d8b;display:block">进入后用一套独立的演示数据，孩子怎么玩都不影响你的真实数据。</small>
        </div>
        <button class="btn-primary" data-action="parent-demo-enter">🎮 进入演示模式</button>
      </div>
    </div>
  `;
}
async function enterDemoMode() {
  if (!await askConfirm('进入演示模式？\n会切换到一套独立的演示数据，孩子随便玩，不影响你的真实数据。', { okText: '进入', danger: false })) return;
  localStorage.setItem('km_role_back', localStorage.getItem(LK('role')) || 'parent');
  localStorage.setItem('km_demo', '1');
  localStorage.removeItem(LK('role'));
  location.reload();
}
async function exitDemoMode() {
  if (!await askConfirm('退出演示模式，回到真实数据？', { okText: '退出' })) return;
  localStorage.removeItem('km_demo');
  localStorage.setItem('km_role', localStorage.getItem('km_role_back') || 'parent');
  localStorage.removeItem('km_role_back');
  location.reload();
}

function pendingPointsPanel() {
  const pend = S.pointLogs.filter(l => l.confirmed === false && l.amount > 0);
  if (!pend.length) return '';
  const byDate = {};
  pend.forEach(l => { (byDate[l.log_date] = byDate[l.log_date] || []).push(l); });
  const total = pend.reduce((s, l) => s + l.amount, 0);
  const dates = Object.keys(byDate).sort().reverse();
  return `
    <div class="panel pending-panel">
      <h3>📦 待确认积分 <small style="font-weight:400">孩子已完成，等你发放</small></h3>
      ${dates.map(date => `
        <div class="pend-date">${date}</div>
        ${byDate[date].map(l => `
          <div class="prow pend-row">
            <label class="pend-check"><input type="checkbox" data-plid="${l.id}" checked> <span>${l.reason}</span></label>
            <span class="amt plus">+${l.amount}</span>
            <button class="btn-icon" data-action="parent-undo" data-plid="${l.id}" title="放弃这条并恢复该任务未完成">✖</button>
          </div>
        `).join('')}
      `).join('')}
      <button class="btn-primary" data-action="parent-confirm" style="width:100%;margin-top:10px">✅ 确认发放选中的积分（共 ${total} 分）</button>
    </div>
  `;
}

// 时间格式：ISO → HH:MM
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function pointLogPanel() {
  const rows = S.pointLogs.slice(0, 50);
  if (!rows.length) return '';
  // 超过 20 条默认折叠收起，放在页面最下面
  return `
    <details class="panel log-fold" ${rows.length > 20 ? '' : 'open'}>
      <summary>积分流水（最近 ${rows.length} 条）<small style="font-weight:400">「↩」撤销已发放的积分</small></summary>
      <div style="margin-top:8px">
      ${rows.map(l => `
        <div class="prow">
          <span class="grow">${l.confirmed === false ? '⏳ ' : ''}${l.reason}</span>
          <span class="when">${l.log_date} ${fmtTime(l.created_at)}</span>
          <span class="amt ${l.amount >= 0 ? 'plus' : 'minus'}">${l.amount >= 0 ? '+' : ''}${l.amount}</span>
          ${l.amount > 0 ? `<button class="btn-danger" data-action="parent-undo" data-plid="${l.id}">↩</button>` : ''}
        </div>
      `).join('')}
      </div>
    </details>
  `;
}

// 按维度过滤每日任务：all 全部每日 / req 必做 / opt 选做
function filterDailyByDim(dim) {
  let daily = S.tasks.filter(t => t.schedule === 'daily');
  if (dim === 'req') daily = daily.filter(t => t.required !== false);
  else if (dim === 'opt') daily = daily.filter(t => t.required === false);
  else if (dim && dim !== 'all') daily = daily.filter(t => t.id === Number(dim));  // 单个重复任务
  return daily;
}
// 打卡日历网格（含翻月导航），家长端和孩子端共用
function calGridHTML(daily) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + S.calOffset;
  const first = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const startDow = (first.getDay() + 6) % 7;
  const todayStr = DB.today();
  let html = `
    <div class="cal-head">
      <button class="cal-nav" data-action="parent-cal" data-step="-1">◀</button>
      <b>${first.getFullYear()} 年 ${first.getMonth() + 1} 月</b>
      <button class="cal-nav" data-action="parent-cal" data-step="1">▶</button>
    </div>
    <div class="cal-grid">
      ${'一二三四五六日'.split('').map(d => `<span class="cal-dow">${d}</span>`).join('')}
  `;
  for (let i = 0; i < startDow; i++) html += '<span class="cal-day empty"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayLogs = S.logs[ds];
    let doneN = 0;
    daily.forEach(t => { const l = dayLogs && dayLogs[t.id]; if (l && (l.done || l.completed)) doneN++; });
    let dot = '<span class="dot none"></span>';
    if (daily.length) {
      dot = doneN === daily.length ? '<span class="dot full"></span>' : (doneN > 0 ? '<span class="dot part"></span>' : '<span class="dot none"></span>');
    }
    html += `<span class="cal-day ${ds === todayStr ? 'today' : ''}">${d}${dot}</span>`;
  }
  html += '</div>';
  return html;
}
// 孩子端「我的」页打卡日历
function renderKidCal() {
  const root = $('kid-cal-root');
  if (!root) return;
  root.innerHTML = calGridHTML(filterDailyByDim(S.statDim));
}
function parentPmPanel() {
  return `
    <div class="panel">
      <h3>🎁 奖励 / 扣分</h3>
      <div class="input-row">
        <input id="pt-reason" placeholder="理由（如：帮妈妈洗碗 / 作业拖拉）" style="flex:2">
      </div>
      <div class="input-row">
        <input id="pt-givepts" type="number" placeholder="积分数量" value="50">
        <button class="btn-primary btn-pts" data-action="parent-givepts" style="flex:1">奖励积分</button>
      </div>
      <div class="input-row">
        <input id="pt-minuspts" type="number" placeholder="扣分数量" value="5">
        <button class="btn-danger btn-pts" data-action="parent-minuspts" style="flex:1">扣分</button>
      </div>
      <div class="input-row">
        <button class="btn-primary" data-action="parent-giveball" style="flex:1">送精灵球 ×1</button>
      </div>
      <div class="form-hint">奖励或扣分即时生效；理由会跟着展示给孩子看。</div>
    </div>
  `;
}
// 读取奖励/扣分理由（可空）
function pmReason() { return ($('pt-reason') && $('pt-reason').value || '').trim(); }

// 家长叮嘱弹窗编辑
function openNoteEditor() {
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal" style="max-width:440px;width:calc(100% - 40px)">
      <h3>💬 ${S.parentDate} 的叮嘱</h3>
      <textarea id="note-text" placeholder="说句给孩子的话（孩子端当天显示）" style="min-height:110px">${S.parentNote || ''}</textarea>
      <div class="form-hint">今天还没单独写过的话，这里会先带出最近一次的叮嘱，改完保存就只算今天的。留空保存 = 从今天起清除。</div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn-cancel" data-cancel style="flex:1">取消</button>
        <button class="btn-primary" data-save style="flex:2">保存</button>
      </div>
    </div>
  `;
  modal.querySelector('[data-cancel]').onclick = () => modal.remove();
  modal.querySelector('[data-save]').onclick = async ev => {
    const btn = ev.currentTarget;
    const n = modal.querySelector('#note-text').value.trim();
    btn.disabled = true;
    try {
      await DB.setNote(S.parentDate, n);
      // 家长端和查看日期是同一天时，同步孩子端的数据，切过去立刻能看到，不用刷新页面
      if (S.parentDate === S.viewDate) S.viewNote = n || null;
      S.parentNote = n || null;
      modal.remove();
      toast(n ? '已保存叮嘱' : '已清除叮嘱');
      render();
    } catch (err) {
      btn.disabled = false;
      toast('保存失败：' + (err && err.message ? err.message : err));
      reportError('保存叮嘱失败', `${err && err.message ? err.message : err}（日期 ${S.parentDate}）`, err && err.stack, '');
    }
  };
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}
// ---------- 家长规则设置（动态调分值，存数据库全家同步） ----------
// 🐞 错误日志：页面异常都留了档，家长端可查看/复制，方便排查
function errorLogPanel() {
  const list = loadErrors();
  return `
    <div class="panel">
      <h3>🐞 错误日志</h3>
      <div class="form-hint">${list.length
        ? `最近记录了 ${list.length} 条异常（同类错误会合并计数），出问题时可以一键复制发给我排查。`
        : '最近没有异常 🎉 页面运行正常。'}</div>
      ${list.length ? `<button class="btn-primary" data-action="err-view" style="width:100%">查看 / 复制错误日志</button>
      <button class="btn-ghost" data-action="err-clear" style="width:100%;margin-top:8px">清空日志</button>` : ''}
    </div>`;
}
function openErrorLog() {
  const list = loadErrors().slice().reverse();
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal" style="max-width:520px;width:calc(100% - 32px);max-height:80vh;display:flex;flex-direction:column">
      <h3>🐞 错误日志（${list.length}）</h3>
      <div style="overflow:auto;flex:1;margin:8px 0">
        ${list.length ? list.map(e => `
          <div class="err-item">
            <b>${escHTML(e.kind || '异常')}${e.count > 1 ? ` ×${e.count}` : ''}</b>
            <span>${escHTML(e.date || '')}</span>
            <p>${escHTML(e.message || '')}</p>
            ${e.extra ? `<small>${escHTML(e.extra)}</small>` : ''}
            ${e.stack ? `<details><summary>堆栈</summary><pre>${escHTML(e.stack)}</pre></details>` : ''}
          </div>`).join('') : '<div class="empty-tip">暂无记录</div>'}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-cancel" data-copy style="flex:1">复制全部</button>
        <button class="btn-primary" data-close style="flex:1">关闭</button>
      </div>
    </div>`;
  modal.querySelector('[data-close]').onclick = () => modal.remove();
  modal.querySelector('[data-copy]').onclick = () => copyText(list.map(errText).join('\n\n'));
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function parentSettingsPanel() {
  return `
    <div class="panel">
      <h3>⚙️ 规则设置</h3>
      <div class="form-hint">调整各种分值奖励（必做/选做全清奖、多日奖励与扣分、球价、经验等），改完立即生效、孩子端同步。</div>
      <button class="btn-primary" data-action="parent-settings" style="width:100%">调整规则数值</button>
    </div>
  `;
}
function openSettings() {
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal" style="max-width:440px;width:calc(100% - 40px)">
      <h3>⚙️ 规则设置</h3>
      ${SETTING_FIELDS.map(f => `
        <div class="input-row" style="margin-top:8px">
          <span style="font-size:13px;color:var(--ink-soft);flex:1.5">${f.label}</span>
          <input type="number" data-key="${f.key}" value="${CONFIG[f.key]}" style="width:88px">
        </div>`).join('')}
      <div class="form-hint">家长手机调整后，孩子平板打开自动用新数值。留空 = 保持原值。</div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn-cancel" data-cancel style="flex:1">取消</button>
        <button class="btn-primary" data-save style="flex:2">保存设置</button>
      </div>
    </div>
  `;
  modal.querySelector('[data-cancel]').onclick = () => modal.remove();
  modal.querySelector('[data-save]').onclick = async () => {
    const obj = {};
    modal.querySelectorAll('input[data-key]').forEach(inp => {
      const k = inp.dataset.key, v = inp.value.trim();
      if (v !== '') obj[k] = Number(v);
    });
    await DB.setSettings(obj);
    Object.keys(obj).forEach(k => { if (CONFIG[k] !== undefined) CONFIG[k] = obj[k]; });
    modal.remove();
    toast('已保存规则设置');
    render();
  };
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}
async function resetDemo() {
  const prefix = DEMO_ACTIVE ? 'kmd_' : 'km_';
  const what = DEMO_ACTIVE ? '演示数据' : '全部数据';
  if (!await askConfirm(`确定清空${what}吗？会重新生成示例任务。`, { okText: '清空' })) return;
  Object.keys(localStorage).filter(k => k.startsWith(prefix)).forEach(k => localStorage.removeItem(k));
  localStorage.removeItem(LK('lead'));
  location.reload();
}
async function giveBall() {
  const why = pmReason();
  const reason = why ? `家长奖励：${why}` : '家长奖励';
  await DB.addItemLog('ball', 1, reason, DB.today());
  S.balls++;
  toast('🔴 已送 1 个精灵球');
  pushNotice('ball', '家长送了你 1 个精灵球！', `现在一共有 ${S.balls} 个${why ? ' · ' + why : ''}`);
  render();
}
async function givePts() {
  const n = parseInt($('pt-givepts').value) || 0;
  if (!n) { toast('填数量'); return; }
  const why = pmReason();
  const reason = why ? `家长奖励：${why}` : '家长奖励';
  const pid = await DB.addPointLog(n, reason, DB.today());
  S.pointLogs.push({ id: pid, log_date: DB.today(), amount: n, reason });
  S.balance += n;
  toast(`⭐ 已发 ${n} 积分`);
  pushNotice('bonus', `家长额外奖励你 ${n} 积分！`, why ? `原因：${why}` : `现在一共有 ${S.balance} 分`);
  render();
}
async function minusPts() {
  const n = parseInt($('pt-minuspts').value) || 0;
  if (!n) { toast('填数量'); return; }
  const why = pmReason();
  const reason = why ? `家长扣分：${why}` : '家长扣分';
  const pid = await DB.addPointLog(-n, reason, DB.today());
  S.pointLogs.push({ id: pid, log_date: DB.today(), amount: -n, reason });
  S.balance -= n;
  toast(`➖ 已扣 ${n} 积分`);
  pushNotice('minus', `家长扣了你 ${n} 积分`, why ? `原因：${why}` : `现在还剩 ${S.balance} 分`);
  render();
}

// ---------- 待确认积分：一键发放 / 撤销 ----------
async function confirmPending() {
  const boxes = [...document.querySelectorAll('.pending-panel input[type=checkbox]:checked')];
  if (!boxes.length) { toast('没有选中的积分'); return; }
  const ids = boxes.map(b => Number(b.dataset.plid));
  const sum = S.pointLogs.filter(l => ids.includes(l.id)).reduce((s, l) => s + l.amount, 0);
  S.pointLogs.forEach(l => { if (ids.includes(l.id)) l.confirmed = true; });
  S.balance += sum;
  // 家长审批通过：把对应任务标记为"已完成"（不下架，任务保留在列表里展示完成状态）
  // 本地状态先算好，写库请求一次性并发发出（原来一条条 await，选 10 条就是 10 次往返）
  const approved = [];
  const logWrites = [];
  for (const id of ids) {
    const l = S.pointLogs.find(x => x.id === id);
    if (l && l.task_id) {
      logWrites.push(DB.setLog(l.task_id, l.log_date, true, null, null, true));
      if (S.logs[l.log_date]?.[l.task_id]) S.logs[l.log_date][l.task_id].approved = true;
      const raw = S.tasks.find(x => x.id === l.task_id);
      const t = raw ? taskAttrFor(raw, l.log_date) : null;   // 用那天的名称（编辑只对今天及之后生效）
      approved.push({
        title: (t && t.title) || String(l.reason || '').replace(/^完成[:：]\s*/, '') || '任务',
        pts: l.amount,
      });
    }
  }
  await Promise.all([DB.confirmPointLogs(ids), ...logWrites]);
  toast(`✅ 已发放 ${sum} 积分`);
  // 孩子任务页顶端留一条家长消息，点「知道啦」才消失
  if (approved.length === 1) {
    pushNotice('points', `家长确认了「${approved[0].title}」+${approved[0].pts} 积分！`, `现在一共有 ${S.balance} 分`);
  } else if (approved.length > 1) {
    const names = approved.map(a => a.title);
    pushNotice('points', `家长确认了 ${approved.length} 项任务，共 +${sum} 积分！`, `含：${names.slice(0, 3).join('、')}${names.length > 3 ? ' 等' : ''}`);
  }
  render();
}

async function undoPoint(id) {
  const l = S.pointLogs.find(x => x.id === id);
  if (!l) return;
  const kind = l.confirmed === false ? '这条待确认积分' : `这笔已发放的 +${l.amount} 积分`;
  if (!await askConfirm(`撤销${kind}「${l.reason}」？对应任务会恢复为未完成。`, { okText: '撤销' })) return;
  await DB.deletePointLog(id);
  S.pointLogs = S.pointLogs.filter(x => x.id !== id);
  if (l.confirmed !== false && l.amount > 0) S.balance -= l.amount;
  if (l.task_id) {
    await DB.setLog(l.task_id, l.log_date, false);
    if (S.logs[l.log_date]) delete S.logs[l.log_date][l.task_id];
    // 任务不再因完成而下架，撤销积分后它自然恢复为未完成状态，无需处理 active
  }
  toast('已撤销');
  render();
}

// ---------- 朋友圈成就图 ----------
async function shareCard() {
  if (!window.html2canvas) { toast('分享组件未加载（需联网），稍后再试'); return; }
  const wrap = document.createElement('div');
  wrap.id = 'share-wrap';
  wrap.innerHTML = shareCardHTML();
  document.body.appendChild(wrap);
  try {
    const canvas = await html2canvas(wrap, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    const dataUrl = canvas.toDataURL('image/png');
    const ov = $('overlay');
    ov.classList.remove('hidden');
    ov.className = 'overlay share-view';
    ov.innerHTML = `<img class="share-img" src="${dataUrl}"><p class="share-tip">💡 长按图片保存到相册，就能发朋友圈啦</p><button class="ov-skip">关闭</button>`;
    ov.querySelector('.ov-skip').onclick = () => ov.classList.add('hidden');
  } catch (err) {
    console.error(err);
    toast('生成失败，稍后再试');
  } finally {
    wrap.remove();
  }
}

function shareCardHTML() {
  const streak = calcStreak();
  const ts = todayTasks().filter(t => t.required !== false);
  const done = ts.filter(t => logToday(t.id)).length;
  const ds = doneStats();
  const lead = S.pokemons.find(p => p.id === S.leadId);
  const leadNo = lead ? lead.pokedex_no : 25;
  const type = pmType(leadNo);
  const theme = TYPE_THEME[type] || TYPE_THEME.normal;
  return `
    <div class="share-card" style="--tc:${theme.color}; --bg1:${theme.bg1}; --bg2:${theme.bg2}">
      <div class="share-head">🏝️ 佑佑的任务岛</div>
      <div class="share-pm">
        <img src="${lead ? artworkPath(leadNo) : 'assets/artwork/25.png'}" alt="">
        <div class="share-pm-name">${lead ? PK_BY_NO[leadNo].name + (lead.shiny ? ' ✨' : '') : '皮卡丘'}<span>${lead ? evoStageLabel(lead) : '基础'}</span></div>
      </div>
      <div class="share-stats">
        <div><b>${done}/${ts.length}</b><span>今日任务</span></div>
        <div><b>${streak}</b><span>必做全清连击</span></div>
        <div><b>${dexGotCount()}/151</b><span>图鉴收集</span></div>
        <div><b>${S.balance}</b><span>积分</span></div>
      </div>
      <div class="share-line" style="margin-top:14px;display:flex;justify-content:space-around;font-size:13px;font-weight:700;color:rgba(255,255,255,.92)">
        <span>累计完成 <b style="font-size:16px">${ds.total}</b></span>
        <span>近一周 <b style="font-size:16px">${ds.week}</b></span>
        <span>近一月 <b style="font-size:16px">${ds.month}</b></span>
      </div>
      <div class="share-date">${DB.today()} · 快乐打卡每一天</div>
    </div>
  `;
}

// ---------- 启动 ----------
window.addEventListener('DOMContentLoaded', async () => {
  try {
    DB.init();
    await refreshAll();
    S.viewDate = S.viewDate || DB.today();    // 默认查看今天
    S.parentDate = S.parentDate || DB.today(); // 家长端默认今天
    await applyOverduePenalty();  // 多日任务超期自动扣分
    await refreshAll();
    render();
    bindActions();
  } catch (err) {
    console.error(err);
    reportError('启动失败', `${err.message}（检查 CONFIG 里的数据库配置）`, err.stack, '');
    $('app').innerHTML = `<div class="loading-screen"><p>加载失败：${err.message}<br>检查 CONFIG 里的数据库配置</p></div>`;
  }
});
