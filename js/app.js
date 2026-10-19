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
  // 家长端
  pmId: null,           // 正在操作的宝可梦
  calOffset: 0,         // 日历偏移(月)
  // 孩子端查看的日期（历史查看用，默认今天）
  viewDate: null,       // 'YYYY-MM-DD'，启动时置为今天
};

// 日期工具
function shiftDate(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// 某任务在指定日期是否已完成
function logOn(taskId, date) { return !!(S.logs[date]?.[taskId]?.done); }

// 顶部趣味短句：按日期稳定随机一句
const MOTTO = [
  '今天也要元气满满哦！',
  '去捉一只新的宝可梦吧！',
  '认真完成任务，精灵球会越来越多～',
  '闪光宝可梦在等你哦！',
  '坚持打卡，你就是最棒的小训练家！',
  '作业做完，宝可梦就来啦！',
  '喂饱你的伙伴，一起变强！',
  '今天的你，比昨天更厉害！',
  '把任务都点亮，成就感满满！',
  '每一个小任务，都是进化的起点！',
  '啾——精灵球准备好啦！',
  '全勤了记得看看谁变闪了哦✨',
];
function mottoText() {
  const d = DB.today();
  let h = 0;
  for (const ch of d) h = (h * 31 + ch.charCodeAt(0)) % 997;
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

// ---------- 类别图标（按关键词匹配 + 哈希兜底） ----------
function catEmoji(cat) {
  if (!cat) return '📝';
  for (const r of CONFIG.CATEGORY_EMOJI_RULES) if (cat.includes(r.match)) return r.emoji;
  let h = 0;
  for (const ch of cat) h = (h * 31 + (ch.codePointAt(0) || 0)) % 997;
  return CONFIG.CATEGORY_EMOJI_POOL[h % CONFIG.CATEGORY_EMOJI_POOL.length];
}

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
  const [tasks, logs, pokemons, pointLogs, balls] = await Promise.all([
    DB.getTasks(),
    DB.getLogsBetween('2000-01-01', '2099-12-31'),
    DB.getPokemons(),
    DB.getPointLogs(500),
    DB.getItemCount('ball'),
  ]);
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

// 今日常规任务 = active 且每日/单次
function todayTasks() { return S.tasks.filter(t => t.active && (t.schedule === 'daily' || t.schedule === 'once')); }
// 本周(长期)任务 = 父任务
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
function taskProgress(taskId) { // 跨天累计完成百分比（父任务自动聚合子任务）
  const kids = allChildTasks(taskId);
  if (kids.length) {
    let sum = 0;
    kids.forEach(k => { for (const d in S.logs) { const l = S.logs[d][k.id]; if (l && l.progress) sum += l.progress; } });
    return Math.min(100, sum);
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

// ---------- 打卡 ----------
async function checkin(taskId, btn, progress = null) {
  const already = logToday(taskId);
  if (already) return;
  const task = S.tasks.find(t => t.id === taskId);
  if (!task) return;
  const today = DB.today();

  // ===== 进度型打卡（长期/子任务）=====
  if (!progress && task.parent_id) progress = task.percent; // 子任务：用家长配好的百分比
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
      if (lead) await grantExp(lead, 5);
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
    if (lead) await grantExp(lead, 5);
  }

  // once 任务完成即下架
  if (task.schedule === 'once') {
    await DB.updateTask(taskId, { active: false });
    task.active = false;
  }

  // 全清判定 + 奖励（必选/可选分开）
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
    toast(`🎉 今日必选任务全部完成！+${CONFIG.REQUIRED_DONE_BONUS}（待家长确认）`);
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
    toast(`🎁 可选任务也全部完成！+${CONFIG.OPTIONAL_DONE_BONUS}（待家长确认）`);
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
function showShiny(pm) {
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
      <div class="ov-sub">${pm.name} 在连续全勤的欢呼中变成了闪光宝可梦！</div>
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
  if (!all.length) { el.innerHTML = ''; return; }
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
  el.innerHTML = `
    <div class="progress-card">
      ${bar(req, '必选任务', '', `必选全清 +${CONFIG.REQUIRED_DONE_BONUS} 分`)}
      ${bar(all, '全部任务', `可选全清 +${CONFIG.OPTIONAL_DONE_BONUS} 分`, `可选也全清再 +${CONFIG.OPTIONAL_DONE_BONUS} 分`)}
    </div>
  `;
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
  if (wts.length) html += weeklySection(wts);
  html += `<div id="progress-wrap"></div>`;
  html += rulesHintHTML();
  // 必选任务：按类别分区展示（校内在先，孩子先做完校内）
  html += catSectionHTML(req, '必选任务');
  // 可选任务：同样按类别分区
  if (opt.length) html += catSectionHTML(opt, '🎁 可选任务');
  page.innerHTML = html;
  renderProgress();
}

// 按类别把任务分区渲染，组顺序 = 类别记忆顺序（config 里的顺序）
function catSectionHTML(tasks, title) {
  if (!tasks.length) return '';
  const groups = {};
  tasks.forEach(t => { (groups[t.category] = groups[t.category] || []).push(t); });
  const cats = Object.keys(groups).sort((a, b) => catOrder(a) - catOrder(b));
  let html = `<div class="section-title" style="margin:16px 4px 6px">${title}</div>`;
  for (const c of cats) {
    const arr = groups[c];
    html += `<div class="cat-group">
      <div class="cat-head">${catIcon(c)} ${c} <small>${arr.length} 项</small></div>
      ${arr.map(taskCardHTML).join('')}
    </div>`;
  }
  return html;
}

// 孩子端规则说明（可折叠）
function rulesHintHTML() {
  return `
    <details class="rules-hint">
      <summary>${POKE_ICON.dex()} 规则小抄 <small style="font-weight:400">点开看看怎么拿分</small></summary>
      <ul>
        <li>✅ 完成任务 → +积分（家长确认后才到账）</li>
        <li>🎯 今日 <b>必选</b> 全部完成 → +${CONFIG.REQUIRED_DONE_BONUS} 分</li>
        <li>🎁 <b>可选</b> 也全部完成 → 再 +${CONFIG.OPTIONAL_DONE_BONUS} 分</li>
        <li>🏆 连续 ${CONFIG.STREAK_DAYS_FOR_BALL} 天全勤 → 送精灵球，还会随机点亮一只闪光✨</li>
        <li>🥚 1 个精灵球一定抓到 1 只<b>新</b>宝可梦（绝不重复）</li>
        <li>🍬 喂糖果攒经验：1 分 = 1 exp；经验满了一管就能进化，越进化需要的经验越多</li>
        <li>⭐ 出战的宝可梦是你的伙伴，每次完成任务它 +5 经验</li>
        <li>⏳ 积分要家长确认才到账，别乱点哦</li>
      </ul>
    </details>
  `;
}

function taskCardHTML(t) {
  const isToday = S.viewDate === DB.today();
  const done = logOn(t.id, S.viewDate);
  return `
  <div class="task-card ${done ? 'done' : ''} ${t.required === false ? 'optional' : ''}" data-tid="${t.id}">
    <div class="emoji">${catIcon(t.category)}</div>
    <div class="info">
      <b>${t.title}</b>
      <span>${t.category}${t.schedule === 'once' ? ' · 单次' : ''}${t.required === false ? ' · 可选' : ''}</span>
    </div>
    <div class="pts">+${t.points}</div>
    <button class="btn-done" data-action="checkin" data-tid="${t.id}" ${done || !isToday ? 'disabled' : ''}>${done ? '✅ 已完成' : (!isToday ? '查看历史' : '✅ 完成')}</button>
  </div>`;
}

// ---------- 本周任务（进度型长期任务） ----------
function weeklySection(wts) {
  return `
    <div class="progress-card weekly-card">
      <div class="progress-head"><b>⏰ 本周任务</b><span>做完所有子任务就完成</span></div>
      ${wts.map(t => {
        const prog = taskProgress(t.id);
        const left = deadlineDaysLeft(t.deadline);
        const kids = childTasks(t.id);
        const done = prog >= 100;
        return `
        <div class="task-card weekly-parent ${done ? 'done' : ''}" data-tid="${t.id}">
          <div class="emoji">${catIcon(t.category)}</div>
          <div class="info">
            <b>${t.title}</b>
            <span>${t.deadline ? `截止 ${t.deadline} · 剩 ${left >= 0 ? left : 0} 天` : '本周内完成'} · 进度 ${prog}%</span>
            <div class="exp-track" style="margin-top:6px"><div class="exp-fill" style="width:${prog}%"></div></div>
          </div>
          <div class="pts">+${t.points}</div>
        </div>
        <div class="child-list">
          ${kids.map(k => {
            const isToday = S.viewDate === DB.today();
            const childDone = taskProgress(k.id) >= (k.percent || 0);
            const pend = childDone && taskPending(k.id);
            return `
            <button class="child-item ${childDone ? 'done' : ''}" data-action="checkin" data-tid="${k.id}" ${childDone || !isToday ? 'disabled' : ''}>
              <span class="child-check">${childDone ? '✅' : '⬜'}</span>
              <span class="child-name">${k.title}</span>
              <span class="child-pct">${k.percent || 0}%${pend ? ' ⏳' : ''}</span>
            </button>`;
          }).join('') || '<div class="empty-tip" style="padding:8px">这个任务还没有子任务</div>'}
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderPokemons() {
  const page = $('page');
  page.innerHTML = `
    <div class="catch-zone">${catchZoneHTML()}</div>
    <div class="catch-hint" style="text-align:center;margin-bottom:12px">⭐ 卡上带 ⭐ 的「出战」宝可梦是你的伙伴，每次完成任务它都会 +5 经验。</div>
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
  page.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><b>${S.balance}</b><span>当前积分</span></div>
      <div class="stat-card"><b>${streak}</b><span>连续全勤(天)</span></div>
      <div class="stat-card"><b>${S.pokemons.length}</b><span>我的宝可梦</span></div>
      <div class="stat-card"><b>${Object.values(ownDexCount()).length}</b><span>图鉴收集</span></div>
    </div>
    ${pendCount ? `<div class="form-hint" style="text-align:center;margin-top:10px">⏳ 有 ${pendCount} 条积分在等家长确认，确认后才到账哦</div>` : ''}
    <div class="section-title">本周表现 <small>${weekDone}/7 天全清</small></div>
    <div class="catch-zone">
      <button class="btn-big" data-action="share" style="margin-bottom:8px">📸 生成成就图，发朋友圈</button>
      <button class="btn-big buy" data-action="catch" ${S.balls < 1 ? 'disabled' : ''}>🥚 去捕捉宝可梦</button>
    </div>
    ${bonusLogsHTML()}
    ${minusLogsHTML()}
    <div class="section-title" style="margin-top:20px">积分记录</div>
    <div class="log-list">
      ${S.pointLogs.slice(0, 30).map(logItemHTML).join('') || '<div class="empty-tip">还没有积分记录</div>'}
    </div>
  `;
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
      <div class="title">🏝️ Kimi 的任务岛<small>${mottoText()}</small></div>
      <div class="badges">
        <span class="badge">⭐ <b id="pt">0</b></span>
        <span class="badge ball">🔴 <b id="bl">0</b></span>
      </div>
    </div>
    <div class="page" id="page"></div>
    <nav class="tabbar">
      <button class="${S.tab === 'tasks' ? 'on' : ''}" data-tab="tasks"><span class="ico">${POKE_ICON.ball('#e53935')}</span>任务</button>
      <button class="${S.tab === 'pokemon' ? 'on' : ''}" data-tab="pokemon"><span class="ico">${POKE_ICON.ultra()}</span>宝可梦</button>
      <button class="${S.tab === 'me' ? 'on' : ''}" data-tab="me"><span class="ico">${POKE_ICON.dex()}</span>我的</button>
      <button class="secret" id="btn-parent"><span class="ico">${POKE_ICON.master()}</span>家长</button>
    </nav>
  `;
}
function bindKidTabs() {
  const tabs = document.querySelectorAll('.tabbar button[data-tab]');
  tabs.forEach(b => b.onclick = () => { S.tab = b.dataset.tab; render(); });
  $('btn-parent').onclick = () => {
    // 快速进入：家长密码
    const pw = prompt('请输入家长密码');
    if (pw === CONFIG.PARENT_PASSWORD) { S.role = 'parent'; localStorage.setItem(LK('role'), 'parent'); render(); }
    else if (pw !== null) toast('密码不对哦');
  };
}
function bindActions() {
  document.body.onclick = async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    const tid = btn.dataset.tid, pmid = btn.dataset.pmid;
    if (act === 'checkin') await checkin(Number(tid), btn, btn.dataset.prog ? Number(btn.dataset.prog) : null);
    else if (act === 'date-prev') { S.viewDate = shiftDate(S.viewDate, -1); render(); }
    else if (act === 'date-next') { if (S.viewDate < DB.today()) { S.viewDate = shiftDate(S.viewDate, 1); render(); } }
    else if (act === 'date-today') { S.viewDate = DB.today(); render(); }
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
    else if (act === 'parent-cal') { S.calOffset += Number(btn.dataset.step || 0); renderParentCal(); }
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
  toast('⭐ 它成为你的伙伴了！完成任务会帮它 +5 经验');
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
      ${modePanel()}
      ${pendingPointsPanel()}
      ${parentTaskPanel()}
      ${parentStatsPanel()}
      ${parentPmPanel()}
      ${pointLogPanel()}
      <button class="btn-ghost" style="width:100%;margin-top:8px" data-action="parent-exit">← 返回孩子界面</button>
    </div>
  `;
  if (draft) { const ta = document.getElementById('pt-batch'); if (ta) ta.value = draft; }
  renderParentCal();
  bindActions();
}
function parentTaskPanel() {
  const ts = todayTasks();
  const wts = weeklyTasks();
  return `
    <div class="panel">
      <h3>今日任务</h3>
      ${ts.map(t => `
        <div class="prow">
          <span>${catIcon(t.category)}</span>
          <div class="grow">${t.title} <small style="color:#90a4ae">${t.category} · +${t.points}分${t.schedule === 'once' ? ' · 单次' : ''}${t.required === false ? ' · 可选' : ''}</small></div>
          <span class="${logToday(t.id) ? 'ok' : 'miss'}">${logToday(t.id) ? '✓ 完成' : '未完成'}</span>
          <button class="btn-danger" data-action="parent-del" data-tid="${t.id}">删除</button>
        </div>
      `).join('') || '<div class="empty-tip">今天没有任务</div>'}
      ${wts.length ? `
        <h3 style="margin-top:12px">⏰ 本周任务</h3>
        ${wts.map(t => {
          const prog = taskProgress(t.id);
          const left = deadlineDaysLeft(t.deadline);
          const kids = allChildTasks(t.id);
          return `
          <div class="prow">
            <span>${catIcon(t.category)}</span>
            <div class="grow"><b>${t.title}</b> <small style="color:#90a4ae">${t.deadline ? `截止 ${t.deadline}·剩${left}天` : ''} · 进度 ${prog}% · +${t.points}分</small></div>
            <span class="${prog >= 100 ? 'ok' : 'miss'}">${prog >= 100 ? '✓ 完成' : prog + '%'}</span>
            <button class="btn-ghost" data-action="parent-edit-weekly" data-tid="${t.id}" title="编辑标题/积分/子任务">✏️</button>
            <button class="btn-danger" data-action="parent-del" data-tid="${t.id}">删除</button>
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
        <input id="pt-title" placeholder="任务名称" style="flex:2">
        <input id="pt-cat" list="cat-options" placeholder="类别(可自定义)" value="打卡">
        <datalist id="cat-options">${loadCats().map(c => `<option value="${c}">`).join('')}</datalist>
        <input id="pt-pts" type="number" placeholder="积分" value="10" style="width:80px">
        <select id="pt-req" style="width:80px">
          <option value="1">必选</option>
          <option value="0">可选</option>
        </select>
      </div>
      <div class="input-row">
        <select id="pt-schedule" onchange="var d=document.getElementById('pt-deadline'),c=document.getElementById('pt-children-wrap');var w=this.value==='weekly';if(d)d.style.display=w?'':'none';if(c)c.style.display=w?'':'none';">
          <option value="once">只做一次</option>
          <option value="daily">每天都有</option>
          <option value="weekly">本周任务(拆子任务)</option>
        </select>
        <input id="pt-deadline" type="date" style="display:none;flex:1">
        <button class="btn-primary" data-action="parent-save" style="flex:1">添加</button>
      </div>
      <div id="pt-children-wrap" style="display:none;margin-top:8px">
        <textarea id="pt-children" placeholder="拆子任务：每行 名称,百分比（逗号/分号/顿号都行）&#10;第1篇课文,30&#10;第2篇课文,30&#10;习作,40&#10;&#10;· 百分比可以不填：没填的自动均分剩余部分&#10;· 全部填了但总数不是100%：自动按比例缩放成100%&#10;· 填满100%也可以：比如 50,50 两项"></textarea>
        <div class="form-hint">孩子逐个勾选子任务累计进度，勾满后父任务自动完成，积分按百分比分批发放</div>
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
      <h3 style="margin-top:16px">自动识别（粘贴或手输都行）</h3>
      <div class="form-hint" style="margin-bottom:6px">格式：<b>名称, 类别, 分数, 可选</b>　（除名称外均选填，分隔符使用逗号/分号/顿号/竖线/空格都行）</div>
      <textarea id="pt-batch" placeholder="每行一个任务，4 段可省：&#10;  第1段：名称（必填）&#10;  第2段：类别，不填默认「打卡」&#10;  第3段：分数，不填默认 10 分&#10;  第4段：写「可选」就是不强制，不写默认必选&#10;&#10;语文作业,校内作业,10&#10;跳绳500个,运动,5,可选&#10;练字一页 10"></textarea>
      <button class="btn-primary" data-action="parent-parse" style="margin-top:8px">解析并添加</button>
      <div class="form-hint">类别随意填，会自动记住，孩子端按类别分区展示。</div>
    </div>
  `;
}
async function saveParentTask() {
  const title = $('pt-title').value.trim();
  if (!title) { toast('请填任务名称'); return; }
  const category = ($('pt-cat').value || '').trim() || '打卡';
  const points = Math.max(1, Math.min(CONFIG.MAX_POINTS_PER_TASK, parseInt($('pt-pts').value) || 10));
  const schedule = $('pt-schedule').value;
  const deadline = (schedule === 'weekly' && $('pt-deadline').value) ? $('pt-deadline').value : null;
  const required = $('pt-req').value !== '0';
  saveCat(category);
  if (schedule === 'weekly') {
    const parent = await DB.addTask({ title, category, points, schedule: 'weekly', deadline, required: true });
    const text = ($('pt-children') ? $('pt-children').value : '') || '';
    const items = parseSubtasks(text);
    for (const x of items) {
      await DB.addTask({ title: x.title, category, points: 0, schedule: 'child', parent_id: parent.id, percent: x.pct });
    }
  } else {
    await DB.addTask({ title, category, points, schedule, deadline, required });
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

// ---------- 子任务解析 + 百分比归一化 ----------
// 未填百分比 → 自动均分剩余；全部填了但总和≠100 → 按比例缩放成100
function parseSubtasks(text) {
  const items = (text || '').split('\n').map(s => s.trim()).filter(Boolean)
    .map(l => { const p = parseFields(l); return { title: p[0], pct: p[1] ? parseInt(p[1]) : null }; })
    .filter(x => x.title);
  if (!items.length) return [];
  if (items.length === 1) { items[0].pct = 100; return items; }
  const autoIdx = items.map((x, i) => (!x.pct || x.pct <= 0) ? i : -1).filter(i => i >= 0);
  let vals = items.map(x => (x.pct && x.pct > 0 ? x.pct : 0));
  if (autoIdx.length) {
    // 有没填百分比的：没填的均分剩余部分，最后一项补齐零头
    const fixedSum = vals.reduce((s, v) => s + v, 0);
    const share = Math.max(1, Math.floor((100 - fixedSum) / autoIdx.length));
    autoIdx.forEach(i => { vals[i] = share; });
    vals[autoIdx[autoIdx.length - 1]] += 100 - vals.reduce((s, v) => s + v, 0);
  } else {
    const sum = vals.reduce((s, v) => s + v, 0);
    if (sum !== 100) {
      // 全填了但总和≠100：按比例缩放成 100
      const scale = 100 / sum;
      vals = vals.map(v => Math.floor(v * scale));
      vals[vals.length - 1] += 100 - vals.reduce((s, v) => s + v, 0);
    }
  }
  vals = vals.map(v => Math.max(0, v));
  return items.map((x, i) => ({ title: x.title, pct: vals[i] }));
}

// ---------- 长期任务编辑（父任务元信息 + 子任务列表） ----------
function openWeeklyEditor(id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  const kids = allChildTasks(id);
  const kidsText = kids.map(k => `${k.title},${k.percent}`).join('\n');
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal" style="max-width:440px;width:calc(100% - 40px)">
      <h3>✏️ 编辑本周任务</h3>
      <div class="input-row">
        <input id="we-title" value="${t.title}" placeholder="任务名称" style="flex:2">
        <input id="we-cat" list="cat-options" value="${t.category}" placeholder="类别" style="flex:1">
      </div>
      <div class="input-row">
        <input id="we-pts" type="number" value="${t.points}" style="width:80px" title="总分">
        <input id="we-deadline" type="date" value="${t.deadline || ''}" style="flex:1">
      </div>
      <div class="form-hint">子任务每行「名称,百分比」。不填百分比自动均分；全填了但总数不是100%会自动缩放到100%。改子任务会重置它的进度。</div>
      <textarea id="we-kids" style="min-height:110px" placeholder="第1篇课文,30&#10;第2篇课文,30&#10;习作,40">${kidsText}</textarea>
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
    const category = (modal.querySelector('#we-cat').value || '').trim() || '打卡';
    const points = Math.max(1, Math.min(CONFIG.MAX_POINTS_PER_TASK, parseInt(modal.querySelector('#we-pts').value) || 10));
    const deadline = modal.querySelector('#we-deadline').value || null;
    saveCat(category);
    const items = parseSubtasks(modal.querySelector('#we-kids').value);
    await DB.updateTask(id, { title, category, points, deadline });
    Object.assign(t, { title, category, points, deadline });
    // 重建子任务：删旧子任务（连同打卡记录），按新配置创建
    for (const k of allChildTasks(id)) await DB.deleteTask(k.id);
    for (const it of items) {
      await DB.addTask({ title: it.title, category, points: 0, schedule: 'child', parent_id: id, percent: it.pct });
    }
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

function itemLine(it) { return `${it.title},${it.category},${it.points}${it.required === false ? ',可选' : ''}`; }

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
    const title = parts[0];
    let category = '打卡', points = 10, required = true;
    if (parts[1]) {
      if (/^\d+$/.test(parts[1])) points = parseInt(parts[1]);
      else category = parts[1];
    }
    if (parts[2] && /^\d+$/.test(parts[2])) points = parseInt(parts[2]);
    if (parts[3] && ['可选', '0', '选'].includes(parts[3])) required = false;
    points = Math.max(1, Math.min(CONFIG.MAX_POINTS_PER_TASK, points));
    return { title, category, points, required };
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
    await DB.addTask({ title: it.title, category: it.category, points: it.points, schedule: 'daily', required: it.required });
    n++;
  }
  $('pt-batch').value = '';
  await refreshAll();
  recordAssign();
  render();
  toast(`成功添加 ${n} 个任务`);
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
      <h3>打卡日历</h3>
      <div id="cal-root"></div>
      <h3 style="margin-top:14px">本周完成率</h3>
      <div style="font-size:14px">全清天数：<b>${weekDoneCount()}/7</b>　当前积分：<b>${S.balance}</b>　精灵球：<b>${S.balls}</b></div>
    </div>
  `;
}
function renderParentCal() {
  const root = $('cal-root');
  if (!root) return;
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
    let dot = '<span class="dot none"></span>';
    if (dayLogs && Object.keys(dayLogs).length) {
      dot = Object.values(dayLogs).every(Boolean)
        ? '<span class="dot full"></span>'
        : (Object.values(dayLogs).some(Boolean) ? '<span class="dot part"></span>' : '<span class="dot none"></span>');
    }
    html += `<span class="cal-day ${ds === todayStr ? 'today' : ''}">${d}${dot}</span>`;
  }
  html += '</div>';
  root.innerHTML = html;
}
function parentPmPanel() {
  return `
    <div class="panel">
      <h3>奖励 / 扣分</h3>
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
      <div class="form-hint">奖励或扣分即时生效；孩子端会分类展示「额外奖励」和「扣分」。</div>
    </div>
  `;
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
  await DB.addItemLog('ball', 1, '家长奖励', DB.today());
  S.balls++;
  toast('🔴 已送 1 个精灵球');
  render();
}
async function givePts() {
  const n = parseInt($('pt-givepts').value) || 0;
  if (!n) { toast('填数量'); return; }
  const pid = await DB.addPointLog(n, '家长奖励', DB.today());
  S.pointLogs.push({ id: pid, log_date: DB.today(), amount: n, reason: '家长奖励' });
  S.balance += n;
  toast(`⭐ 已发 ${n} 积分`);
  render();
}
async function minusPts() {
  const n = parseInt($('pt-minuspts').value) || 0;
  if (!n) { toast('填数量'); return; }
  const pid = await DB.addPointLog(-n, '家长扣分', DB.today());
  S.pointLogs.push({ id: pid, log_date: DB.today(), amount: -n, reason: '家长扣分' });
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
    if (t && t.schedule === 'once' && !t.active) { await DB.updateTask(t.id, { active: true }); t.active = true; }
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
      <div class="share-date">${DB.today()} · 快乐打卡每一天</div>
    </div>
  `;
}

// ---------- 启动 ----------
window.addEventListener('DOMContentLoaded', async () => {
  try {
    DB.init();
    await refreshAll();
    S.viewDate = S.viewDate || DB.today();  // 默认查看今天
    render();
    bindActions();
  } catch (err) {
    console.error(err);
    $('app').innerHTML = `<div class="loading-screen"><p>加载失败：${err.message}<br>检查 CONFIG 里的数据库配置</p></div>`;
  }
});
