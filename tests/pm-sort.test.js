// 宝可梦排序：默认 / 获取时间正序 / 逆序，按钮循环切换
const { makeCtx, ok, section } = require('./harness');

const FNS = ['sharedGet', 'sharedSet', 'pmSortMode', 'cyclePmSort', 'pmSortList'];

function setup(shared = {}) {
  const c = makeCtx(FNS, { SHARED: Object.assign({}, shared) });
  c.S.pokemons = [
    { id: 10, pokedex_no: 1, caught_at: '2026-10-20T09:00:00Z' },
    { id: 11, pokedex_no: 4, caught_at: '2026-10-19T18:30:00Z' },
    { id: 12, pokedex_no: 7, caught_at: '2026-10-21T07:15:00Z' },
    { id: 13, pokedex_no: 25, caught_at: null },   // 老数据没有获取时间
  ];
  return c;
}
const ids = list => list.map(p => p.id);

module.exports = async function run() {
  section('三种排序');
  let c = setup();
  ok(c.pmSortMode() === 'default', '默认模式');
  ok(ids(c.pmSortList()).join() === '13,11,10,12', '默认：按获取先后（缺时间的排最前，按 id 兜底）');
  c = setup({ pm_sort: JSON.stringify('asc') });
  ok(ids(c.pmSortList()).join() === '11,10,12,13', '时间正序（早→晚）');
  c = setup({ pm_sort: JSON.stringify('desc') });
  ok(ids(c.pmSortList()).join() === '12,10,11,13', '时间倒序（晚→早）');
  c = setup({ pm_sort: JSON.stringify('乱写的值') });
  ok(c.pmSortMode() === 'default', '脏数据回退到默认');

  section('按钮循环切换');
  c = setup();
  c.cyclePmSort();
  ok(c.pmSortMode() === 'asc', '默认 → 正序');
  ok(c.SHARED.pm_sort === JSON.stringify('asc'), '选择写进共享存储（跨设备一致）');
  ok((c.__toasts || []).some(t => t.includes('正序')), '有提示');
  c.cyclePmSort();
  ok(c.pmSortMode() === 'desc', '正序 → 倒序');
  c.cyclePmSort();
  ok(c.pmSortMode() === 'default', '倒序 → 回到默认');

  section('不改原数组');
  c = setup({ pm_sort: JSON.stringify('desc') });
  const before = ids(c.S.pokemons).join();
  c.pmSortList();
  ok(ids(c.S.pokemons).join() === before, '排序返回副本，S.pokemons 顺序不被改动');
};
