// 📋 오늘의 미션 규칙 검사 (서버 필요 없음)
require('./ts-loader')
const M = require('../lib/game/missions')
const res = []
const ck = (ok, m) => res.push((ok ? '✅ ' : '❌ ') + m)
const EMPTY = { types: {}, days: {}, games: [] }
const ctx = (o = {}) => ({ stats: EMPTY, unlocked: 14, records: {}, ...o })

// 같은 날은 같은 미션, 날마다 골고루
const a = M.newMissionDay('2026-11-19', ctx()), b = M.newMissionDay('2026-11-19', ctx())
ck(JSON.stringify(a.picks) === JSON.stringify(b.picks) && a.picks.length === 2 && a.picks[0] !== a.picks[1], `같은 날은 같은 2개 (${a.picks})`)
const seen = new Set()
for (let d = 1; d <= 60; d++) M.newMissionDay(`2026-12-${String(d).padStart(2, '0')}`, ctx()).picks.forEach((p) => seen.add(p))
ck(seen.size >= 7, `60일 동안 여러 미션이 나옴 (${seen.size}종)`)
// 할 수 없는 미션은 빠짐
let bad = 0
for (let d = 1; d <= 60; d++) {
  const day = M.newMissionDay(`2027-01-${String(d).padStart(2, '0')}`, ctx({ unlocked: 5 }))
  if (day.picks.includes('weak') || day.picks.includes('recordRun')) bad++
}
ck(bad === 0, '학습 기록이 없으면 약점 연습, Lv.11 전이면 기록 도전은 나오지 않음')
const allClear = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [i + 1, 15]))
let nl = 0
for (let d = 1; d <= 60; d++) if (M.newMissionDay(`2027-02-${d}`, ctx({ records: allClear })).picks.includes('newLevel')) nl++
ck(nl === 0, '모든 레벨을 통과했으면 새 레벨 미션은 나오지 않음')
// 약점 레벨: 5문제 이상 푼 유형 중 정답률이 가장 낮은 것
const stats = { types: { 3: { tries: 10, correct: 9 }, 5: { tries: 10, correct: 4 }, 7: { tries: 3, correct: 0 }, 12: { tries: 10, correct: 1 } }, days: {}, games: [] }
ck(M.findWeakLevel(stats, 10) === 5, `약점 레벨 = Lv.5 (3문제만 푼 Lv.7, 안 열린 Lv.12 제외) → ${M.findWeakLevel(stats, 10)}`)
// 한 판 결과 반영
let day = { ...M.newMissionDay('2026-11-19', ctx()), weakLevel: 4 }
day = M.applyGameResult(day, { level: 4, score: 15, passed: true, firstPass: true, dailyLevel: 4, recordLevels: [11, 12, 13] })
day = M.applyGameResult(day, { level: 4, score: 12, passed: true, firstPass: false, dailyLevel: 4, recordLevels: [11, 12, 13] })
day = M.applyGameResult(day, { level: 12, score: 15, passed: true, firstPass: false, dailyLevel: 4, recordLevels: [11, 12, 13] })
day = M.applyGameResult(day, { level: 6, score: 9, passed: false, firstPass: true, dailyLevel: 4, recordLevels: [11, 12, 13] })
ck(day.passed.join() === '4,12' && day.newLevels === 1 && day.weakDone && day.dailyPerfect && day.perfectAny && day.recordRun, `한 판 결과 반영 (통과 ${day.passed}, 새 레벨 ${day.newLevels})`)
const info = M.missionInfo('pass5', day, { attendedToday: false, correctToday: 0, hasDaily: true, dailyLevel: 4 })
ck(info.cur === 2 && info.goal === 5, '서로 다른 레벨 통과 2/5 (같은 레벨 두 번은 1번)')
const noDaily = M.missionInfo('dailyPerfect', { ...day, dailyPerfect: false }, { attendedToday: false, correctToday: 0, hasDaily: false, dailyLevel: null })
ck(noDaily.cur === 1 && /아무 레벨/.test(noDaily.title), '오늘의 도전이 없으면 아무 레벨 만점으로 대신')
console.log(res.join('\n'))
const fails = res.filter((r) => r.startsWith('❌'))
console.log(`\n=== ${res.length}개 중 실패 ${fails.length}개 ===`)
process.exit(fails.length ? 1 : 0)
