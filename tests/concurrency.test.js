// 写库必须并发：打卡/撤销/审批从「串行 N 次往返」变成「一波」
// 用 25ms 的假往返来断言：一波的耗时 ≈ 单次，而不是 N 倍
const { makeCtx, runBg, laggyDB, ok, section } = require('./harness');

const LAG = 25;
const FNS = ['shiftDate', 'makeupDays', 'isMakeupDate', 'logOn', 'logToday', 'isSubmitted', 'isApprovedDone',
  'isTaskDoneEver', 'inEffect', 'taskAttrFor', 'tasksOnDate', 'dayTasksForProgress', 'taskTypeLabel',
  'taskStartText', 'taskCardHTML', 'checkin', 'cancelSubmission', 'dropAllClearPending', 'confirmPending', 'pointReasonLabel'];

function setup(over = {}) {
  const db = laggyDB(LAG);
  const c = makeCtx(FNS, Object.assign({ DB: db }, over));
  c.S.viewDate = '2026-10-21';
  c.S.tasks = [
    { id: 1, title: '跳绳100个', schedule: 'daily', points: 5, required: true, category: '运动', start_date: null, end_date: null, active: true },
    { id: 2, title: '晨读英语', schedule: 'daily', points: 5, required: true, category: '英语', start_date: null, end_date: null, active: true },
  ];
  return c;
}

module.exports = async function run() {
  section('常规打卡：5 个写入一波发出');
  let c = setup();
  c.S.logs['2026-10-21'] = { 2: { done: true, progress: 0, approved: true } };   // 另一条必做已完成
  let t0 = Date.now();
  await c.checkin(1, null, null);
  await runBg(c);
  const el = Date.now() - t0;
  ok(el < LAG * 2.5, `耗时 ${el}ms（串行会是 ${LAG * 5}ms 以上）`);
  ok(c.DB.calls.filter(x => x.name === 'setLog').length === 1, '写打卡记录 1 次');
  ok(c.DB.calls.filter(x => x.name === 'addPointLog').length === 2, '写 2 条积分流水（任务分 + 必选全清奖）');
  ok(c.S.pointLogs.some(l => l.reason === '完成:跳绳100个' && l.amount === 5), '任务流水落本地且 id 正确');
  ok(c.S.pointLogs.some(l => l.reason === '必选全清_2026-10-21' && l.amount === 5), '全清奖流水落本地且 id 正确');
  const sl = c.DB.calls.find(x => x.name === 'setLog');
  ok(sl.args[0] === 1 && sl.args[1] === '2026-10-21' && sl.args[2] === true && sl.args[5] === false, 'setLog 参数不变（待审批）');

  section('无全清奖时不多发请求');
  c = setup();
  await c.checkin(1, null, null); await runBg(c);
  ok(c.DB.calls.filter(x => x.name === 'addPointLog').length === 1, '只有任务分 1 条流水');
  ok(!c.S.pointLogs.some(l => String(l.reason).includes('全清')), '没有全清流水');

  section('出战宝可梦经验并进同一波');
  c = setup();
  c.S.leadId = 77;
  c.S.pokemons = [{ id: 77, exp: 0, shiny: false, pokedex_no: 25 }];
  t0 = Date.now();
  await c.checkin(1, null, null); await runBg(c);
  ok(Date.now() - t0 < LAG * 2.5, `总耗时 ${Date.now() - t0}ms（经验写库没有额外串行等待）`);
  ok(c.S.pokemons[0].exp === 1, '本地经验 +1');

  section('撤销提交：删除与状态写一波');
  c = setup();
  c.S.logs['2026-10-21'] = { 1: { done: true, progress: 0, approved: false } };
  c.S.pointLogs = [
    { id: 201, task_id: 1, log_date: '2026-10-21', amount: 5, reason: '完成:跳绳100个', confirmed: false },
    { id: 202, task_id: 1, log_date: '2026-10-21', amount: 5, reason: '必选全清_2026-10-21', confirmed: false },
    { id: 203, task_id: 1, log_date: '2026-10-20', amount: 5, reason: '完成:跳绳100个', confirmed: false },
  ];
  t0 = Date.now();
  await c.cancelSubmission(1); await runBg(c);
  const el3 = Date.now() - t0;
  ok(el3 < LAG * 3, `耗时 ${el3}ms（2 次删除 + 1 次状态写在同一波）`);
  ok(c.DB.calls.filter(x => x.name === 'deletePointLog').length === 2, '删掉当天两条待确认流水');
  ok(c.DB.calls.some(x => x.name === 'setLog' && x.args[2] === false), '打卡状态清为未完成');
  ok(c.S.pointLogs.some(l => l.id === 203), '别的日期的流水不受影响');

  section('家长一键审批：N+1 波 → 1 波');
  c = setup();
  c.S.logs['2026-10-21'] = { 1: { done: true, approved: false }, 2: { done: true, approved: false } };
  c.S.pointLogs = [
    { id: 301, task_id: 1, log_date: '2026-10-21', amount: 5, reason: '完成:跳绳100个', confirmed: false },
    { id: 302, task_id: 2, log_date: '2026-10-21', amount: 5, reason: '完成:晨读英语', confirmed: false },
  ];
  c.__boxes = [{ dataset: { plid: '301' } }, { dataset: { plid: '302' } }];
  t0 = Date.now();
  await c.confirmPending(); await runBg(c);
  ok(Date.now() - t0 < LAG * 2.5, `耗时 ${Date.now() - t0}ms（1 次确认 + 2 次状态写同一波）`);
  ok(c.S.balance === 10, '余额累加正确');
  ok(c.DB.calls.filter(x => x.name === 'setLog').length === 2 && c.DB.calls.some(x => x.name === 'confirmPointLogs'), '确认与状态写都发出');

  section('审批通知带明细：逐条列出任务名和分数（含不挂任务的全清奖）');
  c = setup();
  c.S.logs['2026-10-21'] = { 1: { done: true, approved: false }, 2: { done: true, approved: false } };
  c.S.pointLogs = [
    { id: 401, task_id: 1, log_date: '2026-10-21', amount: 5, reason: '完成:跳绳100个', confirmed: false },
    { id: 402, task_id: 2, log_date: '2026-10-21', amount: 5, reason: '完成:晨读英语', confirmed: false },
    { id: 403, task_id: null, log_date: '2026-10-21', amount: 5, reason: '必选全清_2026-10-21', confirmed: false },
  ];
  c.__boxes = [401, 402, 403].map(id => ({ dataset: { plid: String(id) } }));
  await c.confirmPending();
  const n = (c.__noticeArgs || [])[0] || {};
  ok(String(n.text).includes('3 项'), '正文说「确认了 3 项」');
  ok(Array.isArray(n.items) && n.items.length === 3, '明细 3 行');
  ok(n.items.some(it => it.title === '跳绳100个' && it.pts === 5), '任务行带名字和分数');
  ok(n.items.some(it => it.title === '必做全清' && it.pts === 5), '全清奖也列进明细（以前只挑带 task_id 的，会漏）');
};
