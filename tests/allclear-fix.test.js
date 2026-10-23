// 家长调整任务后补发全清奖（fixTodayAllClear）
// 场景：必做还差 1 个没完成，家长把那个必做改成选做 → 必做全清、连击也算了，
//       但全清奖只在 checkin 那一刻发过 → 这里负责补上，且不能重复发。
const { makeCtx, runBg, laggyDB, ok, section } = require('./harness');

const FNS = ['shiftDate', 'makeupDays', 'isMakeupDate', 'logOn', 'logToday', 'isSubmitted', 'isApprovedDone',
  'isTaskDoneEver', 'inEffect', 'taskAttrFor', 'tasksOnDate', 'dayTasksForProgress', 'taskTypeLabel',
  'taskStartText', 'taskCardHTML', 'checkin', 'cancelSubmission', 'dropAllClearPending', 'confirmPending',
  'fixTodayAllClear', 'allClearFixText'];

const D = '2026-10-21';
// runBg 会重跑 ctx.__bg 里所有登记的任务，同一个 ctx 用多轮时必须跑完就清空
const flush = async c => { await runBg(c); (c.__bg || []).length = 0; };

function setup(over = {}) {
  const db = laggyDB(5);
  const c = makeCtx(FNS, Object.assign({ DB: db }, over));
  c.S.viewDate = D;
  // 两个必做：1 已完成、2 未完成
  c.S.tasks = [
    { id: 1, title: '跳绳100个', schedule: 'daily', points: 5, required: true, category: '运动', start_date: null, end_date: null, active: true },
    { id: 2, title: '晨读英语', schedule: 'daily', points: 5, required: true, category: '英语', start_date: null, end_date: null, active: true },
  ];
  c.S.logs[D] = { 1: { done: true, progress: 0, approved: true } };
  return c;
}

