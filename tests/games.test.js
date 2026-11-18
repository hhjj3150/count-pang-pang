// 🎮 자동 게임 테스트: 4명이 동시에 여러 레벨을 플레이하면서, 받은 포인트가 게임 규칙 계산과 같은지 확인
// 사용법: node tests/games.test.js [판 수=100] [레벨 고정(선택)]
const H = require('./helpers')
const TOTAL = +process.argv[2] || 100
const FORCE_LV = process.argv[3] !== undefined ? +process.argv[3] : null
const WORKERS = 4
// 일꾼마다 다른 카트·배경 장착 (보너스 계산 확인용)
const SETUP = [
  { car: 'kart_basic', carPct: 0, bg: '가로수드라이브.mp4', bgPct: 0 },
  { car: 'car_suv', carPct: 5, bg: '벚꽃드라이브.mp4', bgPct: 5 },
  { car: 'kart_fire_truck', carPct: 10, bg: '가로수드라이브.mp4', bgPct: 0 },
  { car: 'kart_lion', carPct: 15, bg: '황금의나라.mp4', bgPct: 15 },
]
const results = []
let counter = 0
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

async function worker(b, w) {
  const errs = []
  const p = await H.newPage(b, 390, 844, errs)
  const st = SETUP[w]
  // 일꾼 0·1은 Lv.1부터 차례로 열고, 2·3은 처음부터 모든 레벨을 열어 높은 레벨도 고르게 플레이
  await H.seed(p, H.baseSave({ nickname: '일꾼' + w, unlocked: FORCE_LV ?? (w >= 2 ? 14 : 1) }), {
    ...H.doneDaily(),
    cp_owned_cars: ['kart_basic', st.car], cp_equipped_car: st.car,
    cp_owned_bgs: ['가로수드라이브.mp4', '해변의드라이브.mp4', st.bg], cp_equipped_bg: st.bg,
  })
  await H.enterLobby(p)
  let local = 0
  while (true) {
    const gno = ++counter; if (gno > TOTAL) break; local++
    const notes = [], fails = []
    // 하트가 적으면 광고 보고 하트 충전 (횟수 제한 없음 확인)
    let h = await H.hearts(p)
    if (h <= 2) {
      const btn = p.getByRole('button', { name: /광고 보고 하트 충전/ })
      for (let k = 0; k < 10 - h; k++) { await btn.click(); await H.sleep(80) }
      const h2 = await H.hearts(p); if (h2 !== 10) fails.push(`광고 충전 이상 ${h}→${h2}`)
      notes.push('하트충전'); h = h2
    }
    const unlockedNow = 14 - (await H.lockedCount(p))
    const lv = FORCE_LV ?? 1 + Math.floor(Math.random() * Math.max(1, unlockedNow))
    // 이번 판 계획
    const r = gno % 10, plan = Array(15).fill('ok')
    const pick = () => 3 + Math.floor(Math.random() * 12)
    if (r === 3) { plan[pick()] = 'wrong'; plan[pick()] = 'wrong' }
    if (r === 6) { const s = new Set(); while (s.size < 4) s.add(pick()); for (const i of s) plan[i] = 'wrong' }
    if (r === 8) { plan[pick()] = 'slow' }
    if (r === 9) { plan[pick()] = 'dbl'; plan[pick()] = 'dbl' }
    if (gno % 25 === 5) plan[pick()] = 'timeout'
    if (gno % 17 === 0) plan[1] = 'wrong' // 연습(예제) 문제 오답
    const before = (await H.wallet(p)).P
    const heartsBefore = await H.hearts(p)
    let res
    try {
      await H.startLevel(p, lv)
      res = await H.playGame(p, plan)
      await p.getByText('이번 점수').waitFor({ timeout: 40000 })
      await H.sleep(2600)
      if (await H.closePromo(p)) notes.push('승급')
      await p.getByRole('button', { name: '확인', exact: true }).click(); await H.sleep(900)
      if (await H.closePromo(p)) notes.push('승급')
    } catch (e) {
      results.push({ gno, w, lv, fail: '진행 오류: ' + e.message.split('\n')[0] })
      log(`#${gno} W${w} Lv${lv} ❌ 진행 오류`, e.message.split('\n')[0])
      await H.reloadLobby(p); continue
    }
    const passed = res.correct >= 13
    const pb = passed ? H.passBonus(lv) : 0
    const kart = st.carPct && res.qPts > 0 ? Math.max(1, Math.round(res.qPts * st.carPct / 100)) : 0
    const bgB = passed && res.correct === 15 && st.bgPct ? Math.max(1, Math.round((res.qPts + pb) * st.bgPct / 100)) : 0
    const expected = res.qPts + pb + kart + bgB
    const after = (await H.wallet(p)).P
    if (after - before !== expected) fails.push(`포인트 ${after - before}P ≠ 계산 ${expected}P (정답 ${res.qPts}+통과 ${pb}+카트 ${kart}+만점 ${bgB})`)
    if ((await H.hearts(p)) !== heartsBefore - 1) fails.push('하트 1개 사용 이상')
    if (local % 6 === 0) { // 새로고침해도 그대로인지
      const w1 = await H.wallet(p); await H.reloadLobby(p); const w2 = await H.wallet(p)
      if (w1.P !== w2.P || w1.C !== w2.C) fails.push('새로고침 후 포인트 다름'); notes.push('새로고침검증')
    }
    results.push({ gno, w, lv, fails })
    log(`#${gno} W${w} Lv${lv} 정답${res.correct}/15 ${passed ? '통과' : '탈락'} +${after - before}P ${notes.join(',')} ${fails.length ? '❌ ' + fails.join(' / ') : '✅'}`)
  }
  log(`W${w} 화면 오류 ${errs.length}건`, errs.slice(0, 3))
  results.push({ w, errs })
}
;(async () => {
  const b = await H.newBrowser()
  await Promise.all([...Array(WORKERS).keys()].map((w) => worker(b, w)))
  await b.close()
  const bad = results.filter((r) => r.fail || (r.fails && r.fails.length) || (r.errs && r.errs.length))
  console.log(`\n=== 총 ${TOTAL}판, 문제 있는 판 ${bad.length} ===`)
  bad.slice(0, 10).forEach((r) => console.log(JSON.stringify(r)))
  process.exit(bad.length ? 1 : 0)
})()
