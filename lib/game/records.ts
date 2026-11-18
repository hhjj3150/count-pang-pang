// 🏆 이번 달 신기록·랭킹

// 🏆 이번 달 신기록 챌린지: Lv.11·12·13 만점 최단 기록(문제 푸는 시간만)의 합계로 겨룸. 매달 1일 새로 시작
export const RECORD_LEVELS = [11, 12, 13]
export type MonthBest = Partial<Record<number, number>> // 레벨 → 최고 기록(ms)
export const monthBestTotal = (b: MonthBest) =>
  RECORD_LEVELS.every((lv) => typeof b[lv] === "number") ? RECORD_LEVELS.reduce((a, lv) => a + (b[lv] as number), 0) : null
export type RankTab = "points" | 11 | 12 | 13 | "total"
export const RANK_TABS: { id: RankTab; label: string; desc: string }[] = [
  { id: "points", label: "월간\n포인트", desc: "이번 달에 모은 포인트가 많은 순서" },
  { id: 11, label: "Lv.11", desc: "Lv.11 만점 기록이 빠른 순서" },
  { id: 12, label: "Lv.12", desc: "Lv.12 만점 기록이 빠른 순서" },
  { id: 13, label: "Lv.13", desc: "Lv.13 만점 기록이 빠른 순서" },
  { id: "total", label: "합산", desc: "Lv.11+12+13 만점 기록 합계가 빠른 순서" },
]
export const RANK_SIZE = 10
export type RankEntry = { name: string; value: number; me?: boolean }
// 📡 지금은 서버가 없어서 이 기기(내) 기록만 들어감. 서버가 생기면 탭별 상위 10명을 받아와 이 목록을 채우면 됨
export const buildRanking = (tab: RankTab, me: { name: string; monthlyPoints: number; best: MonthBest }): RankEntry[] => {
  const mine =
    tab === "points" ? (me.monthlyPoints > 0 ? me.monthlyPoints : null)
    : tab === "total" ? monthBestTotal(me.best)
    : me.best[tab] ?? null
  const list: RankEntry[] = mine === null ? [] : [{ name: me.name, value: mine, me: true }]
  // 포인트는 많은 순, 기록(시간)은 짧은 순
  return list.sort((a, b) => (tab === "points" ? b.value - a.value : a.value - b.value)).slice(0, RANK_SIZE)
}
export const fmtRecord = (ms: number) => {
  const sec = ms / 1000
  const m = Math.floor(sec / 60)
  const rest = (sec - m * 60).toFixed(2)
  return m > 0 ? `${m}분 ${rest.padStart(5, "0")}초` : `${rest}초`
}
