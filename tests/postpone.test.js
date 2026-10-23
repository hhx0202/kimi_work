// 「推迟一天」按钮：把今天的单次任务挪到明天，原日期记录不掉、历史不塌
const { makeCtx, laggyDB, ok, section } = require('./harness');

const FNS = ['shiftDate', 'inEffect', 'taskAttrFor', 'pushAttrHistory', 'tasksOnDate', 'dayTasksForProgress',
  'logOn', 'pointReasonLabel', 'allClearFixText', 'fixTodayAllClear', 'postponeTask'];

const D = '2026-10-21';   // harness 里的「今天」
const TOM = '2026-10-22';

function setup(tasks, over = {}) {
  const db = laggyDB(2);
  const c = makeCtx(FNS, Object.assign({
    DB: db,
    refreshAll: async () => {},
    render: () => {},
    askConfirm: async () => true,
  }, over));
  c.S.viewDate = D;
  c.S.tasks = tasks;
  c.S.logs = {};
  return c;
}

const onceTask = (over = {}) => Object.assign({
  id: 1, title: '语文作业', schedule: 'once', points: 10, required: true,
  category: '作业', hint: null, start_date: D, end_date: D, active: true, created_at: null,
}, over);

module.exports = async function run() {
  section('单次任务：今天 → 明天');
  let c = setup([onceTask()]);
  await c.postponeTask(1);
  const t = c.S.tasks[0];
  ok(t.start_date === TOM && t.end_date === TOM, '执行日期改成明天');
  ok(c.tasksOnDate(D).length === 0, '今天列表里不再出现');
  ok(c.tasksOnDate(TOM).some(x => x.id === 1), '明天列表里出现');
  ok(c.DB.calls.some(x => x.name === 'updateTask' && x.args[1].start_date === TOM), '落库带了新日期');
  ok((c.__toasts || []).some(m => String(m).includes('已推迟到 10-22')), '提示推迟到哪天');

  section('昨天布置的任务：推迟后昨天仍看得到（历史不塌）');
  c = setup([onceTask({ start_date: '2026-10-20', end_date: '2026-10-20' })]);
  c.S.logs = { '2026-10-20': { 1: { done: true, approved: true } } };
  await c.postponeTask(1);
  const t2 = c.S.tasks[0];
  ok(t2.start_date === '2026-10-21' && t2.end_date === '2026-10-21', '从 10-20 推到 10-21');
  ok(Array.isArray(t2.history) && t2.history.length === 1, '存了一条历史快照');
  ok(t2.history[0].start_date === '2026-10-20', '快照记的是旧日期');
  ok(c.tasksOnDate('2026-10-20').some(x => x.id === 1), '10-20 那天仍显示这条任务');
  ok(c.tasksOnDate(D).some(x => x.id === 1), '10-21 出现（新日期）');

  section('已完成的任务：二次确认里说明记录保留');
  let asked = '';
  c = setup([onceTask()], { askConfirm: async msg => { asked = String(msg); return true; } });
  c.S.logs = { [D]: { 1: { done: true, approved: false } } };
  await c.postponeTask(1);
  ok(asked.includes('完成记录和积分保留'), '确认文案讲清楚原记录不动');
  ok(c.S.tasks[0].start_date === TOM, '仍然完成推迟');

  section('点取消就什么都不改');
  c = setup([onceTask()], { askConfirm: async () => false });
  await c.postponeTask(1);
  ok(c.S.tasks[0].start_date === D, '日期没变');
  ok(!c.DB.calls.some(x => x.name === 'updateTask'), '没有写库');

  section('重复任务不给推迟（每天都做，推迟=今天跳过，没有这个语义）');
  c = setup([onceTask({ schedule: 'daily', start_date: D, end_date: null })]);
  await c.postponeTask(1);
  ok(c.S.tasks[0].start_date === D, '日期没变');
  ok((c.__toasts || []).some(m => String(m).includes('重复任务每天都做')), '提示原因');

  section('推迟后今天正好全清 → 顺手补发全清奖');
  c = setup([
    onceTask({ id: 1, title: '语文作业' }),
    onceTask({ id: 2, title: '数学作业' }),
  ]);
  c.S.logs = { [D]: { 2: { done: true, approved: true } } };   // 只剩 1 没做
  await c.postponeTask(1);                                     // 把没做的挪走 → 必做全清
  ok(c.S.pointLogs.some(l => l.reason === `必选全清_${D}` && l.amount === 5), '全清奖补发');
  ok((c.__noticeArgs || []).some(n => String(n.text).includes('全清')), '孩子端收到通知');
};
