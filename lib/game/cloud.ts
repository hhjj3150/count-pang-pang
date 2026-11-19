// ☁️ 서버에 내 정보 묶음 보관하기 (계정 연결한 사람만)
// 서버 장부: supabase/01_profiles.sql 의 profiles (본인 줄만 읽고 쓸 수 있음)
import type { SupabaseClient } from "@supabase/supabase-js"
import { getBeltInfo } from "./belts"
import { SAVE_VERSION, type SaveData } from "./save"

export interface CloudRow {
  save: SaveData
  save_version: number
  updated_at: string
}

// 서버에서 내 기록 가져오기 (없으면 null)
export async function fetchCloudSave(sb: SupabaseClient, userId: string): Promise<CloudRow | null> {
  const { data, error } = await sb.from("profiles").select("save, save_version, updated_at").eq("id", userId).maybeSingle()
  if (error) throw error
  if (!data || !data.save || Object.keys(data.save).length === 0) return null
  return data as CloudRow
}

// 서버에 내 기록 올리기 (있으면 덮어쓰기)
export async function pushCloudSave(sb: SupabaseClient, userId: string, save: SaveData): Promise<void> {
  const { error } = await sb.from("profiles").upsert(
    {
      id: userId,
      nickname: save.nickname ? save.nickname.slice(0, 20) : null,
      birth_year: typeof save.birthYear === "number" ? save.birthYear : null,
      save,
      save_version: save.ver ?? SAVE_VERSION,
    },
    { onConflict: "id" },
  )
  if (error) throw error
}

// 탈퇴: 서버 계정과 기록 모두 삭제 (supabase/01_profiles.sql 의 delete_my_account)
export async function deleteCloudAccount(sb: SupabaseClient): Promise<void> {
  const { error } = await sb.rpc("delete_my_account")
  if (error) throw error
}

// 기록 고르기 화면에 보여 줄 요약
export interface SaveSummary {
  nickname: string
  belt: string
  points: number
  lifetimePoints: number
  cash: number
  levels: number
  when: number | null // 마지막 저장 시각 (ms)
}
export function summarizeSave(save: SaveData, when?: number | null): SaveSummary {
  const lifetime = save.lifetimePoints ?? 0
  return {
    nickname: save.nickname ?? "(이름 없음)",
    belt: getBeltInfo(lifetime).currentRank.badge,
    points: save.points ?? 0,
    lifetimePoints: lifetime,
    cash: save.cash ?? 0,
    levels: Math.max(0, save.unlocked ?? 0),
    when: when ?? save.savedAt ?? null,
  }
}

// 👨‍👩‍👧 보호자 동의 (만 14세 미만 계정 연결) — 서버 장부: supabase/02_guardian_consents.sql
// 🧪 본인인증 업체 계약 전이라 지금은 '테스트용 가짜 인증'(method: "test")만 있어요.
//    진짜 인증을 붙이면 인증 결과 확인과 동의 기록 넣기는 서버(Vercel)에서 하고, 앱은 결과만 읽어요.
export type GuardianMethod = "test" | "pass" | "nice" | "sms"
export interface GuardianInfo {
  name: string
  phone: string // 숫자만 (01012345678)
  birthYear: number
}
export interface GuardianConsentItems {
  childInfo: boolean // [필수] 아이의 게임 기록·닉네임·태어난 해 서버 보관
  guardianInfo: boolean // [필수] 보호자 이름·휴대폰 번호·인증 결과 보관
  exchangeNotice: boolean // [선택] 기프티콘 교환 알림 받기 (교환 기능이 생기면)
}
export interface GuardianConsent {
  guardian_name: string
  method: GuardianMethod
  consented_at: string
}
export const GUARDIAN_MIN_AGE = 19 // 보호자는 성인

// 지금 유효한(취소하지 않은) 보호자 동의
export async function fetchActiveConsent(sb: SupabaseClient, userId: string): Promise<GuardianConsent | null> {
  const { data, error } = await sb
    .from("guardian_consents")
    .select("guardian_name, method, consented_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("consented_at", { ascending: false })
    .limit(1)
  if (error) throw error
  return (data?.[0] as GuardianConsent) ?? null
}

// 🧪 테스트용 동의 기록 넣기
export async function insertTestConsent(
  sb: SupabaseClient,
  userId: string,
  child: { nickname: string | null; birthYear: number | null | undefined },
  guardian: GuardianInfo,
  items: GuardianConsentItems,
): Promise<void> {
  const { error } = await sb.from("guardian_consents").insert({
    user_id: userId,
    child_nickname: child.nickname ? child.nickname.slice(0, 20) : null,
    child_birth_year: typeof child.birthYear === "number" ? child.birthYear : null,
    guardian_name: guardian.name.slice(0, 30),
    guardian_phone: guardian.phone,
    guardian_birth_year: guardian.birthYear,
    method: "test",
    items,
  })
  if (error) throw error
}

// 동의 취소: 동의 기록에 취소 시각을 남기고 서버의 게임 기록은 지움 (휴대폰 기록·캐시는 그대로)
export async function revokeConsent(sb: SupabaseClient, userId: string, deleteSave: boolean): Promise<void> {
  const { error } = await sb.from("guardian_consents").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId).is("revoked_at", null)
  if (error) throw error
  if (!deleteSave) return
  const { error: e2 } = await sb.from("profiles").delete().eq("id", userId)
  if (e2) throw e2
}

// 🏆 서버 랭킹 (supabase/03_ranking.sql 의 get_ranking) — 손님도 볼 수 있음
export interface ServerRankRow {
  rank: number
  nickname: string
  value: number
  is_me: boolean
}
export async function fetchRanking(sb: SupabaseClient, tab: string, topN = 10): Promise<ServerRankRow[]> {
  const { data, error } = await sb.rpc("get_ranking", { tab, top_n: topN })
  if (error) throw error
  return (data ?? []) as ServerRankRow[]
}
