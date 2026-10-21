// 跨设备轮询：只在"没在操作、页面可见、数据真变了"时才刷新，且不破坏滚动位置
const { makeCtx, ok, section } = require('./harness');

const FNS = ['pollIntervalMs', 'pollBusy', 'preserveScroll', 'pollOnce'];

function setup(over = {}) {
  const c = makeCtx(FNS, Object.assign({
    CONFIG: { POLL_SECONDS: 20 },
    DB: { today: () => '2026-10-21', getRev: async () => '1|2|3||0' },
    refreshAll: async () => { c.__refreshed = (c.__refreshed || 0) + 1; },
    render: () => { c.__renders = (c.__renders || 0) + 1; },
    $: () => ({ classList: { contains: () => true } }),   // 默认 overlay 是 hidden（不忙）
  }, over));
  return c;
}

module.exports = async function run() {
  section('忙的时候不打扰');
  let c = setup({ document: Object.assign(setupDoc(), { querySelector: sel => (sel === '.modal-mask' ? {} : null) }) });
  ok(c.pollBusy() === true, '有弹窗 → 忙');
  ok(await c.pollOnce() === false && !c.__refreshed, '弹窗开着时不刷新');

  c = setup({ $: () => ({ classList: { contains: () => false } }) });   // overlay 可见
  ok(c.pollBusy() === true, '全屏动画/宝可梦卡牌 → 忙');
  ok(await c.pollOnce() === false && !c.__refreshed, '看卡牌时不被刷新打断');

  c = setup({ document: Object.assign(setupDoc(), { activeElement: { tagName: 'TEXTAREA' } }) });
  ok(c.pollBusy() === true, '正在输入 → 忙');
  c = setup({ document: Object.assign(setupDoc(), { querySelector: sel => (sel === '.dragging' ? {} : null) }) });
  ok(c.pollBusy() === true, '正在拖动排序 → 忙');
  c = setup({
    document: Object.assign(setupDoc(), {
      querySelectorAll: sel => (sel === '#app input, #app textarea' ? [{ value: '50' }] : []),
    }),
  });
  ok(c.pollBusy() === true, '表单里有没提交的内容 → 忙');
  c = setup({
    document: Object.assign(setupDoc(), {
      querySelectorAll: sel => (sel === '#app input, #app textarea' ? [{ value: '  ' }] : []),
    }),
  });
  ok(c.pollBusy() === false, '只有空白的输入框 → 不忙');
  c = setup();
  ok(c.pollBusy() === false, '空页面 → 不忙');

  section('页面不可见 / 演示模式 / 关闭轮询');
  c = setup({ document: Object.assign(setupDoc(), { visibilityState: 'hidden' }) });
  ok(await c.pollOnce() === false && !c.__refreshed, '切到后台不拉数据');
  c = setup({ DEMO_ACTIVE: true });
  ok(await c.pollOnce() === false, '演示模式（数据只在本机）不轮询');
  c = setup({ CONFIG: { POLL_SECONDS: 0 } });
  ok(c.pollIntervalMs() === 0 && await c.pollOnce() === false, 'POLL_SECONDS=0 → 关闭轮询');

  section('数据版本对比');
  c = setup();
  ok(await c.pollOnce() === false && !c.__refreshed, '第一次只记基线，不刷');
  ok(c.pollRev === '1|2|3||0', '基线已记录');
  ok(await c.pollOnce() === false && !c.__refreshed, '版本没变 → 不刷');
  c.DB.getRev = async () => '1|2|3||rev-1';
  ok(await c.pollOnce() === true, '版本变了 → 刷新');
  ok(c.__refreshed === 1 && c.__renders === 1, 'refreshAll + render 各一次');
  ok(await c.pollOnce() === false && c.__refreshed === 1, '再探一次不会重复刷');

  section('刷新时保住"现场"（滚动位置 + 折叠面板）');
  c = setup();
  c.window.scrollY = 640;
  c.__details = [{ open: true }, { open: false }];   // 孩子展开了「规则小抄」
  c.document.querySelectorAll = sel => {
    if (sel === 'details') return c.__details;
    if (sel === '#app input, #app textarea') return [];
    return [];
  };
  c.render = () => {
    c.__renders = (c.__renders || 0) + 1;
    c.window.scrollY = 0;                       // 模拟重画后回到顶部
    c.__details = [{ open: false }, { open: false }];   // 模拟折叠面板被合上
  };
  c.pollRev = 'old';
  await c.pollOnce();
  ok(c.window.scrollY === 640, '重画后滚动位置被恢复');
  ok(c.__details[0].open === true && c.__details[1].open === false, '展开中的折叠面板保持展开');

  section('探测出错不能把页面搞崩');
  c = setup();
  c.DB.getRev = async () => { throw new Error('网络挂了'); };
  ok(await c.pollOnce() === false, 'getRev 抛错 → 静默返回 false');
  ok(!c.__refreshed, '不刷新');
};

function setupDoc() {
  return { querySelector: () => null, querySelectorAll: () => [], visibilityState: 'visible', activeElement: null, addEventListener: () => {} };
}
