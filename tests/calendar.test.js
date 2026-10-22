// 打卡日历：分母按「那天实际生效的任务」算，不能拿今天的任务列表去算历史
const fs = require('fs');
const path = require('path');
const { makeCtx, ok, section, APP_SRC } = require('./harness');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');

const FNS = ['shiftDate', 'inEffect', 'taskAttrFor', 'tasksOnDate', 'dayTasksForProgress',
  'calTasksOn', 'calDayStat', 'allClearDates', 'allDoneDates'];
const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function setup(tasks, logs = {}, over = {}) {
  const c = makeCtx(FNS, Object.assign({ fmtDate, S: Object.assign({}, require('./harness').baseGlobals().S, { tasks, logs }) }, over));
  return c;
}

module.exports = async function run() {
  section('日历分母按天算（今天新加的重复任务不算进昨天）');
  const tasks = [
    { id: 1, title: '晨读', schedule: 'daily', required: true, active: true, start_date: '2026-10-01' },
    // 今天才布置的重复任务
    { id: 2, title: '口算', schedule: 'daily', required: true, active: true, start_date: '2026-10-21' },
    { id: 3, title: '画画', schedule: 'daily', required: false, active: true, start_date: '2026-10-01' },
  ];
  const logs = {
    '2026-10-20': { 1: { done: true }, 3: { done: true } },   // 昨天：必做只有 1，做了；选做 3 也做了
    '2026-10-21': { 1: { done: true } },                     // 今天：只做了晨读
  };
  let c = setup(tasks, logs);

  ok(c.calTasksOn('2026-10-20', 'req').map(t => t.id).join() === '1', '昨天下班分母只有晨读（不含今天才布置的口算）');
  const y = c.calDayStat('2026-10-20', 'req');
  ok(y.full === true && y.done === 1 && y.total === 1, '昨天必做全清（绿点），而不是永远黄点');
  const t = c.calDayStat('2026-10-21', 'req');
  ok(t.done === 1 && t.total === 2 && t.full === false, '今天必做 1/2 → 黄点');
  const o = c.calDayStat('2026-10-21', 'opt');
  ok(o.total === 1 && o.done === 0, '今天选做 0/1');
  const oy = c.calDayStat('2026-10-20', 'opt');
  ok(oy.total === 1 && oy.full === true, '昨天选做全清');

  section('当天没有这类任务 → 标记为"无任务"，不算没做');
  c = setup([{ id: 1, title: '晨读', schedule: 'daily', required: true, active: true, start_date: '2026-10-21' }], {});
  const before = c.calDayStat('2026-10-19', 'req');
  ok(before.total === 0 && before.full === false, '布置之前的日子 total=0（灰点，不是红点）');

  section('全清日期清单与连击口径一致');
  c = setup(tasks, logs);
  ok(c.allClearDates('req').join() === '2026-10-20', '必做全清只有 10-20');
  ok(c.allClearDates('opt').join() === '2026-10-20', '选做全清只有 10-20');
  ok(c.allDoneDates().join() === '2026-10-20,2026-10-21', '有打卡的日子两天都在');

  section('已停用的重复任务不算进之后的日子');
  const stopped = [
    { id: 1, title: '晨读', schedule: 'daily', required: true, active: true, start_date: '2026-10-01', end_date: '2026-10-20' },
  ];
  c = setup(stopped, { '2026-10-21': { 1: { done: true } } });
  ok(c.calDayStat('2026-10-21', 'req').total === 0, '停用后那天没有任务（灰点）');

  section('切换按钮不用圆形色块（避免和日历圆点撞色）');
  ok(!/cal-tab[^>]*>[^<]*[🔴🟢]/.test(APP_SRC), '按钮里没有红/绿圆点 emoji');
  ok(/class="cal-tab req/.test(APP_SRC) && /class="cal-tab opt/.test(APP_SRC), '按钮靠 req/opt 类区分红绿底色');
  ok(/\.cal-tab\.req\.on[^{]*\{[^}]*background/.test(CSS) && /\.cal-tab\.opt\.on[^{]*\{[^}]*background/.test(CSS),
    '必做/选做选中态有各自底色');
  ok(/\.cal-legend/.test(CSS) && /class="cal-legend"/.test(APP_SRC), '有圆点图例集中解释颜色含义');
  // 圆点颜色定义不能只挂在 .cal-day 下，否则图例里的圆点是白点
  ok(/(^|\n)\.dot\.full\s*\{/.test(CSS) && !/(^|\n)\.cal-day \.dot\.full\s*\{/.test(CSS),
    '圆点颜色定义通用于日历与图例');
};
