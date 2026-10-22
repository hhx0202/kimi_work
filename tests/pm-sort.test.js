// 宝可梦排序：捕获顺序（默认）/ 捕获倒序 / 编号顺序 / 属性 / 进化阶段升降序；选择存本机（不跨设备）
const { makeCtx, ok, section } = require('./harness');

const FNS = ['lsGet', 'lsSet', 'pmSortMode', 'setPmSort', 'pmSortList'];
// 进化阶段：0 基础 / 1 一阶 / 2 二阶（真实 evoStage 由 pokemon-data.js 提供，这里给最小替身）
const STAGE = { 1: 0, 2: 1, 3: 2, 4: 0, 7: 0, 25: 0, 26: 1 };

function setup(stored) {
  const c = makeCtx(FNS, {
    TYPE_THEME: { normal: {}, fire: {}, water: {}, electric: {}, grass: {} },
    pmType: no => ({ 1: 'grass', 4: 'fire', 7: 'water', 25: 'electric' }[no] || 'normal'),
    pkNoOf: pm => (STAGE[pm.pokedex_no] === undefined ? null : Number(pm.pokedex_no)),
    evoStage: no => STAGE[no] || 0,
    PM_SORT_OPTS: [['capture', '捕获顺序', ''], ['capture_desc', '捕获倒序', ''], ['dex', '编号顺序', ''], ['type', '属性', ''],
      ['stage', '阶段升序', ''], ['stage_desc', '阶段降序', '']],
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
// 阶段排序专用：混着三档形态，外加一条编号查不到的老数据
function setupStage(stored) {
  const c = setup(stored);
  c.S.pokemons = [
    { id: 20, pokedex_no: 3, caught_at: '2026-10-01T10:00:00Z' },   // 二阶
    { id: 21, pokedex_no: 2, caught_at: '2026-10-02T10:00:00Z' },   // 一阶
    { id: 22, pokedex_no: 1, caught_at: '2026-10-03T10:00:00Z' },   // 基础 #001
    { id: 23, pokedex_no: 7, caught_at: '2026-10-04T10:00:00Z' },   // 基础 #007
    { id: 24, pokedex_no: null, name: '名字也查不到', caught_at: '2026-10-05T10:00:00Z' },
  ];
  return c;
}
const ids = list => list.map(p => p.id);

module.exports = async function run() {
  section('四种基础排序');
  let c = setup();
  ok(c.pmSortMode() === 'capture', '默认 = 捕获顺序');
  ok(ids(c.pmSortList()).join() === '11,10,12,13', '捕获顺序：早→晚，缺时间排最后');
  c = setup('capture_desc');
  ok(ids(c.pmSortList()).join() === '12,10,11,13', '捕获倒序：晚→早，缺时间排最后');
  c = setup('dex');
  ok(ids(c.pmSortList()).join() === '11,10,13,12', '编号顺序：#001→#004→#007→#025');
  c = setup('type');
  ok(ids(c.pmSortList()).join() === '10,13,12,11', '属性：按 TYPE_THEME 顺序（火→水→电→草）');

  section('进化阶段升序 / 降序');
  c = setupStage('stage');
  ok(ids(c.pmSortList()).join() === '22,23,21,20,24', '阶段升序：基础(按编号)→一阶→二阶，查不到编号的排最后');
  c = setupStage('stage_desc');
  ok(ids(c.pmSortList()).join() === '20,21,22,23,24', '阶段降序：二阶→一阶→基础，同阶段内按编号，查不到编号的排最后');
  c = setup('stage_desc');
  ok(c.pmSortMode() === 'stage_desc', 'stage_desc 是合法值（不回退）');

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
  c = setupStage('stage');
  const before2 = ids(c.S.pokemons).join();
  c.pmSortList();
  ok(ids(c.S.pokemons).join() === before2, '阶段排序也不改动 S.pokemons');
};
