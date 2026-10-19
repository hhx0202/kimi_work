-- ============================================================
-- Kimi 任务岛 - 表结构升级 v8（任务生效日期范围：一次性布置未来多天）
-- 在 Supabase 的 SQL Editor 里执行一次即可（可重复执行，幂等）
-- ============================================================

-- 1. tasks 加 start_date：任务生效的开始日期（null = 一直生效）
alter table tasks add column if not exists start_date date;

-- 2. tasks 加 end_date：任务生效的结束日期（null = 一直生效）
alter table tasks add column if not exists end_date date;

-- 语义：
--   start_date / end_date 都为空 → 任务一直生效（旧任务完全兼容）
--   start_date=某天、end_date=某天 → 任务只在这段时间内的每一天出现
--   once 任务带单日 start_date → 那天看到那天做，完成即下架
