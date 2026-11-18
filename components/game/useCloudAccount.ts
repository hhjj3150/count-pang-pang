"use client"
// ☁️ 계정 연결(카카오) + 서버에 기록 자동 보관
// - 손님은 서버에 아무것도 올리지 않음. 연결한 사람만 기록을 서버(profiles)에 올림
// - 처음 연결할 때 서버에 다른 기록이 있으면: 이 휴대폰 기록 / 서버 기록 중에서 고르게 함
// - 이미 연결된 기기: 다른 기기에서 더 최근에 저장한 기록이 있으면 그 기록을 불러옴
import { useCallback, useEffect, useRef, useState } from "react"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { getSupabase } from "@/lib/supabase"
import { deleteCloudAccount, fetchCloudSave, pushCloudSave, summarizeSave, type SaveSummary } from "@/lib/game/cloud"
import { STORAGE_KEY, type SaveData } from "@/lib/game/save"

export interface CloudConflict {
  local: SaveSummary
  server: SaveSummary
  serverSave: SaveData
}

const PUSH_DELAY_MS = 3000 // 저장이 연달아 일어나면 3초 뒤 한 번만 올림
const NOTICE_KEY = "cp_cloud_notice" // 새로고침 뒤 보여 줄 안내 (sessionStorage)

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
      let row
      try {
        row = await fetchCloudSave(client, u.id)
      } catch {
        toast("서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요 📶")
        handledRef.current = null
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
        toast("카카오 계정 연결 완료! 이제 기록이 서버에도 저장돼요 ☁️")
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

  // 로그인 상태 지켜보기
  useEffect(() => {
    if (!loaded) return
    const client = sb()
    if (!client) return
    // 새로고침 전에 남겨 둔 안내
    const notice = sessionStorage.getItem(NOTICE_KEY)
    if (notice) {
      sessionStorage.removeItem(NOTICE_KEY)
      setTimeout(() => toast(notice), 600)
    }
    // 카카오에서 돌아온 주소 정리 (?code=..., 취소했으면 ?error=...)
    const url = new URL(window.location.href)
    if (url.searchParams.get("error")) {
      toast("카카오 연결을 취소했어요")
      url.searchParams.delete("error")
      url.searchParams.delete("error_code")
      url.searchParams.delete("error_description")
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash)
    }
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      // Supabase 안내에 따라 콜백 안에서는 바로 기다리지 않고 다음 차례에 처리
      setTimeout(() => {
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
    const { error } = await client.auth.signInWithOAuth({ provider: "kakao", options: { redirectTo: window.location.origin + "/" } })
    if (error) {
      setBusy(false)
      toast("카카오 연결을 시작하지 못했어요. 잠시 후 다시 해 주세요")
    }
  }, [toast])

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
        applyServerSave(conflict.serverSave, u.id, "서버 기록을 불러왔어요 ☁️")
        return
      }
      setConflict(null)
      if (choice === "cancel") {
        await client.auth.signOut()
        handledRef.current = null
        setUser(null)
        toast("계정 연결을 취소했어요")
        return
      }
      linkedRef.current = u.id
      setCloudUserId(u.id) // 저장되면서 서버 기록을 이 휴대폰 기록으로 덮어씀
      toast("이 휴대폰 기록으로 연결했어요 ☁️")
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

  return { user, linked: !!user && !conflict, conflict, busy, lastSyncedAt, notifySaved, linkKakao, logout, resolveConflict, deleteServerAccount }
}
