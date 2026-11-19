"use client"
// 👨‍👩‍👧 보호자 연결 (만 14세 미만 계정 연결)
// 순서: ① 보호자님께 건네기 → ② 동의 → ③ 보호자 본인인증 → ④ 보호자 카카오 계정으로 연결
// 🧪 본인인증 업체(PASS·NICE 등) 계약 전이라 ③은 '테스트용 가짜 인증'이에요. 입력값을 그대로 인증된 것으로 처리해요.
//    계약 후에는 ③ 자리에 업체 인증 화면을 띄우고, 인증 결과는 서버(Vercel)에서 확인해요.
import { useState } from "react"
import { cn } from "@/lib/utils"
import { GUARDIAN_MIN_AGE, type GuardianConsentItems, type GuardianInfo } from "@/lib/game/cloud"

const THIS_YEAR = new Date().getFullYear()
const GUARDIAN_YEARS = Array.from({ length: THIS_YEAR - GUARDIAN_MIN_AGE - 1930 + 1 }, (_, i) => THIS_YEAR - GUARDIAN_MIN_AGE - i)

export function GuardianLink({
  childNickname,
  busy,
  onClose,
  onSubmit,
}: {
  childNickname: string
  busy: boolean
  onClose: () => void
  onSubmit: (g: GuardianInfo, items: GuardianConsentItems) => void
}) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const [items, setItems] = useState<GuardianConsentItems>({ childInfo: false, guardianInfo: false, exchangeNotice: false })
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [birthYear, setBirthYear] = useState<number | "">("")
  const [error, setError] = useState("")

  const required = items.childInfo && items.guardianInfo
  const all = required && items.exchangeNotice
  const phoneDigits = phone.replace(/\D/g, "")

  const verify = () => {
    if (!name.trim()) return setError("보호자 이름을 입력해 주세요")
    if (!/^01[016789]\d{7,8}$/.test(phoneDigits)) return setError("휴대폰 번호를 확인해 주세요 (예: 010-1234-5678)")
    if (birthYear === "") return setError("태어난 해를 골라 주세요")
    setError("")
    setStep(3)
  }

  const CHECKS: { key: keyof GuardianConsentItems; label: string; desc: string; need: boolean }[] = [
    { key: "childInfo", need: true, label: "아이 정보 서버 보관", desc: `${childNickname}의 닉네임·태어난 해·게임 기록을 서버에 보관해요. 휴대폰을 바꿔도 이어서 할 수 있어요.` },
    { key: "guardianInfo", need: true, label: "보호자 정보 보관", desc: "보호자 이름·휴대폰 번호·인증 결과·동의 일시를 동의 증빙으로 보관해요." },
    { key: "exchangeNotice", need: false, label: "기프티콘 교환 알림 받기", desc: "기프티콘 교환 기능이 생기면, 아이가 교환할 때마다 보호자 휴대폰으로 알려 드려요." },
  ]

  return (
    <div data-testid="guardian-link" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-[380px] overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl cpp-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-black text-slate-400">보호자 연결 {step + 1} / 4</p>
          <button type="button" onClick={onClose} aria-label="닫기" className="h-8 w-8 rounded-full bg-slate-100 text-sm font-black text-slate-500">
            ✕
          </button>
        </div>

        {step === 0 && (
          <div className="mt-2 text-center">
            <p className="text-5xl">👨‍👩‍👧</p>
            <h2 className="mt-2 text-xl font-black text-zinc-900">보호자님께 휴대폰을 건네주세요</h2>
            <p className="mt-3 text-left text-sm font-bold leading-relaxed text-zinc-600">
              {childNickname}은(는) 만 14세 미만이라, 기록을 서버에 보관하려면 <b className="text-emerald-600">보호자 동의</b>가 필요해요.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-left text-xs font-bold leading-relaxed text-zinc-500">
              <li>보호자님 본인인증과 동의는 <b>처음 한 번만</b> 해요.</li>
              <li>아이에게 카카오 계정이 없어도 돼요. <b>보호자님의 카카오 계정</b>으로 연결해요.</li>
              <li>동의는 언제든 관리 화면에서 취소할 수 있어요. 취소해도 휴대폰의 기록과 캐시는 남아요.</li>
            </ul>
            <button type="button" onClick={() => setStep(1)} className="mt-5 w-full rounded-2xl bg-emerald-500 py-3 text-base font-black text-white">
              보호자예요, 시작할게요
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="mt-2">
            <h2 className="text-lg font-black text-zinc-900">보호자 동의</h2>
            <button
              type="button"
              onClick={() => setItems({ childInfo: !all, guardianInfo: !all, exchangeNotice: !all })}
              className={cn("mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-black ring-2", all ? "bg-emerald-50 text-emerald-800 ring-emerald-400" : "bg-slate-50 text-slate-700 ring-slate-200")}
            >
              <span className="text-lg">{all ? "✅" : "⬜"}</span> 모두 동의해요
            </button>
            <div className="mt-2 space-y-2">
              {CHECKS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setItems((it) => ({ ...it, [c.key]: !it[c.key] }))}
                  className="flex w-full gap-2 rounded-xl bg-white px-3 py-2.5 text-left ring-1 ring-slate-200"
                >
                  <span className="text-base">{items[c.key] ? "✅" : "⬜"}</span>
                  <span>
                    <span className="text-sm font-black text-slate-800">
                      <span className={c.need ? "text-rose-500" : "text-slate-400"}>[{c.need ? "필수" : "선택"}]</span> {c.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-bold leading-relaxed text-slate-500">{c.desc}</span>
                  </span>
                </button>
              ))}
            </div>
            <a href="/privacy" target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-bold text-sky-700 underline">
              개인정보처리방침 자세히 보기
            </a>
            <button
              type="button"
              disabled={!required}
              onClick={() => setStep(2)}
              className="mt-4 w-full rounded-2xl bg-emerald-500 py-3 text-base font-black text-white disabled:bg-slate-300"
            >
              다음 (보호자 본인인증)
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-2">
            <h2 className="text-lg font-black text-zinc-900">보호자 본인인증</h2>
            <p className="mt-2 rounded-xl bg-amber-100 px-3 py-2 text-[11px] font-black leading-relaxed text-amber-800">
              🧪 테스트용 가짜 인증이에요. 실제 휴대폰 본인인증(PASS 등)은 인증 업체와 계약한 뒤에 바뀌어요.
            </p>
            <label className="mt-3 block text-xs font-black text-slate-500" htmlFor="g-name">보호자 이름</label>
            <input id="g-name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl px-3 py-2.5 text-base font-bold text-slate-800 ring-1 ring-slate-300" placeholder="홍길동" />
            <label className="mt-3 block text-xs font-black text-slate-500" htmlFor="g-phone">휴대폰 번호</label>
            <input id="g-phone" value={phone} inputMode="numeric" maxLength={13} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-xl px-3 py-2.5 text-base font-bold text-slate-800 ring-1 ring-slate-300" placeholder="010-1234-5678" />
            <label className="mt-3 block text-xs font-black text-slate-500" htmlFor="g-birth">태어난 해 (성인 확인)</label>
            <select id="g-birth" value={birthYear} onChange={(e) => setBirthYear(e.target.value ? Number(e.target.value) : "")} className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 text-base font-bold text-slate-800 ring-1 ring-slate-300">
              <option value="">선택해 주세요</option>
              {GUARDIAN_YEARS.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            {error && <p className="mt-2 text-xs font-black text-rose-500">{error}</p>}
            <button type="button" onClick={verify} className="mt-4 w-full rounded-2xl bg-emerald-500 py-3 text-base font-black text-white">
              인증하기 (테스트)
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="mt-2 text-center">
            <p className="text-5xl">✅</p>
            <h2 className="mt-2 text-xl font-black text-zinc-900">본인인증 완료 (테스트)</h2>
            <p className="mt-2 text-sm font-bold leading-relaxed text-zinc-600">
              마지막으로 <b>보호자님의 카카오 계정</b>으로 로그인하면 {childNickname}의 기록이 연결돼요.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSubmit({ name: name.trim(), phone: phoneDigits, birthYear: birthYear as number }, items)}
              className="mt-5 w-full rounded-2xl bg-[#FEE500] py-3 text-base font-black text-[#191919] shadow-sm disabled:opacity-60"
            >
              {busy ? "카카오로 이동 중…" : "💬 보호자 카카오 계정으로 연결"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
