// 📋 오늘의 미션 (사용자 결정: 고정 3개 + 매일 바뀌는 2개, 보상은 포인트·하트)
//  - 고정: 출석 도장 / 서로 다른 레벨 5판 통과 / 오늘의 도전 만점
//  - 매일 바뀌는 2개: 아래 POOL 중에서 날짜로 골라요 (같은 날은 다시 열어도 같은 미션)
//  - 다 받으면 보너스: 하트 +1 + 100P
//  - 자정(이 기기 날짜 기준)에 새로 시작
//  - 캐시가 아니라 포인트라서 '만점'·'통과' 같은 결과 조건을 써도 괜찮아요 (CASH_ENABLED 참고)
import { MAX_LEVEL, PASS_LINE, TOTAL_Q } from "./constants"
import type { LearnStats } from "./stats"

export type MissionId =
  | "attend" | "pass5" | "dailyPerfect"
  | "weak" | "correct50" | "newLevel" | "fever3" | "streak10" | "perfectAny" | "recordRun" | "invite" | "ranking"

export const FIXED_MISSIONS: MissionId[] = ["attend", "pass5", "dailyPerfect"]
export const POOL_MISSIONS: MissionId[] = ["weak", "correct50", "newLevel", "fever3", "streak10", "perfectAny", "recordRun", "invite", "ranking"]
export const MISSION_REWARD: Record<MissionId, number> = {
  attend: 20, pass5: 50, dailyPerfect: 50,
  weak: 50, correct50: 30, newLevel: 50, fever3: 30, streak10: 30, perfectAny: 30, recordRun: 30, invite: 20, ranking: 10,
}
export const MISSION_BONUS = { hearts: 1, points: 100 } // 다섯 개를 모두 받으면

// 하루 미션 기록 (SaveData.missions)
export interface MissionDay {
  date: string // YYYY-MM-DD
  picks: MissionId[] // 오늘 바뀌는 미션 2개
  weakLevel: number | null // 약점 연습 레벨 (정답률이 가장 낮은 유형)
  passed: number[] // 오늘 통과한 레벨들 (서로 다른)
  newLevels: number // 오늘 처음 통과한 레벨 수
  fever: number // 오늘 피버 타임 들어간 횟수
  streak10: boolean // 한 판에서 10문제 연속 정답
  perfectAny: boolean // 아무 레벨 만점
  dailyPerfect: boolean // 오늘의 도전 레벨 만점
  recordRun: boolean // Lv.11~13 만점
  weakDone: boolean // 약점 연습 레벨 통과
  invite: boolean // 초대 링크 보냄
  ranking: boolean // 랭킹 봄
  claimed: MissionId[] // 보상 받은 미션
  bonus: boolean // 모두 완료 보너스 받음
}

// 날짜로 정해지는 섞기 (같은 날은 같은 결과)
function seeded(date: string) {
  let h = 2166136261
  for (const ch of date) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

// 약점 연습 레벨: 5문제 이상 풀어 본 유형 중 정답률이 가장 낮은 레벨 (열린 레벨 1~)
export function findWeakLevel(stats: LearnStats, unlocked: number): number | null {
  let best: { lv: number; rate: number } | null = null
  for (const [k, v] of Object.entries(stats.types ?? {})) {
    const lv = Number(k)
    if (!(lv >= 1 && lv <= Math.min(unlocked, MAX_LEVEL)) || v.tries < 5) continue
    const rate = v.correct / v.tries
    if (!best || rate < best.rate) best = { lv, rate }
  }
  return best ? best.lv : null
}

export function newMissionDay(date: string, ctx: { stats: LearnStats; unlocked: number; records: Record<number, number> }): MissionDay {
  const weakLevel = findWeakLevel(ctx.stats, ctx.unlocked)
  const allCleared = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).every((lv) => (ctx.records[lv] ?? 0) >= PASS_LINE)
  // 오늘 할 수 없는 미션은 빼고 고름
  const eligible = POOL_MISSIONS.filter((id) =>
    id === "weak" ? weakLevel !== null
    : id === "newLevel" ? !allCleared
    : id === "recordRun" ? ctx.unlocked >= 11
    : true,
  )
  const rnd = seeded(date)
  const pool = [...eligible]
  const picks: MissionId[] = []
  while (picks.length < 2 && pool.length) picks.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0])
  return {
    date, picks, weakLevel, passed: [], newLevels: 0, fever: 0,
    streak10: false, perfectAny: false, dailyPerfect: false, recordRun: false, weakDone: false, invite: false, ranking: false,
    claimed: [], bonus: false,
  }
}

