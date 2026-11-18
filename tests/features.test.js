// ✅ 기능별 점검: 가입, 게임 방법, 하트, 출석, 초대, 상점, 저장, 관리, 랭킹, 보너스, 뒤로가기, 게임 설명, 기록 등
const H = require('./helpers')
const { sleep } = H
const res = []
const ck = (c, m) => { res.push((c ? '✅ ' : '❌ ') + m); }
const step = async (name, fn) => { try { await fn() } catch (e) { ck(false, `${name} 실행 오류: ${e.message.split('\n')[0]}`) } }

;(async () => {
  const b = await H.newBrowser(); const errs = []
  let p = await H.newPage(b, 390, 844, errs)

  // ── A. 신규 가입: 게임 방법 자동 표시 없음, Lv.1 열림
  await step('A', async () => {
    await H.seed(p, null)
    await p.getByText('시작하기').click(); await p.locator('input').first().fill('점검왕')
    await p.locator('#birth').selectOption('1990')
    await p.locator('input').first().press('Enter'); await sleep(1200)
    ck(!(await p.getByText(/🎓 게임 방법/).isVisible()), 'A1 가입 직후 게임 방법 자동 표시 안 함')
    ck((await H.lockedCount(p)) === 13, 'A2 가입하면 Lv.1 열림')
    const w = await H.wallet(p); ck(w.P === 0 && w.C === 0, `A3 가입 직후 0P 0C`)
    ck((await H.hearts(p)) === 5, 'A4 시작 하트 5개')
  })
  // ── B. 게임 방법(Lv.0): 10장, 끝까지 보면 +5P 한 번만, 하트 안 씀
  await step('B', async () => {
    for (let round = 0; round < 2; round++) {
      await H.levelCard(p, 0).click(); await sleep(400)
      if (round === 0) ck(await p.getByText('🎓 게임 방법 1/10').isVisible(), 'B1 게임 방법 10장')
      for (let i = 0; i < 9; i++) { await p.getByRole('button', { name: '다음 ▶' }).click(); await sleep(120) }
      await p.getByRole('button', { name: '시작하기! 🚀' }).click(); await sleep(700)
    }
    ck((await H.wallet(p)).P === 5, 'B2 게임 방법 완료 +5P (두 번째는 없음)')
    ck((await H.hearts(p)) === 5, 'B3 게임 방법은 하트 사용 안 함')
  })
  // ── C. 광고 보고 하트 충전: 무제한, 최대 10, 1회 +2C
  await step('C', async () => {
    const btn = p.getByRole('button', { name: /광고 보고 하트 충전/ })
    for (let i = 0; i < 7; i++) { await btn.click(); await sleep(120) }
    const w = await H.wallet(p)
    ck((await H.hearts(p)) === 10 && w.C === 10, `C1 광고 충전: 하트 10(최대), 캐시 ${w.C}C (5회×2C)`)
    ck(await p.getByText(/하트가 가득 찼어요/).isVisible(), 'C2 가득 차면 안내')
  })
  // ── D. 출석체크
  await step('D', async () => {
    await p.getByRole('button', { name: '📅 출석체크' }).click(); await sleep(400)
    await p.getByRole('button', { name: /출석하고 포인트 받기/ }).click(); await sleep(400)
    ck((await H.wallet(p)).P === 10, 'D1 출석 +5P')
    await p.getByRole('button', { name: '📅 출석체크' }).click(); await sleep(400)
    const done = p.getByRole('button', { name: '오늘 출석 완료 ✅' })
    ck(await done.isVisible() && await done.isDisabled(), 'D2 다시 열면 오늘 출석 완료 (누를 수 없음)')
    await p.goBack(); await sleep(400)
    const w = await H.wallet(p); await H.reloadLobby(p)
    const att = (await H.getSave(p))?.attendance ?? JSON.parse(await p.evaluate(() => localStorage.getItem('cp_attendance') || 'null'))
    ck(att && att.weekCount === 1 && att.lastMonday && (await H.wallet(p)).P === w.P, `D3 새로고침 후에도 이번 주 출석 1회 유지 (${JSON.stringify(att)})`)
  })
  // ── E. 친구 초대
  await step('E', async () => {
    await p.evaluate(() => { navigator.share = async () => {} })
    await p.getByRole('button', { name: '💌 초대' }).click(); await sleep(1500)
    const w = await H.wallet(p); ck(w.P === 40 && w.C === 20, `E1 초대 +30P +10C (${w.P}P ${w.C}C)`)
  })
  await p.close()

  // ── F. 상점: 가격, 띠 조건, 구매, 장착
  p = await H.newPage(b, 360, 740, errs)
  const kartCard = (name) => p.locator('div.relative.p-3', { hasText: name }).filter({ visible: true }).first()
  const openShop = async (tab) => { await p.getByRole('button', { name: '🛒 포인트 상점' }).click(); await sleep(400); if (tab) { await p.getByRole('button', { name: tab }).click(); await sleep(500) } }
  await step('F', async () => {
    await H.seed(p, H.baseSave({ points: 100000, hearts: 5, lifetimePoints: 5000 }), H.doneDaily()); await H.enterLobby(p)
    await openShop('🏎️ 카트')
    ck((await kartCard('SUV').innerText()).includes('2,000 P 구매'), 'F1 SUV 2,000P, 화이트 구매 가능')
    ck((await kartCard('소방 카트').innerText()).includes('🔒 블루 벨트부터 · 6,000P'), 'F2 특수 카트는 블루부터')
    ck((await kartCard('대머리사자 카트').innerText()).includes('🔒 퍼플 벨트부터 · 16,000P'), 'F3 동물 카트는 퍼플부터')
    let w0 = (await H.wallet(p)).P
    await kartCard('SUV').getByRole('button', { name: /P 구매/ }).click(); await sleep(300)
    ck(w0 - (await H.wallet(p)).P === 2000, 'F4 SUV 구매 2,000P')
    await p.getByRole('button', { name: /🏞️ 배경/ }).click(); await sleep(400)
    const bgTexts = (await p.locator('div.relative.p-3').filter({ visible: true }).allInnerTexts()).join('|')
    ck(!/해제/.test(bgTexts) && bgTexts.includes('만점 보너스 +5%') && bgTexts.includes('1,500 P'), 'F5 배경: 잠금 없음, 만점 보너스, 1,500P')
    w0 = (await H.wallet(p)).P
    await p.locator('div.relative.p-3', { hasText: '황금의나라' }).filter({ visible: true }).getByRole('button', { name: /P 구매/ }).click(); await sleep(300)
    ck(w0 - (await H.wallet(p)).P === 7000, 'F6 황금의나라 구매 7,000P')
    w0 = (await H.wallet(p)).P
    await p.getByRole('button', { name: /하트 \+1 충전하기 \(150P\)/ }).click(); await sleep(300)
    ck(w0 - (await H.wallet(p)).P === 150 && (await H.hearts(p)) === 6, 'F7 하트 구매 150P')
    await p.getByRole('button', { name: /📸 이모티콘/ }).click(); await sleep(500)
    ck(await p.getByText('단품 각 300 P').isVisible(), 'F8 팡이 이모티콘 300P')
    w0 = (await H.wallet(p)).P
    await p.locator('img[src*="emoticons"]').filter({ visible: true }).first().click(); await sleep(400)
    await p.getByRole('button', { name: /P로 구매하기/ }).click(); await sleep(400)
    ck(w0 - (await H.wallet(p)).P === 300, 'F9 이모티콘 구매 300P')
    await p.goBack(); await sleep(300); await p.goBack(); await sleep(300)
    await p.getByRole('button', { name: '⚙️ 관리' }).click(); await sleep(400)
    await p.getByRole('button', { name: '🚗 내 차고' }).click(); await sleep(400)
    await kartCard('SUV').getByRole('button', { name: '장착' }).click(); await sleep(300)
    await p.getByRole('button', { name: '🏞️ 내 테마' }).click(); await sleep(400)
    await p.locator('div.relative.p-3', { hasText: '황금의나라' }).filter({ visible: true }).getByRole('button', { name: '적용' }).click(); await sleep(300)
    await p.goBack(); await sleep(300)
  })
  // ── G. 새로고침 후 저장 유지 (화면으로 확인)
  await step('G', async () => {
    const before = { w: await H.wallet(p), h: await H.hearts(p) }
    await H.reloadLobby(p)
    const after = { w: await H.wallet(p), h: await H.hearts(p) }
    ck(JSON.stringify(before) === JSON.stringify(after), `G1 새로고침 후 포인트·캐시·하트 유지`)
    await p.getByRole('button', { name: '⚙️ 관리' }).click(); await sleep(400)
    await p.getByRole('button', { name: '🚗 내 차고' }).click(); await sleep(300)
    const carOk = await kartCard('SUV').getByRole('button', { name: '장착중' }).isVisible()
    await p.getByRole('button', { name: '🏞️ 내 테마' }).click(); await sleep(300)
    const bgOk = await p.locator('div.relative.p-3', { hasText: '황금의나라' }).filter({ visible: true }).getByRole('button', { name: '적용중' }).isVisible()
    await p.goBack(); await sleep(300)
    await openShop('📸 이모티콘')
    const emoOk = (await p.locator('img[src*="emoticons"]').filter({ visible: true }).first().evaluate((e) => !e.className.includes('grayscale')))
    await p.goBack(); await sleep(300)
    ck(carOk && bgOk && emoOk, `G2 장착 카트·배경, 산 이모티콘 유지 (카트 ${carOk} 배경 ${bgOk} 이모티콘 ${emoOk})`)
  })
  // ── H. 관리 요약 + 랭킹
  await step('H', async () => {
    await p.getByRole('button', { name: /🪙/ }).click(); await sleep(500)
    ck(await p.getByText('보유 포인트').isVisible() && await p.getByText('누적 포인트').first().isVisible(), 'H1 포인트 칸 → 관리(보유·이번 달·누적·캐시)')
    ck(await p.getByText('📋 게임 설명').isVisible(), 'H2 관리에 게임 설명 켜기/끄기')
    await p.goBack(); await sleep(300)
    await p.getByRole('button', { name: /랭킹/ }).first().click(); await sleep(400)
    ck((await p.locator('ol li').count()) === 10, 'H3 랭킹 10줄')
    for (const t of ['Lv.11', 'Lv.12', 'Lv.13', '합산']) await p.getByRole('button', { name: t, exact: true }).click()
    await p.goBack(); await sleep(400)
    ck(!(await p.locator('ol li').first().isVisible().catch(() => false)), 'H4 뒤로가기로 랭킹 닫힘')
  })
  // ── I. 결과 보너스: SUV(5%) + 황금의나라(15%), Lv.1 만점 → 정답 165 + 통과 30 + 카트 8 + 만점 29
  await step('I', async () => {
    await H.seed(p, H.baseSave({ unlocked: 3 }), { ...H.doneDaily(), cp_owned_cars: ['kart_basic', 'car_suv'], cp_equipped_car: 'car_suv', cp_owned_bgs: ['가로수드라이브.mp4', '황금의나라.mp4'], cp_equipped_bg: '황금의나라.mp4' })
    await H.enterLobby(p)
    const w0 = (await H.wallet(p)).P
    await H.startLevel(p, 1)
    const r = await H.playGame(p, Array(15).fill('ok'))
    await p.getByText('이번 점수').waitFor(); await sleep(2800); await H.closePromo(p)
    const t = (await p.locator('section').filter({ hasText: '이번 점수' }).innerText()).replace(/\n/g, ' ')
    const kart = Math.max(1, Math.round(r.qPts * 0.05)), bg = Math.max(1, Math.round((r.qPts + 30) * 0.15))
    ck(t.includes(`카트 보너스 +${kart}P`) && t.includes(`만점 보너스 +${bg}P`), `I1 결과: 정답 ${r.qPts} · 카트 +${kart} · 만점 +${bg}`)
    await p.getByRole('button', { name: '확인', exact: true }).click(); await sleep(900); await H.closePromo(p)
    ck((await H.wallet(p)).P - w0 === r.qPts + 30 + kart + bg, 'I2 받은 포인트 합계가 계산과 같음')
  })
  // ── J. 게임 중 뒤로가기
  await step('J', async () => {
    await H.startLevel(p, 2); await sleep(1200)
    await p.goBack(); await sleep(400)
    ck(await p.getByText('게임을 그만둘까요?').isVisible(), 'J1 게임 중 뒤로가기 → 그만둘까요?')
    await p.goBack(); await sleep(400)
    ck(!(await p.getByText('게임을 그만둘까요?').isVisible()) && await p.getByText(/^\d+\/15$/).isVisible(), 'J2 한 번 더 → 게임 계속')
    await p.goBack(); await sleep(300); await p.getByRole('button', { name: '그만두기' }).click(); await sleep(900)
  })
  // ── K. 소리 설정 유지, 로비 뒤로가기
  await step('K', async () => {
    const mute = () => p.getByRole('button', { name: /소리 (켜기|끄기)/ })
    const before = await mute().innerText(); await mute().click(); await sleep(300)
    await H.reloadLobby(p)
    ck((await mute().innerText()) !== before, 'K1 소리 설정 새로고침 후 유지')
    await p.goBack(); await sleep(500)
    ck(/종료|나가|그만/.test(await p.locator('body').innerText()), 'K2 로비 뒤로가기 → 종료 확인')
  })
  await p.close()

  // ── L. 작은 화면 로비 넘침 없음
  await step('L', async () => {
    const q = await H.newPage(b, 360, 640, errs)
    await H.seed(q, H.baseSave({ nickname: '아주긴닉네임테스트', points: 123456, lifetimePoints: 199999, cash: 12345 }), H.doneDaily()); await H.enterLobby(q)
    const ov = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    const rowOver = await q.evaluate(() => [...document.querySelectorAll('header > div')].flatMap((r) => [...r.children]).filter((c) => c.scrollWidth > c.clientWidth + 1).length)
    ck(ov <= 0 && rowOver === 0, `L1 360px 로비 넘침 없음 (가로 ${ov}px, 넘친 버튼 ${rowOver}개)`)
    await q.close()
  })
  // ── M. 페이지·아이콘
  await step('M', async () => {
    const q = await H.newPage(b)
    for (const u of ['/privacy', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-icon.png']) { const r = await q.request.get(H.URL + u); ck(r.status() === 200, `M ${u} → ${r.status()}`) }
    await q.close()
  })

  // ── N. 게임 설명 팝업
  p = await H.newPage(b, 360, 640, errs)
  await step('N', async () => {
    await H.seed(p, H.baseSave(), H.doneDaily()); await H.enterLobby(p)
    let allFit = true
    for (let lv = 1; lv <= 14; lv++) {
      await H.levelCard(p, lv).scrollIntoViewIfNeeded(); await H.levelCard(p, lv).click(); await sleep(350)
      const box = await p.getByRole('button', { name: H.GUIDE_CLOSE }).boundingBox()
      if (!box || box.y + box.height > 640) allFit = false
      await p.goBack(); await sleep(300)
    }
    ck(allFit, 'N1 Lv.1~14 설명 팝업이 작은 화면에 다 들어감')
    await sleep(800)
    ck((await H.hearts(p)) === 10, 'N2 설명만 보고 뒤로가기 → 하트 그대로')
    await H.startLevel(p, 1); await sleep(1000)
    ck(await p.getByText(/^1\/15$/).isVisible() && (await p.evaluate(() => true)), 'N3 닫기 → 게임 시작')
    await p.goBack(); await sleep(300); await p.getByRole('button', { name: '그만두기' }).click(); await sleep(1000)
    ck((await H.hearts(p)) === 9, 'N4 게임을 시작할 때만 하트 사용')
    await p.getByRole('button', { name: '⚙️ 관리' }).click(); await sleep(400)
    await p.getByRole('button', { name: '끄기', exact: true }).click(); await sleep(300); await p.goBack(); await sleep(300)
    await H.reloadLobby(p)
    await H.levelCard(p, 2).click(); await sleep(1000)
    ck(!(await p.getByRole('button', { name: H.GUIDE_CLOSE }).isVisible()) && await p.getByText(/^1\/15$/).isVisible(), 'N5 끄기 → 새로고침 후에도 바로 시작')
    await p.goBack(); await sleep(300); await p.getByRole('button', { name: '그만두기' }).click(); await sleep(1000)
    await p.getByRole('button', { name: '⚙️ 관리' }).click(); await sleep(400)
    await p.getByRole('button', { name: '켜기', exact: true }).click(); await sleep(300); await p.goBack(); await sleep(300)
    await H.levelCard(p, 2).click(); await sleep(400)
    ck(await p.getByRole('button', { name: H.GUIDE_CLOSE }).isVisible(), 'N6 켜기 → 다시 팝업')
    await p.goBack(); await sleep(300)
  })
  // ── O. 신기록·랭킹: Lv.12 만점 → 기록 저장 → 랭킹 1위
  await step('O', async () => {
    await H.seed(p, H.baseSave(), H.doneDaily()); await H.enterLobby(p)
    await H.startLevel(p, 12)
    await H.playGame(p, Array(15).fill('ok'))
    await p.getByText('이번 점수').waitFor(); await sleep(2800); await H.closePromo(p)
    const box = await p.getByText(/⏱ 이번 기록/).innerText().catch(() => '')
    ck(/이번 기록/.test(box) && await p.getByText(/이번 달 Lv\.12 신기록/).isVisible(), 'O1 Lv.12 만점 → 이번 기록·신기록 표시')
    await p.getByRole('button', { name: '확인', exact: true }).click(); await sleep(900); await H.closePromo(p)
    await p.getByRole('button', { name: /랭킹/ }).first().click(); await sleep(300)
    await p.getByRole('button', { name: 'Lv.12', exact: true }).click(); await sleep(300)
    ck(/테스터 \(나\)\s*\d/.test(await p.locator('ol li').first().innerText()), 'O2 랭킹 Lv.12 1위에 내 기록')
    await p.goBack(); await sleep(300)
    await H.reloadLobby(p)
    await p.getByRole('button', { name: /랭킹/ }).first().click(); await sleep(300); await p.getByRole('button', { name: 'Lv.12', exact: true }).click(); await sleep(300)
    ck(/테스터 \(나\)/.test(await p.locator('ol li').first().innerText()), 'O3 새로고침 후에도 기록 유지')
    await p.goBack(); await sleep(300)
  })
  // ── P. 예전 저장값 변환 (ver3 → 최신): Lv.9 ↔ 10 기록 교환, 열린 레벨 수 유지
  await step('P', async () => {
    await H.seed(p, H.baseSave({ ver: 3, unlocked: 11, records: { 0: 15, 8: 14, 9: 15, 10: 13 } }))
    await H.enterLobby(p)
    const d = await H.getSave(p)
    ck(d.records[9] === 13 && d.records[10] === 15 && d.records[8] === 14 && d.unlocked === 11, `P1 ver3 저장값 변환 (기록 ${JSON.stringify(d.records)}, 열린 레벨 ${d.unlocked})`)
  })
  // ── Q. Lv.9(20 만들기), Lv.10(제시된 숫자 만들기) 실제 풀기
  await step('Q', async () => {
    await H.seed(p, H.baseSave(), H.doneDaily()); await H.enterLobby(p)
    for (const lv of [9, 10]) {
      await H.startLevel(p, lv)
      const titles = new Set()
      const r = await (async () => { const orig = H.readQ; return H.playGame(p, Array(15).fill('ok')) })()
      await p.getByText('이번 점수').waitFor(); await sleep(2800); await H.closePromo(p)
      ck(r.correct === 15 && /15 \/ 15/.test((await p.getByText('이번 점수').locator('..').innerText()).replace(/\s+/g, ' ')), `Q Lv.${lv} 15문제 모두 정답 처리`)
      await p.getByRole('button', { name: '확인', exact: true }).click(); await sleep(900); await H.closePromo(p)
    }
  })
  await p.close()

  console.log(res.join('\n'))
  const bad = res.filter((r) => r.startsWith('❌'))
  console.log(`\n=== ${res.length}개 항목 중 실패 ${bad.length}개 ===`)
  console.log('화면 오류:', errs.length ? errs.slice(0, 5) : '없음')
  await b.close()
  process.exit(bad.length || errs.length ? 1 : 0)
})()
