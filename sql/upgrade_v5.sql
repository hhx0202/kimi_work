-- ============================================================
-- Kimi 任务岛 - 表结构升级 v5（子任务 + 必选/可选）
-- 在 Supabase 的 SQL Editor 里执行一次即可（可重复执行，幂等）
-- ============================================================

-- 1. tasks 加 parent_id：子任务所属的父任务（null = 独立任务）
alter table tasks add column if not exists parent_id bigint;

-- 2. tasks 加 percent：子任务占父任务的完成百分比
alter table tasks add column if not exists percent int;

-- 3. tasks 加 required：必选(true)/可选(false)，默认必选
alter table tasks add column if not exists required boolean not null default true;
