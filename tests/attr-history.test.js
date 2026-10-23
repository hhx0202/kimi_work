// 编辑只对「今天及之后」生效：旧属性存 history 快照，历史日期按当时版本渲染
const { makeCtx, ok, section } = require('./harness');

const FNS = ['shiftDate', 'inEffect', 'taskAttrFor', 'pushAttrHistory', 'tasksOnDate', 'dayTasksForProgress'];

const mkTask = () => ({
  id: 1, title: '跳绳100个', points: 5, required: true, category: '运动', hint: null,
  schedule: 'daily', start_date: null, end_date: null, parent_id: null, active: true, sort: 0,
});

module.exports = async function run() {
  section('快照生成');
  let c = makeCtx(FNS, {});
  let t = mkTask();
  let patch = { title: '跳绳200个', points: 10, required: false, category: '运动' };
  const changed = c.pushAttrHistory(t, { title: '跳绳200个', points: 10, required: false, category: '运动', hint: null }, patch);
  ok(changed === true && patch.history.length === 1, '有改动 → 生成一条快照');
  ok(patch.history[0].to === '2026-10-20', '快照截止到昨天');
  ok(patch.history[0].title === '跳绳100个' && patch.history[0].points === 5, '快照存的是旧名称/旧分值');

  c = makeCtx(FNS, {});
  t = mkTask(); patch = { title: '跳绳100个', points: 5, required: true, category: '运动' };
  ok(c.pushAttrHistory(t, { title: '跳绳100个', points: 5, required: true, category: '运动', hint: null }, patch) === false && !patch.history, '没改动 → 不写快照');
  t = mkTask(); t.start_date = '2026-10-21'; t.end_date = '2026-10-21'; patch = { title: '新名字' };
  ok(c.pushAttrHistory(t, { title: '新名字', points: 5, required: true, category: '运动', hint: null }, patch) === false, '今天才布置的任务 → 随便改，不留快照');

  section('按日期取属性');
  c = makeCtx(FNS, {});
  t = mkTask();
  patch = { title: '跳绳200个', points: 10, required: false, category: '运动', hint: null };
  c.pushAttrHistory(t, { title: '跳绳200个', points: 10, required: false, category: '运动', hint: null }, patch);
  Object.assign(t, patch);
  c.S.tasks = [t];
  const past = c.tasksOnDate('2026-10-20')[0];
  const today = c.tasksOnDate('2026-10-21')[0];
  ok(past.title === '跳绳100个' && past.points === 5, '昨天的卡片显示旧名称/旧分值');
  ok(past.required === true, '昨天仍是必做');
  ok(today.title === '跳绳200个' && today.points === 10, '今天显示新名称/新分值');
  ok(today.required === false, '今天变选做');
  ok(c.S.tasks[0].title === '跳绳200个', '任务行本体是最新属性（打卡/统计走 id 不受影响）');

  section('全清判定也按日期版本');
  c.S.logs = { '2026-10-20': { 1: { done: true, approved: true } } };
  ok(c.dayTasksForProgress('2026-10-20')[0].required === true, '昨天该任务仍按「必做」计入分母');
  ok(c.dayTasksForProgress('2026-10-21')[0].required === false, '今天按「选做」计入');

  section('多次编辑的区间');
  c = makeCtx(FNS, {});
  let t2 = mkTask();
  let p1 = { title: '跳绳300个' };
  c.pushAttrHistory(t2, { title: '跳绳300个', points: 5, required: true, category: '运动', hint: null }, p1);
  Object.assign(t2, p1);
  let p2 = { title: '跳绳400个' };
  c.pushAttrHistory(t2, { title: '跳绳400个', points: 5, required: true, category: '运动', hint: null }, p2);
  Object.assign(t2, p2);
  c.S.tasks = [t2];
  ok(c.tasksOnDate('2026-10-20')[0].title === '跳绳100个', '同一天连改两次 → 历史仍是最初名称');
  ok(c.tasksOnDate('2026-10-21')[0].title === '跳绳400个', '今天显示最后一次改的名称');

  const realToday = c.DB.today;
  c.DB.today = () => '2026-10-22';   // 模拟第二天再改一次
  let p3 = { title: '跳绳500个' };
  c.pushAttrHistory(t2, { title: '跳绳500个', points: 5, required: true, category: '运动', hint: null }, p3);
  Object.assign(t2, p3);
  c.DB.today = realToday;
  c.S.tasks = [t2];
  ok(c.tasksOnDate('2026-10-19')[0].title === '跳绳100个', '跨天编辑：更早的日子仍是最初属性');
  ok(c.tasksOnDate('2026-10-21')[0].title === '跳绳400个', '10-21 显示第二次编辑前的版本');
  ok(c.tasksOnDate('2026-10-22')[0].title === '跳绳500个', '10-22 起显示最新');

  section('改日期：把任务挪到明天，历史那天不能少一条');
  c = makeCtx(FNS, {});
  // 10-19 布置的单次任务，今天(10-21) 改到 10-25
  let td = Object.assign(mkTask(), { schedule: 'once', start_date: '2026-10-19', end_date: '2026-10-19' });
  let pd = { start_date: '2026-10-25', end_date: '2026-10-25' };
  const changedDate = c.pushAttrHistory(td, { title: td.title, points: td.points, required: true, category: td.category, hint: null }, pd);
  ok(changedDate === true && pd.history.length === 1, '只改日期（别的都没动）也会存快照');
  ok(pd.history[0].start_date === '2026-10-19' && pd.history[0].end_date === '2026-10-19', '快照存的是旧日期');
  Object.assign(td, pd);
  c.S.tasks = [td];
  ok(c.tasksOnDate('2026-10-19').length === 1, '10-19 那天仍看得到这条任务（历史没被抹掉）');
  ok(c.tasksOnDate('2026-10-21').length === 0, '今天看不到（已经挪到 10-25）');
  ok(c.tasksOnDate('2026-10-25').length === 1, '10-25 出现');

  // 今天才布置的任务没生效过 → 改日期不留快照（不然会凭空多一条历史）
  td = Object.assign(mkTask(), { schedule: 'once', start_date: '2026-10-21', end_date: '2026-10-21' });
  pd = { start_date: '2026-10-25', end_date: '2026-10-25' };
  ok(c.pushAttrHistory(td, { title: td.title, points: td.points, required: true, category: td.category, hint: null }, pd) === false, '今天才布置的任务改日期不留快照');
};
