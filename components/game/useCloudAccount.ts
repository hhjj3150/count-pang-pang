"use client"
// ☁️ 계정 연결(카카오) + 서버에 기록 자동 보관
// - 손님은 서버에 아무것도 올리지 않음. 연결한 사람만 기록을 서버(profiles)에 올림
// - 처음 연결할 때 서버에 다른 기록이 있으면: 이 휴대폰 기록 / 서버 기록 중에서 고르게 함
// - 이미 연결된 기기: 다른 기기에서 더 최근에 저장한 기록이 있으면 그 기록을 불러옴
// - 만 14세 미만: 보호자가 동의·본인인증(🧪 지금은 테스트용 가짜 인증)을 하고 보호자 카카오 계정으로 연결
//   동의 기록이 없거나 취소됐으면 서버에 올리지 않음
import { useCallback, useEffect, useRef, useState } from "react"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { getSupabase, markSessionAlive } from "@/lib/supabase"
import {
  deleteCloudAccount, fetchActiveConsent, fetchCloudSave, insertTestConsent, pushCloudSave, revokeConsent, summarizeSave,
  type GuardianConsent, type GuardianConsentItems, type GuardianInfo, type SaveSummary,
} from "@/lib/game/cloud"
import { isChildUser } from "@/lib/game/constants"
import { STORAGE_KEY, type SaveData } from "@/lib/game/save"

export interface CloudConflict {
  local: SaveSummary
  server: SaveSummary
  serverSave: SaveData
}

const PUSH_DELAY_MS = 3000 // 저장이 연달아 일어나면 3초 뒤 한 번만 올림
const NOTICE_KEY = "cp_cloud_notice" // 새로고침 뒤 보여 줄 안내 (sessionStorage)
const LINKED_KEY = "cp_cloud_linked" // 새로고침 뒤 연결 완료 창 보여 주기 (sessionStorage)
const PENDING_KEY = "cp_guardian_pending" // 보호자 동의를 마치고 카카오로 다녀오는 동안 잠시 보관 (localStorage)
const PENDING_TTL_MS = 30 * 60 * 1000 // 30분 안에 카카오 연결을 끝내야 함

interface GuardianPending {
  guardian: GuardianInfo
  items: GuardianConsentItems
  at: number
}
const takePending = (): GuardianPending | null => {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null") as GuardianPending | null
    localStorage.removeItem(PENDING_KEY)
    return p && Date.now() - p.at < PENDING_TTL_MS ? p : null
  } catch {
    return null
  }
}

const readLocalSave = (): SaveData | null => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
  } catch {
    return null
  }
}

