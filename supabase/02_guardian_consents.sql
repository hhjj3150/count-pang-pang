-- =========================================================================
-- 카운터 팡팡 서버 장부 ②: 보호자 동의 기록 (만 14세 미만 계정 연결)
-- Supabase → SQL Editor 에 붙여 넣고 Run. 01_profiles.sql 다음에 실행. 여러 번 실행해도 안전해요.
--
-- - 만 14세 미만 아이의 기록을 서버에 올리기 전에, 보호자가 본인인증을 하고 동의한 기록을 남겨요.
-- - 보호자는 자기 카카오 계정으로 연결해요. 그래서 user_id = 보호자가 로그인한 계정이에요.
-- - 🧪 지금은 본인인증 업체 계약 전이라 '테스트용 가짜 인증'(method = 'test')만 앱에서 직접 넣을 수 있어요.
--   진짜 인증(PASS·NICE·문자 등)은 나중에 서버(Vercel)가 인증 결과를 확인한 뒤 비밀 열쇠로 넣어요.
--   그래서 앱(로그인한 사용자)이 직접 넣을 수 있는 건 method = 'test' 뿐이에요.
-- - 동의를 취소하면 revoked_at 에 취소 시각을 남겨요(기록은 증빙으로 보관). 탈퇴하면 함께 지워져요.
-- =========================================================================

create table if not exists public.guardian_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade, -- 보호자가 로그인한 계정
  child_nickname text check (char_length(child_nickname) <= 20),
  child_birth_year int check (child_birth_year between 1900 and 2100),
  guardian_name text not null check (char_length(guardian_name) between 1 and 30),
  guardian_phone text not null check (guardian_phone ~ '^01[016789][0-9]{7,8}$'), -- 숫자만 (예: 01012345678)
  guardian_birth_year int check (guardian_birth_year between 1900 and 2100),
  method text not null check (method in ('test', 'pass', 'nice', 'sms')), -- 본인인증 방법
  items jsonb not null default '{}'::jsonb, -- 동의한 항목 (필수·선택)
  consented_at timestamptz not null default now(),
  revoked_at timestamptz -- 보호자가 동의를 취소한 시각 (취소 전에는 비어 있음)
);

create index if not exists guardian_consents_user_idx on public.guardian_consents (user_id);

-- 🔒 줄 단위 잠금
alter table public.guardian_consents enable row level security;

drop policy if exists "본인 동의 기록 읽기" on public.guardian_consents;
create policy "본인 동의 기록 읽기" on public.guardian_consents
  for select to authenticated using ((select auth.uid()) = user_id);

-- 🧪 테스트용 가짜 인증만 앱에서 직접 넣을 수 있음
drop policy if exists "테스트 동의 넣기" on public.guardian_consents;
create policy "테스트 동의 넣기" on public.guardian_consents
  for insert to authenticated with check ((select auth.uid()) = user_id and method = 'test' and revoked_at is null);

-- 동의 취소: 본인 줄의 revoked_at 만 고칠 수 있음 (아래 칸 단위 권한)
drop policy if exists "본인 동의 취소" on public.guardian_consents;
create policy "본인 동의 취소" on public.guardian_consents
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on table public.guardian_consents from anon, authenticated;
grant select, insert on table public.guardian_consents to authenticated;
grant update (revoked_at) on table public.guardian_consents to authenticated;
