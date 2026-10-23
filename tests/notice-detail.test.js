// 家长消息的明细行：一次确认了一堆积分时，孩子端要能逐条看到「哪项 + 多少」，
// 而不是只有一个总分（否则和任务列表对不上，看起来像少给了分）
const { makeCtx, ok, section } = require('./harness');

const FNS = ['escHTML', 'pointReasonLabel', 'loadNotices', 'saveNotices', 'noticeTime', 'pushNotice', 'noticesHTML'];

const META = {
  ball: { ic: '🔴', cls: 'ball', tag: '精灵球' },
  minus: { ic: '➖', cls: 'minus', tag: '扣分' },
  points: { ic: '🏅', cls: 'points', tag: '积分到账' },
  bonus: { ic: '🎁', cls: 'bonus', tag: '奖励积分' },
};

function setup() {
  const store = {};                       // 模拟 settings 表里的 notices
  const c = makeCtx(FNS, {
    NOTICE_META: META,
    NOTICE_MAX: 20,
    SHARED: {},
    sharedGet: (k, dflt) => (store[k] === undefined ? dflt : JSON.parse(store[k])),
    sharedSet: (k, v) => { store[k] = JSON.stringify(v); },
    // pushNotice 末尾会在孩子端任务页直接重绘，这里简化掉
    renderTasks: () => {},
  });
  c.__store = store;
  return c;
}

module.exports = async function run() {
  section('pushNotice 存明细行（最多 8 行，多的折叠成 more）');
  let c = setup();
  c.pushNotice('points', '家长确认了 3 项，共 +15 积分！', '现在一共有 15 分', [
    { title: '跳绳100个', pts: 5 },
    { title: '晨读英语', pts: 5 },
    { title: '必做全清', pts: 5 },
  ]);
  let list = c.loadNotices();
  ok(list.length === 1, '存下 1 条通知');
  ok(list[0].items.length === 3, '3 行明细都在');
  ok(list[0].items[2].title === '必做全清' && list[0].items[2].pts === 5, '全清奖也列进去了（它不挂任务）');
  ok(list[0].more === undefined, '没超过 8 行不折叠');

  c = setup();
  c.pushNotice('points', '家长确认了 12 项，共 +60 积分！', '', Array.from({ length: 12 }, (_, i) => ({ title: `任务${i + 1}`, pts: 5 })));
  list = c.loadNotices();
  ok(list[0].items.length === 8, '只存前 8 行（避免通知卡长到要滑半天）');
  ok(list[0].more === 4, '折叠提示「还有 4 项」');

  section('没有明细 / 非法数据时不硬塞');
  c = setup();
  c.pushNotice('bonus', '家长额外奖励你 10 积分！', '现在一共有 30 分');
  list = c.loadNotices();
  ok(!list[0].items, '单笔通知不带 items');
  c.pushNotice('points', '空的', '', []);
  c.pushNotice('points', '脏的', '', [{ pts: 5 }, null, { title: '  ' }]);
  ok(!c.loadNotices()[1].items && !c.loadNotices()[2].items, '空数组 / 无标题的行都不生成 items');

  section('noticesHTML 渲染明细：任务名 + 分数，负分换色，超出的写「还有 N 项」');
  c = setup();
  c.pushNotice('points', '家长确认了 3 项，共 +12 积分！', '现在一共有 12 分', [
    { title: '跳绳100个', pts: 5 },
    { title: '必做全清', pts: 5 },
    { title: '补卡扣分', pts: -2 },
  ]);
  let html = c.noticesHTML();
  ok(html.includes('notice-items'), '渲染出明细列表');
  ok(html.includes('跳绳100个') && html.includes('+5'), '任务名和分数都在');
  ok(html.includes('必做全清'), '全清奖也在明细里');
  ok(html.includes('class="minus">-2'), '负分带 minus 样式');
  ok(html.includes('12 分') || html.includes('现在一共有 12 分'), '副标题（当前余额）保留');

  c = setup();
  c.pushNotice('points', '家长确认了 12 项，共 +60 积分！', '', Array.from({ length: 12 }, (_, i) => ({ title: `任务${i + 1}`, pts: 5 })));
  html = c.noticesHTML();
  ok(html.includes('…还有 4 项'), '超出 8 行的部分有提示');

  section('老通知（没有 items）照旧显示，不会空一块');
  c = setup();
  c.sharedSet('notices', [{ id: 'old_1', type: 'points', text: '家长确认了 2 项任务，共 +10 积分！', sub: '含：A、B', at: Date.now() }]);
  html = c.noticesHTML();
  ok(!html.includes('notice-items'), '不渲染明细块');
  ok(html.includes('共 +10 积分'), '正文照旧');

  section('明细里的文字会被转义（任务名带尖括号不会破坏结构）');
  c = setup();
  c.pushNotice('points', '确认了 1 项', '', [{ title: '<img src=x>', pts: 5 }]);
  html = c.noticesHTML();
  ok(!html.includes('<img src=x>') && html.includes('&lt;img src=x&gt;'), '任务名已转义');

  section('pointReasonLabel：内部 reason 转成孩子看得懂的话');
  ok(c.pointReasonLabel('完成:跳绳100个') === '跳绳100个', '「完成:xxx」→ 任务名');
  ok(c.pointReasonLabel('必选全清_2026-10-23') === '必做全清', '必做全清去掉日期');
  ok(c.pointReasonLabel('可选全清_2026-10-23') === '选做全清', '选做全清去掉日期');
  ok(c.pointReasonLabel('多日完成奖:阅读计划') === '多日任务完成 · 阅读计划', '多日完成奖带出任务名');
  ok(c.pointReasonLabel('家长奖励') === '家长奖励', '未知 reason 原样返回');
  ok(c.pointReasonLabel('') === '积分', '空值兜底');
};
