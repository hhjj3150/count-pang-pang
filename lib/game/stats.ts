// 📊 학습 기록 형식
// 내 정보 묶음(SaveData.stats)에 저장. 예제 3문제는 정답을 보여주므로 기록에서 제외, 시간 초과는 오답으로 기록
export interface LearnStats {
  types: Record<number, { tries: number; correct: number }> // 문제 유형(로직 레벨 1~10)별
  days: Record<string, { games: number; solved: number; correct: number }> // 날짜별
  games: { date: string; level: number; score: number }[] // 최근 게임 (최대 30개)
}
export const EMPTY_STATS: LearnStats = { types: {}, days: {}, games: [] }
