// ============================================================
// 数据层 - 双模式
// demo      = 本地试玩：localStorage 模拟，无需数据库，先看效果
// supabase  = 真实模式：连接 Supabase，部署远程时用
// 两种模式接口完全一致，界面代码不区分
// ============================================================

const DB = (() => {
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const nowISO = () => new Date().toISOString();

  // 演示模式隔离：km_demo 标志激活时，全部数据走 kmd_ 前缀，与真实数据完全隔离
  const DEMO_ACTIVE = (() => { try { return localStorage.getItem('km_demo') === '1'; } catch { return false; } })();
  const P = DEMO_ACTIVE ? 'kmd_' : 'km_';

  // ==========================================================
  // 模式一：demo（localStorage 模拟）
  // ==========================================================
  const K = { tasks: P + 'tasks', logs: P + 'logs', pms: P + 'pokemons', pts: P + 'points', items: P + 'items', wallet: P + 'wallet' };
  const K_SEED_VER = P + 'seedver';
  const SEED_VER = 8;   // 演示数据版本：升版本时会给已有的演示数据补一次测试内容 / 修一次历史数据

  // 演示用宝可梦：覆盖「基础 / 一阶 / 最终 / 无进化链 / 闪耀形态 / 临进化」各阶段，方便测试
  const DEMO_PMS = [
    [1,   100, false],   // 妙蛙种子  基础形态 100/300
    [4,   280, false],   // 小火龙    差 20 分就能进化（测「刚好进化」）
    [5,    30, false],   // 火恐龙    一阶形态
    [9,    60, false],   // 水箭龟    最终形态，40 分后进入闪耀形态
    [7,     0, false],   // 杰尼龟    刚抓到的样子
    [25,    0, false],   // 皮卡丘
    [25,    0, true ],   // ✨皮卡丘   整条进化链闪耀形态
    [126,  70, false],   // 鸭嘴火兽  无进化链（70/100 可测进入闪耀形态）
  ];
  // 额外的一批：让图鉴/队伍一打开就热闹（各属性、各阶段、稀有与传说都有）
  const DEMO_PMS_EXTRA = [
    [3,     0, false],   // 妙蛙花    最终形态
    [6,   150, false],   // 喷火龙    最终形态，快到闪耀
    [12,   40, false],   // 巴大蝶
    [65,   90, false],   // 胡地
    [94,    0, false],   // 耿鬼
    [131,  60, false],   // 拉普拉斯
    [133,   0, false],   // 伊布      分支进化（水/雷/火）
    [143,   0, false],   // 卡比兽
    [149, 120, false],   // 快龙
    [150,   0, true ],   // ✨超梦     传说 + 闪耀
    [95,    0, false],   // 大岩蛇    岩石/地面
    [68,   50, false],   // 怪力      格斗
  ];
  // 一大批演示宝可梦（2026-10-23 扩充）：图鉴大部分点亮，覆盖 15 种属性、0/1/2 阶、各种经验状态。
  // 规则：闪耀只给「没有后续进化」的最终形态（给基础形态会让整条进化链被判定成闪耀血统，
  //       兄弟形态的普通卡就变成「已拥有闪耀形态」不可点亮），大约一半最终形态带 ✨；
  //       火伊布(136) 故意留空，用来测「伊布分支没集齐 → 重新回到捕捉池」；
  //       捕捉池刻意留一批可抓，别把 79 个基础形态全塞满。
  const DEMO_PMS_MORE = [
    [ 10, 165, false],   // 绿毛虫    虫   0阶  → 铁甲蛹
    [ 11,   0, false],   // 铁甲蛹    虫   1阶  → 巴大蝶
    [ 13, 300, false],   // 独角虫    虫   0阶  → 铁壳蛹
    [ 14, 275, false],   // 铁壳蛹    虫   1阶  → 大针蜂
    [ 15,   0, false],   // 大针蜂    虫   2阶  最终形态
    [ 16,   0, false],   // 波波      普通 0阶  → 比比鸟
    [ 17, 275, false],   // 比比鸟    普通 1阶  → 大比鸟
    [ 18,   0, true ],   // 大比鸟    普通 2阶  ✨闪耀  最终形态
    [ 19, 300, false],   // 小拉达    普通 0阶  → 拉达
    [ 20,  60, false],   // 拉达      普通 1阶  最终形态
    [ 21,   0, false],   // 烈雀      普通 0阶  → 大嘴雀
    [ 22,   0, true ],   // 大嘴雀    普通 1阶  ✨闪耀  最终形态
    [ 23, 165, false],   // 阿柏蛇    毒   0阶  → 阿柏怪
    [ 24,   0, false],   // 阿柏怪    毒   1阶  最终形态
    [ 26,   0, true ],   // 雷丘      电   1阶  ✨闪耀  最终形态
    [ 27, 165, false],   // 穿山鼠    地面 0阶  → 穿山王
    [ 28,   0, false],   // 穿山王    地面 1阶  最终形态
    [ 29,   0, false],   // 尼多兰    毒   0阶  → 尼多娜
    [ 30, 275, false],   // 尼多娜    毒   1阶  → 尼多后
    [ 31,   0, true ],   // 尼多后    毒   2阶  ✨闪耀  最终形态
    [ 32, 300, false],   // 尼多朗    毒   0阶  → 尼多力诺
    [ 33, 275, false],   // 尼多力诺  毒   1阶  → 尼多王
    [ 34,   0, false],   // 尼多王    毒   2阶  最终形态
    [ 35,   0, false],   // 皮皮      妖精 0阶  → 皮可西
    [ 36,   0, true ],   // 皮可西    妖精 1阶  ✨闪耀  最终形态
    [ 37,   0, false],   // 六尾      火   0阶  → 九尾
    [ 38, 100, false],   // 九尾      火   1阶  最终形态
    [ 43, 165, false],   // 走路草    草   0阶  → 臭臭花
    [ 44,   0, false],   // 臭臭花    草   1阶  → 霸王花
    [ 45,   0, true ],   // 霸王花    草   2阶  ✨闪耀  最终形态
    [ 46, 165, false],   // 派拉斯    虫   0阶  → 派拉斯特
    [ 47,   0, false],   // 派拉斯特  虫   1阶  最终形态
    [ 50, 300, false],   // 地鼠      地面 0阶  → 三地鼠
    [ 51,   0, true ],   // 三地鼠    地面 1阶  ✨闪耀  最终形态
    [ 54,   0, false],   // 可达鸭    水   0阶  → 哥达鸭
    [ 55,   0, false],   // 哥达鸭    水   1阶  最终形态
    [ 56, 165, false],   // 猴怪      格斗 0阶  → 火爆猴
    [ 57,   0, true ],   // 火爆猴    格斗 1阶  ✨闪耀  最终形态
    [ 58, 300, false],   // 卡蒂狗    火   0阶  → 风速狗
    [ 59,  60, false],   // 风速狗    火   1阶  最终形态
    [ 60,   0, false],   // 蚊香蝌蚪  水   0阶  → 蚊香君
    [ 61,   0, false],   // 蚊香君    水   1阶  → 蚊香泳士
    [ 62,   0, true ],   // 蚊香泳士  水   2阶  ✨闪耀  最终形态
    [ 63,   0, false],   // 凯西      超能 0阶  → 勇吉拉
    [ 64, 500, false],   // 勇吉拉    超能 1阶  → 胡地
    [ 66, 165, false],   // 腕力      格斗 0阶  → 豪力
    [ 67,   0, false],   // 豪力      格斗 1阶  → 怪力
    [ 69,   0, false],   // 喇叭芽    草   0阶  → 口呆花
    [ 70, 275, false],   // 口呆花    草   1阶  → 大食花
    [ 71,   0, false],   // 大食花    草   2阶  最终形态
    [ 72, 300, false],   // 玛瑙水母  水   0阶  → 毒刺水母
    [ 73,   0, true ],   // 毒刺水母  水   1阶  ✨闪耀  最终形态
    [ 74,   0, false],   // 小拳石    岩石 0阶  → 隆隆石
    [ 75,   0, false],   // 隆隆石    岩石 1阶  → 隆隆岩
    [ 76,  60, false],   // 隆隆岩    岩石 2阶  最终形态
    [ 77,   0, false],   // 小火马    火   0阶  → 烈焰马
    [ 78,   0, true ],   // 烈焰马    火   1阶  ✨闪耀  最终形态
    [ 79, 165, false],   // 呆呆兽    水   0阶  → 呆壳兽
    [ 81,   0, false],   // 小磁怪    电   0阶  → 三合一磁怪
    [ 82,   0, false],   // 三合一磁怪电   1阶  最终形态
    [ 85,   0, true ],   // 嘟嘟利    普通 1阶  ✨闪耀  最终形态
    [ 89,   0, false],   // 臭臭泥    毒   1阶  最终形态
    [ 92, 300, false],   // 鬼斯      幽灵 0阶  → 鬼斯通
    [ 93, 275, false],   // 鬼斯通    幽灵 1阶  → 耿鬼
    [ 96,   0, false],   // 催眠貘    超能 0阶  → 引梦貘人
    [ 97,   0, true ],   // 引梦貘人  超能 1阶  ✨闪耀  最终形态
    [100, 165, false],   // 雷电球    电   0阶  → 顽皮雷弹
    [101,   0, false],   // 顽皮雷弹  电   1阶  最终形态
    [102, 300, false],   // 蛋蛋      草   0阶  → 椰蛋树
    [103,   0, true ],   // 椰蛋树    草   1阶  ✨闪耀  最终形态
    [104,   0, false],   // 卡拉卡拉  地面 0阶  → 嘎啦嘎啦
    [105,   0, false],   // 嘎啦嘎啦  地面 1阶  最终形态
    [106,   0, true ],   // 飞腿郎    格斗 0阶  ✨闪耀  最终形态
    [107,   0, false],   // 快拳郎    格斗 0阶  最终形态
    [110,   0, true ],   // 双弹瓦斯  毒   1阶  ✨闪耀  最终形态
    [112,  60, false],   // 铁甲暴龙  地面 1阶  最终形态
    [114,   0, true ],   // 蔓藤怪    草   0阶  ✨闪耀  最终形态
    [122,   0, false],   // 魔墙人偶  超能 0阶  最终形态
    [123,   0, true ],   // 飞天螳螂  虫   0阶  ✨闪耀  最终形态
    [124,   0, false],   // 迷唇姐    冰   0阶  最终形态
    [125,   0, true ],   // 电击兽    电   0阶  ✨闪耀  最终形态
    [127,  60, false],   // 凯罗斯    虫   0阶  最终形态
    [130,   0, true ],   // 暴鲤龙    水   1阶  ✨闪耀  最终形态
    [134,   0, false],   // 水伊布    水   1阶  最终形态
    [135,   0, true ],   // 雷伊布    电   1阶  ✨闪耀  最终形态
    [138,   0, false],   // 菊石兽    岩石 0阶  → 多刺菊石兽
    [139, 100, false],   // 多刺菊石兽岩石 1阶  最终形态
    [140, 165, false],   // 化石盔    岩石 0阶  → 镰刀盔
    [141,   0, true ],   // 镰刀盔    岩石 1阶  ✨闪耀  最终形态
    [142,   0, false],   // 化石翼龙  岩石 0阶  最终形态
    [144,   0, true ],   // 急冻鸟    冰   0阶  ✨闪耀  最终形态
    [145,   0, false],   // 闪电鸟    电   0阶  最终形态
    [146,   0, true ],   // 火焰鸟    火   0阶  ✨闪耀  最终形态
    [147, 165, false],   // 迷你龙    龙   0阶  → 哈克龙
    [148,   0, false],   // 哈克龙    龙   1阶  → 快龙
    [151,   0, false],   // 梦幻      超能 0阶  最终形态
  ];
  // 同一进化家族：先回溯到最上游的根（如伊布 133），再从根把全部分支铺开
  // （不能只算 no 自己的祖先 + 后代——分支进化时那样会漏掉兄弟分支，比如雷伊布闪耀时漏掉水/火伊布）
  function evoChainOf(no) {
    let root = no;
    let guard = 0;
    while (PK_EVOLVE_FROM[root] !== undefined && guard++ < 6) root = PK_EVOLVE_FROM[root];
    const out = new Set([root]);
    const walk = n => {
      const p = PK_BY_NO[n];
      if (!p) return;
      (p.ev || (p.e ? [p.e] : [])).forEach(k => {
        if (!out.has(k)) { out.add(k); walk(k); }
      });
    };
    walk(root);
    out.delete(no);
    return [...out];
  }

  // 把 [编号, 经验, 闪耀] 清单规范成自洽的一组卡，两条规则：
  //   ① 闪耀形态 = 普通卡保留 + 额外多一张 ✨ 卡 → 有 ✨ 就必须有同编号普通卡；
  //   ② 闪耀按整条进化链生效（与 dexGot 的 shinyOwned 口径一致）→ 链上某形态闪耀时，整链每个形态都补 ✨，
  //      否则会出现「大嘴雀是 ✨、烈雀还是普通」这种自相矛盾的演示数据。
  function expandDemoPms(list) {
    const rows = list.map(([no, exp, shiny]) => ({ no, exp, shiny: !!shiny }));
    const seen = new Set(rows.map(r => `${r.no}|${r.shiny ? 1 : 0}`));
    const push = r => {
      if (!PK_BY_NO[r.no]) return;
      const k = `${r.no}|${r.shiny ? 1 : 0}`;
      if (seen.has(k)) return;
      seen.add(k); rows.push(r);
    };
    // ① 先把 ✨ 沿整条进化链铺开（顺序很重要：先铺链路，再补普通卡，
    //    否则链路里新补进来的基础形态（如嘟嘟 84）又会缺普通卡）
    const family = new Set();
    rows.filter(r => r.shiny).forEach(r => evoChainOf(r.no).forEach(n => family.add(n)));
    family.forEach(no => push({ no, exp: 0, shiny: true }));
    // ② 再给所有 ✨ 编号补一张普通卡
    rows.slice().filter(r => r.shiny).forEach(r => push({ no: r.no, exp: 0, shiny: false }));
    return rows;
  }

  // 演示用的历史打卡：给「重复任务 / 子任务 / 没绑日期的一次性任务」造——这三类每天都会出现在必做清单里
  // （`dayTasksForProgress` 的口径），只有它们都勾上，演示的「必做全清连击」才不是 0。
  // 最近 5 天做满 → 连击有 5 天；更早 16 天每天做掉大部分 → 成就图的「累计完成」看着像真攒了很久。
  // 用 (i + back) % 4 这种确定性规则，不用 Math.random：同一份演示数据每次生成都一样，便于排查。
  function demoHistoryLogs(tasks, todayStr) {
    const pool = tasks.filter(t => t.schedule === 'daily' || t.schedule === 'child' || (t.schedule === 'once' && !t.start_date));
    const out = [];
    let id = 1;
    for (let back = 20; back >= 1; back--) {
      const d = new Date(todayStr + 'T00:00:00');
      d.setDate(d.getDate() - back);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const allDone = back <= 5;                       // 最近 5 天全清
      pool.forEach((t, i) => {
        if (!allDone && (i + back) % 4 === 0) return;  // 早些的日子偶尔漏一条
        out.push({
          id: id++, task_id: t.id, log_date: date, completed: true,
          completed_at: date + 'T12:00:00Z', note: null, progress: null, approved: true,
        });
      });
    }
    return out;
  }

  function demoPmRows(startId = 1, list = DEMO_PMS) {    return expandDemoPms(list).map((r, i) => ({
      id: startId + i,
      name: PK_BY_NO[r.no].name,
      pokedex_no: r.no,
      shiny: r.shiny,
      level: 1,
      exp: r.exp,
      caught_at: nowISO(),
    }));
  }

  // 演示用的零花钱流水：有一笔收入、一笔支出、一笔孩子刚记等确认的，三个状态都能看到
  function demoWalletRows() {
    const d = n => { const x = new Date(today() + 'T00:00:00'); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    return [
      { id: 1, log_date: d(5), dir: 'in', cat: '零花钱', note: '', amt: 20, pending: false },
      { id: 2, log_date: d(3), dir: 'in', cat: '阅读排名', note: '周排名第 8', amt: 30, pending: false },
      { id: 3, log_date: d(2), dir: 'out', cat: '零食', note: '奥利奥', amt: 12, pending: false },
      { id: 4, log_date: d(1), dir: 'out', cat: '玩具', note: '卡包', amt: 15, pending: false },
      { id: 5, log_date: today(), dir: 'out', cat: '文具', note: '买了块橡皮', amt: 3, pending: true },
    ];
  }

  function lsGet(key, def) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? def; } catch { return def; } }
  function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  function dGet(t) { return lsGet(t, []); }
  function dSet(t, rows) { lsSet(t, rows); }
  function dNextId(t) { return dGet(t).reduce((m, r) => Math.max(m, r.id || 0), 0) + 1; }

  const demo = {
    init() {
      // 首次使用：生成示例任务（各类都来一点，方便演示）+ 初始积分和精灵球
      if (lsGet(K.tasks, null) === null) {
        const today0 = today();
        const add = n => { const d = new Date(today0 + 'T00:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
        const seed = [
          // daily 每天都有
          { title: '语文作业', hint: '先复习生字再写', category: '校内作业', points: 10, schedule: 'daily' },
          { title: '数学作业', category: '校内作业', points: 10, schedule: 'daily' },
          { title: '跳绳 500 个', category: '运动', points: 5, schedule: 'daily' },
          { title: '阅读 20 分钟', category: '阅读', points: 5, schedule: 'daily' },
          // once 只做一次
          { title: '整理书包', category: '家务', points: 5, schedule: 'once' },
          { title: '练字两页', category: '练字', points: 5, schedule: 'once', required: false },
          // weekly 多日任务（各自带截止日期，可拆子任务）
          { title: '练字一本', category: '练字', points: 20, schedule: 'weekly', deadline: add(2), subtasks: [['楷书练习', 50], ['硬笔练习', 50]] },
          { title: '读完《夏洛的网》', category: '阅读', points: 30, schedule: 'weekly', deadline: add(4) },
        ];
        const rows = [];
        let id = 1;
        for (const s of seed) {
          const pid = id;
          rows.push({ id: pid, title: s.title, hint: s.hint || null, category: s.category, points: s.points, schedule: s.schedule, deadline: s.deadline || null, parent_id: null, percent: null, required: s.required !== false, sort: 0, active: true, created_at: nowISO() });
          id++;
          if (s.subtasks) {
            for (const [t, pct] of s.subtasks) {
              // 子任务按占比分到父任务的分数（0 分会让进度条永远不动）
              const pts = Math.max(1, Math.round(s.points * pct / 100));
              rows.push({ id: id++, title: t, category: s.category, points: pts, schedule: 'child', deadline: null, parent_id: pid, percent: pct, required: true, active: true, created_at: nowISO() });
            }
          }
        }
        dSet(K.tasks, rows);
        dSet(K.logs, demoHistoryLogs(rows, today0));
        // 演示队伍：喷火龙 / 快龙 各带一张 ✨（写进清单里，让 expandDemoPms 一并把整链铺成闪耀）
        const pmRows = demoPmRows(1, DEMO_PMS.concat(DEMO_PMS_EXTRA, DEMO_PMS_MORE, [[6, 0, true], [149, 0, true]]));
        dSet(K.pms, pmRows);
        // 演示初始积分（已确认发放，孩子可直接花）
        dSet(K.pts, [{ id: 1, log_date: today0, amount: 2000, reason: '演示初始积分', confirmed: true, task_id: null, created_at: nowISO() }]);
        dSet(K.items, [
          { id: 1, log_date: today0, item: 'ball', amount: 60, reason: '演示礼包' },
          { id: 2, log_date: today0, item: 'shiny', amount: 6, reason: '演示闪耀卡' },
        ]);
        lsSet(K_SEED_VER, SEED_VER);
        return;
      }
      const prevVer = Number(lsGet(K_SEED_VER, 1));
      // v1 → v2：补一批测试用宝可梦 / 积分 / 精灵球（只补一次）
      if (prevVer < 2) {
        const d0 = today();
        const pms = dGet(K.pms);
        dSet(K.pms, pms.concat(demoPmRows(pms.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1)));
        const pts = dGet(K.pts);
        pts.push({ id: pts.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1, log_date: d0, amount: 500, reason: '演示测试积分', confirmed: true, task_id: null, created_at: nowISO() });
        dSet(K.pts, pts);
        const its = dGet(K.items);
        its.push({ id: its.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1, log_date: d0, item: 'ball', amount: 25, reason: '演示测试精灵球' });
        dSet(K.items, its);
      }
      // v2 → v3：修历史演示数据
      //   ① 多日任务的子任务之前都是 0 分 → 完成也不涨进度，这里按占比把父任务分数分下去
      //   ② 宝可梦记录缺 pokedex_no → 按名字补回来（否则阶段角标会误标成「基础」）
      if (prevVer < 3) {
        const tasks = dGet(K.tasks);
        const parents = tasks.filter(t => t.schedule === 'weekly');
        parents.forEach(p => {
          const kids = tasks.filter(k => k.parent_id === p.id);
          if (!kids.length) return;
          const total = kids.reduce((s, k) => s + (k.points || 0), 0);
          if (total > 0) return;                       // 已经有分数就不动
          const pctSum = kids.reduce((s, k) => s + (k.percent || 0), 0);
          kids.forEach(k => {
            const share = pctSum > 0 ? (k.percent || 0) / pctSum : 1 / kids.length;
            k.points = Math.max(1, Math.round((p.points || 0) * share));
          });
          p.points = kids.reduce((s, k) => s + k.points, 0);   // 父任务总分 = 子任务之和
        });
        dSet(K.tasks, tasks);
        const pms = dGet(K.pms);
        let changed = false;
        pms.forEach(p => {
          if (typeof PK_NO_BY_NAME !== 'undefined' && !PK_BY_NO[p.pokedex_no] && PK_NO_BY_NAME[p.name] !== undefined) {
            p.pokedex_no = PK_NO_BY_NAME[p.name];
            changed = true;
          }
        });
        if (changed) dSet(K.pms, pms);
      }
      // v3 → v4：演示队伍再补一批宝可梦 + 积分/精灵球（只补一次；已有的同一只不会重复加）
      if (prevVer < 4) {
        const d0 = today();
        const pms = dGet(K.pms);
        const haveNo = new Set(pms.map(r => Number(r.pokedex_no)));
        const haveName = new Set(pms.map(r => r.name));
        const missing = DEMO_PMS_EXTRA.filter(([no]) => !haveNo.has(no) && !haveName.has(PK_BY_NO[no].name));
        if (missing.length) {
          const nextId = pms.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
          dSet(K.pms, pms.concat(demoPmRows(nextId, missing)));
        }
        const pts = dGet(K.pts);
        pts.push({ id: pts.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1, log_date: d0, amount: 1000, reason: '演示补充积分', confirmed: true, task_id: null, created_at: nowISO() });
        dSet(K.pts, pts);
        const its = dGet(K.items);
        its.push({ id: its.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1, log_date: d0, item: 'ball', amount: 20, reason: '演示补充精灵球' });
        dSet(K.items, its);
      }
      // v4 → v5：演示模式直接送几张闪耀卡（库存）+ 两只最终形态的 ✨ 副本，方便试「使用闪耀卡」和卡片列表效果
      if (prevVer < 5) {
        const d0 = today();
        const its = dGet(K.items);
        its.push({ id: its.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1, log_date: d0, item: 'shiny', amount: 3, reason: '演示闪耀卡' });
        dSet(K.items, its);
        const pms = dGet(K.pms);
        const haveShinyNo = new Set(pms.filter(r => r.shiny).map(r => Number(r.pokedex_no)));
        const addNos = [6, 149].filter(no => PK_BY_NO[no] && !haveShinyNo.has(no));   // 喷火龙、快龙 各补一张 ✨ 卡
        if (addNos.length) {
          let nid = pms.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
          dSet(K.pms, pms.concat(addNos.map(no => ({ id: nid++, name: PK_BY_NO[no].name, pokedex_no: no, shiny: true, level: 1, exp: 0, caught_at: nowISO() }))));
        }
      }
      // v5 → v6：演示队伍再扩一批（96 只，图鉴大部分点亮，捕捉池留 22 只可抓）+ 补球和积分
      if (prevVer < 6) {
        const d0 = today();
        const pms = dGet(K.pms);
        const haveNo = new Set(pms.map(r => Number(r.pokedex_no)));
        const missing = DEMO_PMS_MORE.filter(([no]) => !haveNo.has(no));
        if (missing.length) {
          const nextId = pms.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
          dSet(K.pms, pms.concat(demoPmRows(nextId, missing)));
        }
        const its = dGet(K.items);
        its.push({ id: its.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1, log_date: d0, item: 'ball', amount: 40, reason: '演示补充精灵球' });
        dSet(K.items, its);
        const pts = dGet(K.pts);
        pts.push({ id: pts.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1, log_date: d0, amount: 3000, reason: '演示补充积分', confirmed: true, task_id: null, created_at: nowISO() });
        dSet(K.pts, pts);
      }
      // v6 → v7：修历史数据的闪耀自洽性——早期种子只写了 ✨ 卡、没配普通卡，且闪耀没铺满整条进化链。
      // 这里一次性补齐：① 每个有 ✨ 的编号补一张普通卡；② 链上某形态闪耀时，整链所有形态都补 ✨。
      if (prevVer < 7) {
        const pms = dGet(K.pms);
        const seen = new Set(pms.map(r => `${Number(r.pokedex_no)}|${r.shiny ? 1 : 0}`));
        const add = [];
        const addRow = (no, shiny) => {
          if (!PK_BY_NO[no]) return;
          const k = `${no}|${shiny ? 1 : 0}`;
          if (seen.has(k)) return;
          seen.add(k); add.push({ no, shiny });
        };
        const shinyNos = [...new Set(pms.filter(r => r.shiny).map(r => Number(r.pokedex_no)))];
        const family = new Set();
        shinyNos.forEach(no => evoChainOf(no).forEach(n => family.add(n)));
        family.forEach(no => addRow(no, true));                          // ① 整链补 ✨
        [...new Set([...shinyNos, ...family])].forEach(no => addRow(no, false));   // ② 每个 ✨ 补普通卡
        if (add.length) {
          let nid = pms.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
          dSet(K.pms, pms.concat(add.map(r => ({
            id: nid++, name: PK_BY_NO[r.no].name, pokedex_no: r.no,
            shiny: r.shiny, level: 1, exp: 0, caught_at: nowISO(),
          }))));
        }
      }
      // v7 → v8：给还没打过卡的演示数据补一批历史打卡，成就图/日历才看得出"积累"
      if (prevVer < 8 && dGet(K.logs).length === 0) dSet(K.logs, demoHistoryLogs(dGet(K.tasks), today()));
      // 零花钱：首次初始化（老演示数据升级时也补一份，只补这一次）
      if (lsGet(K.wallet, null) === null) dSet(K.wallet, demoWalletRows());
      lsSet(K_SEED_VER, SEED_VER);
    },
    async getTasks() { return [...dGet(K.tasks)]; },
    async addTask({ title, category, points, schedule = 'daily', deadline = null, parent_id = null, percent = null, required = true, start_date = null, end_date = null, hint = null, sort = 0, note = null, bonus = null }) {
      const rows = dGet(K.tasks);
      const row = { id: dNextId(K.tasks), title, category, points, schedule, deadline, parent_id, percent, required, start_date, end_date, hint, sort, note, bonus, active: true, created_at: nowISO() };
      rows.push(row); dSet(K.tasks, rows);
      return { ...row };
    },
    async updateTask(id, patch) {
      dSet(K.tasks, dGet(K.tasks).map(r => r.id === id ? { ...r, ...patch } : r));
    },
    async deleteTask(id) {
      // 只删任务，保留历史打卡记录（与 supabase 一致，删除任务不影响过往打卡数据）
      dSet(K.tasks, dGet(K.tasks).filter(r => r.id !== id));
    },
    async getLogsBetween(start, end) {
      return dGet(K.logs).filter(r => r.log_date >= start && r.log_date <= end);
    },
    async getTodayLogs() { return demo.getLogsBetween(today(), today()); },
    async setLog(taskId, date, completed, note = null, progress = null, approved = true) {
      const rows = dGet(K.logs);
      const i = rows.findIndex(r => r.task_id === taskId && r.log_date === date);
      if (i >= 0) {
        rows[i] = { ...rows[i], completed, completed_at: completed ? nowISO() : null, note, progress, approved };
      } else {
        rows.push({ id: dNextId(K.logs), task_id: taskId, log_date: date, completed, completed_at: completed ? nowISO() : null, note, progress, approved });
      }
      dSet(K.logs, rows);
    },
    async getPokemons() { return [...dGet(K.pms)]; },
    async addPokemon({ pokedex_no, shiny = false }) {
      const info = PK_BY_NO[pokedex_no];
      const rows = dGet(K.pms);
      const row = { id: dNextId(K.pms), name: info.name, pokedex_no, shiny, level: 1, exp: 0, caught_at: nowISO() };
      rows.push(row); dSet(K.pms, rows);
      return { ...row };
    },
    async updatePokemon(id, patch) {
      dSet(K.pms, dGet(K.pms).map(r => r.id === id ? { ...r, ...patch } : r));
    },
    async deletePokemon(id) {
      dSet(K.pms, dGet(K.pms).filter(r => r.id !== id));
    },
    async addPointLog(amount, reason, date = today(), opts = {}) {
      const rows = dGet(K.pts);
      const row = { id: dNextId(K.pts), log_date: date, amount, reason, confirmed: opts.confirmed !== false, task_id: opts.task_id || null, created_at: nowISO() };
      rows.push(row); dSet(K.pts, rows);
      return row.id;
    },
    async confirmPointLogs(ids) {
      const set = new Set(ids);
      dSet(K.pts, dGet(K.pts).map(r => set.has(r.id) ? { ...r, confirmed: true } : r));
    },
    async deletePointLog(id) {
      dSet(K.pts, dGet(K.pts).filter(r => r.id !== id));
    },
    async getPointLogs(limit = 200) {
      return [...dGet(K.pts)].sort((a, b) => b.id - a.id).slice(0, limit);
    },
    async addItemLog(item, amount, reason, date = today()) {
      const rows = dGet(K.items);
      rows.push({ id: dNextId(K.items), log_date: date, item, amount, reason });
      dSet(K.items, rows);
    },
    async getItemCount(item) {
      return dGet(K.items).filter(r => r.item === item).reduce((s, r) => s + r.amount, 0);
    },
    async hasItemReason(reason) {
      return dGet(K.items).some(r => r.reason === reason);
    },
    // 零花钱流水（全量读取，量小）
    async getWalletLogs() { return [...dGet(K.wallet)]; },
    async addWalletLog({ log_date, dir, cat, note = '', amt, pending = false }) {
      const rows = dGet(K.wallet);
      const row = { id: dNextId(K.wallet), log_date, dir, cat, note, amt: Number(amt), pending };
      rows.push(row); dSet(K.wallet, rows);
      return { ...row };
    },
    async confirmWalletLog(id) {
      dSet(K.wallet, dGet(K.wallet).map(r => r.id === id ? { ...r, pending: false } : r));
    },
    async deleteWalletLog(id) {
      dSet(K.wallet, dGet(K.wallet).filter(r => r.id !== id));
    },
    // 今天的叮嘱（家长留言，孩子端顶部展示）
    // 当天没单独写过 → 自动沿用「这天之前最近一次」的叮嘱（家长换个字就能用，不用每天重打）
    // 当天写过空字符串 = 明确清空（从这天起不显示），后面的日期也跟着空，不会又翻回更早的
    async getNote(date) {
      const own = lsGet(P + 'note_' + date, null);
      if (own !== null) return String(own).trim() ? String(own) : null;
      let best = null, bestDate = '';
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || !k.startsWith(P + 'note_')) continue;
          const d = k.slice((P + 'note_').length);
          if (d >= date || d <= bestDate) continue;
          bestDate = d; best = lsGet(k, null);
        }
      } catch { /* 读不到就用空 */ }
      return best && String(best).trim() ? String(best) : null;
    },
    async setNote(date, note) { lsSet(P + 'note_' + date, note || ''); },
    // 家长规则设置（覆盖 config 数值）
    async getSettings() { return lsGet(P + 'settings', {}) || {}; },
    // 按 key 合并写入（与 supabase 的 upsert 行为一致）：只传一个 key 时不能把其它设置冲掉
    async setSettings(obj) { lsSet(P + 'settings', { ...(lsGet(P + 'settings', {}) || {}), ...obj }); },
    // 数据版本（跨设备轮询用）：演示模式数据只在本机，没有"别的设备改了"这回事
    async getRev() { return ''; },
  };

  // ==========================================================
  // 模式二：supabase（真实数据库）
  // ==========================================================
  let sb = null;
  // 本项目不用 Supabase Auth（只走 PostgREST + anon key）：关掉会话持久化/自动刷新/URL 探测。
  // 否则 supabase-js 会在 visibilitychange（安卓切回前台）时恢复会话、读写 localStorage，
  // 那部分代码在 CDN 里，一旦抛错浏览器只上报 "Script error."，完全无法定位。
  function sClient() {
    if (!sb) sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return sb;
  }
  function sFail(error, op) { console.error(`[DB ${op}]`, error); throw new Error(`${op} 失败: ${error.message}`); }

  const sup = {
    init() { sClient(); },
    async getTasks() {
      const { data, error } = await sClient().from('tasks').select('*').order('id');
      if (error) sFail(error, '读取任务');
      return data || [];
    },
    async addTask({ title, category, points, schedule = 'daily', deadline = null, parent_id = null, percent = null, required = true, start_date = null, end_date = null, hint = null, sort = 0, note = null, bonus = null }) {
      const { data, error } = await sClient().from('tasks').insert({ title, category, points, schedule, deadline, parent_id, percent, required, start_date, end_date, hint, sort, note, bonus, active: true }).select();
      if (error) sFail(error, '新增任务');
      return data[0];
    },
    async updateTask(id, patch) {
      const { error } = await sClient().from('tasks').update(patch).eq('id', id);
      if (error) sFail(error, '更新任务');
    },
    async deleteTask(id) {
      const { error } = await sClient().from('tasks').delete().eq('id', id);
      if (error) sFail(error, '删除任务');
    },
    async getLogsBetween(startDate, endDate) {
      const { data, error } = await sClient().from('task_logs').select('*').gte('log_date', startDate).lte('log_date', endDate);
      if (error) sFail(error, '读取记录');
      return data || [];
    },
    async getTodayLogs() { return sup.getLogsBetween(today(), today()); },
    async setLog(taskId, date, completed, note = null, progress = null, approved = true) {
      const { error } = await sClient().from('task_logs').upsert(
        { task_id: taskId, log_date: date, completed, completed_at: completed ? nowISO() : null, note, progress, approved },
        { onConflict: 'task_id,log_date' }
      );
      if (error) sFail(error, '打卡');
    },
    async getPokemons() {
      const { data, error } = await sClient().from('pokemon').select('*').order('id');
      if (error) sFail(error, '读取宝可梦');
      return data || [];
    },
    async addPokemon({ pokedex_no, shiny = false }) {
      const info = PK_BY_NO[pokedex_no];
      const { data, error } = await sClient().from('pokemon').insert({
        name: info.name, pokedex_no, shiny, level: 1, exp: 0,
      }).select();
      if (error) sFail(error, '收录宝可梦');
      return data[0];
    },
    async updatePokemon(id, patch) {
      const { error } = await sClient().from('pokemon').update(patch).eq('id', id);
      if (error) sFail(error, '更新宝可梦');
    },
    async deletePokemon(id) {
      const { error } = await sClient().from('pokemon').delete().eq('id', id);
      if (error) sFail(error, '删除宝可梦');
    },
    async addPointLog(amount, reason, date = today(), opts = {}) {
      const { data, error } = await sClient().from('point_logs').insert({ log_date: date, amount, reason, confirmed: opts.confirmed !== false, task_id: opts.task_id || null, created_at: new Date().toISOString() }).select();
      if (error) sFail(error, '记积分');
      return (data && data[0]) ? data[0].id : null;
    },
    async confirmPointLogs(ids) {
      const { error } = await sClient().from('point_logs').update({ confirmed: true }).in('id', ids);
      if (error) sFail(error, '确认积分');
    },
    async deletePointLog(id) {
      const { error } = await sClient().from('point_logs').delete().eq('id', id);
      if (error) sFail(error, '撤销积分');
    },
    async getPointLogs(limit = 200) {
      const { data, error } = await sClient().from('point_logs').select('*').order('id', { ascending: false }).limit(limit);
      if (error) sFail(error, '读取积分流水');
      return data || [];
    },
    async addItemLog(item, amount, reason, date = today()) {
      const { error } = await sClient().from('item_logs').insert({ log_date: date, item, amount, reason });
      if (error) sFail(error, '记物品');
    },
    async getItemCount(item) {
      const { data, error } = await sClient().from('item_logs').select('amount').eq('item', item);
      if (error) sFail(error, '查物品库存');
      return (data || []).reduce((s, r) => s + r.amount, 0);
    },
    async hasItemReason(reason) {
      const { data, error } = await sClient().from('item_logs').select('id').eq('reason', reason).limit(1);
      if (error) sFail(error, '查重');
      return (data || []).length > 0;
    },
    // 零花钱流水（全量读取，量小）
    async getWalletLogs() {
      const { data, error } = await sClient().from('wallet_logs').select('*').order('id');
      if (error) sFail(error, '读取零花钱');
      return (data || []).map(r => ({ ...r, amt: Number(r.amt) }));
    },
    async addWalletLog({ log_date, dir, cat, note = '', amt, pending = false }) {
      const { data, error } = await sClient().from('wallet_logs').insert({ log_date, dir, cat, note, amt: Number(amt), pending }).select();
      if (error) sFail(error, '记零花钱');
      return { ...data[0], amt: Number(data[0].amt) };
    },
    async confirmWalletLog(id) {
      const { error } = await sClient().from('wallet_logs').update({ pending: false }).eq('id', id);
      if (error) sFail(error, '确认零花钱');
    },
    async deleteWalletLog(id) {
      const { error } = await sClient().from('wallet_logs').delete().eq('id', id);
      if (error) sFail(error, '删除零花钱');
    },
    // 今天的叮嘱（家长留言）
    // 当天没记录 → 取这天之前最近一条（自动沿用）；当天记了空串 = 明确清空
    async getNote(date) {
      const { data, error } = await sClient().from('notes').select('note').eq('log_date', date).maybeSingle();
      if (error) sFail(error, '读叮嘱');
      if (data) return String(data.note || '').trim() ? data.note : null;
      const { data: prev, error: e2 } = await sClient().from('notes')
        .select('note').lt('log_date', date).order('log_date', { ascending: false }).limit(1);
      if (e2) sFail(e2, '读叮嘱');
      const row = prev && prev[0];
      return row && String(row.note || '').trim() ? row.note : null;
    },
    async setNote(date, note) {
      const { error } = await sClient().from('notes').upsert({ log_date: date, note }, { onConflict: 'log_date' });
      if (error) sFail(error, '存叮嘱');
    },
    // 家长规则设置（覆盖 config 数值）
    async getSettings() {
      const { data, error } = await sClient().from('settings').select('key, value');
      if (error) sFail(error, '读设置');
      const obj = {};
      (data || []).forEach(r => { obj[r.key] = r.value; });
      return obj;
    },
    async setSettings(obj) {
      const rows = Object.keys(obj).map(k => ({ key: k, value: String(obj[k]) }));
      const { error } = await sClient().from('settings').upsert(rows, { onConflict: 'key' });
      if (error) sFail(error, '存设置');
    },
    // 数据版本：几张会跨设备变动的表各取"最新一条"（都走主键倒序 limit 1，很便宜），拼成字符串比较。
    // 只用来判断"别的设备是不是改了什么"，不用来读数据；失败不抛错，避免轮询把页面搞崩。
    async getRev() {
      const maxId = async table => {
        const { data, error } = await sClient().from(table).select('id').order('id', { ascending: false }).limit(1);
        if (error) return 'x';
        return (data && data[0]) ? data[0].id : 0;
      };
      const noteQ = sClient().from('notes').select('log_date, note').order('log_date', { ascending: false }).limit(1);
      const revQ = sClient().from('settings').select('value').eq('key', 'rev').limit(1);
      const [logs, pts, tasks, note, rev, wallet] = await Promise.all([maxId('task_logs'), maxId('point_logs'), maxId('tasks'), noteQ, revQ, maxId('wallet_logs')]);
      const n = (note.data && note.data[0]) ? `${note.data[0].log_date}:${note.data[0].note || ''}` : '';
      const r = (rev.data && rev.data[0]) ? rev.data[0].value : '';
      return [logs, pts, tasks, n, r, wallet].join('|');
    },
  };

  // ==========================================================
  // 导出（按配置选择模式；演示模式强制走 demo 实现，数据隔离）
  // ==========================================================
  const impl = (CONFIG.DB_MODE === 'supabase' && !DEMO_ACTIVE) ? sup : demo;

  return {
    init: impl.init.bind(impl),
    today,
    getTasks: impl.getTasks.bind(impl),
    addTask: impl.addTask.bind(impl),
    updateTask: impl.updateTask.bind(impl),
    deleteTask: impl.deleteTask.bind(impl),
    getLogsBetween: impl.getLogsBetween.bind(impl),
    getTodayLogs: impl.getTodayLogs.bind(impl),
    setLog: impl.setLog.bind(impl),
    getPokemons: impl.getPokemons.bind(impl),
    addPokemon: impl.addPokemon.bind(impl),
    updatePokemon: impl.updatePokemon.bind(impl),
    deletePokemon: impl.deletePokemon.bind(impl),
    addPointLog: impl.addPointLog.bind(impl),
    confirmPointLogs: impl.confirmPointLogs.bind(impl),
    deletePointLog: impl.deletePointLog.bind(impl),
    getPointLogs: impl.getPointLogs.bind(impl),
    addItemLog: impl.addItemLog.bind(impl),
    getItemCount: impl.getItemCount.bind(impl),
    hasItemReason: impl.hasItemReason.bind(impl),
    getWalletLogs: impl.getWalletLogs.bind(impl),
    addWalletLog: impl.addWalletLog.bind(impl),
    confirmWalletLog: impl.confirmWalletLog.bind(impl),
    deleteWalletLog: impl.deleteWalletLog.bind(impl),
    getNote: impl.getNote.bind(impl),
    setNote: impl.setNote.bind(impl),
    getSettings: impl.getSettings.bind(impl),
    setSettings: impl.setSettings.bind(impl),
    getRev: impl.getRev.bind(impl),
  };
})();