module.exports = async function run() {
  section('必做差 1 个时，家长把它改成选做 → 补发必做全清奖');
  let c = setup();
  ok((await c.fixTodayAllClear()).length === 0, '还没全清时不发（任务 2 仍未完成）');
  ok(c.DB.calls.filter(x => x.name === 'addPointLog').length === 0, '没有多余写库');

  c.S.tasks[1].required = false;   // 家长把「晨读英语」改成选做 → 必做只剩已完成的 1
  let added = await c.fixTodayAllClear();
  ok(added.length === 1 && added[0].label === '必做', '补发的是「必做」全清');
  let log = c.DB.calls.filter(x => x.name === 'addPointLog');
  ok(log.length === 1 && log[0].args[1] === `必选全清_${D}` && log[0].args[0] === 5, '流水 reason/金额正确');
  ok(log[0].args[3].confirmed === false, '记为待家长确认（不直接加余额）');
  ok(c.S.pointLogs.some(l => l.reason === `必选全清_${D}` && l.amount === 5), '本地流水已补上（进度条能立刻显示）');
  ok(c.allClearFixText(added).includes('补发 +5 分'), '提示文案带补发积分');

  section('幂等：再点一次保存不会重复发');
  added = await c.fixTodayAllClear();
  ok(added.length === 0, '第二次返回空');
  ok(c.DB.calls.filter(x => x.name === 'addPointLog').length === 1, '写库仍然只有 1 条');

  section('反复改来改去也不重复发');
  c.S.tasks[1].required = true;    // 改回必做 → 又不全清了（只补不扣，不回收）
  ok((await c.fixTodayAllClear()).length === 0, '改回必做后不重复发');
  ok(c.S.pointLogs.some(l => l.reason === `必选全清_${D}`), '已发的奖不会被追回');
  c.S.tasks[1].required = false;   // 再改成选做 → 又全清了
  ok((await c.fixTodayAllClear()).length === 0, '再次改成选做仍按 reason 去重，不发第二次');

  section('选做组同理（差 1 个选做没做，家长把它改成必做）');
  c = setup();
  c.S.logs[D] = { 1: { done: true } };   // 必做 2 还没做，避免本节混进必做全清
  c.S.tasks.push(
    { id: 3, title: '练琴20分钟', schedule: 'daily', points: 3, required: false, category: '音乐', start_date: null, end_date: null, active: true },
    { id: 4, title: '读绘本', schedule: 'daily', points: 3, required: false, category: '阅读', start_date: null, end_date: null, active: true },
  );
  c.S.logs[D][3] = { done: true };   // 选做 3 完成、4 未完成
  ok((await c.fixTodayAllClear()).length === 0, '选做没全清时不发');
  c.S.tasks[3].required = true;      // 把未完成的选做 4 改成必做 → 选做只剩已完成的 3
  added = await c.fixTodayAllClear();
  ok(added.length === 1 && added[0].label === '选做', '补发的是「选做」全清');
  ok(c.DB.calls.some(x => x.name === 'addPointLog' && x.args[1] === `可选全清_${D}`), '选做全清流水 reason 正确');

  section('必做组被清空（全改成选做）不算全清');
  c = setup();
  c.S.logs[D] = {};
  c.S.tasks.forEach(t => { t.required = false; });
  added = await c.fixTodayAllClear();
  ok(!added.some(g => g.label === '必做'), '必做组为空 → 不发（与 reqDayDone 口径一致）');

  section('必做 + 选做同时达成 → 两条并发，不串行');
  c = setup();
  c.S.logs[D] = { 1: { done: true }, 2: { done: true }, 3: { done: true } };
  c.S.tasks[1].required = false;
  c.S.tasks.push({ id: 3, title: '练琴20分钟', schedule: 'daily', points: 3, required: false, category: '音乐', start_date: null, end_date: null, active: true });
  const t0 = Date.now();
  added = await c.fixTodayAllClear();
  const el = Date.now() - t0;
  ok(added.length === 2, '必做和选做都补发');
  ok(el < 20, `耗时 ${el}ms（两条流水并发，不是 2×5ms）`);

  section('写库失败时不吞错、也没有假流水');
  c = setup();
  c.S.tasks[1].required = false;
  c.DB.addPointLog = async () => { throw new Error('boom'); };
  added = await c.fixTodayAllClear();
  ok(added.length === 0, '返回空');
  ok(!c.S.pointLogs.some(l => String(l.reason).includes('全清')), '本地没有残留假流水');
  ok((c.__toasts || []).some(m => String(m).includes('补发全清奖失败')), '提示了失败');

  section('孩子撤销 → 重做 → 确认：全清奖不会反复刷分');
  c = setup();
  const allClearLogs = () => c.S.pointLogs.filter(l => l.reason === `必选全清_${D}`);
  await c.checkin(2, null, null); await flush(c);
  ok(allClearLogs().length === 1, '第一次做完两个必做 → 1 条全清奖');
  await c.cancelSubmission(2); await flush(c);
  ok(allClearLogs().length === 0, '撤销后未确认的全清奖被收回（不进余额）');
  await c.checkin(2, null, null); await flush(c);
  ok(allClearLogs().length === 1, '重新做完仍只有 1 条，不会累加成 2 条');

  const pl = allClearLogs()[0];
  c.__boxes = [{ dataset: { plid: String(pl.id) } }];
  await c.confirmPending(); await flush(c);
  ok(c.S.balance === 5, `家长确认后余额 +5（实际 ${c.S.balance}）`);
  await c.cancelSubmission(2); await flush(c);
  ok(allClearLogs().length === 1, '已确认的全清奖不会被撤销收回');
  ok(c.S.balance === 5, '余额仍是 5（不倒退）');
  await c.checkin(2, null, null); await flush(c);
  ok(allClearLogs().length === 1, '再做完不重复发（reason 去重）');
  ok(c.S.balance === 5, `余额始终只有一次 +5（实际 ${c.S.balance}）`);

  section('撤销后家长调整任务 → 补发一条，仍不会双份');
  c = setup();
  await c.checkin(2, null, null); await flush(c);
  await c.cancelSubmission(2); await flush(c);
  ok(allClearLogs().length === 0, '撤销后没有全清奖');
  c.S.tasks[1].required = false;                 // 家长把没做完的必做改成选做 → 必做全清
  added = await c.fixTodayAllClear();
  ok(added.length === 1, '补发 1 条');
  ok(allClearLogs().length === 1, '流水只有 1 条');
  await c.checkin(2, null, null); await flush(c);  // 孩子又把那条选做做掉
  ok(allClearLogs().length === 1, '之后再打卡不会因为补发过而重发，也不会变 2 条');
};
