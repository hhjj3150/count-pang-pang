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
  console.log(res.join('\n')); await b.close()
})()
