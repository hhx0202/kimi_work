// ============================================================
// 测试脚手架（纯 node，零依赖）
// 做法：把 js/app.js 里真实的函数按名字切出来，丢进 node 的 vm 沙箱跑，
// 手工喂 S / CONFIG / DB 的 mock → 断言渲染出的 HTML 和状态。
// 测的是真实源码本身，不是复制品。
// 跑全部：node tests/run.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
// 统一成 LF：Windows 上 checkout 出来的是 CRLF，源码断言里写的是 \n，不归一化会误报失败
const readSrc = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const APP_SRC = readSrc('js/app.js');
const DB_SRC = readSrc('js/db.js');

// 按函数名从 app.js 源码里切出完整函数（花括号配平），支持 async
function slice(name) {
  const a = APP_SRC.indexOf(`async function ${name}(`);
  const b = APP_SRC.indexOf(`function ${name}(`);
  const idx = a >= 0 && (b < 0 || a < b) ? a : b;
  if (idx < 0) throw new Error('app.js 里找不到函数: ' + name);
  const start = APP_SRC.lastIndexOf('\n', idx) + 1;
  let i = APP_SRC.indexOf('{', idx), depth = 0, end = -1;
  for (; i < APP_SRC.length; i++) {
    if (APP_SRC[i] === '{') depth++;
    else if (APP_SRC[i] === '}') { depth--; if (!depth) { end = i; break; } }
  }
  return APP_SRC.slice(start, APP_SRC.indexOf('\n', end) + 1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// 默认全局：测试里常改的是 S / DB / CONFIG，其余够用
function baseGlobals(over = {}) {
  const g = {
    console,
    CONFIG: {
      REQUIRED_DONE_BONUS: 5, OPTIONAL_DONE_BONUS: 5, WEEKLY_DONE_BONUS: 10,
      BALL_PRICE: 100, LEAD_EXP_PER_TASK: 1, MAKEUP_DAYS: 1, MAX_POINTS_PER_TASK: 100,
      DEFAULT_CATEGORIES: ['打卡'],
    },
    S: {
      viewDate: '2026-10-21', parentDate: '2026-10-21', role: 'parent',
      balance: 0, balls: 0, shinyCards: 0, leadId: null,
      logs: {}, pointLogs: [], tasks: [], pokemons: [],
    },
    DB: { today: () => '2026-10-21' },
    awardLocked: new Set(),
    SHARED: {},
    SHARED_LABEL: { notices: '家长消息', quick_tasks: '常用任务', categories: '类别', categories_hidden: '类别', lead: '出战宝可梦', streak_claim: '领奖记录' },
    K_QUICK: 'km_quick_tasks', K_CATS: 'km_categories', K_CATS_HIDE: 'km_categories_hidden', K_STREAK_CLAIM: 'km_streak_claim',
    LK: k => 'km_' + k,
    NOTICE_MAX: 20,
    toast: m => (g.__toasts || (g.__toasts = [])).push(m),
    confetti: () => {},
    render: () => { g.__renders = (g.__renders || 0) + 1; },
    renderTop: () => { g.__renders = (g.__renders || 0) + 1; },
    renderProgress: () => {}, renderTasks: () => { g.__renders = (g.__renders || 0) + 1; },
    renderPokemons: () => {}, renderParent: () => {},
    pushNotice: (t, x) => (g.__notices || (g.__notices = [])).push(x),
    askConfirm: async () => true,
    pmReason: () => '',
    $: () => ({ value: '' }),
    document: {
      querySelectorAll: () => g.__boxes || [],
      querySelector: () => (g.__modal ? {} : null),
      visibilityState: 'visible',
      activeElement: null,
      addEventListener: () => {},
    },
    window: { scrollY: 0, scrollTo: (x, y) => { g.window.scrollY = y; } },
    pollRev: '', pollTimer: null,
    DEMO_ACTIVE: false,
    localStorage: {
      _m: {},
      getItem(k) { return k in this._m ? this._m[k] : null; },
      setItem(k, v) { this._m[k] = String(v); },
      removeItem(k) { delete this._m[k]; },
    },
    // bgWrite 默认只登记不执行：测试自己用 runBg() 驱动，才能断言"渲染先于落库"
    bgWrite: (desc, fn) => { (g.__bg || (g.__bg = [])).push({ desc, fn }); },
    taskProgress: () => 100,
    streakCycleDays: () => 0, streakGoal: () => 7,
    catIcon: () => '🎮', taskStreak: () => 0,
    isMaxed: () => false, canEvolve: () => ({ ok: false }), evolvePm: async () => {},
    grantExp: async (pm, e) => { pm.exp += e; if (g.DB.updatePokemon) await g.DB.updatePokemon(pm.id, { exp: pm.exp }); },
    saveCat: () => {}, randomPokeIconKey: () => 'ball', POKE_ICON_KEYS: ['ball'],
    POKE_ICON: { dex: () => '' }, TPL: [],
  };
  return Object.assign(g, over);
}

// 往已有的 vm 上下文里载入 app.js 的函数（用于和 pokemon-data.js 之类共用同一个沙箱）
function loadInto(ctx, fns) {
  for (const n of fns) vm.runInContext(slice(n), ctx);
  return ctx;
}

// 建沙箱并载入函数。fns = 函数名数组；over 覆盖全局
function makeCtx(fns, over = {}) {
  const ctx = baseGlobals(over);
  vm.createContext(ctx);
  return loadInto(ctx, fns);
}

// 把 makeCtx 里登记的后台写库任务跑完（模拟"稍后真正落库"）
async function runBg(ctx) {
  for (const j of (ctx.__bg || [])) await j.fn();
}

// 模拟网络的 DB：每个方法先睡眠 lag 毫秒再返回（用于并发/耗时断言）
function laggyDB(lag, impls = {}) {
  const calls = [];
  let seq = 1000;
  const db = { calls, today: () => '2026-10-21' };
  const names = ['getTasks', 'getSettings', 'setSettings', 'setLog', 'addPointLog', 'deletePointLog',
    'addItemLog', 'confirmPointLogs', 'updateTask', 'addTask', 'deleteTask', 'updatePokemon', 'hasItemReason'];
  for (const n of names) {
    db[n] = async (...args) => {
      calls.push({ name: n, args, t: Date.now() });
      await sleep(lag);
      if (impls[n]) return impls[n](...args);
      return n === 'addPointLog' ? ++seq : undefined;
    };
  }
  return db;
}

// ---------- 断言与统计 ----------
const state = { pass: 0, fail: 0 };
function ok(cond, msg) {
  if (cond) { state.pass++; console.log('  ✓ ' + msg); }
  else { state.fail++; console.log('  ✗ ' + msg); }
}
function section(name) { console.log('\n▸ ' + name); }
function summary() { return state; }

module.exports = { slice, makeCtx, loadInto, runBg, laggyDB, sleep, ok, section, summary, baseGlobals, APP_SRC, DB_SRC };
