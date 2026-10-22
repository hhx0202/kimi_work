// 闪耀继承：闪耀卡用在基础形态上之后，进化出来的形态也直接是闪耀形态
// 规则（shinyLineageNo / willInheritShiny）：
//   更早的形态已经有 ✨ 卡 → 进化结果自动是 ✨
//   目标形态已经有 ✨ 卡 → 不再重复生成（保持普通卡，同族只留一张 ✨）
const { makeCtx, ok, section } = require('./harness');

const FNS = ['evoAncestors', 'evoTargets', 'hasNextEvo', 'evoStage', 'hasShinyCopy', 'evoNeedExp',
  'shinyLineageNo', 'willInheritShiny', 'canEvolve', 'addShinyCopy', 'evolvePm'];

const PK = {
  1: { no: 1, name: '妙蛙种子', e: 2 },
  2: { no: 2, name: '妙蛙草', e: 3 },
  3: { no: 3, name: '妙蛙花' },
};

function setup(pokemons) {
  const seen = [];
  const c = makeCtx(FNS, {
    CONFIG: { EVO_EXP_1: 300, EVO_EXP_2: 500, SHINY_EXP: 100 },
    PK_BY_NO: PK,
    PK_EVOLVE_FROM: { 2: 1, 3: 2 },
    DB: {
      today: () => '2026-10-22',
      updatePokemon: async (id, patch) => { seen.push({ id, patch }); },
      addPokemon: async ({ pokedex_no, shiny }) => ({ id: 999, pokedex_no, shiny, name: PK[pokedex_no].name, exp: 0 }),
    },
    showEvolve: async (fromNo, toNo, shiny) => { c.__evo = { fromNo, toNo, shiny }; },
  });
  c.S.pokemons = pokemons;
  c.__seen = seen;
  return c;
}

module.exports = async function run() {
  section('闪耀血统判定');
  let c = setup([
    { id: 1, pokedex_no: 1, name: '妙蛙种子', shiny: false, exp: 300 },
    { id: 2, pokedex_no: 1, name: '✨妙蛙种子', shiny: true, exp: 0 },
  ]);
  ok(c.shinyLineageNo(1) === false, '基础形态自己没有「更早的形态」，不算血统');
  ok(c.shinyLineageNo(2) === true, '一阶形态：前置的基础形态有 ✨ 卡 → 有血统');
  ok(c.shinyLineageNo(3) === true, '二阶形态也顺着链继承血统');
  ok(c.willInheritShiny(c.S.pokemons[0], 2) === true, '普通基础卡进化出一阶 → 会继承闪耀');
  ok(c.canEvolve(c.S.pokemons[0]).inherit === true, '详情页能提前提示「进化后直接是闪耀形态」');

  section('进化落库（基础 → 一阶）');
  await c.evolvePm(c.S.pokemons[0]);
  const patch = c.__seen[0] && c.__seen[0].patch;
  ok(!!patch, '调用了 DB.updatePokemon');
  ok(patch.pokedex_no === 2, '进化到 #002 妙蛙草');
  ok(patch.shiny === true, '落库时就写成闪耀卡（不是只在内存里）');
  ok(patch.name === '✨妙蛙草', '名字带 ✨ 前缀');
  ok(c.S.pokemons[0].shiny === true, '内存里的个体也变成闪耀');
  ok(c.__evo && c.__evo.shiny === true, '进化动画用闪耀形态的图');

  section('不会往前继承');
  c = setup([
    { id: 1, pokedex_no: 1, name: '妙蛙种子', shiny: false, exp: 300 },
    { id: 3, pokedex_no: 3, name: '✨妙蛙花', shiny: true, exp: 0 },
  ]);
  await c.evolvePm(c.S.pokemons[0]);
  ok(c.__seen[0].patch.shiny === false, '✨ 只在后面的形态 → 基础进化不做成闪耀（避免倒着传染）');
  ok(c.__evo.shiny === false, '动画也用普通形态');
  ok(c.S.pokemons[0].name === '妙蛙草', '名字不带 ✨');

  section('目标已有 ✨ 卡不重复生成');
  c = setup([
    { id: 1, pokedex_no: 1, name: '妙蛙种子', shiny: false, exp: 300 },
    { id: 2, pokedex_no: 2, name: '✨妙蛙草', shiny: true, exp: 0 },
  ]);
  await c.evolvePm(c.S.pokemons[0]);
  ok(c.__seen[0].patch.shiny === false, '一阶已经有 ✨ 卡 → 这次进化保持普通卡，不再多一张 ✨');

  section('闪耀卡用在基础形态 = 立刻有血统');
  c = setup([{ id: 1, pokedex_no: 1, name: '妙蛙种子', shiny: false, exp: 0 }]);
  const copy = await c.addShinyCopy(c.S.pokemons[0]);
  ok(copy.shiny === true, 'addShinyCopy 额外生成一张 ✨ 卡');
  ok(c.S.pokemons.filter(p => p.pokedex_no === 1).length === 2, '普通卡保留 + 多一张 ✨ 卡');
  ok(c.shinyLineageNo(2) === true, '这条链从此有闪耀血统');
};
