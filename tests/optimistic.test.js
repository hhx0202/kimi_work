// 乐观更新：交互立即返回 + 渲染先于落库，写库丢后台
const { makeCtx, runBg, laggyDB, ok, section } = require('./harness');

const LAG = 40;
const FNS = ['shiftDate', 'makeupDays', 'isMakeupDate', 'logOn', 'logToday', 'isSubmitted', 'isApprovedDone',
  'isTaskDoneEver', 'inEffect', 'taskAttrFor', 'tasksOnDate', 'dayTasksForProgress',
  'checkin', 'cancelSubmission', 'dropAllClearPending', 'confirmPending', 'undoPoint',
  'givePts', 'minusPts', 'giveBall', 'buyBall'];

function setup(over = {}) {
  const c = makeCtx(FNS, Object.assign({ DB: laggyDB(LAG) }, over));
  c.S.viewDate = '2026-10-21';
  return c;
}

module.exports = async function run() {
  section('撤销提交：立即返回，渲染先于落库');
  let c = setup();
  c.S.tasks = [{ id: 1, title: '跳绳', schedule: 'daily', required: true, points: 5, active: true }];
  c.S.logs['2026-10-21'] = { 1: { done: true, progress: 0, approved: false } };
  c.S.pointLogs = [{ id: 601, task_id: 1, log_date: '2026-10-21', amount: 5, reason: '完成:跳绳', confirmed: false }];
  let t0 = Date.now();
  await c.cancelSubmission(1);
  ok(Date.now() - t0 < 15, `调用立即返回（${Date.now() - t0}ms，不等网络）`);
  ok(c.S.logs['2026-10-21'][1].done === false, '本地状态已恢复未完成');
  ok((c.__renders || 0) > 0, '返回前已经渲染');
  ok(c.DB.calls.length === 0, '落库还没发出');
  await runBg(c);
  ok(c.DB.calls.some(x => x.name === 'deletePointLog') && c.DB.calls.some(x => x.name === 'setLog'), '后台才真正落库');

  section('撤销提交：全清奖同步回收');
  c = setup();
  c.S.tasks = [
    { id: 1, title: '跳绳', schedule: 'daily', required: true, points: 5, active: true },
    { id: 2, title: '晨读', schedule: 'daily', required: true, points: 5, active: true },
  ];
  c.S.logs['2026-10-21'] = { 1: { done: true, approved: false }, 2: { done: true, approved: true } };
  c.S.pointLogs = [
    { id: 611, task_id: 1, log_date: '2026-10-21', amount: 5, reason: '完成:跳绳', confirmed: false },
    { id: 612, log_date: '2026-10-21', amount: 5, reason: '必选全清_2026-10-21', confirmed: false },
  ];
  await c.cancelSubmission(1);
  ok(!c.S.pointLogs.some(l => l.id === 612), '本地全清奖立即回收（不等网络）');
  ok(!c.awardLocked.has('必选全清_2026-10-21'), '锁定已释放');
  await runBg(c);
  ok(c.DB.calls.filter(x => x.name === 'deletePointLog').length === 2, '两条流水都在后台删除');

  section('家长审批：余额立即可见');
  c = setup();
  c.S.tasks = [{ id: 1, title: '跳绳' }, { id: 2, title: '晨读' }];
  c.S.logs['2026-10-21'] = { 1: { done: true, approved: false }, 2: { done: true, approved: false } };
  c.S.pointLogs = [
    { id: 621, task_id: 1, log_date: '2026-10-21', amount: 5, reason: '完成:跳绳', confirmed: false },
    { id: 622, task_id: 2, log_date: '2026-10-21', amount: 10, reason: '完成:晨读', confirmed: false },
  ];
  c.__boxes = [{ dataset: { plid: '621' } }, { dataset: { plid: '622' } }];
  t0 = Date.now();
  await c.confirmPending();
  ok(Date.now() - t0 < 15, '审批立即返回');
  ok(c.S.balance === 15, '余额立即 +15');
  ok(c.S.pointLogs.every(l => l.confirmed === true), '流水立即标记已确认');
  ok(c.S.logs['2026-10-21'][2].approved === true, '打卡立即标记已审批');
  ok((c.__notices || []).length === 1, '家长消息已推送');
  await runBg(c);
  ok(c.DB.calls.filter(x => x.name === 'setLog').length === 2, '后台一波写入状态');

  section('家长撤销单条：立即消失');
  c = setup();
  c.S.balance = 20;
  c.S.pointLogs = [{ id: 631, task_id: 1, log_date: '2026-10-21', amount: 5, reason: '完成:跳绳', confirmed: true }];
  c.S.logs['2026-10-21'] = { 1: { done: true, approved: true } };
  await c.undoPoint(631);
  ok(!c.S.pointLogs.some(l => l.id === 631), '本地流水立即移除');
  ok(c.S.balance === 15, '余额立即扣回');
  ok(!c.S.logs['2026-10-21'][1], '打卡状态立即清掉');
  await runBg(c);
  ok(c.DB.calls.some(x => x.name === 'deletePointLog') && c.DB.calls.some(x => x.name === 'setLog'), '后台并发删除 + 清状态');

  section('速发类：界面先动，id 后补');
  c = setup(); c.$ = () => ({ value: '10' });
  await c.givePts();
  ok(c.S.balance === 10, '发 10 分：余额立即 +10');
  ok((c.__toasts || []).some(t => t.includes('已发 10 积分')), '提示立即出现');
  await runBg(c);
  ok(c.S.pointLogs.length === 1 && c.S.pointLogs[0].id > 1000, '后台拿到流水 id 并补进列表');
  c = setup(); c.$ = () => ({ value: '10' });
  await c.minusPts();
  ok(c.S.balance === -10, '扣 10 分：余额立即 -10');
  await runBg(c);
  ok(c.S.pointLogs[0].amount === -10, '后台流水为 -10');
  c = setup();
  await c.giveBall();
  ok(c.S.balls === 1, '送球：数量立即 +1');
  c = setup(); c.S.balance = 150;
  await c.buyBall();
  ok(c.S.balls === 1 && c.S.balance === 50, '买球：立即扣 100 分加 1 球');
  await runBg(c);
  ok(c.DB.calls.filter(x => x.name === 'addPointLog').length === 1 && c.DB.calls.filter(x => x.name === 'addItemLog').length === 1, '后台并发写扣分 + 物品流水');
};
