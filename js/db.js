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
  const K = { tasks: P + 'tasks', logs: P + 'logs', pms: P + 'pokemons', pts: P + 'points', items: P + 'items' };

  function lsGet(key, def) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? def; } catch { return def; } }
  function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  function dGet(t) { return lsGet(t, []); }
  function dSet(t, rows) { lsSet(t, rows); }
  function dNextId(t) { return dGet(t).reduce((m, r) => Math.max(m, r.id || 0), 0) + 1; }

  const demo = {
    init() {
      // 首次使用：生成示例任务 + 新手精灵球
      if (lsGet(K.tasks, null) === null) {
        const seed = [
          { title: '语文作业', category: '作业', points: 10 },
          { title: '数学作业', category: '作业', points: 10 },
          { title: '跳绳 500 个', category: '打卡', points: 5 },
          { title: '阅读 20 分钟', category: '打卡', points: 5 },
        ];
        dSet(K.tasks, seed.map((s, i) => ({ id: i + 1, ...s, schedule: 'daily', active: true, created_at: nowISO() })));
        dSet(K.logs, []);
        dSet(K.pms, []);
        dSet(K.pts, []);
        dSet(K.items, [{ id: 1, log_date: today(), item: 'ball', amount: 1, reason: '新手礼包' }]);
      }
    },
    async getTasks() { return [...dGet(K.tasks)]; },
    async addTask({ title, category, points, schedule = 'daily', deadline = null, parent_id = null, percent = null, required = true }) {
      const rows = dGet(K.tasks);
      const row = { id: dNextId(K.tasks), title, category, points, schedule, deadline, parent_id, percent, required, active: true, created_at: nowISO() };
      rows.push(row); dSet(K.tasks, rows);
      return { ...row };
    },
    async updateTask(id, patch) {
      dSet(K.tasks, dGet(K.tasks).map(r => r.id === id ? { ...r, ...patch } : r));
    },
    async deleteTask(id) {
      dSet(K.tasks, dGet(K.tasks).filter(r => r.id !== id));
      dSet(K.logs, dGet(K.logs).filter(r => r.task_id !== id));
    },
    async getLogsBetween(start, end) {
      return dGet(K.logs).filter(r => r.log_date >= start && r.log_date <= end);
    },
    async getTodayLogs() { return demo.getLogsBetween(today(), today()); },
    async setLog(taskId, date, completed, note = null, progress = null) {
      const rows = dGet(K.logs);
      const i = rows.findIndex(r => r.task_id === taskId && r.log_date === date);
      if (i >= 0) {
        rows[i] = { ...rows[i], completed, completed_at: completed ? nowISO() : null, note, progress };
      } else {
        rows.push({ id: dNextId(K.logs), task_id: taskId, log_date: date, completed, completed_at: completed ? nowISO() : null, note, progress });
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
  };

  // ==========================================================
  // 模式二：supabase（真实数据库）
  // ==========================================================
  let sb = null;
  function sClient() { if (!sb) sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY); return sb; }
  function sFail(error, op) { console.error(`[DB ${op}]`, error); throw new Error(`${op} 失败: ${error.message}`); }

  const sup = {
    init() { sClient(); },
    async getTasks() {
      const { data, error } = await sClient().from('tasks').select('*').order('id');
      if (error) sFail(error, '读取任务');
      return data || [];
    },
    async addTask({ title, category, points, schedule = 'daily', deadline = null, parent_id = null, percent = null, required = true }) {
      const { data, error } = await sClient().from('tasks').insert({ title, category, points, schedule, deadline, parent_id, percent, required, active: true }).select();
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
    async setLog(taskId, date, completed, note = null, progress = null) {
      const { error } = await sClient().from('task_logs').upsert(
        { task_id: taskId, log_date: date, completed, completed_at: completed ? nowISO() : null, note, progress },
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
  };
})();
