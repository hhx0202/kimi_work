-- ============================================================
-- Kimi 任务岛 - 表结构升级 v9（零花钱）
-- 在 Supabase 的 SQL Editor 里执行一次即可（可重复执行，幂等）
-- ============================================================

-- 零花钱流水表：
--   dir = 'in' 收入（家长给的） / 'out' 支出（花掉或孩子登记的花销）
--   pending = true 表示孩子自己记的、等家长确认（确认后才算进余额；拒绝 = 直接删掉这条）
--   余额 = SUM(未 pending 的 in) - SUM(未 pending 的 out)
create table if not exists wallet_logs (
  id bigint generated always as identity primary key,
  log_date date not null default current_date,
  dir text not null,
  cat text not null,
  note text not null default '',
  amt numeric(10,2) not null,
  pending boolean not null default false,
  created_at timestamptz not null default now()
);
alter table wallet_logs enable row level security;
create policy "public access" on wallet_logs for all using (true) with check (true);
