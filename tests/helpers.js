// 🧪 테스트 공용 도구: 저장값 넣기, 로비 읽기, 문제 풀기 (화면만 보고 푸는 방식)
const { chromium } = require('playwright')

const URL = process.env.CP_URL || 'http://localhost:3222'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ymd = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
const sum = (a) => a.reduce((x, y) => x + y, 0)

// 기본 저장값 (예전 형식 ver4 — 앱이 알아서 최신 형식으로 옮김)
const baseSave = (o = {}) => Object.assign({
  ver: 4, nickname: '테스터', hearts: 10, heartDate: ymd(), unlocked: 14, records: { 0: 15 }, birthYear: 1990,
  muted: true, points: 0, lifetimePoints: 0, monthlyPoints: 0, monthlyDate: ymd().slice(0, 7), cash: 0,
}, o)
// 오늘의 도전이 계산에 끼어들지 않게 '오늘 이미 완료'로 넣어 둠
const doneDaily = () => ({ cp_daily: { date: ymd(), level: 1, done: true } })

// 게임 코드가 돌지 않는 빈 페이지에서 저장값을 넣고 게임으로 이동 (앱이 덮어쓰는 일 방지)
async function seed(p, save, extra = {}) {
  await p.goto(URL + '/__cp_seed__')
  await p.evaluate(([save, extra]) => {
    localStorage.clear()
    if (save) localStorage.setItem('counter-pang-pang-v1', JSON.stringify(save))
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))
  }, [save, extra])
  await p.goto(URL)
}
async function enterLobby(p) {
  await p.getByRole('button', { name: '시작하기 🚗' }).click()
  await p.getByRole('button', { name: /🪙/ }).waitFor({ timeout: 30000 })
  await sleep(600)
}
async function reloadLobby(p) { await p.goto(URL); await enterLobby(p) }
const getSave = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('counter-pang-pang-v1') || 'null'))

async function wallet(p) {
  const t = await p.getByRole('button', { name: /🪙/ }).innerText()
  const m = t.match(/🪙 ([\d,]+)P\s*💵 ([\d,]+)C/)
  return { P: +m[1].replace(/,/g, ''), C: +m[2].replace(/,/g, '') }
}
const hearts = (p) => p.evaluate(() => +[...document.querySelectorAll('header div')].find((e) => /^💖\s*\d+$/.test(e.textContent.trim())).textContent.match(/\d+/)[0])
const lockedCount = (p) => p.getByText(/^🔒/).count()
const levelCard = (p, lv) => p.locator('button').filter({ has: p.locator('span', { hasText: new RegExp(`^Lv\\.${lv}$`) }) })
const GUIDE_CLOSE = '닫기 · 게임 시작 ▶'
// 레벨 시작 (게임 설명 팝업이 뜨면 닫기)
async function startLevel(p, lv) {
  await levelCard(p, lv).scrollIntoViewIfNeeded()
  await levelCard(p, lv).click()
  const g = p.getByRole('button', { name: GUIDE_CLOSE })
  if (await g.isVisible({ timeout: 1500 }).catch(() => false)) await g.click()
}
// 승급 축하 화면이 떠 있으면 닫기
async function closePromo(p) {
  const btn = p.getByRole('button', { name: '확인 🥋' })
  if (await btn.isVisible().catch(() => false)) { await sleep(900); await btn.click({ force: true }); await sleep(400); return true }
  return false
}

// ── 문제 읽기·풀기
async function readQ(p) {
  return p.evaluate(() => {
    const plate = document.querySelector('section div.inline-flex.border-4')
    if (!plate) return null
    const groups = plate.querySelectorAll(':scope > div')
    const cells = (g) => [...g.children].map((c) => ({ t: c.textContent.trim(), lit: c.className.includes('bg-red-500'), hidden: c.textContent.trim() === '?' }))
    const title = document.querySelector('p.text-xl.text-yellow-300')?.textContent.trim()
    const totalEl = [...document.querySelectorAll('p')].find((x) => x.textContent.startsWith('전체 합 ='))
    const prog = [...document.querySelectorAll('span')].map((s) => s.textContent.trim()).find((t) => /^\d+\/15$/.test(t))
    return { front: cells(groups[0]), back: cells(groups[1]), title, total: totalEl ? +totalEl.textContent.match(/\d+/)[0] : null, idx: prog ? +prog.split('/')[0] - 1 : null }
  })
}
function solve(q) {
  const f = q.front.map((c) => +c.t), b = q.back.map((c) => +c.t), all = [...q.front, ...q.back], d = all.map((c) => +c.t)
  const subset = (t, n = d.length, exceptAll = false) => { for (let m = 1; m < (1 << n) - (exceptAll ? 1 : 0); m++) { let s = 0; for (let i = 0; i < n; i++) if (m >> i & 1) s += d[i]; if (s === t) return [...Array(n).keys()].filter((i) => m >> i & 1) } return null }
  const tm = q.title.match(/^(\d+) 만들기$/)
  if (tm) return { kind: 'target', a: subset(+tm[1]), bad: [d.indexOf(Math.max(...d))] }
  switch (q.title) {
    case '앞자리 더하기': return { kind: 'num', a: sum(f) }
    case '뒷자리 더하기': return { kind: 'num', a: sum(b) }
    case '구형 전체 더하기': case '신형 전체 더하기': return { kind: 'num', a: sum(d) }
    case '앞뒤 비교': return { kind: 'cmp', a: sum(f) > sum(b) ? '앞이 큼' : sum(f) < sum(b) ? '뒤가 큼' : '같음' }
    case '앞뒤 차이': return { kind: 'num', a: Math.abs(sum(f) - sum(b)) }
    case '짝수만 더하기': return { kind: 'num', a: sum(d.filter((x) => x % 2 === 0)) }
    case '홀수만 더하기': return { kind: 'num', a: sum(d.filter((x) => x % 2 === 1)) }
    case '가려진 숫자': { const hi = all.findIndex((c) => c.hidden); return { kind: 'num', a: q.total - sum(d.filter((_, i) => i !== hi)) } }
    case '이등분 퍼즐': { const t = sum(d); return { kind: 'part', a: t % 2 ? null : subset(t / 2, d.length, true) } }
    case '큰 수 덧셈': return { kind: 'num', a: Number(b.join('')) + Number(f.join('')) }
    case '불빛 곱셈': return { kind: 'num', a: all.reduce((pr, c, i) => (c.lit ? pr * d[i] : pr), 1) }
  }
  throw new Error('모르는 문제: ' + q.title)
}
async function typeNum(p, n) { for (const ch of String(n)) await p.getByRole('button', { name: ch, exact: true }).click() }
const TIMER = { '앞자리 더하기': 15, '뒷자리 더하기': 15, '구형 전체 더하기': 20, '신형 전체 더하기': 20, '앞뒤 비교': 15, '앞뒤 차이': 20, '짝수만 더하기': 18, '홀수만 더하기': 18, '가려진 숫자': 20, '큰 수 덧셈': 30, '이등분 퍼즐': 30, '불빛 곱셈': 18 }
const timerOf = (title) => TIMER[title] ?? (title === '20 만들기' ? 25 : 30)

