// ☁️ Supabase(서버 장부·로그인) 연결
// 아래 주소와 공개 열쇠(publishable key)는 원래 브라우저에 공개되는 값이에요. (비밀 열쇠는 절대 여기에 넣지 않음)
// 다른 서버(예: 테스트 서버)를 쓸 때는 Vercel 환경 변수 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 로 바꿀 수 있어요.
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zzekinnnhizuwaczyrqp.supabase.co"
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_uIMcNaHpx2RfgHkhR5c5yg_3Tr7BUdP"

let client: SupabaseClient | null = null

// 🔐 다음부터 자동 로그인하기 (첫 화면의 선택, 기본은 켜짐)
// 끄면: 앱(탭)을 닫았다가 다시 열 때 로그인 정보를 지움. 같은 탭에서 새로고침하거나 카카오에 다녀오는 동안은 유지
const AUTO_LOGIN_KEY = "cp_auto_login" // localStorage: "0"이면 꺼짐
const ALIVE_KEY = "cp_session_alive" // sessionStorage: 이 탭에서 로그인함 (탭을 닫으면 사라짐)
export function getAutoLogin(): boolean {
  try {
    return localStorage.getItem(AUTO_LOGIN_KEY) !== "0"
  } catch {
    return true
  }
}
export function setAutoLogin(on: boolean) {
  try {
    if (on) localStorage.removeItem(AUTO_LOGIN_KEY)
    else localStorage.setItem(AUTO_LOGIN_KEY, "0")
  } catch {
    /* ignore */
  }
}
export function markSessionAlive() {
  try {
    sessionStorage.setItem(ALIVE_KEY, "1")
  } catch {
    /* ignore */
  }
}
// 자동 로그인을 끈 사람이 앱을 새로 열면 남아 있는 로그인 정보를 지움 (서버 연결을 만들기 전에)
function dropSessionIfNotAuto() {
  try {
    if (getAutoLogin() || sessionStorage.getItem(ALIVE_KEY)) return
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) localStorage.removeItem(k)
    }
  } catch {
    /* ignore */
  }
}

// 브라우저에서만 만들기 (서버 렌더링 중에는 null)
export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null
  if (!client) {
    dropSessionIfNotAuto()
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return client
}
