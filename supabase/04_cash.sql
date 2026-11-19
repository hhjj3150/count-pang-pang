-- =========================================================================
-- 카운터 팡팡 서버 장부 ④: 캐시 통장 + 친구 초대
-- Supabase → SQL Editor 에 붙여 넣고 Run. 01~03 다음에 실행. 여러 번 실행해도 안전해요.
--
-- 💰 캐시(C)는 기프티콘(실제 돈)과 바뀌므로 휴대폰 숫자를 믿지 않고 서버 통장에만 기록해요.
--   - 들어오고 나간 내역을 한 줄씩 남기고, 잔액 = 합계 (은행 통장과 같은 방식)
--   - 앱(로그인한 사람)은 자기 내역을 읽기만 할 수 있어요. 직접 쓰는 길은 없어요.
--   - 쓰는 길: 아래 친구 초대 함수(서버가 조건 확인) / 나중에 광고 확인·기프티콘 교환은 서버(Vercel, 비밀 열쇠)
--   - 같은 일로 두 번 받지 않게 (사람, 이유, 증거 번호)는 한 번만 기록돼요.
--   - 손님(로그인 안 함)은 캐시가 없어요. 유효기간은 없어요.
--
-- 💌 친구 초대 (사용자 결정): 초대한 친구가 초대 링크로 들어와 카카오 계정으로 가입(연결)하면 초대한 사람에게 5C
--   - 카카오 로그인으로 가입한 사람만 셈. 한 사람은 한 번만 '초대받은 사람'이 될 수 있음. 자기 자신은 안 됨
--   - '새로 가입한 사람'만: 계정을 만든 지 7일 안에 초대 코드를 확인한 경우만 인정
-- =========================================================================

-- 💰 캐시 통장
create table if not exists public.cash_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount int not null check (amount <> 0), -- 들어오면 +, 나가면 -
  reason text not null check (reason in ('ad', 'invite', 'exchange', 'refund', 'admin')),
  ref text not null, -- 증거 번호 (광고 거래 번호, 초대받은 사람, 교환 신청 번호 등)
  memo text,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);
create index if not exists cash_ledger_user_idx on public.cash_ledger (user_id);

alter table public.cash_ledger enable row level security;
drop policy if exists "본인 캐시 내역 읽기" on public.cash_ledger;
create policy "본인 캐시 내역 읽기" on public.cash_ledger
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.cash_ledger from anon, authenticated;
grant select on table public.cash_ledger to authenticated;

-- 내 캐시 잔액
create or replace function public.get_my_cash()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::int from public.cash_ledger where user_id = (select auth.uid());
$$;
revoke all on function public.get_my_cash() from public, anon;
grant execute on function public.get_my_cash() to authenticated;

-- 💌 초대 코드 (사람마다 하나)
create table if not exists public.invite_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{8}$'),
  created_at timestamptz not null default now()
);
alter table public.invite_codes enable row level security;
revoke all on table public.invite_codes from anon, authenticated;

-- 누가 누구를 초대했는지 (초대받은 사람은 한 번만)
create table if not exists public.invites (
  invitee_id uuid primary key references auth.users (id) on delete cascade,
  inviter_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists invites_inviter_idx on public.invites (inviter_id);
alter table public.invites enable row level security;
revoke all on table public.invites from anon, authenticated;

-- 내 초대 코드 받기 (없으면 만들기) — 카카오 등으로 로그인한 사람만
create or replace function public.get_my_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c text;
begin
  if uid is null then
    raise exception '로그인이 필요해요';
  end if;
  select code into c from public.invite_codes where user_id = uid;
  if c is not null then
    return c;
  end if;
  loop
    -- 헷갈리는 글자(0·O·1·I) 없이 8자리
    c := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 8));
    begin
      insert into public.invite_codes (user_id, code) values (uid, c);
      return c;
    exception when unique_violation then
      select code into c from public.invite_codes where user_id = uid; -- 동시에 만들어진 경우
      if c is not null then
        return c;
      end if;
    end;
  end loop;
end;
$$;
revoke all on function public.get_my_invite_code() from public, anon;
grant execute on function public.get_my_invite_code() to authenticated;

-- 초대받아 가입한 사람이 부름 → 조건이 맞으면 초대한 사람에게 5C
-- 돌려주는 값: 'ok' / 'not_kakao' / 'bad_code' / 'self' / 'already' / 'not_new'
create or replace function public.claim_invite(invite_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inviter uuid;
  joined timestamptz;
begin
  if uid is null then
    raise exception '로그인이 필요해요';
  end if;
  -- 카카오 로그인으로 가입한 사람만
  if coalesce((select auth.jwt()) -> 'app_metadata' ->> 'provider', '') <> 'kakao' then
    return 'not_kakao';
  end if;
  select user_id into inviter from public.invite_codes where code = upper(trim(invite_code));
  if inviter is null then
    return 'bad_code';
  end if;
  if inviter = uid then
    return 'self';
  end if;
  if exists (select 1 from public.invites where invitee_id = uid) then
    return 'already';
  end if;
  select created_at into joined from auth.users where id = uid;
  if joined is null or joined < now() - interval '7 days' then
    return 'not_new';
  end if;
  insert into public.invites (invitee_id, inviter_id) values (uid, inviter) on conflict do nothing;
  if not found then
    return 'already';
  end if;
  insert into public.cash_ledger (user_id, amount, reason, ref, memo)
  values (inviter, 5, 'invite', uid::text, '친구 초대 가입')
  on conflict do nothing;
  return 'ok';
end;
$$;
revoke all on function public.claim_invite(text) from public, anon;
grant execute on function public.claim_invite(text) to authenticated;

-- 내가 초대해서 가입한 친구 수
create or replace function public.get_my_invite_count()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.invites where inviter_id = (select auth.uid());
$$;
revoke all on function public.get_my_invite_count() from public, anon;
grant execute on function public.get_my_invite_count() to authenticated;