// 한 판 플레이. plan: 15개 행동 'ok' | 'wrong' | 'timeout' | 'slow' | 'dbl'
// 돌려주는 값: 맞힌 수, 정답 포인트(게임 규칙대로 계산한 기대값)
async function playGame(p, plan) {
  let qPts = 0, fever = false, combo = 0, correct = 0
  for (let i = 0; i < 15; i++) {
    let q
    for (let k = 0; k < 400; k++) {
      q = await readQ(p)
      if (q && q.idx === i && q.title) {
        const ready = await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => { const t = x.textContent.trim(); return t === '1' || t.endsWith('앞이 큼') }); if (b) return !b.disabled; const c = document.querySelectorAll('section div.inline-flex.border-4 button'); return c.length > 0 && !c[0].disabled })
        if (ready) break
      }
      await closePromo(p); await sleep(50)
    }
    if (!q || q.idx !== i) throw new Error(`문제 ${i + 1} 화면 대기 실패`)
    const s = solve(q), act = plan[i], isEx = i < 3
    if (act === 'timeout') { await sleep((timerOf(q.title) + 2.5) * 1000); if (!isEx) { fever = false; combo = 0 } continue }
    const good = act !== 'wrong'
    if (act === 'slow') await sleep((Math.ceil(timerOf(q.title) / 3) + 1.2) * 1000)
    const click = async (loc) => (act === 'dbl' ? loc.dblclick() : loc.click())
    if (s.kind === 'num') { await typeNum(p, good ? s.a : s.a + 1); await click(p.getByRole('button', { name: '입력' })) }
    else if (s.kind === 'cmp') { const opts = ['앞이 큼', '같음', '뒤가 큼']; await click(p.getByRole('button', { name: new RegExp(good ? s.a : opts.find((o) => o !== s.a)) })) }
    else {
      const cells = p.locator('section div.inline-flex.border-4 button')
      if (s.kind === 'target') { for (const ix of good ? s.a : s.bad) await cells.nth(ix).click(); await click(p.getByRole('button', { name: /제출/ })) }
      else if (good) { if (s.a) { for (const ix of s.a) await cells.nth(ix).click(); await click(p.getByRole('button', { name: /제출/ })) } else await click(p.getByRole('button', { name: /이등분 불가/ })) }
      else if (s.a) await p.getByRole('button', { name: /이등분 불가/ }).click()
      else { await cells.nth(0).click(); await p.getByRole('button', { name: /제출/ }).click() }
    }
    if (good) correct++
    if (!isEx) {
      if (good && act === 'slow') { qPts += 10; fever = false; combo = 0 }
      else if (good) { qPts += fever ? 15 : 10; combo++; if (combo >= 3) fever = true }
      else { fever = false; combo = 0 }
    }
  }
  return { correct, qPts }
}
const passBonus = (lv) => Math.min(20 + lv * 10, 110)

async function newBrowser() { return chromium.launch() }
async function newPage(b, w = 390, h = 844, errs = []) {
  const p = await b.newPage({ viewport: { width: w, height: h } })
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error' && !/insights|404|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()) })
  return p
}

module.exports = { URL, sleep, ymd, sum, baseSave, doneDaily, seed, enterLobby, reloadLobby, getSave, wallet, hearts, lockedCount, levelCard, GUIDE_CLOSE, startLevel, closePromo, readQ, solve, playGame, passBonus, newBrowser, newPage }
