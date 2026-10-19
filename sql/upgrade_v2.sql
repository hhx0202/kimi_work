-- ============================================================
-- Kimi 任务岛 - 表结构升级 v2
-- 在 Supabase 的 SQL Editor 里执行一次即可（可重复执行，幂等）
-- ============================================================

-- 1. tasks 加 schedule 字段：daily=每天出现, once=完成一次后自动下架
alter table tasks add column if not exists schedule text not null default 'daily';

-- 2. pokemon 加 shiny 字段：闪光个体
alter table pokemon add column if not exists shiny boolean not null default false;

-- 3. 物品流水表：精灵球库存（+1 获得 / -1 使用），余额 = SUM(amount)
create table if not exists item_logs (
  id bigint generated always as identity primary key,
  log_date date not null default current_date,
  item text not null,          -- 'ball' = 精灵球
  amount int not null,
  reason text not null,        -- 如 '购买' '全勤7天奖励' '捕捉消耗'
  created_at timestamptz not null default now()
);
alter table item_logs enable row level security;
create policy "public access" on item_logs for all using (true) with check (true);
