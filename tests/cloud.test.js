// 가짜 로그인 세션 + 가짜 서버 응답으로 기록 고르기·불러오기·올리기 흐름 점검 (실제 서버에 접속하지 않음)
const H = require('./helpers')
const { sleep } = H
const UID = '11111111-2222-3333-4444-555555555555'
const now = Math.floor(Date.now() / 1000)
const session = { access_token: 'x.y.z', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'r',
  user: { id: UID, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'kakao' }, user_metadata: { name: '카카오테스터' }, created_at: new Date().toISOString() } }
const res = []; const ck = (ok, m) => res.push((ok ? '✅ ' : '❌ ') + m)
;(async () => {
  const b = await H.newBrowser(); const p = await H.newPage(b)
  let server = null; let pushes = []
  await p.route('**/rest/v1/profiles**', async (r) => {
    const m = r.request().method()
    if (m === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: server ? JSON.stringify(server) : '' , headers: server ? {} : {} }).catch(()=>{})
    if (m === 'POST') { pushes.push(JSON.parse(r.request().postData())); return r.fulfill({ status: 201, body: '' }) }
    r.fulfill({ status: 200, body: '' })
  })
  await p.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const withSession = (extra) => Object.assign({ 'sb-zzekinnnhizuwaczyrqp-auth-token': session }, extra)
  // 1) 처음 연결, 서버에 기록 있음 → 고르기 창
  server = { save: H.baseSave({ ver: 5, nickname: '서버아이', points: 9999, lifetimePoints: 30000, savedAt: Date.now() - 86400000 }), save_version: 5, updated_at: new Date().toISOString() }
  await H.seed(p, H.baseSave({ points: 111 }), withSession(H.doneDaily())); await sleep(3000)
  const cf = p.getByTestId('cloud-conflict')
  ck(await cf.isVisible() && /서버아이/.test(await cf.innerText()) && /테스터/.test(await cf.innerText()), '1 서버 기록이 있으면 두 기록을 나란히 보여 줌')
  await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/conflict.png' })
  await cf.getByRole('button', { name: /서버 기록/ }).click(); await sleep(2500)
  let s = await H.getSave(p)
  ck(s.nickname === '서버아이' && s.points === 9999 && s.cloudUserId === UID, '2 서버 기록 고르기 → 서버 기록으로 바뀜')
  ck(/카카오테스터/.test(await p.getByTestId('cloud-linked').innerText()) && /불러왔어요/.test(await p.getByTestId('cloud-linked').innerText()), '2-1 새로고침 뒤 연결 완료 창 (연결된 카카오 계정 이름)')
  // 2) 같은 계정, 서버가 더 최신 → 자동 불러오기
  server = { save: H.baseSave({ ver: 5, nickname: '다른폰', points: 4242, savedAt: Date.now() + 5000 }), save_version: 5, updated_at: new Date().toISOString() }
  await H.seed(p, H.baseSave({ points: 1, cloudUserId: UID, savedAt: Date.now() - 1000 }), withSession(H.doneDaily())); await p.waitForTimeout(3000)
  s = await H.getSave(p)
  ck(s.points === 4242 && s.cloudUserId === UID, '3 다른 기기의 더 최신 기록을 자동으로 불러옴')
  // 3) 서버에 기록 없음 → 바로 연결 + 올리기
  server = null; pushes = []
  await H.seed(p, H.baseSave({ points: 321 }), withSession(H.doneDaily())); await sleep(5000)
  s = await H.getSave(p)
  ck(s.cloudUserId === UID && pushes.some((x) => x.id === UID && x.save.points === 321), '4 서버 기록이 없으면 이 휴대폰 기록을 바로 연결해서 올림')
  const lp = p.getByTestId('cloud-linked')
  ck(await lp.isVisible() && /카카오테스터/.test(await lp.innerText()), '4-1 연결 완료 창에 연결된 카카오 계정 이름')
  await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/linked_popup.png' })
  await lp.getByRole('button', { name: '확인' }).click(); await sleep(300)
  await H.enterLobby(p)
  await p.getByRole('button', { name: '⚙️ 관리' }).click(); await sleep(400)
  ck(/연결됐어요/.test(await p.getByTestId('cloud-card').innerText()) && /연결된 카카오 계정: 카카오테스터/.test(await p.getByTestId('cloud-card').innerText()), '5 관리 화면에 연결 상태와 카카오 계정 이름 표시')
  await p.getByTestId('cloud-card').screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/card.png' })
  // 4) 고르기 창에서 '이 휴대폰 기록'
  server = { save: H.baseSave({ ver: 5, nickname: '서버아이', points: 9999 }), save_version: 5, updated_at: new Date().toISOString() }; pushes = []
  await H.seed(p, H.baseSave({ points: 222 }), withSession(H.doneDaily())); await sleep(3000)
  await p.getByTestId('cloud-conflict').getByRole('button', { name: /이 휴대폰 기록/ }).click(); await sleep(5000)
  s = await H.getSave(p)
  ck(s.points === 222 && s.cloudUserId === UID && pushes.some((x) => x.save.points === 222) && await p.getByTestId('cloud-linked').isVisible(), '6 이 휴대폰 기록 고르기 → 서버를 이 기록으로 덮어씀 + 연결 완료 창')
  // ── 👨‍👩‍👧 보호자 연결 (만 14세 미만)
  const kid = (o = {}) => H.baseSave({ birthYear: new Date().getFullYear() - 9, ...o })
  let consents = []; let consentPosts = []; let revokes = 0; let profileDeletes = 0
  await p.route('**/rest/v1/guardian_consents**', async (r) => {
    const m = r.request().method()
    if (m === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(consents.filter((c) => !c.revoked_at)) })
    if (m === 'POST') { const d = JSON.parse(r.request().postData()); consentPosts.push(d); consents.push({ ...d, consented_at: new Date().toISOString() }); return r.fulfill({ status: 201, body: '' }) }
    if (m === 'PATCH') { revokes++; consents.forEach((c) => (c.revoked_at = 'x')); return r.fulfill({ status: 204, body: '' }) }
    r.fulfill({ status: 200, body: '' })
  })
  await p.route('**/rest/v1/profiles**', async (r) => {
    if (r.request().method() === 'DELETE') { profileDeletes++; return r.fulfill({ status: 204, body: '' }) }
    r.fallback()
  })
  server = null
  // 테스트 모드가 꺼져 있으면 보호자 연결 버튼 없음
  await H.seed(p, kid(), H.doneDaily()); await H.enterLobby(p)
  await p.getByRole('button', { name: '⚙️ 관리' }).click(); await sleep(400)
  ck(!(await p.getByRole('button', { name: /보호자와 연결하기/ }).count()), '7 테스트 모드가 아니면 어린이에게 연결 버튼 없음')
  // 테스트 모드 켜고 보호자 연결 단계 진행
  await p.goto(H.URL + '/?guardian-test=1'); await H.enterLobby(p)
  await p.getByRole('button', { name: '⚙️ 관리' }).click(); await sleep(400)
  await p.getByRole('button', { name: /보호자와 연결하기/ }).click(); await sleep(300)
  const g = p.getByTestId('guardian-link')
  await g.getByRole('button', { name: /시작할게요/ }).click()
  ck(await g.getByRole('button', { name: /다음/ }).isDisabled(), '8 필수 동의 전에는 다음으로 못 감')
  await g.getByRole('button', { name: /모두 동의/ }).click()
  await g.getByRole('button', { name: /다음/ }).click()
  await g.getByRole('button', { name: /인증하기/ }).click()
  const errShown = await g.getByText('보호자 이름을 입력해 주세요').isVisible()
  await g.locator('#g-name').fill('김보호'); await g.locator('#g-phone').fill('010-1234-5678'); await g.locator('#g-birth').selectOption('1985')
  await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/guardian_verify.png' })
  await g.getByRole('button', { name: /인증하기/ }).click()
  let authUrl = ''
  await p.route('**/auth/v1/authorize**', (r) => { authUrl = r.request().url(); r.fulfill({ status: 204, body: '' }) }) // 204: 화면 이동 없이 멈춤
  await g.getByRole('button', { name: /보호자 카카오 계정으로 연결/ }).click(); await sleep(1500)
  const pending = await p.evaluate(() => JSON.parse(localStorage.getItem('cp_guardian_pending') || 'null'))
  ck(errShown && authUrl.includes('provider=kakao') && pending?.guardian?.phone === '01012345678' && pending.items.childInfo, '9 동의·테스트 인증 → 보호자 카카오 로그인으로 이동 (동의 내용 잠시 보관)')
  // 카카오에서 돌아옴 (세션 + 보관한 동의) → 동의 기록 저장 후 연결
  pushes = []
  await H.seed(p, kid({ points: 77 }), withSession({ ...H.doneDaily(), cp_guardian_pending: pending, cp_guardian_test: '1' })); await sleep(5000)
  let k = await H.getSave(p)
  ck(consentPosts.length === 1 && consentPosts[0].method === 'test' && consentPosts[0].guardian_name === '김보호' && k.cloudUserId === UID && pushes.some((x) => x.save.points === 77), '10 돌아오면 동의 기록 저장 + 아이 기록 서버에 올림')
  if (await p.getByTestId('cloud-linked').isVisible()) await p.getByTestId('cloud-linked').getByRole('button', { name: '확인' }).click()
  await H.enterLobby(p)
  await p.getByRole('button', { name: '⚙️ 관리' }).click(); await sleep(400)
  const card = p.getByTestId('cloud-card')
  ck(/보호자 동의: 김\*\*/.test(await card.innerText()), '11 관리 화면에 보호자 동의 표시 (이름 가림)')
  await card.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/guardian_card.png' })
  await card.getByRole('button', { name: '보호자 동의 취소' }).click(); await sleep(200)
  await card.getByRole('button', { name: '동의 취소', exact: true }).click(); await sleep(1500)
  k = await H.getSave(p)
  ck(revokes === 1 && profileDeletes === 1 && !k.cloudUserId && k.points === 77, '12 동의 취소 → 서버 기록 삭제·연결 끊김, 휴대폰 기록은 그대로')
  // 동의 없이 로그인된 아이 → 연결 안 함
  consents = []; pushes = []
  await H.seed(p, kid({ points: 5 }), withSession(H.doneDaily())); await H.enterLobby(p); await sleep(4000)
  k = await H.getSave(p)
  ck(!k.cloudUserId && pushes.length === 0, '13 보호자 동의가 없는 아이 계정은 서버에 올리지 않음')
  // ── 💬 첫 화면 '카카오로 시작하기' (이 기기에 기록 없음)
  consents = []; server = null; pushes = []
  await H.seed(p, null, withSession({})); await sleep(4000)
  ck(await p.getByTestId('signup-kakao').isVisible() && /카카오테스터/.test(await p.getByTestId('signup-kakao').innerText()), '14 카카오로 처음 시작 → 닉네임·태어난 해 정하는 화면')
  await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/signup_kakao.png' })
  await p.locator('#nick').fill('새친구'); await p.locator('#birth').selectOption('1990')
  await p.getByRole('button', { name: '입장하기' }).click(); await sleep(5000)
  k = await H.getSave(p)
  ck(k.nickname === '새친구' && k.cloudUserId === UID && pushes.some((x) => x.save.nickname === '새친구') && await p.getByTestId('cloud-linked').isVisible(), '15 입장하면 새 기록으로 연결 + 서버에 올림 + 연결 완료 창')
  server = { save: H.baseSave({ ver: 5, nickname: '돌아온친구', points: 8888 }), save_version: 5, updated_at: new Date().toISOString() }
  await H.seed(p, null, withSession({})); await sleep(4000)
  k = await H.getSave(p)
  ck(k.nickname === '돌아온친구' && k.points === 8888 && /환영/.test(await p.getByTestId('cloud-linked').innerText()), '16 서버에 기록이 있으면 바로 불러오기 (다시 오신 걸 환영해요)')
  server = null; pushes = []
  await H.seed(p, null, withSession({})); await sleep(4000)
  await p.locator('#nick').fill('꼬마'); await p.locator('#birth').selectOption(String(new Date().getFullYear() - 8))
  await p.getByRole('button', { name: '입장하기' }).click(); await sleep(500)
  const ks = p.getByTestId('kid-start')
  ck(await ks.isVisible() && /준비 중/.test(await ks.innerText()), '17 어린이가 카카오로 시작 → 부모님과 함께 안내 (테스트 모드 아니면 준비 중)')
  await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/kid_start.png' })
  await ks.getByRole('button', { name: '손님으로 먼저 하기' }).click(); await sleep(2500)
  k = await H.getSave(p)
  const tok = await p.evaluate(() => localStorage.getItem('sb-zzekinnnhizuwaczyrqp-auth-token'))
  ck(k.nickname === '꼬마' && !k.cloudUserId && !tok && pushes.length === 0, '18 손님으로 먼저 하기 → 로그아웃, 기록은 휴대폰에만')
  // ── 🔐 다음부터 자동 로그인하기를 끈 경우
  await p.evaluate(() => sessionStorage.clear()) // 앞 단계에서 이 탭에 남은 '로그인함' 표시 지우기
  server = null; pushes = []
  await H.seed(p, H.baseSave({ points: 31, cloudUserId: UID }), withSession({ ...H.doneDaily(), cp_auto_login: '0' })); await sleep(3500)
  let tok2 = await p.evaluate(() => localStorage.getItem('sb-zzekinnnhizuwaczyrqp-auth-token'))
  ck(!tok2 && pushes.length === 0 && await p.getByRole('button', { name: '💬 카카오로 로그인하기' }).isVisible(), '19 자동 로그인 끔 + 앱을 새로 열면 → 로그아웃, 카카오로 로그인하기 버튼')
  await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/intro_relogin.png' })
  await p.evaluate(() => sessionStorage.setItem('cp_session_alive', '1')) // 이 탭에서 로그인한 상태
  await H.seed(p, H.baseSave({ points: 32, cloudUserId: UID }), withSession({ ...H.doneDaily(), cp_auto_login: '0' }))
  await p.reload(); await sleep(3500)
  tok2 = await p.evaluate(() => localStorage.getItem('sb-zzekinnnhizuwaczyrqp-auth-token'))
  ck(!!tok2 && /로그인 중/.test(await p.locator('body').innerText()), '20 자동 로그인 꺼도 같은 탭(로그인 직후·새로고침)에서는 로그인 유지')
  await p.evaluate(() => sessionStorage.clear())
  // ── 🏆 서버 랭킹 (가짜 서버 응답)
  await p.evaluate(() => sessionStorage.clear())
  let rankCalls = []
  await p.unroute('**/rest/v1/rpc/get_ranking**')
  await p.route('**/rest/v1/rpc/get_ranking**', async (r) => {
    const body = JSON.parse(r.request().postData() || '{}'); rankCalls.push(body.tab)
    const rows = body.tab === 'points'
      ? [{ rank: 1, nickname: '일등', value: 9000, is_me: false }, { rank: 2, nickname: '이등', value: 5000, is_me: false }, { rank: 14, nickname: '테스터', value: 300, is_me: true }]
      : [{ rank: 1, nickname: '번개', value: 41230, is_me: false }]
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
  })
  server = null; pushes = []
  await H.seed(p, H.baseSave({ monthlyPoints: 300, cloudUserId: UID }), withSession(H.doneDaily())); await H.enterLobby(p); await sleep(1500)
  await p.getByRole('button', { name: /랭킹/ }).first().click(); await sleep(1500)
  const rl = p.getByTestId('rank-list')
  const rtxt = (await rl.innerText()).replace(/\s+/g, ' ')
  ck(await rl.getAttribute('data-source') === 'server' && /일등 9,000P/.test(rtxt) && /이등 5,000P/.test(rtxt), '21 서버 랭킹 1~10위 표시')
  ck(/내 순위 14위 · 300P/.test(await p.locator('body').innerText()), '22 순위 밖이어도 내 순위 표시')
  await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/rank_server.png' })
  await p.getByRole('button', { name: 'Lv.11', exact: true }).click(); await sleep(1200)
  ck(rankCalls.includes('11') && /번개 41\.23초/.test((await rl.innerText()).replace(/\s+/g, ' ')), '23 탭을 바꾸면 그 탭 순위를 받아옴 (기록은 초로 표시)')
  // 손님: 서버 순위는 보이고, 내 기록은 연결 안내
  await H.seed(p, H.baseSave({ monthlyPoints: 300 }), H.doneDaily()); await H.enterLobby(p)
  await p.getByRole('button', { name: /랭킹/ }).first().click(); await sleep(1500)
  const gtxt = await p.locator('body').innerText()
  ck(/일등/.test(gtxt) && /내 기록 300P · 연결하면 순위에 올라가요/.test(gtxt) && /손님 기록은 순위에 오르지 않아요/.test(gtxt), '24 손님: 서버 순위 + 연결하면 순위에 오른다는 안내')
  await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/rank_guest.png' })
  console.log(res.join('\n')); await b.close()
})()
