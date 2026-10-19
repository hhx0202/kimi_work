-- ============================================================
-- Kimi 任务岛 - 表结构升级 v6（待确认积分 + 可撤销）
-- 在 Supabase 的 SQL Editor 里执行一次即可（可重复执行，幂等）
-- ============================================================

-- 1. point_logs 加 confirmed：积分是否已由家长确认发放
--    默认 true = 存量流水都算已确认（历史数据兼容，只有新打卡的加分才走"待确认"）
alter table point_logs add column if not exists confirmed boolean not null default true;

-- 2. point_logs 加 task_id：记录这笔积分来自哪个任务的打卡（撤销时回退该任务完成状态）
alter table point_logs add column if not exists task_id bigint;
