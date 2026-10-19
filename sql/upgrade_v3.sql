-- ============================================================
-- Kimi 任务岛 - 表结构升级 v3
-- 在 Supabase 的 SQL Editor 里执行一次即可（可重复执行，幂等）
-- ============================================================

-- 1. tasks 加 deadline：进度型长期任务(weekly)的截止日期
alter table tasks add column if not exists deadline date;

-- 2. task_logs 加 progress：单次打卡完成百分比(30/60/100)，用于进度型任务
alter table task_logs add column if not exists progress int;
