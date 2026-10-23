// 批量添加：首行写日期就按天布置，不写就全部加到当天（合并了原来的「批量布置多天」弹窗）
const { makeCtx, ok, section } = require('./harness');

// splitHint 里有正则 {…}，harness 的花括号配平切不准，这里给等价的桩
const splitHint = t => {
  const m = String(t || '').trim().match(/^(.*?)\{([^}]*)\}\s*$/);
  return m ? { title: m[1].trim(), hint: m[2].trim() } : { title: String(t || '').trim(), hint: '' };
};

const FNS = ['shiftDate', 'pad2', 'parseDateToken', 'parseTaskLine', 'parseBatchLines', 'parseMultiDay',
  'sameTitleTask', 'parseBatch', 'applyBatchSingle', 'applyMultiDayGroups'];

const D = '2026-10-21';       // harness 里的「今天」
const TOM = '2026-10-22';

function setup(text, tasks = []) {
  const added = [];
  const db = {
    today: () => D,
    addTask: async o => { added.push(o); return { id: 900 + added.length, ...o }; },
  };
  const c = makeCtx(FNS, {
    DB: db,
    $: () => ({ value: text }),
    refreshAll: async () => {},
    render: () => {},
    saveCat: () => {},
    splitHint,
  });
  c.S.tasks = tasks;
  c.S.parentDate = D;
  c.__added = added;
  return c;
}

module.exports = async function run() {
  section('不写日期 → 全部加到当前日期（单次任务）');
  let c = setup('语文作业 10\n跳绳500个[运动][5][选做]');
  await c.parseBatch();
  ok(c.__added.length === 2, '两条都加了');
  ok(c.__added.every(x => x.start_date === D && x.end_date === D), '日期是当天、当天结束');
  ok(c.__added[0].points === 10, '行尾空格+数字当分数');
  ok(c.__added[1].category === '运动' && c.__added[1].points === 5 && c.__added[1].required === false, '类别/分数/选做都解析对');

  section('首行是日期 → 按天分组布置');
  c = setup(`${TOM}\n明天任务 12\n${D}\n今天任务[阅读][5]`);
  await c.parseBatch();
  const byTitle = Object.fromEntries(c.__added.map(x => [x.title, x]));
  ok(c.__added.length === 2, '加了两条');
  ok(byTitle['明天任务'].start_date === TOM, '「明天任务」落在明天');
  ok(byTitle['今天任务'].start_date === D, '「今天任务」落在今天');
  ok(byTitle['今天任务'].category === '阅读', '分组里的任务照常解析类别');

  section('中文日期词也能识别');
  c = setup(`明天\n任务A 8`);
  await c.parseBatch();
  ok(c.__added[0].start_date === TOM, '「明天」→ 次日');

  section('首行是日期但下面没任务 → 不添加、给出提示');
  c = setup('明天');
  await c.parseBatch();
  ok(c.__added.length === 0, '一条都没加');
  ok((c.__toasts || []).some(m => String(m).includes('每天至少要写一条')), '提示写清楚');

  section('同名拦截：同一天重名只留一个，不同天允许同名');
  c = setup(`${D}\n练字\n练字`, [{ id: 1, title: '已有任务', schedule: 'once', start_date: D, end_date: D, active: true }]);
  await c.parseBatch();
  ok(c.__added.length === 1, '当天重名的只加一条');

  c = setup(`${D}\n练字\n${TOM}\n练字`);
  await c.parseBatch();
  ok(c.__added.length === 2, '不同天的同名任务都保留');

  section('空内容 / 全是重复：不写库');
  c = setup('   ');
  await c.parseBatch();
  ok(c.__added.length === 0 && (c.__toasts || []).some(m => String(m).includes('内容为空')), '空内容给提示');

  section('一次粘贴多条并发落库（不串行逐个 await）');
  c = setup('A 1\nB 2\nC 3\nD 4\nE 5');
  const t0 = Date.now();
  await c.parseBatch();
  ok(c.__added.length === 5, '五条都加了');
  ok(Date.now() - t0 < 50, '并发发出，不串行');
};
