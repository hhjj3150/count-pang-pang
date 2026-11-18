// 💾 저장 데이터 형식과 예전 저장값 변환
// 내 정보는 모두 이 한 묶음(STORAGE_KEY)에 저장해요. 서버를 붙이면 이 묶음을 그대로 올리고 받으면 돼요.
import { MonthBest } from "./records"
import { LearnStats } from "./stats"

export interface SaveData {
  ver?: number // 저장 형식 버전 (SAVE_VERSION)
  nickname: string | null
  hearts: number
  heartDate: string
  unlocked: number
  records: Record<number, number>
  muted: boolean
  points: number
  lifetimePoints: number // 🌟 누적 획득 포인트 (승급용)
  monthlyPoints: number  // 🌟 월간 획득 포인트 (랭킹용)
  monthlyDate: string    // 🌟 월간 랭킹 초기화 기준 달 (YYYY-MM)
  birthYear?: number | null // 🎂 태어난 해 (연령 확인용: 어린이 광고 설정·상품권 교환 자격)
  cash?: number          // 💰 캐시 (광고 시청·초대로 적립, 상품권 교환용. 게임 포인트와 별개)
  cashExchangeMonth?: string // 상품권을 마지막으로 교환한 달 (YYYY-MM, 월 1회 제한)
  premium?: boolean      // 💎 유료(월) 회원 여부 — 결제·서버를 붙이면 서버 값으로 설정 (지금은 항상 false)
  // ── ver5부터 한 묶음에 들어온 항목들 (예전에는 따로 저장)
  ownedCars?: string[]   // 🚗 가진 카트
  equippedCar?: string   // 장착한 카트
  ownedBgs?: string[]    // 🏞️ 가진 배경
  equippedBg?: string    // 장착한 배경
  ownedEmoticons?: string[] // 📸 산 이모티콘
  heartBuy?: { date: string; count: number } // 💖 오늘 상점에서 하트를 산 횟수
  attendance?: { date: string; weekCount: number; lastMonday: string } // 📅 출석 (주마다 새로 시작)
  invite?: { date: string; count: number } // 💌 오늘 친구 초대 횟수
  daily?: { date: string; level: number; done: boolean } // 🔥 오늘의 도전
  monthBest?: { month: string; best: MonthBest } // 🏆 이번 달 신기록
  stats?: LearnStats     // 📊 학습 기록 (부모님 리포트)
  showGuide?: boolean    // 📋 레벨 시작 전 게임 설명 팝업 보기
  lastLevel?: number     // 마지막으로 고른 레벨
  // ── 계정 연결 (☁️ lib/game/cloud.ts)
  cloudUserId?: string   // 이 기록이 연결된 서버 계정 (다른 계정으로 로그인하면 기록 고르기)
  savedAt?: number       // 마지막으로 저장한 시각 (ms) — 기기 여러 대에서 더 최신 기록 찾기
}

export const STORAGE_KEY = "counter-pang-pang-v1"

// 🔁 레벨 번호가 바뀐 업데이트마다 기존 저장값의 레벨 번호를 옮기는 규칙 (저장 형식 버전별로 한 단계씩 적용)
//  - ver1 → 2: 10·20 만들기(Lv.9·10) 추가 → 옛 9,10,11 → 11,12,13
//  - ver2 → 3: 큰 수 덧셈(Lv.11) 추가 → 옛 11,12,13 → 12,13,14
//  - ver3 → 4: 10 만들기(옛 Lv.9)를 '제시된 숫자 만들기'로 바꿔 Lv.10으로, 20 만들기(옛 Lv.10)는 Lv.9로 → 9 ↔ 10 기록 교환
//  - ver4 → 5: 레벨 변화 없음. 따로 저장하던 항목(카트·배경·출석 등)을 한 묶음으로 합침
export const SAVE_VERSION = 5
export const LEVEL_SHIFTS: Record<number, (lv: number) => number> = {
  1: (lv) => (lv >= 9 ? lv + 2 : lv),
  2: (lv) => (lv >= 11 ? lv + 1 : lv),
  3: (lv) => (lv === 9 ? 10 : lv === 10 ? 9 : lv),
}
// 순서만 바꾼 업데이트는 열린 레벨 수를 그대로 둠 (Lv.9가 열린 사람이 Lv.10까지 열리는 일이 없게)
export const KEEP_UNLOCKED_VERSIONS = new Set([3])

