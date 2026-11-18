-- =========================================================================
-- 카운터 팡팡 서버 장부 ①: 계정마다 내 정보 한 묶음 보관
-- Supabase → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전하게 만들었어요.
--
-- - 손님(로그인 안 함)은 서버에 아무것도 올리지 않아요. 카카오·구글로 "계정 연결"을 한 사람만 이 장부를 써요.
-- - save 칸에는 게임의 저장 묶음(SaveData, lib/game/save.ts)을 그대로 넣어요.
-- - 각자 자기 줄만 읽고 쓸 수 있어요(RLS). 다른 사람의 기록은 볼 수 없어요.
-- - ⚠️ 기프티콘·캐시처럼 돈과 관련된 값은 나중에 서버만 고칠 수 있는 장부를 따로 만들어요.
--      (이 묶음은 휴대폰이 보낸 값을 그대로 보관하는 '기록 백업'이에요)
-- =========================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade, -- 로그인 계정 (계정을 지우면 함께 지워짐)
  nickname text check (char_length(nickname) <= 20),
  birth_year int check (birth_year between 1900 and 2100),
  save jsonb not null default '{}'::jsonb check (pg_column_size(save) < 512000), -- 내 정보 묶음 (최대 약 500KB)
  save_version int not null default 0, -- 묶음 형식 버전 (SAVE_VERSION)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 🔒 줄 단위 잠금: 로그인한 본인 줄만
alter table public.profiles enable row level security;

drop policy if exists "본인 기록 읽기" on public.profiles;
create policy "본인 기록 읽기" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "본인 기록 만들기" on public.profiles;
create policy "본인 기록 만들기" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "본인 기록 고치기" on public.profiles;
create policy "본인 기록 고치기" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "본인 기록 지우기" on public.profiles;
create policy "본인 기록 지우기" on public.profiles
  for delete to authenticated using ((select auth.uid()) = id);

-- 앱에서 쓸 수 있게 열어 주기 (로그인한 사람만, 손님(anon)은 안 됨)
revoke all on table public.profiles from anon;
grant select, insert, update, delete on table public.profiles to authenticated;

-- 고친 시각 자동 기록
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 🗑️ 탈퇴: 로그인한 본인 계정을 지움 (profiles 줄도 함께 지워짐)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
