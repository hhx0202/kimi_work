// 宝可梦排序：捕获顺序（默认）/ 捕获倒序 / 编号顺序 / 属性；选择存本机（不跨设备）
const { makeCtx, ok, section } = require('./harness');

const FNS = ['lsGet', 'lsSet', 'pmSortMode', 'setPmSort', 'pmSortList'];

function setup(stored) {
  const c = makeCtx(FNS, {
    TYPE_THEME: { normal: {}, fire: {}, water: {}, electric: {}, grass: {} },
    pmType: no => ({ 1: 'grass', 4: 'fire', 7: 'water', 25: 'electric' }[no] || 'normal'),
    PM_SORT_OPTS: [['capture', '捕获顺序', ''], ['capture_desc', '捕获倒序', ''], ['dex', '编号顺序', ''], ['type', '属性', '']],
  });
  if (stored !== undefined) c.localStorage.setItem(c.LK('pm_sort'), JSON.stringify(stored));
  c.S.pokemons = [
    { id: 10, pokedex_no: 4, caught_at: '2026-10-20T09:00:00Z' },   // 火
    { id: 11, pokedex_no: 1, caught_at: '2026-10-19T18:30:00Z' },   // 草
    { id: 12, pokedex_no: 25, caught_at: '2026-10-21T07:15:00Z' },  // 电
    { id: 13, pokedex_no: 7, caught_at: null },                     // 水，老数据没时间
  ];
  return c;
}
const ids = list => list.map(p => p.id);

module.exports = async function run() {
  section('四种排序');
  let c = setup();
  ok(c.pmSortMode() === 'capture', '默认 = 捕获顺序');
  ok(ids(c.pmSortList()).join() === '11,10,12,13', '捕获顺序：早→晚，缺时间排最后');
  c = setup('capture_desc');
  ok(ids(c.pmSortList()).join() === '12,10,11,13', '捕获倒序：晚→早，缺时间排最后');
  c = setup('dex');
  ok(ids(c.pmSortList()).join() === '11,10,13,12', '编号顺序：#001→#004→#007→#025');
  c = setup('type');
  ok(ids(c.pmSortList()).join() === '10,13,12,11', '属性：按 TYPE_THEME 顺序（火→水→电→草）');

  section('存储与兼容');
  c = setup();
  c.setPmSort('dex');
  ok(c.pmSortMode() === 'dex', '选择立即生效');
  ok(c.localStorage.getItem(c.LK('pm_sort')) === JSON.stringify('dex'), '存在本机 localStorage');
  ok(c.SHARED.pm_sort === undefined, '不写共享存储（不跨设备）');
  for (const legacy of ['default', 'asc', 'desc', '乱写的']) {
    c = setup(legacy);
    ok(c.pmSortMode() === 'capture', `旧值/脏值 "${legacy}" → 回退捕获顺序`);
  }

  section('不改原数组');
  c = setup('capture_desc');
  const before = ids(c.S.pokemons).join();
  c.pmSortList();
  ok(ids(c.S.pokemons).join() === before, '排序返回副本，S.pokemons 顺序不被改动');
};
