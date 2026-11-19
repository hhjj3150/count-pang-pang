-- =========================================================================
-- 카운터 팡팡 서버 장부 ③: 이번 달 랭킹 (서버 랭킹)
-- Supabase → SQL Editor 에 붙여 넣고 Run. 01·02 다음에 실행. 여러 번 실행해도 안전해요.
--
-- - 계정을 연결한 사람의 기록(profiles.save)에서 이번 달 순위를 계산해요.
-- - 다른 사람에게는 닉네임과 순위 값만 보여 줘요. (나머지 기록은 계속 본인만 볼 수 있음)
-- - 손님(로그인 안 함)도 랭킹을 볼 수는 있어요. 순위에 오르려면 계정 연결이 필요해요.
-- - 탭: 'points'(이번 달 포인트, 많은 순) / '11' '12' '13'(만점 최단 기록 ms, 빠른 순) / 'total'(세 레벨 합계, 빠른 순)
-- - 달 기준은 한국 시간이에요. 매달 1일 새로 시작해요.
-- - ⚠️ 지금은 휴대폰이 보낸 기록을 그대로 쓰므로, 말이 안 되는 값(너무 빠른 기록, 너무 많은 포인트)만 걸러요.
--      더 엄격한 검증은 나중에 서버가 직접 게임 결과를 기록할 때 붙여요.
-- =========================================================================

-- 숫자만 꺼내기 (값이 숫자가 아니면 null — 이상한 값 하나 때문에 랭킹 전체가 멈추지 않게)
create or replace function public.jnum(v jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric else null end;
$$;

create or replace function public.get_ranking(tab text, top_n int default 10)
returns table (rank int, nickname text, value bigint, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with month as (
    select to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM') as m
  ),
  v as (
    select
      p.id,
      p.nickname,
      p.updated_at,
      case
        when tab = 'points' then
          case when p.save ->> 'monthlyDate' = (select m from month) then public.jnum(p.save -> 'monthlyPoints') end
        when tab in ('11', '12', '13') then
          case when p.save -> 'monthBest' ->> 'month' = (select m from month) then public.jnum(p.save -> 'monthBest' -> 'best' -> tab) end
        when tab = 'total' then
          -- 세 레벨 모두 정상 기록(3초~1시간)이 있어야 합계를 냄
          case when p.save -> 'monthBest' ->> 'month' = (select m from month)
            and public.jnum(p.save -> 'monthBest' -> 'best' -> '11') between 3000 and 3600000
            and public.jnum(p.save -> 'monthBest' -> 'best' -> '12') between 3000 and 3600000
            and public.jnum(p.save -> 'monthBest' -> 'best' -> '13') between 3000 and 3600000
          then
            public.jnum(p.save -> 'monthBest' -> 'best' -> '11')
            + public.jnum(p.save -> 'monthBest' -> 'best' -> '12')
            + public.jnum(p.save -> 'monthBest' -> 'best' -> '13')
          end
      end as val
    from public.profiles p
    where p.nickname is not null and char_length(trim(p.nickname)) > 0
  ),
  ok as (
    -- 말이 안 되는 값 거르기: 포인트 0 이하·한 달 100만 초과, 15문제 기록 3초 미만·1시간 초과
    select * from v
    where val is not null
      and (
        (tab = 'points' and val > 0 and val <= 1000000)
        or (tab in ('11', '12', '13') and val >= 3000 and val <= 3600000)
        or (tab = 'total' and val >= 9000 and val <= 10800000)
      )
  ),
  ranked as (
    select
      (row_number() over (order by case when tab = 'points' then -val else val end, updated_at))::int as rank,
      nickname,
      val::bigint as value,
      coalesce(id = (select auth.uid()), false) as is_me
    from ok
  )
  -- 상위 top_n명 + (순위 밖이면) 내 줄
  select rank, nickname, value, is_me
  from ranked
  where rank <= least(greatest(top_n, 1), 50) or is_me
  order by rank;
$$;

revoke all on function public.get_ranking(text, int) from public;
grant execute on function public.get_ranking(text, int) to anon, authenticated;
revoke all on function public.jnum(jsonb) from public;