export function useCloudAccount(opts: {
  loaded: boolean
  setCloudUserId: (id: string | undefined) => void
  suspendLocalSave: () => void // 서버 기록으로 바꿔 새로고침하기 전에 화면의 저장을 멈춤
  toast: (msg: string) => void
}) {
  const { loaded, setCloudUserId, suspendLocalSave, toast } = opts
  const [user, setUser] = useState<User | null>(null)
  const [conflict, setConflict] = useState<CloudConflict | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [authReady, setAuthReady] = useState(false) // 로그인 상태 확인이 끝났음 (그 전에는 로그인 버튼을 잠깐 숨김)
  const [needsProfile, setNeedsProfile] = useState(false) // 카카오로 처음 시작: 닉네임·태어난 해를 정해야 함
  const [linkedPopup, setLinkedPopup] = useState<string | null>(null) // 연결이 끝났을 때 크게 보여 줄 안내
  const [guardian, setGuardian] = useState<GuardianConsent | null>(null) // 만 14세 미만: 지금 유효한 보호자 동의
  const justConsentedRef = useRef(false) // 이번에 막 동의 기록을 넣었음 (기록 고르기에서 취소하면 동의도 취소)
  const linkedRef = useRef<string | null>(null) // 기록을 올려도 되는 계정 (기록 고르기 전에는 null)
  const handledRef = useRef<string | null>(null) // 로그인 처리를 이미 한 계정
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sb = (): SupabaseClient | null => getSupabase()

  // 서버 기록으로 바꾸고 새로고침
  const applyServerSave = useCallback(
    (save: SaveData, userId: string, notice: string) => {
      suspendLocalSave()
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...save, cloudUserId: userId }))
      sessionStorage.setItem(NOTICE_KEY, notice)
      window.location.reload()
    },
    [suspendLocalSave],
  )

  const pushNow = useCallback(async () => {
    const client = sb()
    const uid = linkedRef.current
    const local = readLocalSave()
    if (!client || !uid || !local || local.cloudUserId !== uid) return
    try {
      await pushCloudSave(client, uid, local)
      setLastSyncedAt(Date.now())
    } catch {
      /* 인터넷이 끊겼으면 다음 저장 때 다시 올림 */
    }
  }, [])

  // 기다리는 저장이 있으면 지금 바로 올리기 (예: 랭킹을 열 때 내 최신 기록이 반영되게)
  const flushNow = useCallback(async () => {
    if (!linkedRef.current) return
    if (pushTimer.current) {
      clearTimeout(pushTimer.current)
      pushTimer.current = null
    }
    await pushNow()
  }, [pushNow])

  // 화면이 저장할 때마다 불러 줌 → 3초 뒤 서버에 올림
  const notifySaved = useCallback(() => {
    if (!linkedRef.current) return
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => void pushNow(), PUSH_DELAY_MS)
  }, [pushNow])

  // 로그인된 계정 처리 (앱을 켤 때 / 카카오에서 돌아왔을 때)
  const handleSignedIn = useCallback(
    async (u: User) => {
      if (handledRef.current === u.id) return
      handledRef.current = u.id
      const client = sb()
      if (!client) return
      const local = readLocalSave()
      const fresh = !local?.nickname // 이 기기에 아직 기록이 없음 (첫 화면에서 '카카오로 시작하기')
      let row
      try {
        row = await fetchCloudSave(client, u.id)
        if (fresh && !row) {
          // 처음 오신 분: 닉네임·태어난 해를 정하면 그 기록으로 연결 (adoptNewProfile)
          setNeedsProfile(true)
          return
        }
        // 만 14세 미만 기록은 보호자 동의가 있어야 연결
        const birth = fresh ? row?.save.birthYear : local?.birthYear
        if (isChildUser(birth)) {
          const pending = takePending()
          if (pending && !fresh) {
            await insertTestConsent(client, u.id, { nickname: local?.nickname ?? null, birthYear: local?.birthYear }, pending.guardian, pending.items)
            justConsentedRef.current = true
          }
          const consent = await fetchActiveConsent(client, u.id)
          if (!consent) {
            await client.auth.signOut({ scope: "local" })
            handledRef.current = null
            setUser(null)
            toast("만 14세 미만은 보호자 동의가 필요해요. 손님으로 시작한 뒤 관리 → 내 정보에서 보호자와 연결해 주세요 👨‍👩‍👧")
            return
          }
          setGuardian(consent)
        } else {
          setGuardian(null)
        }
      } catch {
        toast("서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요 📶")
        handledRef.current = null
        return
      }
      if (fresh && row) {
        // 이 기기는 처음, 서버에는 기록이 있음 → 바로 불러오기
        sessionStorage.setItem(LINKED_KEY, "다시 오신 걸 환영해요! 서버에 있던 기록을 불러왔어요.")
        applyServerSave(row.save, u.id, "서버 기록을 불러왔어요 ☁️")
        return
      }
      if (local?.cloudUserId === u.id) {
        // 이 기기에서 이미 연결한 계정: 다른 기기의 더 최신 기록이 있으면 불러옴
        if (row && (row.save.savedAt ?? 0) > (local.savedAt ?? 0) + 1000) {
          applyServerSave(row.save, u.id, "다른 기기에서 한 최신 기록을 불러왔어요 ☁️")
          return
        }
        linkedRef.current = u.id
        void pushNow()
        return
      }
      if (!row) {
        // 서버에 기록이 없음 → 이 휴대폰 기록을 연결 (저장되면 자동으로 올라감)
        linkedRef.current = u.id
        setCloudUserId(u.id)
        setLinkedPopup("이 휴대폰의 기록을 서버에 보관하기 시작했어요.")
        return
      }
      // 서버에도 기록이 있음 → 고르게 함
      setConflict({
        local: summarizeSave(local ?? ({} as SaveData)),
        server: summarizeSave(row.save, row.save.savedAt ?? new Date(row.updated_at).getTime()),
        serverSave: row.save,
      })
    },
    [applyServerSave, pushNow, setCloudUserId, toast],
  )

  // 처음 오신 분(카카오로 시작): 화면에서 닉네임·태어난 해를 정한 뒤 불러 줌 → 이 새 기록으로 연결 (만 14세 이상만)
  const adoptNewProfile = useCallback(() => {
    if (!user) return
    linkedRef.current = user.id
    setNeedsProfile(false)
    setCloudUserId(user.id)
    setLinkedPopup("새 기록을 만들었어요. 이제부터 서버에 자동으로 보관돼요.")
  }, [setCloudUserId, user])

  // 카카오로 시작했지만 연결하지 않고 손님으로 하기 (예: 만 14세 미만)
  const leaveKakaoStart = useCallback(async () => {
    const client = sb()
    setNeedsProfile(false)
    linkedRef.current = null
    handledRef.current = null
    setUser(null)
    if (client) await client.auth.signOut({ scope: "local" }).catch(() => {})
  }, [])

  // 로그인 상태 지켜보기
  useEffect(() => {
    if (!loaded) return
    const client = sb()
    if (!client) return
    // 새로고침 전에 남겨 둔 안내
    const notice = sessionStorage.getItem(NOTICE_KEY)
    const linkedMsg = sessionStorage.getItem(LINKED_KEY)
    sessionStorage.removeItem(LINKED_KEY)
    if (notice) {
      sessionStorage.removeItem(NOTICE_KEY)
      if (linkedMsg) setLinkedPopup(linkedMsg)
      else setTimeout(() => toast(notice), 600)
    }
    // 카카오에서 돌아온 주소 정리 (?code=..., 취소했으면 ?error=...)
    const url = new URL(window.location.href)
    if (url.searchParams.get("error")) {
      localStorage.removeItem(PENDING_KEY)
      toast("카카오 연결을 취소했어요")
      url.searchParams.delete("error")
      url.searchParams.delete("error_code")
      url.searchParams.delete("error_description")
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash)
    }
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      // Supabase 안내에 따라 콜백 안에서는 바로 기다리지 않고 다음 차례에 처리
      setTimeout(() => {
        setAuthReady(true)
        setUser(session?.user ?? null)
        if (session?.user) {
          void handleSignedIn(session.user)
          const u = new URL(window.location.href)
          if (u.searchParams.has("code")) {
            u.searchParams.delete("code")
            window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash)
          }
        } else {
          linkedRef.current = null
          handledRef.current = null
          setGuardian(null)
          setNeedsProfile(false)
        }
      }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [loaded, handleSignedIn, toast])

  // 화면을 떠날 때 남은 기록 바로 올리기
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && pushTimer.current) {
        clearTimeout(pushTimer.current)
        pushTimer.current = null
        void pushNow()
      }
    }
    document.addEventListener("visibilitychange", flush)
    return () => document.removeEventListener("visibilitychange", flush)
  }, [pushNow])

  const linkKakao = useCallback(async () => {
    const client = sb()
    if (!client) return
    setBusy(true)
    markSessionAlive() // 자동 로그인을 꺼도 카카오에 다녀오는 동안은 로그인 유지
    const { error } = await client.auth.signInWithOAuth({ provider: "kakao", options: {
        redirectTo: window.location.origin + "/",
        // 이미 카카오에 로그인되어 있어도 '어떤 카카오 계정으로 연결할지' 확인 화면을 보여 줌
        queryParams: { prompt: "select_account" },
      },
    })
    if (error) {
      setBusy(false)
      toast("카카오 연결을 시작하지 못했어요. 잠시 후 다시 해 주세요")
    }
  }, [toast])

  // 👨‍👩‍👧 보호자 동의를 마친 뒤 보호자 카카오 계정으로 연결
  const linkWithGuardian = useCallback(
    async (g: GuardianInfo, items: GuardianConsentItems) => {
      const pending: GuardianPending = { guardian: g, items, at: Date.now() }
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
      await linkKakao()
    },
    [linkKakao],
  )

  // 보호자 동의 취소: 서버의 게임 기록을 지우고 연결을 끊음 (휴대폰 기록·캐시는 그대로)
  const revokeGuardian = useCallback(async (): Promise<boolean> => {
    const client = sb()
    if (!client || !user) return false
    try {
      if (pushTimer.current) clearTimeout(pushTimer.current)
      linkedRef.current = null
      await revokeConsent(client, user.id, true)
      await client.auth.signOut({ scope: "local" })
    } catch {
      linkedRef.current = user.id
      toast("동의를 취소하지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요 📶")
      return false
    }
    handledRef.current = null
    setGuardian(null)
    setUser(null)
    setCloudUserId(undefined)
    toast("보호자 동의를 취소했어요. 서버 기록은 지웠고, 이 휴대폰의 기록과 캐시는 그대로예요")
    return true
  }, [setCloudUserId, toast, user])

  const logout = useCallback(async () => {
    const client = sb()
    if (!client) return
    await pushNow()
    await client.auth.signOut()
    linkedRef.current = null
    handledRef.current = null
    setUser(null)
    toast("로그아웃했어요. 이 휴대폰의 기록은 그대로 남아 있어요")
  }, [pushNow, toast])

  // 기록 고르기: "local" = 이 휴대폰 기록을 서버에 올림, "server" = 서버 기록을 불러옴, "cancel" = 연결 안 함
  const resolveConflict = useCallback(
    async (choice: "local" | "server" | "cancel") => {
      const client = sb()
      const u = user
      if (!client || !u || !conflict) return
      if (choice === "server") {
        sessionStorage.setItem(LINKED_KEY, "서버에 있던 기록을 불러왔어요.")
        applyServerSave(conflict.serverSave, u.id, "서버 기록을 불러왔어요 ☁️")
        return
      }
      setConflict(null)
      if (choice === "cancel") {
        if (justConsentedRef.current) await revokeConsent(client, u.id, false).catch(() => {}) // 방금 한 동의도 취소 (서버 기록은 그대로)
        justConsentedRef.current = false
        setGuardian(null)
        await client.auth.signOut()
        handledRef.current = null
        setUser(null)
        toast("계정 연결을 취소했어요")
        return
      }
      linkedRef.current = u.id
      setCloudUserId(u.id) // 저장되면서 서버 기록을 이 휴대폰 기록으로 덮어씀
      setLinkedPopup("이 휴대폰의 기록으로 연결했어요. 서버 기록은 이 기록으로 바뀌어요.")
    },
    [applyServerSave, conflict, setCloudUserId, toast, user],
  )

  // 탈퇴할 때 서버 계정·기록 삭제 (성공하면 true)
  const deleteServerAccount = useCallback(async (): Promise<boolean> => {
    const client = sb()
    if (!client || !user) return true
    try {
      await deleteCloudAccount(client)
      linkedRef.current = null
      await client.auth.signOut({ scope: "local" })
      return true
    } catch {
      return false
    }
  }, [user])

  // 연결된 카카오 계정 이름 (카카오가 준 닉네임, 없으면 이메일 일부)
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>
  const pick = (...keys: string[]) => keys.map((k) => meta[k]).find((v): v is string => typeof v === "string" && v.trim() !== "")
  const maskEmail = (e?: string | null) => (e ? e.replace(/^(.{2})[^@]*(@.*)$/, "$1***$2") : undefined)
  const kakaoName = user ? pick("name", "full_name", "nickname", "user_name", "preferred_username") ?? maskEmail(user.email) ?? "카카오 계정" : null

  return {
    kakaoName, linkedPopup, closeLinkedPopup: () => setLinkedPopup(null),
    flushNow, authReady, needsProfile, adoptNewProfile, leaveKakaoStart,
    user, linked: !!user && !conflict && !needsProfile, conflict, busy, lastSyncedAt, guardian,
    notifySaved, linkKakao, linkWithGuardian, logout, resolveConflict, deleteServerAccount, revokeGuardian,
  }
}