// 미션 설명과 진행도 (cur/goal)
export interface MissionCtx {
  attendedToday: boolean
  correctToday: number // 오늘 맞힌 문제 수 (학습 기록)
  hasDaily: boolean // 오늘의 도전이 있는지 (없으면 '오늘의 도전 만점'은 아무 레벨 만점으로)
  dailyLevel: number | null
}
export function missionInfo(id: MissionId, d: MissionDay, c: MissionCtx): { icon: string; title: string; cur: number; goal: number } {
  const b = (v: boolean) => (v ? 1 : 0)
  switch (id) {
    case "attend": return { icon: "📅", title: "출석 도장 찍기", cur: b(c.attendedToday), goal: 1 }
    case "pass5": return { icon: "🎮", title: "서로 다른 레벨 5판 통과", cur: Math.min(5, d.passed.length), goal: 5 }
    case "dailyPerfect":
      return c.hasDaily
        ? { icon: "🔥", title: `오늘의 도전(Lv.${c.dailyLevel}) 만점`, cur: b(d.dailyPerfect), goal: 1 }
        : { icon: "🔥", title: "아무 레벨이나 만점 받기", cur: b(d.perfectAny), goal: 1 }
    case "weak": return { icon: "📚", title: `약점 연습: Lv.${d.weakLevel} 통과`, cur: b(d.weakDone), goal: 1 }
    case "correct50": return { icon: "🎯", title: "오늘 문제 50개 맞히기", cur: Math.min(50, c.correctToday), goal: 50 }
    case "newLevel": return { icon: "🆙", title: "아직 통과 못 한 새 레벨 통과", cur: Math.min(1, d.newLevels), goal: 1 }
    case "fever3": return { icon: "⚡", title: "피버 타임 3번 들어가기", cur: Math.min(3, d.fever), goal: 3 }
    case "streak10": return { icon: "🔗", title: "한 판에서 10문제 연속 정답", cur: b(d.streak10), goal: 1 }
    case "perfectAny": return { icon: "💯", title: "아무 레벨이나 15문제 모두 맞히기", cur: b(d.perfectAny), goal: 1 }
    case "recordRun": return { icon: "⏱️", title: "Lv.11~13 중 하나 만점 기록 세우기", cur: b(d.recordRun), goal: 1 }
    case "invite": return { icon: "💌", title: "친구에게 초대 링크 보내기", cur: b(d.invite), goal: 1 }
    case "ranking": return { icon: "🏆", title: "랭킹 확인하기", cur: b(d.ranking), goal: 1 }
  }
}
export const todayMissions = (d: MissionDay): MissionId[] => [...FIXED_MISSIONS, ...d.picks]

// 한 판이 끝났을 때 미션 기록 갱신
export function applyGameResult(
  d: MissionDay,
  r: { level: number; score: number; passed: boolean; firstPass: boolean; dailyLevel: number | null; recordLevels: number[] },
): MissionDay {
  const n = { ...d }
  if (r.passed && !n.passed.includes(r.level)) n.passed = [...n.passed, r.level]
  if (r.passed && r.firstPass) n.newLevels += 1
  if (r.passed && n.weakLevel !== null && r.level === n.weakLevel) n.weakDone = true
  if (r.score >= TOTAL_Q) {
    n.perfectAny = true
    if (r.dailyLevel !== null && r.level === r.dailyLevel) n.dailyPerfect = true
    if (r.recordLevels.includes(r.level)) n.recordRun = true
  }
  return n
}