// ver4까지 따로 저장하던 칸들 (한 묶음으로 옮긴 뒤 지움). cp_points·cp_free_heart는 더 이상 쓰지 않는 옛 칸
const OLD_KEYS = [
  "cp_owned_cars", "cp_equipped_car", "cp_owned_bgs", "cp_equipped_bg", "cp_owned_emoticons", "cp_heart_buy",
  "cp_attendance", "cp_invite", "cp_daily", "cp_month_best", "cp_stats", "cp_show_guide", "pangpang_level",
  "cp_points", "cp_free_heart",
]
// 따로 저장된 칸들을 묶음 안으로 가져오기 (묶음에 이미 있는 값은 그대로 둠)
function foldOldKeys(d: SaveData) {
  const json = (k: string) => {
    try {
      return JSON.parse(localStorage.getItem(k) ?? "null") ?? undefined
    } catch {
      return undefined
    }
  }
  const text = (k: string) => localStorage.getItem(k) ?? undefined
  d.ownedCars ??= json("cp_owned_cars")
  d.equippedCar ??= text("cp_equipped_car")
  d.ownedBgs ??= json("cp_owned_bgs")
  d.equippedBg ??= text("cp_equipped_bg")
  d.ownedEmoticons ??= json("cp_owned_emoticons")
  d.heartBuy ??= json("cp_heart_buy")
  d.attendance ??= json("cp_attendance")
  d.invite ??= json("cp_invite")
  d.daily ??= json("cp_daily")
  d.monthBest ??= json("cp_month_best")
  d.stats ??= json("cp_stats")
  if (d.showGuide === undefined && text("cp_show_guide")) d.showGuide = text("cp_show_guide") !== "off"
  if (d.lastLevel === undefined) {
    const n = parseInt(text("pangpang_level") ?? "", 10)
    if (!Number.isNaN(n)) d.lastLevel = n
  }
}

export function migrateSave() {
  if (typeof window === "undefined") return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const d = JSON.parse(raw) as SaveData
    let ver: number = d.ver ?? 1
    if (ver >= SAVE_VERSION) return
    foldOldKeys(d) // 레벨 번호 변환보다 먼저 모아야 학습 기록·마지막 레벨도 함께 변환됨
    let shifted = false
    while (ver < SAVE_VERSION) {
      const sh = LEVEL_SHIFTS[ver]
      if (sh) {
        shifted = true
        d.records = Object.fromEntries(Object.entries(d.records ?? {}).map(([k, v]) => [sh(Number(k)), v]))
        if (!KEEP_UNLOCKED_VERSIONS.has(ver)) d.unlocked = sh(d.unlocked ?? 0)
        if (typeof d.lastLevel === "number") d.lastLevel = sh(d.lastLevel)
        const st = d.stats
        if (st && st.types && st.games) {
          // 학습 기록의 문제 유형 번호·게임 레벨도 같이 옮김
          st.types = Object.fromEntries(Object.entries(st.types).map(([k, v]) => [sh(Number(k)), v]))
          st.games = st.games.map((g) => ({ ...g, level: sh(g.level) }))
        }
      }
      ver++
    }
    if (shifted) delete d.daily // 레벨 번호가 바뀌었으면 오늘의 도전은 새 번호로 다시 뽑음
    d.ver = SAVE_VERSION
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d))
    for (const k of OLD_KEYS) localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}
