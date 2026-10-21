// 排序落库：只写 sort 变化的行 + 并发 + 本地立即换位（不再全量重写 + 整页重载）
const { makeCtx, runBg, laggyDB, ok, section } = require('./harness');

const LAG = 40;
const FNS = ['shiftDate', 'inEffect', 'taskAttrFor', 'tasksOnDate', 'taskSort', 'persistTaskOrder', 'moveTask'];

function setup() {
  const db = laggyDB(LAG);
  const c = makeCtx(FNS, { DB: db, refreshAll: async () => { c.__refreshed = true; } });
  c.S.tasks = [
    { id: 1, title: '语文', schedule: 'daily', required: true, points: 5, sort: 0, category: '作业', active: true },
    { id: 2, title: '数学', schedule: 'daily', required: true, points: 5, sort: 1, category: '作业', active: true },
    { id: 3, title: '英语', schedule: 'daily', required: true, points: 5, sort: 2, category: '作业', active: true },
    { id: 9, title: '画画', schedule: 'daily', required: false, points: 3, sort: 0, category: '美术', active: true },
  ];
  return c;
}

module.exports = async function run() {
  section('persistTaskOrder：只写变化行');
  let c = setup();
  let t0 = Date.now();
  c.persistTaskOrder([2, 1, 3]);
  ok(Date.now() - t0 < 10, '调用立即返回（不等网络）');
  ok(c.S.tasks.find(t => t.id === 2).sort === 0 && c.S.tasks.find(t => t.id === 1).sort === 1, '本地 sort 立即换好');
  ok(c.S.tasks.find(t => t.id === 3).sort === 2, '未动的行 sort 不变');
  ok((c.__bg || []).length === 1 && c.__bg[0].desc === '保存顺序', '落库进了后台');
  t0 = Date.now();
  await runBg(c);
  ok(Date.now() - t0 < LAG * 2, `写库并发一波（${Date.now() - t0}ms）`);
  ok(c.DB.calls.length === 2, '只写了 2 行（第 3 行没变，不发请求）');

  section('没变化就不发请求');
  c = setup();
  c.persistTaskOrder([1, 2, 3]);
  ok((c.__bg || []).length === 0, '顺序没变 → 不写库');
  c.S.tasks.forEach(t => { t.sort = 0; });   // 全部同值（默认态，所有任务都算「并列第一」）
  c.persistTaskOrder([2, 1, 3]);
  ok(c.DB.calls.length === 0, '调用后仍是后台延迟写，未立即发请求');
  await runBg(c);
  ok(c.DB.calls.length === 2, '同值也能落成确定顺序（id2 目标就是 0，只有另两行要写）');
  ok(c.S.tasks.find(t => t.id === 2).sort === 0 && c.S.tasks.find(t => t.id === 1).sort === 1 && c.S.tasks.find(t => t.id === 3).sort === 2, '落库后顺序确定');

  section('moveTask：点按钮立即换位，不整页重载');
  c = setup();
  await c.moveTask(2, 'up');
  ok(c.__renders > 0, '返回前已渲染');
  ok(c.__refreshed !== true, '不再 refreshAll 整页重载');
  ok(c.S.tasks.find(t => t.id === 2).sort === 0 && c.S.tasks.find(t => t.id === 1).sort === 1, '本地顺序已交换');
  ok(c.DB.calls.length === 0, '写库还在后台');
  await runBg(c);
  ok(c.DB.calls.length === 2, '只写交换涉及的行');

  section('边界与分区隔离');
  c = setup();
  await c.moveTask(1, 'up');
  ok((c.__toasts || []).some(t => t.includes('边缘')), '已在顶部再上移 → 提示边缘');
  ok(c.DB.calls.length === 0 && (c.__bg || []).length === 0, '不写库');
  c = setup();
  await c.moveTask(9, 'up');
  ok((c.__toasts || []).some(t => t.includes('边缘')), '选做分区独立判断，不跨区移动');
  ok(c.S.tasks.find(t => t.id === 1).sort === 0, '必做分区未被搅乱');
};
