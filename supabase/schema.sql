-- 115 學年度社科院院學士學位學程 一審審查頁面
-- Supabase 資料表結構
-- 在 Supabase 專案的 SQL Editor 中依序執行本檔案，再執行 seed.sql

create table if not exists public.applicants (
  id             integer primary key,
  student_id     text not null unique,
  name           text not null,
  name_note      text,                         -- 姓名／學號不一致等提醒（例如自填姓名與名冊不同）
  department     text not null,
  grade_year     integer not null,
  wishes         text[] not null default '{}', -- 志願序，依序放入
  phone          text not null default '',
  email          text not null default '',
  status         text not null default '未確認'
                 check (status in ('未確認','已收件','格式不符待補件','已補件收件','未提交申請書')),
  note           text not null default '',     -- 通知紀錄／備註（可自由編輯）
  has_application boolean not null default false, -- 是否已實際收到申請書檔案
  updated_at     timestamptz not null default now()
);

comment on table public.applicants is '115學年度社科院院學士學位學程加修學系一審審查名冊';
comment on column public.applicants.has_application is '是否已收到該生申請書電子檔（非格式是否合格）';

-- 每次更新自動寫入 updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_applicants_updated_at on public.applicants;
create trigger trg_applicants_updated_at
  before update on public.applicants
  for each row execute function public.set_updated_at();

-- 開啟 Row Level Security
alter table public.applicants enable row level security;

-- 簡易政策：所有人可讀寫（本工具僅供內部連結分享使用，不含帳號系統）
-- 若未來需要限制存取，建議改用 Supabase Auth 並將以下政策換成 auth.uid() 判斷
drop policy if exists "allow all read" on public.applicants;
create policy "allow all read" on public.applicants
  for select using (true);

drop policy if exists "allow all update" on public.applicants;
create policy "allow all update" on public.applicants
  for update using (true) with check (true);

drop policy if exists "allow all insert" on public.applicants;
create policy "allow all insert" on public.applicants
  for insert with check (true);
