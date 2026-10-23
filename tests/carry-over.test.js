// 前一天没做完的单次任务 → 今天自动补一份（复制 + 源任务标记 carried 防复活）
const { makeCtx, laggyDB, ok, section } = require('./harness');

const FNS = ['shiftDate', 'inEffect', 'taskAttrFor', 'logOn', 'carryOverOnceTasks'];

const D = '2026-10-21';    // harness 里的「今天」
const Y = '2026-10-20';    // 昨天

function setup(tasks, logs = {}, over = {}) {
  let nid = 100;
  const db = laggyDB(1, { addTask: o => ({ id: ++nid, ...o }) });
  const c = makeCtx(FNS, Object.assign({ DB: db }, over));
  c.S.tasks = tasks;
  c.S.logs = logs;
  return c;
}
const once = (over = {}) => Object.assign({
  id: 1, title: '语文作业', schedule: 'once', points: 10, required: true,
  category: '作业', hint: null, start_date: Y, end_date: Y, active: true, note: null,
}, over);

const todayCopies = (c, title) => c.S.tasks.filter(t => t.title === title && t.start_date === D);

module.exports = async function run() {
  section('昨天没做完的单次任务 → 今天自动补一份');
  let c = setup([once()]);
  let n = await c.carryOverOnceTasks();
  ok(n === 1, '复制了 1 条');
  const copy = todayCopies(c, '语文作业')[0];
  ok(!!copy, '今天出现同名任务');
  ok(copy && copy.end_date === D, '日期是今天（单次任务当天结束）');
  ok(copy && copy.points === 10 && copy.required === true, '分数/必做属性照抄');
  ok(copy && copy.note === `carry:1:${Y}`, '复制品记了来源，方便追溯');
  ok(c.S.tasks[0].note === 'carried', '源任务标记为已带走');
  ok(c.DB.calls.some(x => x.name === 'updateTask' && x.args[0] === 1 && x.args[1].note === 'carried'), '标记已落库');

  section('选做任务一样带（不看必做/选做）');
  c = setup([once({ required: false })]);
  await c.carryOverOnceTasks();
  ok(todayCopies(c, '语文作业')[0].required === false, '选做属性保留');

  section('昨天做完了 → 不带');
  c = setup([once()], { [Y]: { 1: { done: true, approved: true } } });
  ok(await c.carryOverOnceTasks() === 0, '一条都不复制');
  ok(c.S.tasks.length === 1, '任务数没变');

  section('待家长确认（已提交未审批）也算做完');
  c = setup([once()], { [Y]: { 1: { done: true, approved: false } } });
  ok(await c.carryOverOnceTasks() === 0, '不重复布置');

  section('幂等：反复刷新不会越堆越多');
  c = setup([once()]);
  await c.carryOverOnceTasks();
  await c.carryOverOnceTasks();
  await c.carryOverOnceTasks();
  ok(c.S.tasks.length === 2, '仍然只有「原任务 + 今天这一份」');

  section('隔几天没开页面：同一条链只带走末端那一条');
  c = setup([
    once({ id: 1, start_date: '2026-10-17', end_date: '2026-10-17', note: 'carried' }),
    once({ id: 2, start_date: '2026-10-18', end_date: '2026-10-18', note: 'carried' }),
    once({ id: 3, start_date: '2026-10-19', end_date: '2026-10-19', note: 'carry:2:2026-10-18' }),
  ]);
  ok(await c.carryOverOnceTasks() === 1, '只复制 1 条（不会把历史都翻出来）');
  ok(todayCopies(c, '语文作业').length === 1, '今天只有一条');
  ok(todayCopies(c, '语文作业')[0].note === 'carry:3:2026-10-19', '带的是链末端那条');

  section('几天里各有独立任务 → 各自都带过来');
  c = setup([
    once({ id: 1, title: 'A任务', start_date: '2026-10-18', end_date: '2026-10-18' }),
    once({ id: 2, title: 'B任务', start_date: '2026-10-19', end_date: '2026-10-19' }),
  ]);
  ok(await c.carryOverOnceTasks() === 2, '两条都复制');
  ok(todayCopies(c, 'A任务').length === 1 && todayCopies(c, 'B任务').length === 1, '今天各一条');

  section('今天已经有同名任务（家长自己布置了）→ 不叠加');
  c = setup([
    once({ id: 1, title: 'A任务', start_date: Y, end_date: Y }),
    once({ id: 2, title: 'A任务', start_date: D, end_date: D }),
  ]);
  ok(await c.carryOverOnceTasks() === 0, '不复制');
  ok(todayCopies(c, 'A任务').length === 1, '今天仍只有家长布置的那条');

  section('删掉今天这份 → 明天不会复活（源任务已 carried）');
  c = setup([once()]);
  await c.carryOverOnceTasks();
  c.S.tasks = c.S.tasks.filter(t => t.start_date !== D);   // 家长删掉今天带过来的那条
  ok(await c.carryOverOnceTasks() === 0, '不会又冒出来');

  section('不参与复制的任务');
  c = setup([
    once({ id: 1, title: '重复的', schedule: 'daily', start_date: null, end_date: null }),
    once({ id: 2, title: '多日任务的子任务', schedule: 'child', parent_id: 9, start_date: null, end_date: null }),
    once({ id: 3, title: '多日父任务', schedule: 'weekly', start_date: null, end_date: null }),
    once({ id: 4, title: '老数据没日期', start_date: null, end_date: null }),
    once({ id: 5, title: '还没到期的', start_date: D, end_date: '2026-10-25' }),
  ]);
  ok(await c.carryOverOnceTasks() === 0, '重复/子任务/多日/无日期/未到期 一律不动');
  ok(c.S.tasks.length === 5, '任务数没变');

  section('写库失败不能打断刷新（否则整页白屏）');
  c = setup([once()], {}, { DB: { today: () => D, addTask: async () => { throw new Error('网络断了'); }, updateTask: async () => {} } });
  let threw = false;
  try { await c.carryOverOnceTasks(); } catch (e) { threw = true; }
  ok(!threw, '异常被吞掉，不往外抛');
};
