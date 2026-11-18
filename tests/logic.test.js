// 🔢 문제 만들기 검사: 레벨마다 100판(1,500문제)씩 만들어 정답·조건이 맞는지 확인 (서버 필요 없음)
require('./ts-loader')
const { buildGame, exampleText } = require('../lib/game/questions')
const { LEVEL_TIMER } = require('../lib/game/constants')
const sum = (a) => a.reduce((x, y) => x + y, 0)
const subsetSum = (all, t, notAll = false) => { const n = all.length; for (let k = 1; k < (1 << n) - (notAll ? 1 : 0); k++) { let s = 0; for (let i = 0; i < n; i++) if (k >> i & 1) s += all[i]; if (s === t) return true } return false }
let checked = 0
const fails = []
for (let lv = 1; lv <= 14; lv++) for (let g = 0; g < 100; g++) {
  const qs = buildGame(lv)
  if (qs.length !== 15) fails.push(`Lv${lv}: 문제 수 ${qs.length}`)
  if (lv === 12) { const imp = qs.filter((q) => !q.canPartition).length; if (imp < 2 || imp > 3) fails.push(`Lv12 판${g}: 이등분 불가 ${imp}문제`) }
  qs.forEach((q, i) => {
    checked++
    const f = q.front, b = q.back, all = [...f, ...b]
    const err = (m) => fails.push(`Lv${lv} 판${g} 문제${i}: ${m} ${JSON.stringify(q)}`)
    if (lv !== 14 && q.level !== lv) err('레벨이 다른 문제')
    if (q.timer !== LEVEL_TIMER[q.level]) err('제한 시간')
    if (all.some((d) => !Number.isInteger(d) || d < 0 || d > 9)) err('숫자 범위')
    switch (q.level) {
      case 1: if (q.answer !== sum(f)) err('정답'); break
      case 2: if (q.answer !== sum(b)) err('정답'); break
      case 3: if (f.length !== 2 || q.answer !== sum(all)) err('정답/자리 수'); break
      case 4: if (f.length !== 3 || q.answer !== sum(all)) err('정답/자리 수'); break
      case 5: { const e = sum(f) > sum(b) ? 'front' : sum(f) < sum(b) ? 'back' : 'equal'; if (q.answer !== e) err('비교 정답'); break }
      case 6: if (q.answer !== Math.abs(sum(f) - sum(b))) err('차이 정답'); break
      case 7: { const even = q.title.startsWith('짝수'); if (q.answer !== sum(all.filter((d) => (even ? d % 2 === 0 : d % 2 === 1)))) err('홀짝 정답'); break }
      case 8: if (q.totalForHidden !== sum(all) || q.answer !== all[q.hiddenPos]) err('가려진 숫자'); break
      case 9: if (q.target !== 20 || !subsetSum(all, 20)) err('20 만들기'); break
      case 10: if (!(q.target >= 11 && q.target <= 30) || !subsetSum(all, q.target)) err('숫자 만들기'); break
      case 11: { const n = (ds) => Number(ds.join('')); if (q.answer !== n(b) + n(f) || q.answer > 9999 || f[0] === 0 || b[0] === 0) err('큰 수 덧셈'); break }
      case 12: { const ok = sum(all) % 2 === 0 && subsetSum(all, sum(all) / 2, true); if (q.canPartition !== ok) err('이등분 판정'); break }
      case 13: { const lit = q.lit ?? []; if (lit.length !== 3 || q.answer !== lit.reduce((p, i) => p * all[i], 1)) err('불빛 곱셈'); break }
    }
    if (q.type === 'target') { const ex = exampleText(q).split(' = ')[0].split('+').map(Number); if (sum(ex) !== q.target) err('예시 정답') }
  })
}
console.log(`검사한 문제 ${checked}개, 오류 ${fails.length}개`)
fails.slice(0, 5).forEach((f) => console.log('❌', f))
process.exit(fails.length ? 1 : 0)
