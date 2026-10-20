-- ============================================================
-- Kimi 任务岛 - 完整建库脚本（合并 v2~v10，可重复执行）
-- 在 Supabase SQL Editor 里粘贴执行一次即可
-- 表已存在则跳过建表（后面 alter 补缺失字段），重复执行无害
-- ============================================================

-- 1. 基础表（不存在才创建）
create table if not exists tasks (
  id bigint generated always as identity primary key,
  title text not null,
  category text not null default '打卡',
  points int not null default 10,
  schedule text not null default 'daily',
  deadline date,
  parent_id bigint,
  percent int,
  required boolean not null default true,
  active boolean not null default true,
  start_date date,
  end_date date,
  hint text,                -- 任务小提示（家长用 {提示} 圈住）
  sort int not null default 0,  -- 孩子端展示顺序
  bonus int,                -- 多日任务全清额外分（null=用默认 10 分）
  note text,                -- 备注（暂未使用，留给前端兼容；日常叮嘱存在 notes 表里）
  created_at timestamptz not null default now()
);
-- 兼容早期 addTask 多塞了 note 字段（不影响线上）
alter table tasks add column if not exists note text;

create table if not exists task_logs (
  id bigint generated always as identity primary key,
  task_id bigint not null,
  log_date date not null,
  completed boolean not null default false,
  completed_at timestamptz,
  note text,
  progress int,
  unique (task_id, log_date)
);

create table if not exists pokemon (
  id bigint generated always as identity primary key,
  name text not null,
  pokedex_no int not null,
  shiny boolean not null default false,
  level int not null default 1,
  exp int not null default 0,
  caught_at timestamptz default now()
);

create table if not exists point_logs (
  id bigint generated always as identity primary key,
  log_date date not null default current_date,
  amount int not null,
  reason text not null,
  confirmed boolean not null default true,
  task_id bigint,
  created_at timestamptz not null default now()
);

create table if not exists item_logs (
  id bigint generated always as identity primary key,
  log_date date not null default current_date,
  item text not null,          -- 'ball' = 精灵球
  amount int not null,
  reason text not null,        -- 如 '购买' '全勤7天奖励' '捕捉消耗'
  created_at timestamptz not null default now()
);

-- 家长每日叮嘱表（每天一条，日期唯一）
create table if not exists notes (
  id bigint generated always as identity primary key,
  log_date date not null unique,
  note text not null,
  created_at timestamptz not null default now()
);

-- 家长规则设置（key-value，覆盖 config 数值）
create table if not exists settings (
  key text primary key,
  value text not null
);

-- 2. 行级安全：家庭个人使用，anon key 全开放（读写都允许）
do $$
declare t text;
begin
  foreach t in array array['tasks','task_logs','pokemon','point_logs','item_logs','notes','settings'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "public access" on %I;', t);
    execute format('create policy "public access" on %I for all using (true) with check (true);', t);
  end loop;
end $$;

-- 3. task_logs 打卡唯一约束（task_id+log_date 唯一，重复打卡=更新而非新增）
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'task_logs'::regclass and conname = 'task_logs_task_date_key') then
    alter table task_logs add constraint task_logs_task_date_key unique (task_id, log_date);
  end if;
end $$;

-- 4. 字段升级保底（幂等：即使建表已含这些字段，add column if not exists 也不会报错）
alter table tasks add column if not exists schedule text not null default 'daily';
alter table pokemon add column if not exists shiny boolean not null default false;
alter table tasks add column if not exists deadline date;
alter table task_logs add column if not exists progress int;
-- 提交/审批状态：approved=false=孩子已提交待家长审批；approved=true=已审批（默认 true 兼容旧数据，旧打卡记录视为已审批）
alter table task_logs add column if not exists approved boolean not null default true;
alter table tasks add column if not exists parent_id bigint;
alter table tasks add column if not exists percent int;
alter table tasks add column if not exists required boolean not null default true;
alter table point_logs add column if not exists confirmed boolean not null default true;
alter table point_logs add column if not exists task_id bigint;
alter table point_logs add column if not exists created_at timestamptz default now();
alter table tasks add column if not exists start_date date;
alter table tasks add column if not exists end_date date;
alter table tasks add column if not exists hint text;
alter table tasks add column if not exists sort int not null default 0;
alter table tasks add column if not exists bonus int;
