// ☁️ Supabase(서버 장부·로그인) 연결
// 아래 주소와 공개 열쇠(publishable key)는 원래 브라우저에 공개되는 값이에요. (비밀 열쇠는 절대 여기에 넣지 않음)
// 다른 서버(예: 테스트 서버)를 쓸 때는 Vercel 환경 변수 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 로 바꿀 수 있어요.
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zzekinnnhizuwaczyrqp.supabase.co"
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_uIMcNaHpx2RfgHkhR5c5yg_3Tr7BUdP"

let client: SupabaseClient | null = null

// 브라우저에서만 만들기 (서버 렌더링 중에는 null)
export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return client
}
