// ============================================================
// Kimi 任务岛 - 主程序
// ============================================================

// confetti 安全包装（CDN 加载失败时静默降级，不影响功能）
const confetti = (...args) => window.confetti ? window.confetti(...args) : null;

// ---------- 演示模式隔离 ----------
// 进入演示模式后 localStorage 里写 km_demo=1，所有数据键改用 kmd_ 前缀，与真实数据完全隔离
const DEMO_ACTIVE = (() => { try { return localStorage.getItem('km_demo') === '1'; } catch { return false; } })();
const LK = k => (DEMO_ACTIVE ? 'kmd_' : 'km_') + k;

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
  { key: 'EXP_PER_LEVEL', label: '升 1 级所需经验' },
  { key: 'STREAK_DAYS_FOR_BALL', label: '连续全勤几天送球' },
  { key: 'STREAK_REWARD_BALLS', label: '全勤送几个球' },
];

// 日期工具
function shiftDate(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// 某任务在指定日期是否已完成
function logOn(taskId, date) { return !!(S.logs[date]?.[taskId]?.done); }

// 顶部趣味短句：宝可梦鼓励话 + 宝可梦小知识（适合小学生），共 100 条，按小时稳定换句，零网络依赖
const MOTTO = [
  // ===== 鼓励话 =====
  '坚持打卡，你的伙伴会越来越强！⚡',
  '每完成一个任务，宝可梦就离进化更近一步！',
  '连续全勤的坚持，也许会有宝可梦闪闪发光！✨',
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
  '全勤一周，会有惊喜等着你！🎉',
  '今天的你，比昨天的你更厉害！💪',
  '每只宝可梦都有它的闪光时刻！✨',
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

function pmType(no) { return (typeof PK_TYPES !== 'undefined' && PK_TYPES[no]) || 'normal'; }
function artworkPath(no) { return `assets/artwork/${no}.png`; }

const $ = id => document.getElementById(id);
const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------- 数据加载 ----------
async function refreshAll() {
  const vDate = S.viewDate || DB.today(), pDate = S.parentDate || DB.today();
  const [tasks, logs, pokemons, pointLogs, balls, vNote, pNote, settings] = await Promise.all([
    DB.getTasks(),
    DB.getLogsBetween('2000-01-01', '2099-12-31'),
    DB.getPokemons(),
    DB.getPointLogs(500),
    DB.getItemCount('ball'),
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
    S.logs[d][l.task_id] = { done: !!l.completed, progress: l.progress || 0 };
  });
  S.pokemons = pokemons;
  S.pointLogs = pointLogs;
  // 余额只算家长已确认发放的积分（confirmed=false 的"待确认"不计入）
  S.balance = pointLogs.reduce((s, l) => s + (l.confirmed === false ? 0 : l.amount), 0);
  S.balls = balls;
  if (S.leadId && !pokemons.some(p => p.id === S.leadId)) { S.leadId = null; localStorage.removeItem(LK('lead')); }
}

function activeTasks() { return S.tasks.filter(t => t.active); }

// 任务在某日期是否生效（start_date/end_date 均为空 = 一直生效）
function inEffect(t, d) {
  if (t.start_date && d < t.start_date) return false;
  if (t.end_date && d > t.end_date) return false;
  return true;
}

// 某日期的常规任务 = active 且每日/单次/子任务 且在生效日期范围内
function tasksOnDate(date) { return S.tasks.filter(t => t.active && (t.schedule === 'daily' || t.schedule === 'once' || t.schedule === 'child') && inEffect(t, date)); }
// 今日常规任务
function todayTasks() { return tasksOnDate(DB.today()); }
// 多日(长期)任务 = 父任务，各自带截止日期
function weeklyTasks() { return S.tasks.filter(t => t.active && t.schedule === 'weekly'); }
// 某父任务的子任务（仅 active）
function childTasks(parentId) { return S.tasks.filter(t => t.active && t.parent_id === parentId); }
// 某父任务的全部子任务（含已完成，用于进度统计）
function allChildTasks(parentId) { return S.tasks.filter(t => t.parent_id === parentId); }

function logToday(taskId) { return !!(S.logs[DB.today()]?.[taskId]?.done); }
// 该任务今天的加分是否还在"待家长确认"
function taskPending(taskId) {
  const d = DB.today();
  return S.pointLogs.some(l => l.log_date === d && l.task_id === taskId && l.confirmed === false);
}
function taskProgress(taskId) { // 多日任务按子任务分数算进度；普通任务按 progress 累计
  const kids = allChildTasks(taskId);
  if (kids.length) {
    const total = kids.reduce((s, k) => s + (k.points || 0), 0);
    if (!total) return 0;
    let got = 0;
    kids.forEach(k => {
      for (const d in S.logs) { const l = S.logs[d][k.id]; if (l && (l.completed || l.done)) { got += (k.points || 0); break; } }
    });
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
  for (const t of weeklyTasks()) {
    if (!t.deadline || t.deadline >= today) continue;
    let d = shiftDate(t.deadline, 1);
    while (d <= today) {
      const reason = `多日超期:${t.title}`;
      if (!S.pointLogs.some(l => l.log_date === d && l.reason === reason)) {
        const pid = await DB.addPointLog(-CONFIG.OVERDUE_DAILY_PENALTY, reason, d);
        S.pointLogs.push({ id: pid, log_date: d, amount: -CONFIG.OVERDUE_DAILY_PENALTY, reason, confirmed: true });
      }
      d = shiftDate(d, 1);
    }
  }
  S.balance = S.pointLogs.reduce((s, l) => s + (l.confirmed === false ? 0 : l.amount), 0);
}

// ---------- 计算：全清 / 连击 ----------
function isAllDone(dates) {
  const ts = todayTasks();
  if (!ts.length) return false;
  return ts.every(t => S.logs[dates]?.[t.id]?.done === true);
}
function calcStreak() {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 60; i++) {
    const ds = fmtDate(d);
    const dayLogs = S.logs[ds];
    if (dayLogs && Object.keys(dayLogs).length) {
      if (Object.values(dayLogs).every(l => l && l.done)) streak++;
      else break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
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
async function checkin(taskId, btn, progress = null) {
  const already = logToday(taskId);
  if (already) return;
  const task = S.tasks.find(t => t.id === taskId);
  if (!task) return;
  const today = DB.today();

  // ===== 子任务打卡（独立计分，多日任务的一部分）=====
  if (task.parent_id) {
    await DB.setLog(taskId, today, true, null, null);
    S.logs[today] = S.logs[today] || {};
    S.logs[today][taskId] = { done: true, progress: 0 };
    const pts = task.points || 0;
    if (pts > 0) {
      const pid = await DB.addPointLog(pts, `完成:${task.title}`, today, { confirmed: false, task_id: taskId });
      S.pointLogs.push({ id: pid, log_date: today, amount: pts, reason: `完成:${task.title}`, confirmed: false, task_id: taskId });
    }
    if (S.leadId) { const lead = S.pokemons.find(p => p.id === S.leadId); if (lead) await grantExp(lead, CONFIG.LEAD_EXP_PER_TASK); }
    // 子任务完成即下架（只完成一次，防止每天重复刷分）
    await DB.updateTask(taskId, { active: false });
    task.active = false;
    const parent = S.tasks.find(t => t.id === task.parent_id);
    const total = parent ? taskProgress(parent.id) : taskProgress(taskId);
    if (total >= 100 && parent) {
      await DB.updateTask(parent.id, { active: false });
      parent.active = false;
      for (const c of allChildTasks(parent.id)) { await DB.updateTask(c.id, { active: false }); c.active = false; }
      confetti({ particleCount: 120, spread: 100, origin: { y: .5 } });
      const bonus = parent.bonus || CONFIG.WEEKLY_DONE_BONUS;
      if (bonus > 0) {
        const bpid = await DB.addPointLog(bonus, `多日完成奖:${parent.title}`, today, { confirmed: false });
        S.pointLogs.push({ id: bpid, log_date: today, amount: bonus, reason: `多日完成奖:${parent.title}`, confirmed: false });
      }
      toast(`🎉 多日任务「${parent.title}」完成！${bonus > 0 ? '+' + bonus + '分' : ''}`);
    } else {
      toast(`✅ 「${task.title}」完成！「${parent ? parent.title : ''}」进度 ${total}%`);
    }
    renderTop(); render();
    return;
  }

  // ===== 进度型打卡（带百分比按钮的普通进度任务）=====
  if (progress) {
    await DB.setLog(taskId, today, true, null, progress);
    S.logs[today] = S.logs[today] || {};
    S.logs[today][taskId] = { done: true, progress };

    const parent = task.parent_id ? S.tasks.find(t => t.id === task.parent_id) : null;
    const ptsSource = parent || task;
    const pts = Math.round(ptsSource.points * progress / 100);
    const label = parent ? parent.title : task.title;
    if (pts > 0) {
      // 待家长确认后发放：先记"待确认"流水，余额不变
      const pid = await DB.addPointLog(pts, `完成:${label} ${progress}%`, today, { confirmed: false, task_id: taskId });
      S.pointLogs.push({ id: pid, log_date: today, amount: pts, reason: `完成:${label} ${progress}%`, confirmed: false, task_id: taskId });
    }
    if (S.leadId) {
      const lead = S.pokemons.find(p => p.id === S.leadId);
      if (lead) await grantExp(lead, CONFIG.LEAD_EXP_PER_TASK);
    }
    const total = parent ? taskProgress(parent.id) : taskProgress(taskId);
    if (total >= 100) {
      if (parent) {
        await DB.updateTask(parent.id, { active: false });
        parent.active = false;
        for (const c of allChildTasks(parent.id)) { await DB.updateTask(c.id, { active: false }); c.active = false; }
      } else {
        await DB.updateTask(taskId, { active: false });
        task.active = false;
      }
      confetti({ particleCount: 110, spread: 90, origin: { y: .5 } });
      toast(`🎉 「${label}」完成！`);
    } else {
      toast(`⏰ 「${label}」已完成 ${total}%，还差 ${100 - total}%`);
    }
    renderTop(); render();
    return;
  }

  // ===== 常规打卡 =====
  await DB.setLog(taskId, today, true, null);
  S.logs[today] = S.logs[today] || {};
  S.logs[today][taskId] = { done: true, progress: 0 };

  // 加分（待家长确认后发放：先记"待确认"流水，余额不变）
  const pid = await DB.addPointLog(task.points, `完成:${task.title}`, today, { confirmed: false, task_id: taskId });
  S.pointLogs.push({ id: pid, log_date: today, amount: task.points, reason: `完成:${task.title}`, confirmed: false, task_id: taskId });

  // 出战宝可梦加经验
  if (S.leadId) {
    const lead = S.pokemons.find(p => p.id === S.leadId);
    if (lead) await grantExp(lead, CONFIG.LEAD_EXP_PER_TASK);
  }

  // once 任务完成即下架
  if (task.schedule === 'once') {
    await DB.updateTask(taskId, { active: false });
    task.active = false;
  }

  // 全清判定 + 奖励（必做/选做分开）
  const dayTasks = todayTasks();
  const reqTasks = dayTasks.filter(t => t.required !== false);
  const optTasks = dayTasks.filter(t => t.required === false);
  const isDayDone = arr => arr.length > 0 && arr.every(t => S.logs[today]?.[t.id]?.done === true);
  const reqDone = isDayDone(reqTasks);
  const optDone = isDayDone(optTasks);

  if (reqDone && !S.pointLogs.some(l => l.reason === `必选全清_${today}`)) {
    const rpid = await DB.addPointLog(CONFIG.REQUIRED_DONE_BONUS, `必选全清_${today}`, today, { confirmed: false });
    S.pointLogs.push({ id: rpid, log_date: today, amount: CONFIG.REQUIRED_DONE_BONUS, reason: `必选全清_${today}`, confirmed: false });
    confetti({ particleCount: 90, spread: 80, origin: { y: .6 } });
    toast(`🎉 今日必做任务全部完成！+${CONFIG.REQUIRED_DONE_BONUS}（待家长确认）`);
    // 连击球（基于必选全清）
    if (calcStreak() >= CONFIG.STREAK_DAYS_FOR_BALL) {
      const reason = `全勤${CONFIG.STREAK_DAYS_FOR_BALL}天_${today}`;
      if (!await DB.hasItemReason(reason)) {
        await DB.addItemLog('ball', CONFIG.STREAK_REWARD_BALLS, reason, today);
        S.balls += CONFIG.STREAK_REWARD_BALLS;
        toast(`🏆 连续 ${calcStreak()} 天全勤！送精灵球 ×${CONFIG.STREAK_REWARD_BALLS}`);
        // ✨ 全勤彩蛋：随机点亮一只已有的宝可梦为闪光
        const cand = S.pokemons.filter(p => !p.shiny);
        if (cand.length) {
          const pick = cand[Math.floor(Math.random() * cand.length)];
          await DB.updatePokemon(pick.id, { shiny: true });
          pick.shiny = true;
          await showShiny(pick);
        }
      }
    }
  }
  if (optDone && !S.pointLogs.some(l => l.reason === `可选全清_${today}`)) {
    const opid = await DB.addPointLog(CONFIG.OPTIONAL_DONE_BONUS, `可选全清_${today}`, today, { confirmed: false });
    S.pointLogs.push({ id: opid, log_date: today, amount: CONFIG.OPTIONAL_DONE_BONUS, reason: `可选全清_${today}`, confirmed: false });
    confetti({ particleCount: 50, spread: 60, origin: { y: .5 } });
    toast(`🎁 选做任务也全部完成！+${CONFIG.OPTIONAL_DONE_BONUS}（待家长确认）`);
  }

  // 单任务动画
  const card = btn ? btn.closest('.task-card') : null;
  if (card) card.classList.add('just-done', 'done');
  if (btn) { btn.textContent = '✅ 已完成'; btn.disabled = true; }
  confetti({ particleCount: 40, spread: 60, scalar: .8, origin: { y: .5 } });
  renderTop();
  renderProgress();
  renderTasks();
}

// ---------- 经验 / 升级 ----------
async function grantExp(pm, exp) {
  let e = pm.exp + exp, lv = pm.level;
  let leveled = false;
  while (e >= CONFIG.EXP_PER_LEVEL && lv < CONFIG.LEVEL_CAP) { e -= CONFIG.EXP_PER_LEVEL; lv++; leveled = true; }
  await DB.updatePokemon(pm.id, { exp: e, level: lv });
  pm.exp = e; pm.level = lv;
  if (leveled) showLevelUp(pm);
  // 最高级后继续攒经验，攒满一管就变闪光：给孩子升满级后的新目标
  if (lv >= CONFIG.LEVEL_CAP && !pm.shiny && e >= CONFIG.EXP_PER_LEVEL) {
    await DB.updatePokemon(pm.id, { exp: 0, shiny: true });
    pm.exp = 0; pm.shiny = true;
    await showShiny(pm, `${pm.name} 攒满了最高级的经验，突破极限成为传说闪光✨`);
  }
}

// ---------- 喂养 ----------
async function feedPm(pm, pts) {
  if (pts <= 0 || pts > S.balance) return;
  const pid = await DB.addPointLog(-pts, `喂养:${pm.name}`, DB.today());
  S.pointLogs.push({ id: pid, log_date: DB.today(), amount: -pts, reason: `喂养:${pm.name}` });
  S.balance -= pts;
  await grantExp(pm, pts * CONFIG.POINTS_TO_EXP);
  renderTop();
  hideModal();
  render();
  const card = document.querySelector(`.pm-card[data-pmid="${pm.id}"]`);
  if (card) sparkleOn(card);
}

// ---------- 进化 ----------
function evoStage(no) { // 0基础 1一段 2二段
  let s = 0, cur = no;
  const from = {}; POKEMON.forEach(p => { if (p.e) from[p.e] = p.no; });
  while (from[cur] !== undefined) { cur = from[cur]; s++; }
  return s;
}
function canEvolve(pm) {
  const info = PK_BY_NO[pm.pokedex_no];
  if (!info.e) return { ok: false };
  const stage = evoStage(pm.pokedex_no);
  const needExp = CONFIG.EVOLVE_EXP[stage] || 999;
  if (pm.exp < needExp) return { ok: false, why: `经验 ${pm.exp}/${needExp}` };
  return { ok: true, needExp, stage };
}
async function evolvePm(pm) {
  const c = canEvolve(pm);
  if (!c.ok) return;
  const fromNo = pm.pokedex_no;
  const toNo = PK_BY_NO[fromNo].e;
  // 进化消耗掉这管经验（不再花积分，高级进化需要更多经验）
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

// ---------- 捕捉（必出新：每次一定抓到没抓过的） ----------
async function catchOne() {
  if (S.balls < 1) { toast('没有精灵球啦～攒积分买一个吧'); return; }
  // 从候选池里剔除已经拥有的编号
  const owned = new Set(S.pokemons.map(p => p.pokedex_no));
  const rare = Math.random() < CONFIG.RARITY.rare;
  let pool = CATCH_POOL[rare ? 'rare' : 'common'].filter(no => !owned.has(no));
  if (!pool.length) pool = CATCH_POOL.common.concat(CATCH_POOL.rare).filter(no => !owned.has(no));
  if (!pool.length) { toast('🏆 图鉴已经集满，没有新的宝可梦啦！'); return; }  // 集满不扣球
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

// ---------- 动画：随机点亮闪光（连续全勤时触发） ----------
function showShiny(pm, sub = null) {
  return new Promise(resolve => {
    const ov = $('overlay');
    ov.classList.remove('hidden'); ov.className = 'overlay gold';
    const stars = Array.from({ length: 18 }).map((_, i) =>
      `<i style="left:${(i * 5.5) % 100}%;top:${(i * 31) % 70}%;animation-delay:${(i * 0.13).toFixed(2)}s">✦</i>`).join('');
    ov.innerHTML = `
      <div class="ov-stage">
        <img class="ov-mon reveal" src="${spritePath(pm.pokedex_no, true)}">
        <div class="shiny-rain">${stars}</div>
      </div>
      <div class="ov-title">✨ 闪闪发光了！✨</div>
      <div class="ov-sub">${sub || `${pm.name} 在连续全勤的欢呼中变成了闪光宝可梦！`}</div>
      <button class="ov-skip">哇！！🌟</button>
    `;
    sparkleBurst(ov.querySelector('.ov-stage'), 30);
    confetti({ particleCount: 160, spread: 120, colors: ['#ffe082', '#fff176', '#ffd54f', '#ffffff'], origin: { y: .4 } });
    const finish = () => { if (!ov.dataset.done) { ov.dataset.done = '1'; ov.classList.add('hidden'); resolve(); } };
    ov.querySelector('.ov-skip').onclick = finish;
    setTimeout(finish, 3400);
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
        <div class="ov-title">Lv.${pm.level}</div>
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

// ---------- Toast ----------
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

// ---------- 渲染 ----------
function renderTop() {
  const pt = $('pt'), bl = $('bl');
  if (!pt || !bl) return;
  pt.textContent = S.balance;
  bl.textContent = S.balls;
  pt.parentElement.classList.remove('shake-it'); void pt.parentElement.offsetWidth; pt.parentElement.classList.add('shake-it');
  bl.parentElement.classList.remove('shake-it'); void bl.parentElement.offsetWidth; bl.parentElement.classList.add('shake-it');
}

// 孩子端日期导航条（查看历史某天的完成情况，历史日期只读）
function dateNavHTML() {
  const today = DB.today();
  return `
    <div class="date-nav">
      <button class="chip" data-action="date-prev">◀ 前一天</button>
      <span class="date-cur">${S.viewDate}${S.viewDate === today ? '（今天）' : ''}</span>
      <button class="chip" data-action="date-next" ${S.viewDate >= today ? 'disabled' : ''}>后一天 ▶</button>
      ${S.viewDate !== today ? `<button class="chip red" data-action="date-today">回到今天</button>` : ''}
    </div>
  `;
}

function renderProgress() {
  const el = $('progress-wrap');
  if (!el) return;
  const all = todayTasks();
  const req = all.filter(t => t.required !== false);
  const opt = all.filter(t => t.required === false);
  const wts = weeklyTasks();
  if (!all.length && !wts.length) { el.innerHTML = ''; return; }
  const bar = (list, title, doneText, bonusText) => {
    const done = list.filter(t => logOn(t.id, S.viewDate)).length;
    const full = list.length > 0 && done === list.length;
    return `
      <div class="progress-head" style="display:flex;justify-content:space-between;align-items:center">
        <b>${title}</b>
        <span>${done}/${list.length} 已完成 ${full ? `🎉 ${bonusText}` : doneText}</span>
      </div>
      <div class="progress-track"><div class="progress-fill ${full ? 'full' : ''}" style="width:${list.length ? (done / list.length * 100) : 0}%"></div></div>
    `;
  };
  // 必做 / 选做 独立两条进度条
  let html = `<div class="progress-card">
    ${bar(req, '🔴 必做任务全清', `全清 +${CONFIG.REQUIRED_DONE_BONUS} 分`, `🎉 全清 +${CONFIG.REQUIRED_DONE_BONUS} 分`)}
    ${opt.length ? bar(opt, '🟢 选做任务全清', `全清 +${CONFIG.OPTIONAL_DONE_BONUS} 分`, `🎉 全清 +${CONFIG.OPTIONAL_DONE_BONUS} 分`) : ''}
  </div>`;
  // 多日任务进度条挨着增加
  if (wts.length) html += `<div class="progress-card">${wts.map(weeklyProgressBar).join('')}</div>`;
  el.innerHTML = html;
}

function renderTasks() {
  const page = $('page');
  const ts = todayTasks();
  const wts = weeklyTasks();
  const req = ts.filter(t => t.required !== false);
  const opt = ts.filter(t => t.required === false);
  if (!ts.length && !wts.length) {
    page.innerHTML = `<div class="empty-tip">今天还没有任务哦，让家长去布置吧～</div>`;
    return;
  }
  let html = dateNavHTML();
  if (S.viewNote) html += noteCardHTML();
  html += `<div id="progress-wrap"></div>`;
  html += rulesHintHTML();
  // 必做任务：按类别分区展示（校内在先，孩子先做完校内）
  html += catSectionHTML(req, '🔴 必做任务');
  // 选做任务：同样按类别分区
  if (opt.length) html += catSectionHTML(opt, '🟢 选做任务');
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
// 任务排序：家长调整的 sort 优先，其次按名称
function taskSort(a, b) {
  const sa = a.sort || 0, sb = b.sort || 0;
  if (sa !== sb) return sa - sb;
  return (a.title || '').localeCompare(b.title || '', 'zh');
}
// 必做/选做分区内直接平铺任务（不再按类别分组块），排序：类别顺序 → 家长排序(sort) → 名称
function catSectionHTML(tasks, title) {
  if (!tasks.length) return '';
  const arr = tasks.slice().sort((a, b) => {
    const ca = catOrder(a.category), cb = catOrder(b.category);
    if (ca !== cb) return ca - cb;
    const sa = a.sort || 0, sb = b.sort || 0;
    if (sa !== sb) return sa - sb;
    return (a.title || '').localeCompare(b.title || '', 'zh');
  });
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
        <li>🏆 连续 ${CONFIG.STREAK_DAYS_FOR_BALL} 天全勤 → 送精灵球，还会随机点亮一只闪光✨</li>
        <li>🥚 1 个精灵球一定抓到 1 只<b>新</b>宝可梦（绝不重复）</li>
        <li>🍬 喂糖果攒经验：1 分 = ${CONFIG.POINTS_TO_EXP} exp；经验满了一管就能进化，越进化需要的经验越多</li>
        <li>⭐ 出战的宝可梦是你的伙伴，每次完成任务它 +${CONFIG.LEAD_EXP_PER_TASK} 经验</li>
        <li>⏳ 积分要家长确认才到账，别乱点哦</li>
      </ul>
    </details>
  `;
}

function taskCardHTML(t) {
  const isToday = S.viewDate === DB.today();
  const done = logOn(t.id, S.viewDate);
  const isChild = !!t.parent_id;
  const streak = t.schedule === 'daily' ? taskStreak(t.id) : 0;  // 每日任务连续打卡天数
  // 必做/选做明显标记（卡片上部）
  const reqTag = t.required === false
    ? '<span class="req-tag opt">🟢 选做</span>'
    : '<span class="req-tag">🔴 必做</span>';
  // 家长小提示
  const hint = t.hint ? `<div class="task-hint">💡 ${t.hint}</div>` : '';
  return `
  <div class="task-card ${done ? 'done' : ''} ${t.required === false ? 'optional' : ''} ${isChild ? 'child-card' : ''}" data-action="task-detail" data-tid="${t.id}">
    <div class="emoji">${catIcon(t.category)}</div>
    <div class="info">
      <b>${t.title}</b>${reqTag}
      ${hint}
      <span>${t.category} · ${taskTypeLabel(t)}${streak > 0 ? ` · 🔥连续 ${streak} 天` : ''}${t.start_date ? ` · 📅 ${t.start_date.slice(5)}` : ''}</span>
    </div>
    <div class="pts">+${t.points}</div>
    <button class="btn-done" data-action="checkin" data-tid="${t.id}" ${done || !isToday ? 'disabled' : ''}>${done ? '✅ 已完成' : (!isToday ? '查看历史' : '✅ 完成')}</button>
  </div>`;
}

// 任务详情弹窗（手机上看不清时点卡片查看完整信息）
function showTaskDetail(id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  const isChild = !!t.parent_id;
  const parent = isChild ? S.tasks.find(x => x.id === t.parent_id) : null;
  const isParent = S.role === 'parent';
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal" style="max-width:420px;width:calc(100% - 40px)">
      <h3>${t.title}${t.required === false ? ' <span class="req-tag opt">选做</span>' : ' <span class="req-tag">必做</span>'}</h3>
      <div class="form-hint" style="margin-top:10px">${t.category} · +${t.points}分 · ${taskTypeLabel(t)}${t.start_date ? ` · 📅 ${t.start_date}` : ''}${t.deadline ? ` · 截止 ${t.deadline}` : ''}</div>
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
// 删除任务（家长）
async function delTask(id) {
  if (!confirm('确定删除这个任务？')) return;
  await DB.deleteTask(id);
  await refreshAll(); render();
  toast('已删除');
}

// ---------- 多日任务进度条（统一风格，挨着每日进度条增加） ----------
function dlBadgeHTML(t, left) {
  if (!t.deadline) return '';
  if (left > 2) return `<span class="dl-badge">⏳ 剩 ${left} 天</span>`;
  if (left === 0) return `<span class="dl-badge urgent">🔥 今天截止！</span>`;
  if (left < 0) return `<span class="dl-badge urgent">🚫 已超期 ${-left} 天</span>`;
  return `<span class="dl-badge urgent">⏳ 剩 ${left} 天</span>`;
}
function weeklyProgressBar(t) {
  const prog = taskProgress(t.id);
  const left = deadlineDaysLeft(t.deadline);
  const full = prog >= 100;
  return `
    <div class="progress-head" data-action="weekly-detail" data-tid="${t.id}" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" title="点开看子任务状态">
      <b>${t.title}${dlBadgeHTML(t, left)}</b>
      <span>${prog}%${full ? ' 🎉' : ''} · 全清 +${t.bonus || CONFIG.WEEKLY_DONE_BONUS} 分</span>
    </div>
    <div class="progress-track"><div class="progress-fill ${full ? 'full' : ''}" style="width:${prog}%"></div></div>
    ${t.deadline ? `<div class="dl-penalty">⏰ 超期每天扣 ${CONFIG.OVERDUE_DAILY_PENALTY} 分</div>` : ''}
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
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal" style="max-width:420px;width:calc(100% - 40px)">
      <h3>${t.title}</h3>
      <div class="form-hint" style="margin-top:4px">子任务完成得自己的分数，全部完成多日任务即完成</div>
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

function renderPokemons() {
  const page = $('page');
  page.innerHTML = `
    <div class="catch-zone">${catchZoneHTML()}</div>
    <div class="catch-hint" style="text-align:center;margin-bottom:12px">⭐ 卡上带 ⭐ 的「出战」宝可梦是你的伙伴，每次完成任务它都会 +${CONFIG.LEAD_EXP_PER_TASK} 经验。</div>
    ${S.pokemons.length ? `
      <div class="section-title">我的宝可梦 <small>${S.pokemons.length} 只 · 点卡查看</small></div>
      <div class="pm-grid">
        ${S.pokemons.map(pmCardHTML).join('')}
      </div>
    ` : '<div class="empty-tip">还没有宝可梦！<br><br>先去捉一只吧 🥚</div>'}
    <div class="section-title" style="margin-top:24px">宝可梦图鉴 <small>${dexGotCount()}/151</small></div>
    ${dexHTML()}
  `;
}

// 小卡牌（列表）
function pmCardHTML(pm) {
  const info = PK_BY_NO[pm.pokedex_no];
  const type = pmType(pm.pokedex_no);
  return `
  <div class="pm-card-mini ${pm.shiny ? 'shiny' : ''}" data-action="card" data-pmid="${pm.id}">
    <div class="mini-frame" style="--tc:${TYPE_COLOR[type] || '#a8a878'}">
      <img src="${artworkPath(pm.pokedex_no)}" alt="${info.name}" loading="lazy">
      ${pm.shiny ? '<span class="mini-shiny">✨</span>' : ''}
      ${pm.id === S.leadId ? '<span class="mini-lead">⭐</span>' : ''}
      <span class="mini-lv-badge">Lv.${pm.level}</span>
    </div>
    <div class="mini-name">${info.name}</div>
    <div class="mini-type" style="color:${TYPE_COLOR[type] || '#a8a878'}">${TYPE_NAME[type] || type}</div>
  </div>`;
}

// 卡牌详情（PTCG 风格全屏）
function showCardDetail(pm) {
  const info = PK_BY_NO[pm.pokedex_no];
  const type = pmType(pm.pokedex_no);
  const theme = TYPE_THEME[type] || TYPE_THEME.normal;
  const expPct = Math.min(100, pm.exp / CONFIG.EXP_PER_LEVEL * 100);
  const evo = canEvolve(pm);
  const isLead = pm.id === S.leadId;
  const ov = $('overlay');
  ov.classList.remove('hidden');
  ov.className = 'overlay card-view';
  ov.innerHTML = `
    <div class="ptcg" style="--tc:${theme.color}; --bg1:${theme.bg1}; --bg2:${theme.bg2}">
      <div class="ptcg-top">
        <span class="ptcg-name">${info.name}</span>
        ${pm.shiny ? '<span class="ptcg-shiny">✨ 闪光</span>' : ''}
        <span class="ptcg-lv">Lv.${pm.level}</span>
      </div>
      <div class="ptcg-art">
        <img src="${artworkPath(pm.pokedex_no)}">
        <span class="ptcg-type">${TYPE_NAME[type] || type}</span>
        ${pm.shiny ? '<span class="ptcg-glitter"></span>' : ''}
      </div>
      <div class="ptcg-skill">
        <b><span class="ptcg-move" style="background:${theme.color}">${theme.skill}</span><em>${theme.damage}</em></b>
        <p>${theme.desc}</p>
      </div>
      ${typeof PK_FLAVOR !== 'undefined' && PK_FLAVOR[pm.pokedex_no] ? `
      <div class="ptcg-flavor">📖 ${PK_FLAVOR[pm.pokedex_no]}</div>` : ''}
      <div class="ptcg-foot">
        <div class="ptcg-exprow">EXP ${pm.exp}/${CONFIG.EXP_PER_LEVEL}</div>
        <div class="exp-track"><div class="exp-fill" style="width:${expPct}%"></div></div>
        ${evoChainLine(pm.pokedex_no)}
        ${info.e ? `<div class="ptcg-evo ${evo.ok ? 'ok' : ''}">${evo.ok ? '✨ 可以进化啦！' : (evo.why ? '『' + evo.why + '』' : '')}</div>` : ''}
      </div>
      <div class="ptcg-btns">
        <button class="btn-lead" ${isLead ? 'disabled' : ''}>${isLead ? '⭐ 出战（伙伴）' : '⭐ 设为出战（伙伴）'}</button>
        <button class="btn-feed">🍬 喂糖果</button>
        ${info.e ? `<button class="btn-evo" ${evo.ok ? '' : 'disabled'}>进化</button>` : ''}
        <button class="btn-close">✕ 关闭</button>
      </div>
    </div>
  `;
  ov.querySelector('.btn-close').onclick = () => ov.classList.add('hidden');
  ov.querySelector('.btn-lead').onclick = () => { setLead(pm.id); ov.classList.add('hidden'); };
  ov.querySelector('.btn-feed').onclick = () => { ov.classList.add('hidden'); openFeed(pm.id); };
  const evoBtn = ov.querySelector('.btn-evo');
  if (evoBtn) evoBtn.onclick = async () => { ov.classList.add('hidden'); await evolvePm(pm); };
}

// 进化链展示
function evoChainLine(no) {
  const chain = [no];
  let cur = no;
  while (PK_BY_NO[cur] && PK_BY_NO[cur].e) { cur = PK_BY_NO[cur].e; chain.push(cur); }
  while (PK_EVOLVE_FROM[chain[0]] !== undefined) chain.unshift(PK_EVOLVE_FROM[chain[0]]);
  return `<div class="ptcg-chain">${chain.map(c => {
    const curPm = c === no;
    return `<span class="${curPm ? 'cur' : ''}"><img src="${spritePath(c, false)}" alt="">${PK_BY_NO[c].name}</span>`;
  }).join('<i>→</i>')}</div>`;
}

function catchZoneHTML() {
  const ballIcons = Array.from({ length: Math.min(S.balls, 24) }).map(() => '<span class="mini-ball"></span>').join('');
  return `
    <div class="ball-row">${ballIcons || '<span style="font-size:12px;color:#8d6e63">0 个球</span>'}</div>
    <button class="btn-big" data-action="catch" ${S.balls < 1 ? 'disabled' : ''}>${POKE_ICON.ball('#e53935')} 捕捉宝可梦（1 个球）</button>
    <button class="btn-big buy" data-action="buyball" ${S.balance < CONFIG.BALL_PRICE ? 'disabled' : ''}>${POKE_ICON.master()} 买精灵球（${CONFIG.BALL_PRICE} 分）</button>
    <div class="catch-hint">每次必抓到新宝可梦（不重复）· 连续 ${CONFIG.STREAK_DAYS_FOR_BALL} 天全勤送球，还会随机点亮一只闪光✨</div>
  `;
}

// ---------- 图鉴 ----------
function dexGot() {
  const got = {};
  const shinyOwned = new Set();
  S.pokemons.forEach(p => { got[p.pokedex_no] = true; if (p.shiny) shinyOwned.add(p.pokedex_no); });
  return { got, shinyOwned };
}
function dexGotCount() { return Object.keys(dexGot().got).length; }
function dexHTML() {
  const { got, shinyOwned } = dexGot();
  return `
    <div class="dex-grid">
      ${POKEMON.map(p => {
        const has = got[p.no];
        const shiny = shinyOwned.has(p.no);
        return `
        <div class="dex-cell ${has ? '' : 'unknown'} ${shiny ? 'shiny-cell' : ''}" data-no="${p.no}">
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
      <div class="stat-card"><b>${streak}</b><span>连续全勤(天)</span></div>
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
  const dailyTasks = S.tasks.filter(t => t.active && t.schedule === 'daily');
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
  const dailyTasks = S.tasks.filter(t => t.active && t.schedule === 'daily');
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
  const daily = S.tasks.filter(t => t.active && t.schedule === 'daily');
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
function ownDexCount() {
  const got = {}; S.pokemons.forEach(p => got[p.pokedex_no] = 1); return got;
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
  $('app').innerHTML = kidShellHTML();
  bindKidTabs();
  if (S.tab === 'tasks') renderTasks();
  else if (S.tab === 'pokemon') renderPokemons();
  else renderMe();
  renderTop();
}
function kidShellHTML() {
  return `
    <div class="topbar">
      ${DEMO_ACTIVE ? '<div class="demo-tag">🎬 演示模式</div>' : ''}
      <div class="title">🏝️ Kimi 的任务岛<small>${mottoText()}</small></div>
      <div class="badges">
        <span class="badge">⭐ <b id="pt">0</b></span>
        <span class="badge ball">🔴 <b id="bl">0</b></span>
      </div>
    </div>
    ${ptsNoticeHTML()}
    <div class="page" id="page"></div>
    <nav class="tabbar">
      <button class="${S.tab === 'tasks' ? 'on' : ''}" data-tab="tasks"><span class="ico">${POKE_ICON.ball('#e53935')}</span>任务</button>
      <button class="${S.tab === 'pokemon' ? 'on' : ''}" data-tab="pokemon"><span class="ico">${POKE_ICON.ultra()}</span>宝可梦</button>
      <button class="${S.tab === 'me' ? 'on' : ''}" data-tab="me"><span class="ico">${POKE_ICON.dex()}</span>我的</button>
      <button class="secret" id="btn-parent"><span class="ico">${POKE_ICON.master()}</span>家长</button>
    </nav>
  `;
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
async function refreshViewNote() { S.viewNote = await DB.getNote(S.viewDate); render(); }
async function refreshParentNote() { S.parentNote = await DB.getNote(S.parentDate); render(); }
// 孩子端：当日叮嘱卡片（等宽圆角，和任务列表一致），随日期切换
function noteCardHTML() {
  return `<div class="note-card">💬 每日叮嘱：${S.viewNote}</div>`;
}
function bindKidTabs() {
  const tabs = document.querySelectorAll('.tabbar button[data-tab]');
  tabs.forEach(b => b.onclick = () => { S.tab = b.dataset.tab; render(); });
  $('btn-parent').onclick = () => {
    // 演示模式下已具备家长身份，直接进入不再要密码
    if (DEMO_ACTIVE) { S.role = 'parent'; localStorage.setItem(LK('role'), 'parent'); render(); return; }
    // 快速进入：家长密码
    const pw = prompt('请输入家长密码');
    if (pw === CONFIG.PARENT_PASSWORD) { S.role = 'parent'; localStorage.setItem(LK('role'), 'parent'); render(); }
    else if (pw !== null) toast('密码不对哦');
  };
}
// 家长端任务列表：长按/按住拖动排序（手机 touch + 桌面 mouse）
function enableDragSort(sel) {
  const list = document.querySelector(sel);
  if (!list) return;
  const rows = () => [...list.children].filter(c => c.classList.contains('prow'));
  let drag = null;
  function moveBy(dy) {
    const r = rows();
    const h = (r[0] ? r[0].offsetHeight : 40) + 4;
    let cur = r.indexOf(drag.row);
    let target = Math.min(r.length - 1, Math.max(0, cur + Math.round(dy / h)));
    if (target !== cur && r[target]) {
      drag.moved = true;
      list.insertBefore(drag.row, target > cur ? r[target].nextSibling : r[target]);
      drag.startY += (target - cur) * h;  // 行已移动，起始基准同步，继续拖能连续换位
      drag.row.classList.add('dragging');
    }
  }
  async function saveSort() {
    const r = rows();
    for (let i = 0; i < r.length; i++) await DB.updateTask(Number(r[i].dataset.tid), { sort: i });
    await refreshAll(); render();
  }
  // 手机：长按 400ms 进入拖动
  list.addEventListener('touchstart', e => {
    const row = e.target.closest('.prow');
    if (!row) return;
    const t = e.touches[0];
    drag = { row, startY: t.clientY, armed: false, moved: false, timer: setTimeout(() => { drag.armed = true; row.classList.add('dragging'); }, 400) };
  }, { passive: true });
  list.addEventListener('touchmove', e => {
    if (!drag || !drag.armed) return;
    e.preventDefault();
    const t = e.touches[0];
    moveBy(t.clientY - drag.startY);
  }, { passive: false });
  list.addEventListener('touchend', () => {
    if (!drag) return;
    clearTimeout(drag.timer);
    if (drag.armed && drag.moved) saveSort();
    if (drag.row) drag.row.classList.remove('dragging');
    drag = null;
  });
  // 桌面：鼠标直接按住拖动
  list.addEventListener('mousedown', e => {
    const row = e.target.closest('.prow');
    if (!row) return;
    e.preventDefault();
    drag = { row, startY: e.clientY, armed: true, moved: false, timer: null };
    row.classList.add('dragging');
    const onMove = ev => { if (!drag) return; moveBy(ev.clientY - drag.startY); };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (drag && drag.moved) saveSort();
      if (drag && drag.row) drag.row.classList.remove('dragging');
      drag = null;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
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
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    const tid = btn.dataset.tid, pmid = btn.dataset.pmid;
    if (act === 'checkin') await checkin(Number(tid), btn, btn.dataset.prog ? Number(btn.dataset.prog) : null);
    else if (act === 'task-detail') showTaskDetail(Number(tid));
    else if (act === 'weekly-detail') showWeeklyChildren(Number(tid));
    else if (act === 'date-prev') { S.viewDate = shiftDate(S.viewDate, -1); render(); refreshViewNote(); }
    else if (act === 'date-next') { if (S.viewDate < DB.today()) { S.viewDate = shiftDate(S.viewDate, 1); render(); refreshViewNote(); } }
    else if (act === 'date-today') { S.viewDate = DB.today(); render(); refreshViewNote(); }
    else if (act === 'card') { const pm = S.pokemons.find(p => p.id === Number(pmid)); if (pm) showCardDetail(pm); }
    else if (act === 'feed') openFeed(Number(pmid));
    else if (act === 'evolve') { const pm = S.pokemons.find(p => p.id === Number(pmid)); if (pm) evolvePm(pm); }
    else if (act === 'lead') { setLead(Number(pmid)); }
    else if (act === 'catch') catchOne();
    else if (act === 'buyball') buyBall();
    else if (act === 'parent-save') saveParentTask(btn);
    else if (act === 'parent-del') { await DB.deleteTask(Number(tid)); await refreshAll(); render(); }
    else if (act === 'parent-del-cat') { deleteCat(btn.dataset.cat); render(); }
    else if (act === 'parent-add-cat') { const c = ($('pt-newcat').value || '').trim(); if (c) { saveCat(c); $('pt-newcat').value = ''; render(); } }
    else if (act === 'parent-edit-weekly') openWeeklyEditor(Number(tid));
    else if (act === 'parent-quick') appendBatch(loadQuick()[Number(btn.dataset.idx)]);
    else if (act === 'parent-del-quick') delQuick(Number(btn.dataset.idx));
    else if (act === 'parent-parse') parseBatch();
    else if (act === 'parent-exit') { S.role = 'kid'; localStorage.setItem(LK('role'), 'kid'); render(); }
    else if (act === 'parent-cal') { S.calOffset += Number(btn.dataset.step || 0); renderKidCal(); }
    else if (act === 'parent-date-prev') { S.parentDate = shiftDate(S.parentDate, -1); render(); refreshParentNote(); }
    else if (act === 'parent-date-next') { S.parentDate = shiftDate(S.parentDate, 1); render(); refreshParentNote(); }
    else if (act === 'parent-date-today') { S.parentDate = DB.today(); render(); refreshParentNote(); }
    else if (act === 'parent-multi') openMultiDayAssign();
    else if (act === 'parent-move') moveTask(Number(tid), btn.dataset.dir);
    else if (act === 'parent-edit') openTaskEditor(Number(tid));
    else if (act === 'parent-edit-note') openNoteEditor();
    else if (act === 'parent-settings') openSettings();
    else if (act === 'pts-dismiss') { lsSet(LK('seen_pts'), Math.max(0, ...S.pointLogs.filter(l => l.amount > 0 && l.confirmed !== false).map(l => l.id))); render(); }
    else if (act === 'parent-giveball') giveBall();
    else if (act === 'parent-givepts') givePts();
    else if (act === 'parent-minuspts') minusPts();
    else if (act === 'parent-reset-demo') resetDemo();
    else if (act === 'parent-demo-enter') enterDemoMode();
    else if (act === 'parent-demo-exit') exitDemoMode();
    // 家长端已移除「放生」入口（防误点），deletePokemon 保留给未来扩展
    else if (act === 'parent-confirm') confirmPending();
    else if (act === 'parent-undo') undoPoint(Number(btn.dataset.plid));
    else if (act === 'parent-copy-last') copyLastAssign();
    else if (act === 'parent-save-tpl') saveTemplate();
    else if (act === 'parent-load-tpl') loadTemplate(Number(btn.dataset.tpl));
    else if (act === 'parent-del-tpl') deleteTemplate(Number(btn.dataset.tpl));
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
  const opts = [10, 25, 50, S.balance].filter((v, i, a) => a.indexOf(v) === i && v > 0);
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal">
      <h3>喂 ${pm.name} 糖果</h3>
      <p style="font-size:13px;color:#607d8b">1 积分 = 1 exp，满 ${CONFIG.EXP_PER_LEVEL} 升级</p>
      <div class="feed-opts">
        ${opts.map(v => `<button data-v="${v}">${v} 分</button>`).join('')}
      </div>
      <div style="margin-top:14px"><button class="btn-cancel" style="width:100%">取消</button></div>
    </div>
  `;
  modal.querySelectorAll('.feed-opts button').forEach(b => b.onclick = () => { feedPm(pm, Number(b.dataset.v)); });
  modal.querySelector('.btn-cancel').onclick = () => modal.remove();
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}
function hideModal() { document.querySelectorAll('.modal-mask').forEach(m => m.remove()); }

// ---------- 家长端 ----------
function renderParent() {
  // 重渲染时保留批量输入框里正在编辑的草稿
  const draft = (document.getElementById('pt-batch') || {}).value || '';
  $('app').innerHTML = `
    <div class="topbar">
      <div class="title">🛠️ 家长中心</div>
      <div class="badges">
        <span class="badge">⭐ <b id="pt">${S.balance}</b></span>
        <span class="badge ball">🔴 <b id="bl">${S.balls}</b></span>
      </div>
    </div>
    <div class="page">
      ${pendingPointsPanel()}
      ${parentTaskPanel()}
      ${parentStatsPanel()}
      ${parentPmPanel()}
      ${parentSettingsPanel()}
      ${checkinLogPanel('📋 每日任务打卡记录', 'parent')}
      ${pointLogPanel()}
      ${modePanel()}
      <button class="btn-ghost" style="width:100%;margin-top:8px" data-action="parent-exit">← 返回孩子界面</button>
    </div>
  `;
  if (draft) { const ta = document.getElementById('pt-batch'); if (ta) ta.value = draft; }
  bindActions();
  enableDragSort('#pt-task-list-req');
  enableDragSort('#pt-task-list-opt');
}
// 家长端日期导航条（切换后任务面板/布置都针对所选日期）
function parentDateNav() {
  const today = DB.today();
  return `
    <div class="date-nav">
      <button class="chip" data-action="parent-date-prev">◀ 前一天</button>
      <span class="date-cur">${S.parentDate}${S.parentDate === today ? '（今天）' : ''}</span>
      <button class="chip" data-action="parent-date-next">后一天 ▶</button>
      ${S.parentDate !== today ? `<button class="chip red" data-action="parent-date-today">回到今天</button>` : ''}
    </div>
  `;
}
// 家长端任务行模板（小字标出必做/选做）
function prowRowHTML(t) {
  return `
    <div class="prow prow-click" data-action="parent-edit" data-tid="${t.id}" title="点开编辑">
      <span>${catIcon(t.category)}</span>
      <div class="grow"><b>${t.title}</b><small style="display:block;color:#90a4ae">${t.category} · ${taskTypeLabel(t)} · ${t.required === false ? '选做' : '必做'} · +${t.points}分${t.start_date ? ` · 📅 ${t.start_date.slice(5)}` : ''}${t.hint ? ` · 💡 ${t.hint}` : ''}</small></div>
      <span class="${logOn(t.id, S.parentDate) ? 'ok' : 'miss'}">${logOn(t.id, S.parentDate) ? '✓' : '·'}</span>
      <button class="btn-ghost mini" data-action="parent-move" data-tid="${t.id}" data-dir="up" title="上移">↑</button>
      <button class="btn-ghost mini" data-action="parent-move" data-tid="${t.id}" data-dir="down" title="下移">↓</button>
    </div>`;
}
function parentTaskPanel() {
  const ts = tasksOnDate(S.parentDate);
  const reqTs = ts.filter(t => t.required !== false).sort(taskSort);
  const optTs = ts.filter(t => t.required === false).sort(taskSort);
  const wts = weeklyTasks();
  const pIsToday = S.parentDate === DB.today();
  return `
    <div class="panel">
      <h3 style="margin-top:12px">布置任务 <small style="font-weight:400">先选日期，再布置那天的任务</small></h3>
      ${parentDateNav()}
      <div class="input-row" style="margin-top:8px">
        <span style="font-size:13px;color:var(--ink-soft);white-space:nowrap">💬 叮嘱</span>
        <button class="btn-primary" data-action="parent-edit-note" style="flex:2">${S.parentNote ? `📝 编辑叮嘱（${S.parentNote.slice(0, 12)}${S.parentNote.length > 12 ? '…' : ''}）` : '✍️ 写今天的叮嘱'}</button>
      </div>
      <h3 style="margin-top:8px">📅 ${S.parentDate} 的任务${pIsToday ? '（今天）' : ''} <small style="font-weight:400">长按拖动可排序</small></h3>
      <div class="prow sec-head">🔴 必做</div>
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
            <span>${catIcon(t.category)}</span>
            <div class="grow"><b>${t.title}</b><small style="display:block;color:#90a4ae">${t.deadline ? `截止 ${t.deadline}·剩${left}天` : ''} · 进度 ${prog}% · +${t.points}分</small></div>
            <span class="${prog >= 100 ? 'ok' : 'miss'}">${prog >= 100 ? '✓' : prog + '%'}</span>
          </div>
          ${kids.map(k => {
            const kdone = taskProgress(k.id) >= (k.percent || 0);
            return `
            <div class="prow" style="padding-left:26px">
              <span>${kdone ? '✅' : '·'}</span>
              <div class="grow">${k.title} <small style="color:#90a4ae">${k.percent || 0}%</small></div>
              <button class="btn-danger" data-action="parent-del" data-tid="${k.id}">删</button>
            </div>`;
          }).join('')}`;
        }).join('')}
      ` : ''}
      <h3 style="margin-top:16px">快速布置 <small style="font-weight:400">点一下填进输入框，改完再发布</small></h3>
      <div class="tpl-row">
        <button class="chip red" data-action="parent-copy-last">📋 复制上次布置</button>
        <button class="chip red" data-action="parent-save-tpl">⭐ 存为模板</button>
      </div>
      ${lsGet(K_TPL, []).length ? `
      <div class="tpl-row" style="margin-top:8px">
        <small style="align-self:center;color:var(--ink-soft);font-size:12px">我的模板</small>
        ${lsGet(K_TPL, []).map((t, i) => `
          <button class="chip" data-action="parent-load-tpl" data-tpl="${i}" title="点=填入输入框，✖=删除">${t.name}<span style="margin-left:6px;color:#c62828;cursor:pointer" data-action="parent-del-tpl" data-tpl="${i}">✖</span></button>
        `).join('')}
      </div>
      ` : ''}
      ${loadQuick().length ? `
      <div class="tpl-row" style="margin-top:8px">
        <small style="align-self:center;color:var(--ink-soft);font-size:12px">常用任务</small>
        ${loadQuick().slice(0, 12).map((it, i) => `
          <button class="chip" data-action="parent-quick" data-idx="${i}" title="点=加到输入框末尾，✕=删除">${catIcon(it.category)} ${it.title} +${it.points}<span style="margin-left:6px;color:#c62828;cursor:pointer" data-action="parent-del-quick" data-idx="${i}">✕</span></button>
        `).join('')}
      </div>
      ` : ''}
      <h3 style="margin-top:16px">新建任务</h3>
      <div class="input-row">
        <textarea id="pt-title" placeholder="任务名称（末尾可加 {提示}）" style="flex:2;min-height:44px"></textarea>
      </div>
      <div class="input-row">
        <input id="pt-cat" list="cat-options" placeholder="类别(可自定义)" value="打卡" style="flex:1.5">
        <datalist id="cat-options">${loadCats().map(c => `<option value="${c}">`).join('')}</datalist>
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
        <summary style="font-size:13px;color:var(--ink-soft);cursor:pointer">🏷️ 管理历史类别（${loadCats().length} 个，删掉的不再出现在下拉里）</summary>
        <div style="margin-top:8px;line-height:2">
          ${loadCats().map(c => `
            <span style="display:inline-flex;align-items:center;gap:4px;background:#e3f2fd;border-radius:999px;padding:3px 10px;margin:3px;font-size:12px">
              ${catIcon(c)} ${c}
              <button class="btn-icon" data-action="parent-del-cat" data-cat="${c}" title="从下拉里移除">✕</button>
            </span>
          `).join('')}
          <span style="display:inline-flex;align-items:center;gap:4px;margin:3px">
            <input id="pt-newcat" placeholder="新增类别" style="width:110px;border:1px solid #e0e0e0;border-radius:999px;padding:4px 10px;font-size:12px">
            <button class="chip" data-action="parent-add-cat">添加</button>
          </span>
        </div>
      </details>
      <h3 style="margin-top:16px">批量布置多天</h3>
      <button class="btn-primary" data-action="parent-multi" style="width:100%">📅 批量布置多天（日期分隔行）</button>
      <div class="form-hint">一次规划好几天：每行写一个日期（如 <b>10-20</b> / <b>周一</b> / <b>明天</b>），下面几行是那天要做的任务，直到下一个日期行。布置后任务只出现在对应的那天（错过当天则不再出现）。</div>
      <h3 style="margin-top:16px">📥 批量添加单次任务</h3>
      <div class="form-hint" style="margin-bottom:6px">格式：<b>名称, 类别, 分数, 选做</b>　（除名称外均可省；名称末尾用 <b>{花括号}</b> 圈住小提示）<br>这里添加的是<b>单次任务</b>（当前日期做一次、做完消失）；<b>重复任务（每天都有）</b>请用上方「新建任务 → 重复（每天都有）」单独建，避免批量复制重复建出很多条。</div>
      <textarea id="pt-batch" placeholder="每行一个任务（除名称外都可省）：&#10;  名称 必填，末尾可加 {小提示} 如 语文作业{先复习生字}&#10;  类别 默认「打卡」（任务分组）&#10;  分数 默认 10&#10;  选做 写「选做」=非必做（默认必做）&#10;&#10;示例：&#10;  语文作业{先复习生字},校内作业,10&#10;  跳绳500个,运动,5,选做&#10;  练字一页 10"></textarea>
      <button class="btn-primary" data-action="parent-parse" style="margin-top:8px">解析并添加</button>
      <div class="form-hint">批量添加的都是当天的一次性任务，不会重复出现在以后的每天里。</div>
    </div>
  `;
}
async function saveParentTask() {
  const { title, hint } = splitHint($('pt-title').value.trim());
  if (!title) { toast('请填任务名称'); return; }
  const category = ($('pt-cat').value || '').trim() || '打卡';
  const points = Math.max(1, Math.min(CONFIG.MAX_POINTS_PER_TASK, parseInt($('pt-pts').value) || 10));
  const schedule = $('pt-schedule').value;
  const deadline = (schedule === 'weekly' && $('pt-deadline').value) ? $('pt-deadline').value : null;
  const required = $('pt-req').value !== '0';
  saveCat(category);
  if (schedule === 'weekly') {
    const text = ($('pt-children') ? $('pt-children').value : '') || '';
    const items = parseSubtasks(text);
    if (!items.length) { toast('子任务为空，先填拆分子任务'); return; }
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
  await refreshAll(); recordAssign(); render();
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
        <input id="we-title" value="${t.title}" placeholder="任务名称" style="flex:2">
        <input id="we-cat" list="cat-options" value="${t.category}" placeholder="类别" style="flex:1">
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
    const hint = modal.querySelector('#we-hint').value.trim() || null;
    const category = (modal.querySelector('#we-cat').value || '').trim() || '打卡';
    const deadline = modal.querySelector('#we-deadline').value || null;
    const bonusVal = parseInt(modal.querySelector('#we-bonus').value);
    const bonus = bonusVal ? Math.min(CONFIG.MAX_POINTS_PER_TASK, Math.max(1, bonusVal)) : null;
    saveCat(category);
    const items = parseSubtasks(modal.querySelector('#we-kids').value);
    if (!items.length) { toast('子任务为空，先填拆分子任务'); return; }
    const totalPts = items.reduce((s, x) => s + x.points, 0);
    await DB.updateTask(id, { title, hint, category, points: totalPts, deadline, bonus });
    Object.assign(t, { title, hint, category, points: totalPts, deadline, bonus });
    // 重建子任务：删旧子任务（连同打卡记录），按新配置创建
    for (const k of allChildTasks(id)) await DB.deleteTask(k.id);
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
      <input id="te-cat" list="te-cat-list" value="${t.category}" placeholder="类别(可自定义)">
      <datalist id="te-cat-list">${loadCats().map(c => `<option value="${c}">`).join('')}</datalist>
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
    const category = (modal.querySelector('#te-cat').value || '').trim() || '打卡';
    const points = Math.max(1, Math.min(CONFIG.MAX_POINTS_PER_TASK, parseInt(modal.querySelector('#te-pts').value) || 10));
    const required = modal.querySelector('#te-req').value !== '0';
    const oldParent = t.parent_id;
    const parentVal = (modal.querySelector('#te-parent').value || '').trim();
    const newParent = parentVal ? Number(parentVal) : null;
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
    await DB.updateTask(id, patch);
    Object.assign(t, patch);
    // 关联变化时重算相关多日任务的总分
    if (oldParent && oldParent !== newParent) await syncParentPoints(oldParent);
    if (newParent) await syncParentPoints(newParent);
    modal.remove();
    await refreshAll(); render();
    toast('已保存');
  };
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ---------- 快速布置：复制上次 / 命名模板 / 最近用过 → 都填进输入框编辑 ----------
const K_LAST = LK('last_assign'), K_TPL = LK('templates'), K_QUICK = LK('quick_tasks');
function lsGet(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } }
function lsSet(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

// ---------- 类别记忆：新输入的类别会记住，用于下拉和孩子端分区排序 ----------
const K_CATS = LK('categories');
function loadCats() { return lsGet(K_CATS, CONFIG.DEFAULT_CATEGORIES); }
function saveCat(cat) {
  if (!cat) return;
  const cats = loadCats();
  if (!cats.includes(cat)) { cats.push(cat); lsSet(K_CATS, cats); }
}
function deleteCat(cat) {
  lsSet(K_CATS, loadCats().filter(c => c !== cat));
}
// 类别排序索引：按记忆顺序，未记录的排最后
function catOrder(cat) {
  const i = loadCats().indexOf(cat);
  return i >= 0 ? i : 1000;
}

function itemLine(it) { return `${it.title}${it.hint ? `{${it.hint}}` : ''},${it.category},${it.points}${it.required === false ? ',选做' : ''}`; }

function fillBatch(items) {
  const ta = $('pt-batch');
  ta.value = items.map(itemLine).join('\n');
  ta.focus();
}

function appendBatch(it) {
  const ta = $('pt-batch');
  const line = itemLine(it);
  ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + line;
  ta.focus();
}

// 发布任务后调用：记忆本次布置（供"复制上次布置"）+ 积累"常用任务"
function recordAssign() {
  const daily = todayTasks().filter(t => t.schedule === 'daily').map(t => ({
    title: t.title, category: t.category, points: t.points, required: t.required !== false,
  }));
  if (daily.length) lsSet(K_LAST, { date: DB.today(), items: daily });
  mergeQuick(daily);
}

// 常用任务：合并去重，新的排前面，最多 20 个
function mergeQuick(items) {
  const q = loadQuick();
  const seen = new Set(); const out = [];
  for (const it of [...items, ...q]) { const k = `${it.title}|${it.points}`; if (!seen.has(k)) { seen.add(k); out.push(it); } }
  lsSet(K_QUICK, out.slice(0, 20));
}

// 常用任务列表：首次用默认模板(TPL) + 老的"最近用过"合并初始化，之后可增删
function loadQuick() {
  let q = lsGet(K_QUICK, null);
  if (q === null) {
    const seed = TPL.map(t => ({ title: t.title, category: t.category, points: t.points, required: true }));
    const old = lsGet(LK('recent_tasks'), []);
    const seen = new Set(); const out = [];
    for (const it of [...old, ...seed]) { const k = `${it.title}|${it.points}`; if (!seen.has(k)) { seen.add(k); out.push(it); } }
    q = out;
    lsSet(K_QUICK, q);
  }
  return q;
}

function delQuick(idx) {
  const q = loadQuick();
  q.splice(idx, 1);
  lsSet(K_QUICK, q);
  render();
}

function copyLastAssign() {
  const snap = lsGet(K_LAST, null);
  if (!snap || !snap.items || !snap.items.length) { toast('还没有上次布置的记录，发布过任务后就能复制了'); return; }
  fillBatch(snap.items);
  toast(`已填入上次布置的 ${snap.items.length} 个任务，改完点「解析并添加」`);
}

// 把输入框文本解析成任务项（与 parseBatch 同规则）
function parseBatchLines(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const parts = parseFields(line);
    const { title, hint } = splitHint(parts[0]);
    let category = '打卡', points = 10, required = true;
    if (parts[1]) {
      if (/^\d+$/.test(parts[1])) points = parseInt(parts[1]);
      else category = parts[1];
    }
    if (parts[2] && /^\d+$/.test(parts[2])) points = parseInt(parts[2]);
    if (parts[3] && ['选做', '可选', '0', '选'].includes(parts[3])) required = false;
    points = Math.max(1, Math.min(CONFIG.MAX_POINTS_PER_TASK, points));
    return { title, hint, category, points, required };
  });
}

function saveTemplate() {
  const text = $('pt-batch').value.trim();
  if (!text) { toast('输入框是空的，先填任务再存模板'); return; }
  const items = parseBatchLines(text);
  if (!items.length) { toast('没解析到有效任务'); return; }
  const name = prompt('模板名称（如：周末套餐）：', '');
  if (!name) return;
  const tpl = lsGet(K_TPL, []);
  if (tpl.some(t => t.name === name)) { toast('已有同名模板，先删旧的'); return; }
  tpl.push({ name, items });
  lsSet(K_TPL, tpl);
  toast(`已保存模板「${name}」`);
  render();
}

function loadTemplate(i) {
  const tpl = lsGet(K_TPL, []);
  const t = tpl[i];
  if (!t) return;
  fillBatch(t.items);
  toast(`已填入模板「${t.name}」，改完点「解析并添加」`);
}

function deleteTemplate(i) {
  const tpl = lsGet(K_TPL, []);
  const t = tpl[i];
  if (!t) return;
  if (!confirm(`删除模板「${t.name}」？`)) return;
  tpl.splice(i, 1);
  lsSet(K_TPL, tpl);
  render();
}

async function parseBatch() {
  const text = $('pt-batch').value.trim();
  if (!text) { toast('粘贴内容为空'); return; }
  const items = parseBatchLines(text);
  if (!items.length) { toast('没解析到有效任务'); return; }
  let n = 0;
  for (const it of items) {
    saveCat(it.category);
    // 批量添加固定为单次任务（当前日期做一次、做完消失），避免批量复制重复建重复任务
    await DB.addTask({ title: it.title, hint: it.hint, category: it.category, points: it.points, schedule: 'once', required: it.required, start_date: S.parentDate, end_date: S.parentDate });
    n++;
  }
  $('pt-batch').value = '';
  await refreshAll();
  recordAssign();
  render();
  toast(`成功添加 ${n} 个单次任务`);
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
    const parts = parseFields(line);
    const { title, hint } = splitHint(parts[0]);
    if (!title) return;
    let category = '打卡', points = 10, required = true;
    if (parts[1]) { if (/^\d+$/.test(parts[1])) points = parseInt(parts[1]); else category = parts[1]; }
    if (parts[2] && /^\d+$/.test(parts[2])) points = parseInt(parts[2]);
    if (parts[3] && ['选做', '可选', '0', '选'].includes(parts[3])) required = false;
    points = Math.max(1, Math.min(CONFIG.MAX_POINTS_PER_TASK, points));
    cur.items.push({ title, hint, category, points, required });
  });
  return groups.filter(g => g.items.length);
}
// 弹窗：一次规划多天
function openMultiDayAssign() {
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal" style="max-width:460px;width:calc(100% - 40px)">
      <h3>📅 批量布置多天</h3>
      <p class="form-hint">每行写一个日期（如 <b>10-20</b> / <b>周一</b> / <b>明天</b>），下面几行是那天要做的任务，直到下一个日期行。任务只出现在对应的那天。</p>
      <textarea id="md-input" style="min-height:180px" placeholder="10-20&#10;语文作业,校内作业,10&#10;跳绳500个,运动,5,选做&#10;10-21&#10;英语作业,校内作业,10&#10;阅读20分钟,阅读,5"></textarea>
      <div class="form-hint">任务格式同「自动识别」：名称, 类别, 分数, 选做（除名称外可省）</div>
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
    let n = 0;
    for (const g of groups) {
      for (const it of g.items) {
        saveCat(it.category);
        await DB.addTask({ title: it.title, hint: it.hint, category: it.category, points: it.points, schedule: 'once', required: it.required, start_date: g.date, end_date: g.date });
        n++;
      }
    }
    modal.remove();
    await refreshAll(); render();
    toast(`已布置 ${n} 个任务（${groups.length} 天）`);
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
        <button class="btn-danger" data-action="parent-reset-demo" style="width:100%;margin-top:6px">🔄 重置演示数据（重新生成示例）</button>
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
function enterDemoMode() {
  if (!confirm('进入演示模式？\n会切换到一套独立的演示数据，孩子随便玩，不影响你的真实数据。')) return;
  localStorage.setItem('km_role_back', localStorage.getItem(LK('role')) || 'parent');
  localStorage.setItem('km_demo', '1');
  localStorage.removeItem(LK('role'));
  location.reload();
}
function exitDemoMode() {
  if (!confirm('退出演示模式，回到真实数据？')) return;
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

function parentStatsPanel() {
  return `
    <div class="panel">
      <h3>本周完成率</h3>
      <div style="font-size:14px">全清天数：<b>${weekDoneCount()}/7</b>　当前积分：<b>${S.balance}</b>　精灵球：<b>${S.balls}</b></div>
      <div class="form-hint" style="margin-top:6px">打卡日历已移到孩子「我的」页面，孩子也能直观看到。</div>
    </div>
  `;
}
// 按维度过滤每日任务：all 全部每日 / req 必做 / opt 选做
function filterDailyByDim(dim) {
  let daily = S.tasks.filter(t => t.active && t.schedule === 'daily');
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
      <h3>奖励 / 扣分</h3>
      <div class="input-row">
        <input id="pt-reason" placeholder="理由（如：帮妈妈洗碗 / 作业拖拉）" style="flex:2">
      </div>
      <div class="input-row">
        <input id="pt-givepts" type="number" placeholder="积分数量" value="50">
        <button class="btn-primary" data-action="parent-givepts" style="flex:1">奖励积分</button>
      </div>
      <div class="input-row">
        <input id="pt-minuspts" type="number" placeholder="扣分数量" value="5">
        <button class="btn-danger" data-action="parent-minuspts" style="flex:1">扣分</button>
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
      <div class="form-hint">每天一条，家长手机写了孩子平板打开就能看到。留空保存 = 清除。</div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn-cancel" data-cancel style="flex:1">取消</button>
        <button class="btn-primary" data-save style="flex:2">保存</button>
      </div>
    </div>
  `;
  modal.querySelector('[data-cancel]').onclick = () => modal.remove();
  modal.querySelector('[data-save]').onclick = async () => {
    const n = modal.querySelector('#note-text').value.trim();
    await DB.setNote(S.parentDate, n);
    S.parentNote = n || null;
    modal.remove();
    toast(n ? '已保存叮嘱' : '已清除叮嘱');
    render();
  };
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}
// ---------- 家长规则设置（动态调分值，存数据库全家同步） ----------
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
  if (!confirm(`确定清空${what}吗？会重新生成示例任务。`)) return;
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
  render();
}

// ---------- 待确认积分：一键发放 / 撤销 ----------
async function confirmPending() {
  const boxes = [...document.querySelectorAll('.pending-panel input[type=checkbox]:checked')];
  if (!boxes.length) { toast('没有选中的积分'); return; }
  const ids = boxes.map(b => Number(b.dataset.plid));
  const sum = S.pointLogs.filter(l => ids.includes(l.id)).reduce((s, l) => s + l.amount, 0);
  await DB.confirmPointLogs(ids);
  S.pointLogs.forEach(l => { if (ids.includes(l.id)) l.confirmed = true; });
  S.balance += sum;
  toast(`✅ 已发放 ${sum} 积分`);
  render();
}

async function undoPoint(id) {
  const l = S.pointLogs.find(x => x.id === id);
  if (!l) return;
  const kind = l.confirmed === false ? '这条待确认积分' : `这笔已发放的 +${l.amount} 积分`;
  if (!confirm(`撤销${kind}「${l.reason}」？对应任务会恢复为未完成。`)) return;
  await DB.deletePointLog(id);
  S.pointLogs = S.pointLogs.filter(x => x.id !== id);
  if (l.confirmed !== false && l.amount > 0) S.balance -= l.amount;
  if (l.task_id) {
    await DB.setLog(l.task_id, l.log_date, false);
    if (S.logs[l.log_date]) delete S.logs[l.log_date][l.task_id];
    // 撤销"单次任务"时重新激活，避免撤销后任务消失
    const t = S.tasks.find(x => x.id === l.task_id);
    if (t && (t.schedule === 'once' || t.schedule === 'child') && !t.active) { await DB.updateTask(t.id, { active: true }); t.active = true; }
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
      <div class="share-head">🏝️ Kimi 任务岛</div>
      <div class="share-pm">
        <img src="${lead ? artworkPath(leadNo) : 'assets/artwork/25.png'}" alt="">
        <div class="share-pm-name">${lead ? PK_BY_NO[leadNo].name + (lead.shiny ? ' ✨' : '') : '皮卡丘'}<span>Lv.${lead ? lead.level : 1}</span></div>
      </div>
      <div class="share-stats">
        <div><b>${done}/${ts.length}</b><span>今日任务</span></div>
        <div><b>${streak}</b><span>连续全勤</span></div>
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
    $('app').innerHTML = `<div class="loading-screen"><p>加载失败：${err.message}<br>检查 CONFIG 里的数据库配置</p></div>`;
  }
});
