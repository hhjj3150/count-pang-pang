// 가짜 로그인 세션 + 가짜 서버 응답으로 기록 고르기·불러오기·올리기 흐름 점검 (실제 서버에 접속하지 않음)
const H = require('./helpers')
const { sleep } = H
const UID = '11111111-2222-3333-4444-555555555555'
const now = Math.floor(Date.now() / 1000)
const session = { access_token: 'x.y.z', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'r',
  user: { id: UID, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'kakao' }, user_metadata: {}, created_at: new Date().toISOString() } }
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
  // 2) 같은 계정, 서버가 더 최신 → 자동 불러오기
  server = { save: H.baseSave({ ver: 5, nickname: '다른폰', points: 4242, savedAt: Date.now() + 5000 }), save_version: 5, updated_at: new Date().toISOString() }
  await H.seed(p, H.baseSave({ points: 1, cloudUserId: UID, savedAt: Date.now() - 1000 }), withSession(H.doneDaily())); await p.waitForTimeout(3000)
  s = await H.getSave(p)
  ck(s.points === 4242 && s.cloudUserId === UID, '3 다른 기기의 더 최신 기록을 자동으로 불러옴')
  // 3) 서버에 기록 없음 → 바로 연결 + 올리기
  server = null; pushes = []
  await H.seed(p, H.baseSave({ points: 321 }), withSession(H.doneDaily())); await H.enterLobby(p); await sleep(5000)
  s = await H.getSave(p)
  ck(s.cloudUserId === UID && pushes.some((x) => x.id === UID && x.save.points === 321), '4 서버 기록이 없으면 이 휴대폰 기록을 바로 연결해서 올림')
  await p.getByRole('button', { name: '⚙️ 관리' }).click(); await sleep(400)
  ck(/연결됐어요/.test(await p.getByTestId('cloud-card').innerText()), '5 관리 화면에 연결 상태 표시')
  await p.getByTestId('cloud-card').screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/card.png' })
  // 4) 고르기 창에서 '이 휴대폰 기록'
  server = { save: H.baseSave({ ver: 5, nickname: '서버아이', points: 9999 }), save_version: 5, updated_at: new Date().toISOString() }; pushes = []
  await H.seed(p, H.baseSave({ points: 222 }), withSession(H.doneDaily())); await sleep(3000)
  await p.getByTestId('cloud-conflict').getByRole('button', { name: /이 휴대폰 기록/ }).click(); await sleep(5000)
  s = await H.getSave(p)
  ck(s.points === 222 && s.cloudUserId === UID && pushes.some((x) => x.save.points === 222), '6 이 휴대폰 기록 고르기 → 서버를 이 기록으로 덮어씀')
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
  await H.seed(p, kid({ points: 77 }), withSession({ ...H.doneDaily(), cp_guardian_pending: pending, cp_guardian_test: '1' })); await H.enterLobby(p); await sleep(5000)
  let k = await H.getSave(p)
  ck(consentPosts.length === 1 && consentPosts[0].method === 'test' && consentPosts[0].guardian_name === '김보호' && k.cloudUserId === UID && pushes.some((x) => x.save.points === 77), '10 돌아오면 동의 기록 저장 + 아이 기록 서버에 올림')
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
  console.log(res.join('\n')); await b.close()
})()
