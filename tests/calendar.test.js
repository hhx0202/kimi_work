// 打卡日历：分母按「那天实际生效的任务」算，不能拿今天的任务列表去算历史
const fs = require('fs');
const path = require('path');
const { makeCtx, ok, section, APP_SRC } = require('./harness');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');

const FNS = ['shiftDate', 'inEffect', 'taskAttrFor', 'tasksOnDate', 'dayTasksForProgress',
  'calTasksOn', 'calDayStat'];
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

  section('已停用的重复任务不算进之后的日子');
  const stopped = [
    { id: 1, title: '晨读', schedule: 'daily', required: true, active: true, start_date: '2026-10-01', end_date: '2026-10-20' },
  ];
  c = setup(stopped, { '2026-10-21': { 1: { done: true } } });
  ok(c.calDayStat('2026-10-21', 'req').total === 0, '停用后那天没有任务（灰点）');

  section('未来的日子不判成败（不标红）');
  ok(APP_SRC.includes('const future = ds > todayStr'), '日历区分未来日期');
  ok(/const st = future \? \{ total: 0, done: 0, full: false \}/.test(APP_SRC), '未来日期不算完成情况');
  ok(/if \(!future && st\.total\) dot =/.test(APP_SRC), '未来日期不会得到红点');
  ok(APP_SRC.includes('还没到'), '未来日期的提示文案是"还没到"');
  ok(/\.cal-day\.future/.test(CSS), '未来日期有专门样式');
  // 函数层面仍如实返回完成情况，"未来不标红"只在渲染层做
  c = setup(tasks, logs);
  ok(c.calDayStat('2026-10-21', 'req').total === 2, '纯统计函数仍如实返回（红线由渲染层控制）');

  section('切换按钮不用圆形色块（避免和日历圆点撞色）');
  ok(!/cal-tab[^>]*>[^<]*[🔴🟢]/.test(APP_SRC), '按钮里没有红/绿圆点 emoji');
  ok(/class="cal-tab req/.test(APP_SRC) && /class="cal-tab opt/.test(APP_SRC), '按钮靠 req/opt 类区分红绿底色');
  ok(/\.cal-tab\.req\.on[^{]*\{[^}]*background/.test(CSS) && /\.cal-tab\.opt\.on[^{]*\{[^}]*background/.test(CSS),
    '必做/选做选中态有各自底色');
  ok(/\.cal-legend/.test(CSS) && /class="cal-legend"/.test(APP_SRC), '有圆点图例集中解释颜色含义');

  section('「我的」页整合：卡片并成一块、流水合并');
  ok(APP_SRC.includes('累计获得积分') && APP_SRC.includes('累计完成任务'), '四张卡片：当前积分/累计获得/累计完成/连击');
  // 只看 renderMe 函数体，避免误伤注释和成就图里的同名文案
  const meStart = APP_SRC.indexOf('function renderMe(');
  const meBody = APP_SRC.slice(meStart, APP_SRC.indexOf('function kidCalPanel(', meStart));
  ok(!meBody.includes('完成统计'), '「完成统计」整块和说明行已删除');
  ok(!meBody.includes('我的宝可梦</span>') && !meBody.includes('图鉴收集</span>'), '宝可梦/图鉴卡片已移除');
  ok(meBody.indexOf('stat-grid') < meBody.indexOf('kidCalPanel'), '卡片区在日历上方');
  ok(!APP_SRC.includes('function approvedPointsHTML'), '「家长确认获得积分」独立列表已删');
  ok(!APP_SRC.includes('function bonusLogsHTML') && !APP_SRC.includes('function minusLogsHTML'),
    '「额外奖励」「扣分」独立列表已删（合并进积分记录）');
  ok(APP_SRC.includes('function kidPointLogPanel'), '积分记录合并为一块');
  ok(APP_SRC.includes("data-action=\"pt-filter\"") && /PT_FILTERS\s*=/.test(APP_SRC), '积分记录带 全部/获得/扣分 筛选');
  ok(/\.log-filter/.test(CSS) && /\.log-tab\.on/.test(CSS), '筛选项有样式');
  ok(APP_SRC.includes('function earnedPoints') && APP_SRC.includes('function totalDoneCount'), '新增累计获得积分/累计完成任务计算');

  section('「我的」页：删除重复入口');
  ok(!APP_SRC.includes('去捕捉宝可梦'), '「去捕捉宝可梦」大按钮已删（底栏已有入口）');
  ok(/data-action="share"/.test(APP_SRC) && /class="btn-ghost mini" data-action="share"/.test(APP_SRC), '成就图改成小按钮');
  ok(!/catch-zone[\s\S]{0,200}data-action="share"/.test(APP_SRC), '成就图不再占用整块 catch-zone');

  section('家长端：每日打卡记录面板已删');
  ok(!APP_SRC.includes('checkinLogPanel'), 'checkinLogPanel 已移除');
  ok(!APP_SRC.includes('showTaskLogs'), 'showTaskLogs 已移除');
  ok(!APP_SRC.includes('每日任务打卡记录'), '家长端不再渲染打卡记录面板');
  // 圆点颜色定义不能只挂在 .cal-day 下，否则图例里的圆点是白点
  ok(/(^|\n)\.dot\.full\s*\{/.test(CSS) && !/(^|\n)\.cal-day \.dot\.full\s*\{/.test(CSS),
    '圆点颜色定义通用于日历与图例');
};
