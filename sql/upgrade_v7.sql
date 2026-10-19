-- ============================================================
-- Kimi 任务岛 - 表结构升级 v7（积分流水记录完成时间）
-- 在 Supabase 的 SQL Editor 里执行一次即可（可重复执行，幂等）
-- ============================================================

-- point_logs 加 created_at：每笔积分发生的时间（家长端流水显示日期+时间）
alter table point_logs add column if not exists created_at timestamptz default now();
