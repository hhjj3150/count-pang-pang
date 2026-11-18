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
