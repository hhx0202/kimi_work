// 跨设备共享的小数据：存 settings 表的键值，本机老数据自动搬家
const { makeCtx, ok, section, APP_SRC, DB_SRC } = require('./harness');

const FNS = ['sharedGet', 'sharedSet', 'migrateLocalToShared', 'sharedLeadId', 'setSharedLead', 'loadNotices', 'saveNotices'];

function setup(over = {}) {
  const wrote = [];
  const db = { setSettings: async obj => { wrote.push(obj); }, today: () => '2026-10-21' };
  const c = makeCtx(FNS, Object.assign({ DB: db, __wrote: wrote }, over));
  return c;
}

module.exports = async function run() {
  section('sharedGet / sharedSet');
  let c = setup();
  ok(c.sharedGet('quick_tasks', 'DEF') === 'DEF', '共享里没有 → 返回默认值');
  c.sharedSet('quick_tasks', [{ title: '语文作业' }]);
  ok(JSON.stringify(c.sharedGet('quick_tasks', [])) === JSON.stringify([{ title: '语文作业' }]), '写进内存镜像后立刻可读');
  ok(c.__wrote.length === 0, '写库进了后台（bgWrite 未执行）');
  c.SHARED.bad = '{不是JSON';
  ok(c.sharedGet('bad', 'DEF') === 'DEF', '坏 JSON 不炸，回退默认值');
  c.SHARED.empty = '';
  ok(c.sharedGet('empty', 'DEF') === 'DEF', '空串视为没有值');
  c.sharedSet('lead', 12);
  ok(c.sharedLeadId() === 12, '出战宝可梦读写正常');
  c.sharedSet('lead', null);
  ok(c.sharedLeadId() === null, '清空后返回 null');

  section('本机老数据搬家（一次性）');
  c = setup();
  c.localStorage.setItem('km_quick_tasks', JSON.stringify([{ title: '老的标签' }]));
  c.localStorage.setItem('km_categories', JSON.stringify(['校内作业']));
  c.localStorage.setItem('km_lead', '7');
  c.migrateLocalToShared();
  ok(JSON.stringify(c.sharedGet('quick_tasks', [])) === JSON.stringify([{ title: '老的标签' }]), '常用任务搬到了共享');
  ok(JSON.stringify(c.sharedGet('categories', [])) === JSON.stringify(['校内作业']), '类别搬到了共享');
  ok(c.sharedLeadId() === 7, '出战宝可梦搬到了共享');
  ok(c.__wrote.length === 1 && Object.keys(c.__wrote[0]).sort().join() === 'categories,lead,quick_tasks', '一次批量上传，不逐个写');
  const wrote2 = [];
  c.__wrote = wrote2;
  c.migrateLocalToShared();
  ok(wrote2.length === 0, '共享里已有值 → 不再重复上传（不会覆盖别的设备的改动）');
  c = setup();
  c.SHARED.notices = JSON.stringify([{ id: 'x' }]);
  c.localStorage.setItem('km_notices', JSON.stringify([{ id: 'old' }]));
  c.migrateLocalToShared();
  ok(JSON.stringify(c.sharedGet('notices', [])) === JSON.stringify([{ id: 'x' }]), '共享里已有消息 → 保留共享，不被本机老值覆盖');

  section('消息卡走共享存储');
  c = setup();
  c.saveNotices([{ id: '1', text: '家长确认了任务' }]);
  ok(JSON.stringify(c.loadNotices()) === JSON.stringify([{ id: '1', text: '家长确认了任务' }]), '写入后立即能读（孩子端下次刷新就能看到）');
  c.saveNotices(Array.from({ length: 30 }).map((_, i) => ({ id: String(i), text: 'x' })));
  ok(c.loadNotices().length === 20, '只保留最近 20 条');

  section('源码自检：该共享的都共享了，该留本地的还留本地');
  for (const k of ['quick_tasks', 'categories', 'categories_hidden']) {
    ok(!APP_SRC.includes(`lsGet(K_${k === 'quick_tasks' ? 'QUICK' : k === 'categories' ? 'CATS' : 'CATS_HIDE'}`), `${k} 不再直接读 localStorage`);
  }
  ok(!APP_SRC.includes("lsGet(K_QUICK"), '常用任务不再走 localStorage 读');
  ok(!APP_SRC.includes("lsSet(K_QUICK"), '常用任务不再走 localStorage 写');
  ok(!APP_SRC.includes("lsGet(LK('notices')"), '消息卡不再走 localStorage 读');
  ok(!APP_SRC.includes("lsSet(LK('notices')"), '消息卡不再走 localStorage 写');
  ok(!APP_SRC.includes("lsSet(K_STREAK_CLAIM"), '领奖标记不再走 localStorage 写');
  ok(APP_SRC.includes("sharedGet('streak_claim'"), '领奖标记走共享存储');
  ok(APP_SRC.includes("['notices', 'lead', 'streak_claim']") || APP_SRC.includes('notices: LK(\'notices\')'), '迁移映射里包含消息卡/出战/领奖标记');
  ok(APP_SRC.includes("localStorage.getItem(LK('lead'))"), '出战宝可梦保留本机初值（首屏不闪烁）');
  ok(APP_SRC.includes("lsSet(LK('errors')"), '错误日志仍留本地（跨设备同步会自激）');
  ok(APP_SRC.includes("localStorage.getItem(LK('parent_authed'))"), '家长免密标记仍留本地（安全语义）');
  ok(DB_SRC.includes('...(lsGet(P + \'settings\', {}) || {}), ...obj'), 'demo 的 setSettings 改成按 key 合并（否则单键写会冲掉别的设置）');
};
