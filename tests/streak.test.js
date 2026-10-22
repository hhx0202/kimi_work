// 连续必做全清：只看孩子是否提交（done），不看家长审批；重复任务不回溯到布置之前
const { makeCtx, ok, section } = require('./harness');

const FNS = ['shiftDate', 'inEffect', 'taskAttrFor', 'tasksOnDate', 'dayTasksForProgress',
  'reqDayDone', 'reqStreakDays', 'calcStreak', 'streakCycleDays', 'streakGoal'];
// fmtDate 在 app.js 里是 const 箭头函数，切不出来，这里按同样格式给一份
const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function setup(tasks, logs = {}, over = {}) {
  const c = makeCtx(FNS, Object.assign({ fmtDate }, over));
  c.S.tasks = tasks;
  c.S.logs = logs;
  return c;
}

// 一个"昨天和前天都已全清"的基线：只有一条重复任务
const baseTasks = () => ([
  { id: 1, title: '晨读', schedule: 'daily', points: 5, required: true, active: true, start_date: '2026-10-01', end_date: null },
]);
const allDone = (...dates) => {
  const logs = {};
  dates.forEach(d => { logs[d] = { 1: { done: true, progress: 0, approved: false } }; });
  return logs;
};

module.exports = async function run() {
  section('连击口径：以孩子提交为准（不看家长审核）');
  let c = setup(baseTasks(), {
    '2026-10-21': { 1: { done: true, progress: 0, approved: false } },   // 今天已提交、未审核
    '2026-10-20': { 1: { done: true, progress: 0, approved: false } },
  });
  ok(c.reqDayDone('2026-10-21') === true, '已提交但家长没审核 → 仍算全清');
  ok(c.reqStreakDays() === 2, '连击 2 天，不等审核');

  section('今天新加的重复任务不许回溯到昨天（连击不能被打断）');
  // 场景：昨天、前天已全清；今天家长又布置了一条重复任务
  const tasksWithNew = baseTasks().concat([
    { id: 2, title: '口算一页', schedule: 'daily', points: 5, required: true, active: true, start_date: '2026-10-21', end_date: null },
  ]);
  c = setup(tasksWithNew, allDone('2026-10-20', '2026-10-19'));
  ok(c.dayTasksForProgress('2026-10-20').every(t => t.id !== 2), '新重复任务不在昨天的分母里');
  ok(c.reqDayDone('2026-10-20') === true, '昨天仍判为全清 → 连击不断');
  ok(c.reqStreakDays() === 2, '连击还是 2 天');

  section('老数据（start_date 为空）用 created_at 兜底');
  const legacy = baseTasks().concat([
    { id: 3, title: '朗读', schedule: 'daily', points: 5, required: true, active: true,
      start_date: null, end_date: null, created_at: '2026-10-21T09:00:00.000Z' },
  ]);
  c = setup(legacy, allDone('2026-10-20', '2026-10-19'));
  ok(c.dayTasksForProgress('2026-10-20').every(t => t.id !== 3), 'start_date 为空但 created_at 是今天 → 不算进昨天');
  ok(c.reqDayDone('2026-10-20') === true, '昨天仍判为全清');
  ok(c.reqStreakDays() === 2, '连击没被打断');

  section('真正一直存在的重复任务仍然算进历史');
  const oldTask = [{ id: 1, title: '晨读', schedule: 'daily', points: 5, required: true, active: true,
    start_date: null, end_date: null, created_at: '2026-09-01T09:00:00.000Z' }];
  c = setup(oldTask, allDone('2026-10-20'));
  ok(c.dayTasksForProgress('2026-10-20').some(t => t.id === 1), '远古任务照常出现在历史分母');

  section('昨天没做完 → 连击中断');
  // 任务 2 是昨天就在的（start_date 更早），所以昨天分母包含它，但昨天没做完
  const oldBoth = baseTasks().concat([
    { id: 2, title: '口算一页', schedule: 'daily', points: 5, required: true, active: true, start_date: '2026-10-19', end_date: null },
  ]);
  c = setup(oldBoth, {
    '2026-10-20': { 1: { done: true, progress: 0, approved: false } },   // 昨天的 2 没做
    '2026-10-19': { 1: { done: true, progress: 0, approved: false }, 2: { done: true, progress: 0, approved: false } },
  });
  ok(c.reqDayDone('2026-10-20') === false, '昨天有必做没做完 → 不算全清');
  ok(c.reqStreakDays() === 0, '连击归零');

  section('单次任务只在当天生效');
  const onceTasks = baseTasks().concat([
    { id: 4, title: '带作业本', schedule: 'once', points: 5, required: true, active: true, start_date: '2026-10-21', end_date: '2026-10-21' },
  ]);
  c = setup(onceTasks, allDone('2026-10-20'));
  ok(c.dayTasksForProgress('2026-10-20').every(t => t.id !== 4), '今天的单次任务不进昨天的分母');
};
