// 💾 예전 저장값 변환 검사 (서버 필요 없음): ver1·3·4 저장값이 최신 한 묶음으로 바르게 바뀌는지
require('./ts-loader')
const store = new Map()
global.window = {}
global.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() }
const { migrateSave, SAVE_VERSION, STORAGE_KEY } = require('../lib/game/save')
const res = []
const ck = (c, m) => res.push((c ? '✅ ' : '❌ ') + m)
const base = (o) => Object.assign({ nickname: '테스터', hearts: 5, heartDate: '2026-11-01', unlocked: 1, records: {}, muted: false, points: 100, lifetimePoints: 100, monthlyPoints: 0, monthlyDate: '2026-11' }, o)
const run = (save, extra = {}) => { store.clear(); store.set(STORAGE_KEY, JSON.stringify(save)); for (const [k, v] of Object.entries(extra)) store.set(k, typeof v === 'string' ? v : JSON.stringify(v)); migrateSave(); return JSON.parse(store.get(STORAGE_KEY)) }

// ver4 → 5: 따로 저장된 칸들이 묶음으로 들어오고, 옛 칸은 지워짐
let d = run(base({ ver: 4 }), {
  cp_owned_cars: ['kart_basic', 'car_suv'], cp_equipped_car: 'car_suv', cp_owned_bgs: ['가로수드라이브.mp4', '단풍길.mp4'], cp_equipped_bg: '단풍길.mp4',
  cp_owned_emoticons: ['pangi_joy'], cp_heart_buy: { date: '2026-11-18', count: 2 }, cp_attendance: { date: '2026-11-18', weekCount: 3, lastMonday: '2026-11-16' },
  cp_invite: { date: '11/18/2026', count: 1 }, cp_daily: { date: '2026-11-18', level: 3, done: true }, cp_month_best: { month: '2026-11', best: { 12: 31000 } },
  cp_stats: { types: { 9: { tries: 3, correct: 2 } }, days: {}, games: [{ date: '2026-11-18', level: 9, score: 14 }] }, cp_show_guide: 'off', pangpang_level: '7', cp_points: '999',
})
ck(d.ver === SAVE_VERSION && SAVE_VERSION === 5, 'ver4 → ver5')
ck(d.ownedCars.join() === 'kart_basic,car_suv' && d.equippedCar === 'car_suv', '카트 옮김')
ck(d.ownedBgs.includes('단풍길.mp4') && d.equippedBg === '단풍길.mp4', '배경 옮김')
ck(d.ownedEmoticons[0] === 'pangi_joy', '이모티콘 옮김')
ck(d.heartBuy.count === 2 && d.attendance.weekCount === 3 && d.invite.count === 1, '하트 구매·출석·초대 횟수 옮김')
ck(d.daily && d.daily.level === 3, '오늘의 도전 유지 (레벨 변화 없는 변환)')
ck(d.monthBest.best[12] === 31000, '이번 달 신기록 옮김')
ck(d.stats.types[9].tries === 3 && d.stats.games[0].level === 9, '학습 기록 그대로 (레벨 번호 변화 없음)')
ck(d.showGuide === false && d.lastLevel === 7, '게임 설명 끄기·마지막 레벨 옮김')
ck(['cp_owned_cars', 'cp_stats', 'cp_daily', 'pangpang_level', 'cp_points', 'cp_show_guide'].every((k) => !store.has(k)), '옛 칸 모두 지움')
ck(d.points === 100 && d.nickname === '테스터', '원래 묶음 값 유지')

// ver3 → 5: 9 ↔ 10 기록 교환 + 학습 기록·마지막 레벨도 교환, 오늘의 도전은 다시 뽑음
d = run(base({ ver: 3, unlocked: 11, records: { 0: 15, 8: 14, 9: 15, 10: 13 } }), { cp_stats: { types: { 9: { tries: 30, correct: 25 }, 10: { tries: 20, correct: 10 } }, days: {}, games: [{ date: 'x', level: 9, score: 15 }] }, pangpang_level: '9', cp_daily: { date: '2026-11-18', level: 9, done: false } })
ck(d.records[9] === 13 && d.records[10] === 15 && d.records[8] === 14 && d.unlocked === 11, `ver3: 기록 교환, 열린 레벨 유지 (${JSON.stringify(d.records)})`)
ck(d.stats.types[10].tries === 30 && d.stats.types[9].tries === 20 && d.stats.games[0].level === 10 && d.lastLevel === 10, 'ver3: 학습 기록·마지막 레벨도 교환')
ck(d.daily === undefined, 'ver3: 오늘의 도전은 새로 뽑도록 지움')

// ver1 → 5: 옛 9,10,11 → 11,12,13 → 12,13,14 순서로 옮겨짐
d = run(base({ unlocked: 9, records: { 8: 15, 9: 14, 10: 13, 11: 15 } }))
ck(d.records[8] === 15 && d.records[12] === 14 && d.records[13] === 13 && d.records[14] === 15 && d.unlocked === 12, `ver1: 기록 이동 (${JSON.stringify(d.records)}, 열린 레벨 ${d.unlocked})`)

// ver5는 건드리지 않음
d = run(base({ ver: 5, records: { 9: 15, 10: 13 }, ownedCars: ['kart_basic'] }), { cp_owned_cars: ['kart_lion'] })
ck(d.records[9] === 15 && d.ownedCars.join() === 'kart_basic' && store.has('cp_owned_cars'), 'ver5 저장값은 그대로')

console.log(res.join('\n'))
const bad = res.filter((r) => r.startsWith('❌')).length
console.log(`\n=== ${res.length}개 중 실패 ${bad}개 ===`)
process.exit(bad ? 1 : 0)
