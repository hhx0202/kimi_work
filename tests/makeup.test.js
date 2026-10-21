// 补卡：只能补窗口内的单次任务，补交不发当天全清奖
const { makeCtx, runBg, ok, section } = require('./harness');

const FNS = ['shiftDate', 'makeupDays', 'isMakeupDate', 'logOn', 'logToday', 'isSubmitted', 'isApprovedDone',
  'isTaskDoneEver', 'inEffect', 'taskAttrFor', 'tasksOnDate', 'dayTasksForProgress', 'taskTypeLabel',
  'taskStartText', 'taskCardHTML', 'dropAllClearPending', 'checkin', 'cancelSubmission'];

function setup(over = {}) {
  const c = makeCtx(FNS, over);
  c.S.viewDate = '2026-10-20';   // 查看昨天
  c.S.tasks = [
    { id: 1, title: '晨读英语', schedule: 'once', points: 5, required: true, category: '英语', start_date: '2026-10-20', end_date: '2026-10-20', active: true },
    { id: 2, title: '跳绳100个', schedule: 'daily', points: 5, required: true, category: '运动', start_date: null, end_date: null, active: true },
  ];
  return c;
}

module.exports = async function run() {
  section('补卡窗口（isMakeupDate）');
  let c = makeCtx(['shiftDate', 'makeupDays', 'isMakeupDate'], {});
  ok(c.isMakeupDate('2026-10-20') === true, '昨天可补');
  ok(c.isMakeupDate('2026-10-19') === false, '前天不可补');
  ok(c.isMakeupDate('2026-10-21') === false, '今天不是补卡日');
  ok(c.isMakeupDate('2026-10-22') === false, '未来不可补');
  c = makeCtx(['shiftDate', 'makeupDays', 'isMakeupDate'], { CONFIG: { MAKEUP_DAYS: 0 } });
  ok(c.isMakeupDate('2026-10-20') === false, 'MAKEUP_DAYS=0 → 全关');
  c = makeCtx(['shiftDate', 'makeupDays', 'isMakeupDate'], { CONFIG: { MAKEUP_DAYS: 3 } });
  ok(c.isMakeupDate('2026-10-19') && c.isMakeupDate('2026-10-18') && !c.isMakeupDate('2026-10-17'), 'MAKEUP_DAYS=3 → 前两天可补');

  section('按钮状态');
  c = setup();
  ok(c.taskCardHTML(c.S.tasks[0]).includes('补完成'), '补卡日单次任务 → 可点「补完成」');
  ok(/btn-done" disabled>未完成/.test(c.taskCardHTML(c.S.tasks[1])), '补卡日重复任务 → 锁定「未完成」');
  c = setup(); c.S.logs['2026-10-21'] = { 1: { done: true, progress: 0, approved: true } };
  ok(!c.taskCardHTML(c.S.tasks[0]).includes('补完成'), '单次任务已完成过 → 不能再补');
  c = setup(); c.S.viewDate = '2026-10-19';
  ok(!c.taskCardHTML(c.S.tasks[0]).includes('补完成'), '超出补卡窗口 → 锁定只读');
  c = setup(); c.S.logs['2026-10-20'] = { 1: { done: true, progress: 0, approved: false } };
  ok(c.taskCardHTML(c.S.tasks[0]).includes('data-action="cancel-submit"'), '补卡日单次已提交 → 可撤销（撤了可再补）');
  c = setup(); c.S.logs['2026-10-20'] = { 2: { done: true, progress: 0, approved: false } };
  ok(/cancel-submit[^>]*disabled/.test(c.taskCardHTML(c.S.tasks[1])), '补卡日重复已提交 → 不可撤销（撤了没法重交）');

  section('补交落库与奖励');
  c = setup();
  c.DB = { today: () => '2026-10-21', setLog: async (...a) => (c.__setLog || (c.__setLog = [])).push(a), addPointLog: async () => 77 };
  await c.checkin(1, null, null);
  await runBg(c);
  ok(c.S.logs['2026-10-20'][1].done === true, '记录写在昨天');
  ok((c.__setLog || []).some(a => a[0] === 1 && a[1] === '2026-10-20'), 'setLog 用昨天的日期');
  ok(c.S.pointLogs.some(l => l.log_date === '2026-10-20' && l.confirmed === false), '积分流水记昨天、待家长确认');
  ok(!c.S.pointLogs.some(l => String(l.reason).includes('全清')), '补交不发当天全清奖');
  ok((c.__toasts || []).some(t => t.includes('补交')), '提示写明是补交');

  section('补交防线');
  c = setup();
  c.S.logs['2026-10-21'] = { 1: { done: true, progress: 0, approved: true } };
  await c.checkin(1, null, null);
  ok((c.__toasts || []).some(t => t.includes('已经完成过')), '已完成过的单次任务拒绝再补');
  ok(!c.S.logs['2026-10-20'], '没有写入昨天记录');

  section('撤销约束');
  c = setup();
  c.DB = { today: () => '2026-10-21', deletePointLog: async () => {}, setLog: async () => {} };
  c.S.logs['2026-10-20'] = { 1: { done: true, progress: 0, approved: false } };
  c.S.pointLogs = [{ id: 9, task_id: 1, log_date: '2026-10-20', amount: 5, reason: '完成:晨读英语', confirmed: false }];
  await c.cancelSubmission(1); await runBg(c);
  ok(c.S.logs['2026-10-20'][1].done === false && !c.S.pointLogs.some(l => l.id === 9), '补卡日单次提交可撤销');
  c = setup();
  c.DB = { today: () => '2026-10-21', deletePointLog: async () => {}, setLog: async () => {} };
  c.S.logs['2026-10-20'] = { 2: { done: true, progress: 0, approved: false } };
  await c.cancelSubmission(2); await runBg(c);
  ok((c.__toasts || []).some(t => t.includes('补卡只支持单次任务')), '重复任务的历史提交不可撤销');
  ok(c.S.logs['2026-10-20'][2].done === true, '重复任务记录未被破坏');
};
