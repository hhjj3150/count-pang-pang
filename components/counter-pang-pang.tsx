"use client"
import React from 'react';
// 

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/* =========================================================================
   카운터 팡팡 — 초등학생 대상 캐주얼 사칙연산 퀴즈 모바일 웹 게임
   플로우: INTRO -> LOGIN -> LOBBY -> GAME -> RESULT
   ========================================================================= */

type Screen = "INTRO" | "LOGIN" | "LOBBY" | "GAME" | "RESULT"
type QType = "numpad" | "compare" | "partition"
type Reaction = "idle" | "correct" | "wrong"

interface SaveData {
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
}


interface Question {
  level: number // 로직 기준 레벨 (0/1 동일)
  front: number[]
  back: number[]
  hangul: string
  type: QType
  title: string
  desc: string
  timer: number
  answer: number | "front" | "back" | "equal" | null
  hiddenPos?: number
  totalForHidden?: number
  lit?: number[]
  canPartition?: boolean
}

const STORAGE_KEY = "counter-pang-pang-v1"
const TOTAL_Q = 15
const PASS_LINE = 13
const MAX_LEVEL = 11
const HEART_CAP = 10

const HANGUL = ["가", "나", "다", "라", "마", "거", "너", "더", "러", "머", "바", "사", "아", "자", "하", "호"]

const LEVEL_NAMES: Record<number, string> = {
  0: "게임 방법",
  1: "앞자리 팡팡",
  2: "뒷자리 팡팡",
  3: "구형 완전정복",
  4: "신형 완전정복",
  5: "앞뒤 비교왕",
  6: "앞뒤 차이왕",
  7: "홀짝 마법사",
  8: "숨은 숫자 탐정",
  9: "이등분 퍼즐",
  10: "불빛 곱셈",
  11: "그랜드 마스터",
}

// 🎮 스테이지 선택 카드 이름 캡슐에 표시되는 레벨별 게임 설명 (없으면 LEVEL_NAMES 사용)
const LEVEL_DESC: Record<number, string> = {
  0: "📖 게임 방법",
  1: "앞자리 합",
  2: "뒷자리 합",
  3: "6자리 합",
  4: "7자리 합",
  5: "앞뒤 자리 비교",
  6: "앞뒤 차이",
  7: "홀수/짝수만 합",
  8: "?에 들어갈 숫자",
  9: "전체합의 이등분\n조합선택", // \n = 카드 안에서 줄바꿈
  10: "붉은 숫자의 곱",
}

const LEVEL_TIMER: Record<number, number> = {
  0: 15,
  1: 15,
  2: 15,
  3: 20,
  4: 20,
  5: 15,
  6: 20,
  7: 18,
  8: 20,
  9: 30,
  10: 18,
  11: 20,
}

const FACE_EMOJI = ["🐣", "🐥", "🐤", "🦆", "🐦", "🦉", "🦜", "🦢", "🕊️", "🦅", "🦩", "👑"]

/* ----------------------------- 유틸 ----------------------------- */
const ri = (max: number) => Math.floor(Math.random() * max)
const rd = () => ri(10)
const mkDigits = (n: number) => Array.from({ length: n }, rd)
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
// 📅 휴대폰 현지 시간 기준 날짜 (YYYY-MM-DD). toISOString()은 UTC라 한국에선 오전 9시에 날짜가 바뀌는 문제가 있음
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const today = () => localDate()

function canSplitEven(arr: number[]) {
  const total = sum(arr)
  if (total === 0) return arr.length >= 2
  if (total % 2 !== 0) return false
  const target = total / 2
  const dp = new Array(target + 1).fill(false)
  dp[0] = true
  for (const n of arr) {
    for (let j = target; j >= n; j--) if (dp[j - n]) dp[j] = true
  }
  return dp[target]
}

function pickDistinct(count: number, poolSize: number) {
  const idx = Array.from({ length: poolSize }, (_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = ri(i + 1)
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx.slice(0, count).sort((a, b) => a - b)
}

// 🧩 한 판(15문제) 만들기
// 이등분 퍼즐(Lv.9)은 '이등분 불가' 정답을 한 판에 2~3문제만 섞고, 나머지는 숫자 조합을 골라야 하는 문제로 구성
function buildGame(chosenLevel: number): Question[] {
  if (chosenLevel === 9) {
    const impossible = new Set(pickDistinct(2 + ri(2), TOTAL_Q))
    return Array.from({ length: TOTAL_Q }, (_, i) => buildQuestion(chosenLevel, i, !impossible.has(i)))
  }
  return Array.from({ length: TOTAL_Q }, (_, i) => buildQuestion(chosenLevel, i))
}

function buildQuestion(chosenLevel: number, index: number, wantPartition?: boolean): Question {
  // 그랜드 마스터는 매 문제 Lv1~10 무작위, 그 외엔 선택 레벨(0은 1과 동일 로직)
  const logic = chosenLevel === 11 ? 1 + ri(10) : chosenLevel === 0 ? 1 : chosenLevel
  const timer = LEVEL_TIMER[logic]
  const hangul = HANGUL[ri(HANGUL.length)]

  const base = (frontCount: number) => {
    const front = mkDigits(frontCount)
    const back = mkDigits(4)
    return { front, back }
  }

  switch (logic) {
    case 1: {
      const { front, back } = base(2 + ri(2))
      return {
        level: logic, front, back, hangul, type: "numpad", timer,
        title: "앞자리 더하기", desc: "앞 번호 숫자를 모두 더하세요", answer: sum(front),
      }
    }
    case 2: {
      const { front, back } = base(2 + ri(2))
      return {
        level: logic, front, back, hangul, type: "numpad", timer,
        title: "뒷자리 더하기", desc: "뒤 4자리 숫자를 모두 더하세요", answer: sum(back),
      }
    }
    case 3: {
      const { front, back } = base(2)
      return {
        level: logic, front, back, hangul, type: "numpad", timer,
        title: "구형 전체 더하기", desc: "번호판 6자리를 모두 더하세요", answer: sum(front) + sum(back),
      }
    }
    case 4: {
      const { front, back } = base(3)
      return {
        level: logic, front, back, hangul, type: "numpad", timer,
        title: "신형 전체 더하기", desc: "번호판 7자리를 모두 더하세요", answer: sum(front) + sum(back),
      }
    }
    case 5: {
      const { front, back } = base(2 + ri(2))
      const f = sum(front)
      const b = sum(back)
      return {
        level: logic, front, back, hangul, type: "compare", timer,
        title: "앞뒤 비교", desc: "앞 숫자 합과 뒤 숫자 합을 비교하세요",
        answer: f > b ? "front" : f < b ? "back" : "equal",
      }
    }
    case 6: {
      const { front, back } = base(2 + ri(2))
      return {
        level: logic, front, back, hangul, type: "numpad", timer,
        title: "앞뒤 차이", desc: "큰 쪽 합에서 작은 쪽 합을 빼세요",
        answer: Math.abs(sum(front) - sum(back)),
      }
    }
    case 7: {
      const { front, back } = base(2 + ri(2))
      const even = ri(2) === 0
      const all = [...front, ...back]
      return {
        level: logic, front, back, hangul, type: "numpad", timer,
        title: even ? "짝수만 더하기" : "홀수만 더하기",
        desc: even ? "짝수 숫자만 골라 더하세요 (0은 짝수)" : "홀수 숫자만 골라 더하세요",
        answer: sum(all.filter((d) => (even ? d % 2 === 0 : d % 2 === 1))),
      }
    }
    case 8: {
      const { front, back } = base(2 + ri(2))
      const all = [...front, ...back]
      const total = sum(all)
      const hiddenPos = ri(all.length)
      return {
        level: logic, front, back, hangul, type: "numpad", timer,
        title: "가려진 숫자", desc: "전체 합을 보고 가려진 숫자를 맞히세요",
        answer: all[hiddenPos], hiddenPos, totalForHidden: total,
      }
    }
    case 9: {
      // wantPartition: true = 이등분 가능한 번호판, false = 이등분 불가 번호판
      // (지정이 없으면 그랜드 마스터용: 약 20%만 이등분 불가)
      const want = wantPartition ?? Math.random() >= 0.2
      let { front, back } = base(2 + ri(2))
      let all = [...front, ...back]
      for (let tries = 0; tries < 500; tries++) {
        if (sum(all) > 0 && canSplitEven(all) === want) break
        ;({ front, back } = base(2 + ri(2)))
        all = [...front, ...back]
      }
      return {
        level: logic, front, back, hangul, type: "partition", timer,
        title: "이등분 퍼즐", desc: "숫자를 골라 두 그룹의 합을 같게 만드세요",
        answer: null, canPartition: canSplitEven(all),
      }
    }
    case 10:
    default: {
      const { front, back } = base(2 + ri(2))
      
      // 🔥 난이도 상승: 번호판의 0과 1을 2~9 사이의 숫자로 강제 변환
      const hardFront = front.map(n => n <= 1 ? 2 + ri(8) : n)
      const hardBack = back.map(n => n <= 1 ? 2 + ri(8) : n)
      const all = [...hardFront, ...hardBack]
      
      const litCount = 3 // 무조건 3개의 숫자 곱셈
      const lit = pickDistinct(litCount, all.length)
      const product = lit.reduce((p, i) => p * all[i], 1)
      
      return {
        level: logic, 
        front: hardFront, // 변환된 어려운 숫자 적용
        back: hardBack,   // 변환된 어려운 숫자 적용
        hangul, type: "numpad", timer,
        title: "불빛 곱셈", desc: "불이 켜진 숫자를 모두 곱하세요", answer: product, lit,
      }
    }
  }
}

function exampleText(q: Question) {
  if (q.type === "compare") return q.answer === "front" ? "앞이 큼" : q.answer === "back" ? "뒤가 큼" : "같음"
  if (q.type === "partition") {
    if (!q.canPartition) return "이등분 불가"
    // 합이 전체의 절반이 되는 숫자 조합 하나 찾아서 보여주기 (예: 7+1 = 8)
    const all = [...q.front, ...q.back]
    const half = sum(all) / 2
    for (let m = 1; m < (1 << all.length) - 1; m++) {
      const picked = all.filter((_, i) => (m >> i) & 1)
      if (sum(picked) === half) return `${picked.join("+")} = ${half}`
    }
    return "이등분 가능"
  }
  return String(q.answer)
}

/* ------------------------ 화면용 가벼운 이미지 경로 ------------------------ */
// 원본 PNG(1254px, 장당 ~1MB)는 이모티콘 저장할 때만 쓰고, 화면에는 미리 줄여 둔 webp를 사용 (데이터 절약)
//  - sm: 상점·차고 목록용 작은 이미지 / md: 미리보기·게임 화면용 중간 이미지
const lightImg = (folder: "emoticons" | "karts", file: string, size: "sm" | "md") =>
  `/assets/${folder}/${size}/${file.replace(/\.png$/, ".webp")}`

// 📱 실행 환경 확인 (카카오톡 앱 안 브라우저는 파일 다운로드가 막혀 있음)
const isKakaoInApp = () => typeof navigator !== "undefined" && /KAKAOTALK/i.test(navigator.userAgent)
const isMobileDevice = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

/* ------------------------ 이미지 (폴백 포함) ------------------------ */
function GameImage({
  src,
  alt,
  fallback,
  className,
  style,
}: {
  src: string
  alt: string
  fallback: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const [err, setErr] = useState(false)
  useEffect(() => setErr(false), [src])
  if (!err && src) {
    return (
      <img
        src={src || "/placeholder.svg"}
        alt={alt}
        className={className}
        style={style}
        draggable={false}
        onError={() => setErr(true)}
      />
    )
  }
  return (
    <div
      className={cn(className, "flex items-center justify-center leading-none select-none overflow-hidden")}
      style={style}
      role="img"
      aria-label={alt}
    >
      {fallback}
    </div>
  )
}

/* ----------------------------- 번호판 ----------------------------- */
function Plate({
  q,
  selected,
  onToggle,
}: {
  q: Question
  selected?: number[]
  onToggle?: (i: number) => void
}) {
  const litSet = useMemo(() => new Set(q.lit ?? []), [q.lit])
  const selSet = useMemo(() => new Set(selected ?? []), [selected])
  const combined = [...q.front, ...q.back]

  const cell = (d: number, gi: number, edge: boolean) => {
    const hidden = q.hiddenPos === gi
    const lit = litSet.has(gi)
    const sel = selSet.has(gi)
    const clickable = !!onToggle
    const content = hidden ? "?" : d
    const classes = cn(
      "grid place-items-center rounded-lg font-black tabular-nums transition-all duration-150",
      "h-11 w-8 sm:h-12 sm:w-9 text-2xl sm:text-3xl",
      "shadow-[inset_0_-3px_0_rgba(0,0,0,0.25),0_2px_4px_rgba(0,0,0,0.3)]",
      hidden
        ? "bg-rose-500 text-white animate-pulse"
        : lit
          ? "bg-red-500 text-white animate-pulse ring-2 ring-red-300 shadow-lg"
          : sel
            ? "bg-sky-400 text-white ring-2 ring-sky-200 scale-105"
            : "bg-white text-zinc-900",
      clickable && "active:scale-95 cursor-pointer",
    )
    if (clickable) {
      return (
        <button
          key={`${edge}-${gi}`}
          type="button"
          onClick={() => onToggle?.(gi)}
          className={classes}
          aria-pressed={sel}
        >
          {content}
        </button>
      )
    }
    return (
      <span key={`${edge}-${gi}`} className={classes}>
        {content}
      </span>
    )
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-2xl border-4 border-zinc-900/80 bg-gradient-to-b from-amber-300 to-amber-400 px-2.5 py-2 shadow-[0_8px_0_rgba(0,0,0,0.35),0_12px_20px_rgba(0,0,0,0.4)]">
      <div className="flex gap-1">{q.front.map((d, i) => cell(d, i, false))}</div>
      <span className="px-0.5 text-2xl sm:text-3xl font-black text-zinc-900">{q.hangul}</span>
      <div className="flex gap-1">{q.back.map((d, i) => cell(d, q.front.length + i, true))}</div>
    </div>
  )
}

/* ------------------------------ 넘패드 ------------------------------ */
function Numpad({
  value,
  onKey,
  onBackspace,
  onSubmit,
  disabled,
}: {
  value: string
  onKey: (k: string) => void
  onBackspace: () => void
  onSubmit: () => void
  disabled: boolean
}) {
  const keyBtn =
    "select-none rounded-2xl bg-white/90 text-zinc-900 text-2xl font-black shadow-[0_4px_0_rgba(0,0,0,0.25)] active:translate-y-0.5 active:shadow-[0_1px_0_rgba(0,0,0,0.25)] disabled:opacity-40 transition-all"
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
        <button key={n} type="button" disabled={disabled} onClick={() => onKey(String(n))} className={cn(keyBtn, "py-1.5 sm:py-2.5")}>
          {n}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={onBackspace}
        className={cn(keyBtn, "py-1.5 sm:py-2.5 bg-rose-200 text-rose-800 text-lg")}
        aria-label="지움"
      >
        ⌫
      </button>
      <button key={0} type="button" disabled={disabled} onClick={() => onKey("0")} className={cn(keyBtn, "py-1.5 sm:py-2.5")}>
        0
      </button>
      <button
        type="button"
        disabled={disabled || value.length === 0}
        onClick={onSubmit}
        className={cn(keyBtn, "py-1.5 sm:py-2.5 bg-emerald-300 text-emerald-950 text-lg")}
        aria-label="입력"
      >
        입력
      </button>
    </div>
  )
}

/* =========================================================================
   메인 앱 컴포넌트
   ========================================================================= */
/* ------------------------- 🥋 승급 축하 연출 ------------------------- */
const BELT_NAMES = ["화이트", "블루", "퍼플", "브라운", "블랙"] as const
type BeltName = (typeof BELT_NAMES)[number]

// 띠 색상 (base: 띠 색, edge: 테두리, bar: 그랄이 감기는 랭크바, stitch: 박음질 선)
const BELT_COLORS: Record<BeltName, { base: string; edge: string; bar: string; stitch: string }> = {
  화이트: { base: "#f8fafc", edge: "#cbd5e1", bar: "#18181b", stitch: "rgba(100,116,139,0.45)" },
  블루: { base: "#2563eb", edge: "#1e3a8a", bar: "#18181b", stitch: "rgba(255,255,255,0.35)" },
  퍼플: { base: "#7c3aed", edge: "#4c1d95", bar: "#18181b", stitch: "rgba(255,255,255,0.35)" },
  브라운: { base: "#92400e", edge: "#451a03", bar: "#18181b", stitch: "rgba(255,255,255,0.3)" },
  블랙: { base: "#18181b", edge: "#000000", bar: "#dc2626", stitch: "rgba(255,255,255,0.25)" },
}

// "🟦 블루 3그랄" → { name: "블루", stripes: 3 }
function parseBelt(badge: string): { name: BeltName; stripes: number } {
  const name = BELT_NAMES.find((n) => badge.includes(n)) ?? "화이트"
  const m = badge.match(/(\d)그랄/)
  return { name, stripes: m ? Number(m[1]) : 0 }
}

// 화면 가운데 크게 보이는 띠 그림 (끝부분 랭크바에 그랄 최대 4개)
function BeltGraphic({ name, stripes, flyLastStripe = false }: { name: BeltName; stripes: number; flyLastStripe?: boolean }) {
  const c = BELT_COLORS[name]
  const stitchLine = { backgroundImage: `repeating-linear-gradient(90deg, ${c.stitch} 0 7px, transparent 7px 12px)` }
  return (
    <div
      className="relative h-16 w-[78vw] max-w-[320px] rounded-lg"
      style={{
        background: `linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 45%, rgba(0,0,0,0.18)), ${c.base}`,
        boxShadow: `0 14px 28px rgba(0,0,0,0.22), inset 0 0 0 2px ${c.edge}`,
      }}
    >
      <div className="absolute inset-x-2 top-2.5 h-px" style={stitchLine} />
      <div className="absolute inset-x-2 bottom-2.5 h-px" style={stitchLine} />
      {/* 랭크바 + 그랄 */}
      <div
        className="absolute inset-y-0 right-[9%] flex w-[26%] items-stretch justify-evenly px-1"
        style={{ background: c.bar, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.4)" }}
      >
        {[0, 1, 2, 3].map((i) =>
          i < stripes ? (
            <span
              key={i}
              className={cn(
                "w-[9px] rounded-[1px] bg-white shadow-[0_0_2px_rgba(0,0,0,0.4)]",
                flyLastStripe && i === stripes - 1 && "cpp-stripe-fly",
              )}
            />
          ) : (
            <span key={i} className="w-[9px]" />
          ),
        )}
      </div>
    </div>
  )
}

function PromotionCelebration({ from, to, onClose }: { from?: string; to: { badge: string; style: string }; onClose: () => void }) {
  const next = parseBelt(to.badge)
  const prev = from ? parseBelt(from) : { name: next.name, stripes: Math.max(0, next.stripes - 1) }
  const isBeltUp = prev.name !== next.name

  // 꽃가루 / 불꽃놀이 입자 (처음 한 번만 무작위로 만들기)
  const petals = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => ({
        left: Math.random() * 100,
        w: 10 + Math.random() * 11,
        color: ["#f9a8d4", "#fbcfe8", "#fde68a", "#ffffff", "#c4b5fd", "#fda4af"][i % 6],
        t: 3.6 + Math.random() * 3,
        d: 1.0 + Math.random() * 2.2,
        sway: (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 40),
        round: i % 3 === 0,
      })),
    [],
  )
  const bursts = useMemo(
    () =>
      [
        { x: 18, y: 16 }, { x: 80, y: 13 }, { x: 50, y: 6 }, { x: 14, y: 46 }, { x: 86, y: 42 }, { x: 52, y: 78 },
      ].map((b, bi) => ({
        ...b,
        color: ["#f43f5e", "#f59e0b", "#8b5cf6", "#10b981", "#3b82f6", "#ec4899"][bi],
        sparks: Array.from({ length: 20 }, (_, i) => {
          const a = (i / 20) * Math.PI * 2
          const r = 65 + Math.random() * 55
          return { dx: Math.cos(a) * r, dy: Math.sin(a) * r }
        }),
        d: 1.4 + bi * 0.3,
      })),
    [],
  )

  return (
    <div className="cpp-promo-in fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden bg-gradient-to-b from-amber-50 via-rose-50 to-sky-100 px-6">
      {/* 은은하게 도는 햇살 */}
      <div className="cpp-promo-rays pointer-events-none absolute left-1/2 top-[42%] h-[180vmax] w-[180vmax] -translate-x-1/2 -translate-y-1/2 rounded-full" />
      <div className="pointer-events-none absolute left-1/2 top-[42%] h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 blur-3xl" />

      {/* 🎆 불꽃놀이 (띠 승급 때만) */}
      {isBeltUp &&
        bursts.map((b, bi) => (
          <div key={bi} className="pointer-events-none absolute" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
            {b.sparks.map((sp, i) => (
              <span
                key={i}
                className="cpp-spark absolute h-2 w-2 rounded-full"
                style={{
                  background: b.color,
                  boxShadow: `0 0 6px ${b.color}`,
                  ["--dx" as string]: `${sp.dx}px`,
                  ["--dy" as string]: `${sp.dy}px`,
                  ["--d" as string]: `${b.d}s`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        ))}

      {/* 🌸 꽃가루 */}
      <div className="pointer-events-none absolute inset-0">
        {petals.map((pt, i) => (
          <span
            key={i}
            className="cpp-petal absolute top-0"
            style={{
              left: `${pt.left}%`,
              width: pt.w,
              height: pt.w * 0.75,
              background: pt.color,
              borderRadius: pt.round ? "50%" : "100% 0 100% 0",
              boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
              ["--t" as string]: `${pt.t}s`,
              ["--d" as string]: `${pt.d}s`,
              ["--sway" as string]: `${pt.sway}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="relative flex w-full max-w-sm flex-col items-center text-center">
        {/* 상단 문구: 그랄 = '축' 도장 / 띠 = Congratulations */}
        <div className="flex h-36 items-end justify-center">
          {isBeltUp ? (
            <h2 className="cpp-congrats pb-2 text-[clamp(28px,9vw,40px)] font-black italic leading-none drop-shadow-[0_3px_0_rgba(255,255,255,0.8)]">
              Congratulations!
            </h2>
          ) : (
            <div className="cpp-stamp grid h-32 w-32 place-items-center rounded-full border-[5px] border-amber-300 bg-gradient-to-br from-rose-500 to-red-600 shadow-[0_10px_25px_rgba(225,29,72,0.45),inset_0_0_0_4px_rgba(255,255,255,0.35)]">
              <span className="text-[72px] font-black leading-none text-white drop-shadow-[0_3px_0_rgba(127,29,29,0.6)]">축</span>
            </div>
          )}
        </div>

        {/* 가운데 큰 띠 */}
        <div className="relative my-10 grid place-items-center">
          {isBeltUp ? (
            <>
              <div className="cpp-old-belt-out col-start-1 row-start-1">
                <BeltGraphic name={prev.name} stripes={prev.stripes} />
              </div>
              <div className="cpp-belt-fly col-start-1 row-start-1">
                <BeltGraphic name={next.name} stripes={next.stripes} />
              </div>
              <div
                className="cpp-impact-flash pointer-events-none col-start-1 row-start-1 h-40 w-40 rounded-full bg-white"
                style={{ animationDelay: "1.25s", filter: "blur(8px)" }}
              />
            </>
          ) : (
            <div className="cpp-belt-pop">
              <BeltGraphic name={next.name} stripes={next.stripes} flyLastStripe />
            </div>
          )}
        </div>

        {/* 새 등급 이름 */}
        <div className="cpp-rise-in" style={{ ["--d" as string]: "1.9s" } as React.CSSProperties}>
          <div className={cn("inline-block rounded-xl px-6 py-2 text-xl font-black shadow-lg", to.style)}>{to.badge}</div>
          <p className="mt-3 text-lg font-black text-rose-500 drop-shadow-sm">
            {isBeltUp ? `${next.name} 띠로 승급했어요! 🥋` : `그랄을 하나 더 감았어요! 🎀`}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="cpp-rise-in mt-8 w-full max-w-[220px] rounded-full bg-gradient-to-b from-yellow-300 to-amber-400 py-4 text-lg font-black text-amber-950 shadow-[0_5px_0_#b45309] active:translate-y-1 active:shadow-none"
          style={{ ["--d" as string]: "2.3s" } as React.CSSProperties}
        >
          확인 🥋
        </button>
      </div>
    </div>
  )
}

/* ------------------------- 📊 학습 기록 · 부모님 리포트 ------------------------- */
// 기기 안(localStorage "cp_stats")에만 저장. 예제 3문제는 정답을 보여주므로 기록에서 제외, 시간 초과는 오답으로 기록
interface LearnStats {
  types: Record<number, { tries: number; correct: number }> // 문제 유형(로직 레벨 1~10)별
  days: Record<string, { games: number; solved: number; correct: number }> // 날짜별
  games: { date: string; level: number; score: number }[] // 최근 게임 (최대 30개)
}
const EMPTY_STATS: LearnStats = { types: {}, days: {}, games: [] }
const STATS_KEY = "cp_stats"

function ParentReport({ stats }: { stats: LearnStats }) {
  const typeRows = Array.from({ length: 10 }, (_, i) => i + 1).map((lv) => {
    const t = stats.types[lv] ?? { tries: 0, correct: 0 }
    return { lv, name: (LEVEL_DESC[lv] ?? "").replace("\n", " "), ...t, rate: t.tries ? Math.round((t.correct / t.tries) * 100) : null }
  })
  const total = typeRows.reduce((a, r) => ({ tries: a.tries + r.tries, correct: a.correct + r.correct }), { tries: 0, correct: 0 })
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const key = localDate(d)
    return { key, label: i === 6 ? "오늘" : `${d.getMonth() + 1}/${d.getDate()}`, games: stats.days[key]?.games ?? 0 }
  })
  const weekGames = last7.reduce((a, d) => a + d.games, 0)
  const maxGames = Math.max(1, ...last7.map((d) => d.games))
  const rated = typeRows.filter((r) => r.tries >= 5) // 5문제 이상 푼 유형만 강점/약점 판단
  const best = rated.length ? rated.reduce((a, b) => ((b.rate ?? 0) > (a.rate ?? 0) ? b : a)) : null
  const weak = rated.length ? rated.reduce((a, b) => ((b.rate ?? 101) < (a.rate ?? 101) ? b : a)) : null
  const barColor = (r: number) => (r >= 80 ? "bg-emerald-400" : r >= 60 ? "bg-amber-400" : "bg-rose-400")

  if (total.tries === 0) {
    return (
      <div className="rounded-xl bg-slate-50 p-6 text-center ring-1 ring-slate-200">
        <p className="text-4xl">📊</p>
        <p className="mt-2 text-sm font-bold text-slate-500">아직 기록이 없어요.<br />게임을 하면 여기에 학습 기록이 쌓여요!</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-sky-50 p-3 ring-1 ring-sky-100"><p className="text-[11px] font-bold text-sky-500">푼 문제</p><p className="text-lg font-black text-sky-700">{total.tries}</p></div>
        <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100"><p className="text-[11px] font-bold text-emerald-500">정답률</p><p className="text-lg font-black text-emerald-700">{Math.round((total.correct / total.tries) * 100)}%</p></div>
        <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-100"><p className="text-[11px] font-bold text-amber-500">최근 7일</p><p className="text-lg font-black text-amber-700">{weekGames}판</p></div>
      </div>

      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <p className="mb-3 text-sm font-black text-slate-700">📅 최근 7일 게임 수</p>
        <div className="flex h-24 items-end justify-between gap-1.5">
          {last7.map((d) => (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-black text-slate-500">{d.games || ""}</span>
              <div className="w-full rounded-t bg-sky-400" style={{ height: `${(d.games / maxGames) * 60}px`, minHeight: d.games ? 4 : 0 }} />
              <span className="text-[10px] font-bold text-slate-400">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {(best || weak) && (
        <div className="space-y-2">
          {best && <div className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">💪 잘하는 유형: <b>{best.name}</b> ({best.rate}%)</div>}
          {weak && weak.lv !== best?.lv && (
            <div className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800 ring-1 ring-rose-200">
              🎯 더 연습하면 좋은 유형: <b>{weak.name}</b> ({weak.rate}%)<br />
              <span className="text-xs font-bold text-rose-600">→ Lv.{weak.lv}를 몇 번 더 해 보면 금방 늘어요!</span>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <p className="mb-3 text-sm font-black text-slate-700">🧮 문제 유형별 정답률</p>
        <div className="space-y-2">
          {typeRows.map((r) => (
            <div key={r.lv} className="flex items-center gap-2">
              <span className="w-10 text-[11px] font-black text-slate-400">Lv.{r.lv}</span>
              <span className="w-[92px] truncate text-xs font-bold text-slate-600">{r.name}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                {r.rate !== null && <div className={cn("h-full rounded-full", barColor(r.rate))} style={{ width: `${r.rate}%` }} />}
              </div>
              <span className="w-[64px] text-right text-[11px] font-bold text-slate-500">{r.rate === null ? "아직 안 함" : `${r.rate}% (${r.tries})`}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] font-bold text-slate-400">괄호 안은 푼 문제 수예요. 그랜드 마스터(Lv.11)에서 푼 문제도 유형별로 함께 계산돼요.</p>
      </div>

      {stats.games.length > 0 && (
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <p className="mb-2 text-sm font-black text-slate-700">🕹️ 최근 게임</p>
          {stats.games.slice(-5).reverse().map((g, i) => (
            <div key={i} className="flex items-center justify-between border-b border-slate-100 py-1.5 text-xs font-bold text-slate-600 last:border-0">
              <span className="text-slate-400">{g.date.slice(5).replace("-", "/")}</span>
              <span>Lv.{g.level} {LEVEL_NAMES[g.level]}</span>
              <span className={g.score >= PASS_LINE ? "text-emerald-600" : "text-rose-500"}>{g.score}/{TOTAL_Q} {g.score >= PASS_LINE ? "통과" : "탈락"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------- 🎓 튜토리얼 (Lv.0 게임 방법) ------------------------- */
const TUTORIAL_PAGES = ["번호판 읽는 법", "게임 방법", "직접 해 보기", "이등분 퍼즐 (Lv.9)", "통과 규칙", "피버 타임", "하트 · 포인트 · 상점", "띠 승급", "레벨 소개"]

function Tutorial({ onFinish, onSkip, playClick }: { onFinish: () => void; onSkip: () => void; playClick: () => void }) {
  const [page, setPage] = useState(0)
  const last = TUTORIAL_PAGES.length - 1
  const go = (n: number) => {
    playClick()
    setPage(Math.max(0, Math.min(last, n)))
  }

  // 👆 좌우로 밀어서 넘기기
  const touchX = useRef<number | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (dx < -60 && page < last) go(page + 1)
    if (dx > 60 && page > 0) go(page - 1)
  }

  // ✏️ 3장 '직접 해 보기' 연습 문제 (시간 제한 없음)
  const [practice, setPractice] = useState(() => buildQuestion(1, 5))
  const [pInput, setPInput] = useState("")
  const [pResult, setPResult] = useState<"idle" | "correct" | "wrong">("idle")
  const submitPractice = () => {
    if (pInput === "") return
    setPResult(Number(pInput) === practice.answer ? "correct" : "wrong")
  }
  // ✂️ 이등분 퍼즐 연습 (고정 예시: 7 4 / 2 6 5 0 → 전체 24, 절반 12)
  const halfDemo: Question = {
    level: 9, front: [7, 4], back: [2, 6, 5, 0], hangul: "나", type: "partition", timer: 30,
    title: "", desc: "", answer: null, canPartition: true,
  }
  const [halfSel, setHalfSel] = useState<number[]>([])
  const [halfOk, setHalfOk] = useState(false)
  const [halfTry, setHalfTry] = useState(0)

  const newPractice = () => {
    playClick()
    setPractice(buildQuestion(1, 5))
    setPInput("")
    setPResult("idle")
  }

  const samplePlate: Question = {
    level: 1, front: [3, 7], back: [1, 2, 5, 8], hangul: "가", type: "numpad", timer: 15,
    title: "", desc: "", answer: 10,
  }
  const Bubble = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl bg-white/90 p-4 text-left text-[15px] font-bold leading-relaxed text-zinc-700 shadow-sm ring-1 ring-black/5">{children}</div>
  )

  const body = (() => {
    switch (TUTORIAL_PAGES[page]) {
      case "번호판 읽는 법":
        return (
          <>
            <div className="flex justify-center"><div className="scale-110"><Plate q={samplePlate} /></div></div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm font-black">
              <div className="rounded-xl bg-sky-100 py-2 text-sky-700">앞자리<br /><span className="text-xs font-bold">2~3자리 숫자</span></div>
              <div className="rounded-xl bg-amber-100 py-2 text-amber-700">글자<br /><span className="text-xs font-bold">계산 안 해요</span></div>
              <div className="rounded-xl bg-rose-100 py-2 text-rose-700">뒷자리<br /><span className="text-xs font-bold">4자리 숫자</span></div>
            </div>
            <Bubble>🚗 자동차 번호판의 숫자로 계산하는 게임이에요.<br />예) 앞자리 합 = <b className="text-sky-600">3 + 7 = 10</b></Bubble>
          </>
        )
      case "게임 방법":
        return (
          <>
            <div className="flex justify-center"><GameImage src="/assets/0-2-2.png" alt="팡이" className="h-28 w-28 object-contain" fallback={<span className="text-6xl">🐣</span>} /></div>
            <Bubble>
              <p>① 화면 위에 나오는 <b className="text-amber-600">문제 설명</b>을 읽어요</p>
              <p className="mt-2">② <b className="text-sky-600">번호판</b>을 보고 설명에 따라 계산해요</p>
              <p className="mt-2">③ 숫자를 누르고 <b className="rounded bg-emerald-200 px-1.5 text-emerald-800">입력</b> 버튼!</p>
              <p className="mt-3 text-sm text-zinc-500">💡 대부분의 레벨은 이렇게 하면 돼요. 앞뒤 비교(Lv.5)는 버튼을 누르고, 이등분 퍼즐(Lv.9)은 다음 장에서 따로 알려줄게요.</p>
            </Bubble>
          </>
        )
      case "직접 해 보기":
        return (
          <>
            <p className="text-center text-base font-black text-zinc-700">앞자리 숫자를 모두 더해 보세요!</p>
            <div className="flex justify-center"><Plate q={practice} /></div>
            <div className="flex items-center justify-center gap-2">
              <div className="min-w-[80px] rounded-2xl bg-zinc-900 px-4 py-2 text-center text-3xl font-black tabular-nums text-white">{pInput || "?"}</div>
              {pResult === "correct" && <span className="rounded-full bg-emerald-500 px-3 py-1.5 text-sm font-black text-white cpp-pop">정답! 🎉</span>}
              {pResult === "wrong" && <span className="rounded-full bg-rose-500 px-3 py-1.5 text-sm font-black text-white cpp-shake">다시 해 볼까요? 🤔</span>}
            </div>
            {pResult === "correct" ? (
              <div className="text-center">
                <p className="text-sm font-bold text-zinc-600">잘했어요! 실제 게임도 이렇게 하면 돼요 👍</p>
                <button type="button" onClick={newPractice} className="mt-2 rounded-full bg-white px-4 py-2 text-sm font-black text-zinc-700 shadow ring-1 ring-black/10 active:scale-95">🔄 한 문제 더</button>
              </div>
            ) : (
              <div className="rounded-2xl bg-zinc-900/90 p-2">
                <Numpad
                  value={pInput}
                  onKey={(k) => { playClick(); setPResult("idle"); setPInput((v) => (v.length >= 4 ? v : v + k)) }}
                  onBackspace={() => { playClick(); setPResult("idle"); setPInput((v) => v.slice(0, -1)) }}
                  onSubmit={submitPractice}
                  disabled={false}
                />
              </div>
            )}
          </>
        )
      case "이등분 퍼즐 (Lv.9)": {
        const all = [...halfDemo.front, ...halfDemo.back]
        const total = sum(all)
        const selSum = halfSel.reduce((a, i) => a + all[i], 0)
        return (
          <>
            <Bubble>
              <p>✂️ 번호판 숫자를 <b>두 묶음</b>으로 나눠서, 두 묶음의 합이 <b className="text-sky-600">똑같게</b> 만드는 게임이에요.</p>
              <p className="mt-2">① 전체 합을 구해요 → ② <b>절반</b>이 되도록 숫자를 눌러 <b className="text-sky-600">파란 불</b>을 켜요 → ③ <b className="rounded bg-emerald-200 px-1.5 text-emerald-800">제출</b></p>
            </Bubble>
            <p className="text-center text-sm font-black text-zinc-600">직접 눌러 보세요! 전체 합 {total} → 절반은 <span className="text-sky-600">{total / 2}</span></p>
            <div className="flex justify-center">
              <Plate
                q={halfDemo}
                selected={halfSel}
                onToggle={halfOk ? undefined : (i) => { playClick(); setHalfOk(false); setHalfSel((sel) => (sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i])) }}
              />
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-zinc-700 shadow-sm ring-1 ring-black/10">선택한 합 <span className="text-sky-600">{selSum}</span></span>
              {halfOk ? (
                <span className="rounded-full bg-emerald-500 px-3 py-1.5 text-sm font-black text-white cpp-pop">정답! {selSum} = {total - selSum} 🎉</span>
              ) : (
                <button
                  type="button"
                  disabled={halfSel.length === 0}
                  onClick={() => { playClick(); setHalfOk(selSum * 2 === total && halfSel.length < all.length) ; if (selSum * 2 !== total) setHalfTry((t) => t + 1) }}
                  className="rounded-full bg-gradient-to-b from-emerald-400 to-emerald-500 px-4 py-1.5 text-sm font-black text-emerald-950 shadow disabled:opacity-40"
                >
                  제출 ✅
                </button>
              )}
            </div>
            {!halfOk && halfTry > 0 && <p className="text-center text-sm font-bold text-rose-500">합이 {total / 2}이 되도록 다시 골라 보세요! (예: 4 + 2 + 6)</p>}
            <p className="text-center text-[13px] font-bold leading-relaxed text-zinc-500">💡 정답 조합은 여러 개일 수 있어요. 어떤 조합이든 합만 같으면 정답!<br />🚫 어떻게 해도 반으로 못 나누면 <b className="text-rose-500">이등분 불가</b> 버튼 (전체 합이 홀수면 무조건 불가)</p>
          </>
        )
      }
      case "통과 규칙":
        return (
          <>
            <div className="flex items-center justify-center gap-2 text-5xl"><span>📝</span><span className="text-3xl font-black text-zinc-700">15문제</span></div>
            <Bubble>
              <p>✅ 15문제 중 <b className="text-emerald-600">13개 이상</b> 맞히면 통과! 다음 레벨이 열려요.</p>
              <p className="mt-2">🟢 처음 <b>3문제</b>는 연습이라 정답을 알려줘요.</p>
              <p className="mt-2">⏰ 시간이 다 되면 틀린 걸로 처리돼요.</p>
              <p className="mt-2">❌ 틀리면 <b className="text-rose-500">빨간색으로 정답</b>을 보여줘요.</p>
            </Bubble>
          </>
        )
      case "피버 타임":
        return (
          <>
            <p className="text-center text-5xl font-black italic text-orange-500" style={{ textShadow: "0 0 12px #FFD700, 0 0 24px #FF8C00" }}>FEVER TIME</p>
            <Bubble>
              <p>⚡ 시간이 넉넉할 때(⅔ 이상 남았을 때) 맞히면 <b>빠른 정답</b>!</p>
              <p className="mt-2">🔥 빠른 정답 <b>3번 연속</b>이면 피버 타임 시작!</p>
              <p className="mt-2">💰 문제당 포인트 <b>10P → 15P</b></p>
              <p className="mt-2 text-sm text-zinc-500">늦게 맞히거나 틀리면 피버가 꺼져요.</p>
            </Bubble>
          </>
        )
      case "하트 · 포인트 · 상점":
        return (
          <Bubble>
            <p>💖 <b>하트</b>: 게임 한 판에 1개 사용. 매일 5개까지 다시 채워져요.</p>
            <p className="mt-3">🪙 <b>포인트</b>: 문제를 맞히고, 레벨을 통과하고, 📅 출석체크, 💌 친구 초대로 모아요.</p>
            <p className="mt-3">🛒 <b>포인트 상점</b>: 모은 포인트로 카트, 배경, 이모티콘, 하트를 살 수 있어요.</p>
          </Bubble>
        )
      case "띠 승급":
        return (
          <>
            <div className="flex flex-col items-center gap-2">
              {(["화이트", "블루", "퍼플", "브라운", "블랙"] as const).map((n) => (
                <div key={n} className="flex w-full max-w-[260px] items-center gap-2">
                  <span className="w-14 text-right text-sm font-black text-zinc-600">{n}</span>
                  <div className="h-5 flex-1 rounded" style={{ background: BELT_COLORS[n].base, boxShadow: `inset 0 0 0 2px ${BELT_COLORS[n].edge}` }}>
                    <div className="ml-auto mr-[10%] h-full w-[28%]" style={{ background: BELT_COLORS[n].bar }} />
                  </div>
                </div>
              ))}
            </div>
            <Bubble>
              <p>🥋 지금까지 모은 <b>누적 포인트</b>로 띠가 올라가요. 상점에서 포인트를 써도 줄지 않아요!</p>
              <p className="mt-2">🎀 띠마다 <b>그랄(줄무늬) 4개</b>를 모으면 다음 띠로 승급해요.</p>
            </Bubble>
          </>
        )
      default:
        return (
          <div className="grid grid-cols-2 gap-1.5">
            {Array.from({ length: 11 }, (_, i) => i + 1).map((lv) => (
              <div key={lv} className="flex items-center gap-1.5 rounded-xl bg-white/90 px-2.5 py-2 text-left shadow-sm ring-1 ring-black/5">
                <span className="text-xs font-black text-amber-600">Lv.{lv}</span>
                <span className="text-[13px] font-bold leading-tight text-zinc-700">{(LEVEL_DESC[lv] ?? "모든 게임 섞어서").replace("\n", " ")}</span>
              </div>
            ))}
          </div>
        )
    }
  })()

  return (
    <div
      className="cpp-promo-in fixed inset-0 z-[90] flex flex-col bg-gradient-to-b from-amber-50 via-rose-50 to-sky-100"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="mx-auto flex h-full w-full max-w-[440px] flex-col px-5 pb-5 pt-4">
        {/* 상단: 단계 표시 + 건너뛰기 (언제든 가능) */}
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black text-zinc-500 shadow-sm">🎓 게임 방법 {page + 1}/{TUTORIAL_PAGES.length}</span>
          <button type="button" onClick={() => { playClick(); onSkip() }} className="rounded-full bg-white/80 px-3 py-1.5 text-sm font-black text-zinc-600 shadow-sm active:scale-95">
            건너뛰기 ✕
          </button>
        </div>

        <h2 key={`t${page}`} className="mt-4 text-center text-3xl font-black text-zinc-800 cpp-pop">{TUTORIAL_PAGES[page]}</h2>

        <div key={`b${page}`} className="cpp-rise-in mt-4 flex min-h-0 flex-1 flex-col justify-center gap-4 overflow-y-auto cpp-no-scrollbar">
          {body}
        </div>

        {/* 하단: 점 표시 + 이전/다음 */}
        <div className="mt-4 flex justify-center gap-1.5">
          {TUTORIAL_PAGES.map((_, i) => (
            <span key={i} className={cn("h-2 rounded-full transition-all", i === page ? "w-6 bg-amber-500" : "w-2 bg-zinc-300")} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
          <button type="button" disabled={page === 0} onClick={() => go(page - 1)} className="rounded-2xl bg-white py-3.5 text-base font-black text-zinc-600 shadow-sm ring-1 ring-black/10 disabled:opacity-40">
            ◀ 이전
          </button>
          {page < last ? (
            <button type="button" onClick={() => go(page + 1)} className="rounded-2xl bg-gradient-to-b from-yellow-300 to-amber-400 py-3.5 text-base font-black text-amber-950 shadow-[0_4px_0_#b45309] active:translate-y-0.5">
              다음 ▶
            </button>
          ) : (
            <button type="button" onClick={() => { playClick(); onFinish() }} className="rounded-2xl bg-gradient-to-b from-emerald-300 to-emerald-500 py-3.5 text-base font-black text-emerald-950 shadow-[0_4px_0_#047857] active:translate-y-0.5">
              시작하기! 🚀
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CounterPangPang() {
  
  
  // (그 아래로는 BGM 코드 등이 이어집니다)

  
  // ▼▼▼ 14곡 랜덤 무한 재생 BGM 코드 ▼▼▼
  React.useEffect(() => {
    // 1. 1부터 14까지의 숫자를 만들고 무작위로 섞어주는 마법의 함수 (피셔-예이츠 셔플)
    const shuffleArray = (array: number[]) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };

    // 2. 플레이리스트 생성 및 초기 세팅
    let playlist = shuffleArray(Array.from({ length: 14 }, (_, i) => i + 1));
    let currentIndex = 0;
    
    // 첫 번째 곡 세팅
    let currentAudio = new Audio(`/assets/bgm${playlist[currentIndex]}.mp3`);
    currentAudio.volume = 0.3; // 볼륨 크기 (0.3이 적당합니다)
    
    // ▼▼▼ 이 한 줄을 꼭 추가해 주세요! (버튼과 음악을 연결해 줍니다) ▼▼▼
    (window as any).globalBgm = currentAudio;
   

    // 3. 한 곡이 끝났을 때 다음 곡으로 부드럽게 넘기는 함수
    const playNext = () => {
      currentIndex++;
      
      // 만약 14곡을 다 들었다면? -> 다시 새롭게 섞어서 처음부터 무한 반복!
      if (currentIndex >= playlist.length) {
        playlist = shuffleArray([...playlist]);
        currentIndex = 0;
      }
      
      // 다음 곡으로 오디오 소스 교체 후 재생
      currentAudio.src = `/assets/bgm${playlist[currentIndex]}.mp3`;
      currentAudio.play().catch(e => console.log("음악 재생 대기 중..."));
    };

    // 현재 음악이 끝나는 순간(ended)을 감지해서 playNext를 실행하게 만듭니다.
    currentAudio.addEventListener('ended', playNext);

    // 4. 브라우저 자동재생 차단 방지 (유저가 화면을 처음 '클릭'하면 1번 트랙 시작!)
    const handleFirstClick = () => {
      currentAudio.play().catch(e => console.log("자동재생 대기"));
      document.removeEventListener('click', handleFirstClick); // 한 번 시작되면 클릭 이벤트는 삭제
    };
    
    document.addEventListener('click', handleFirstClick);

    // ▼▼▼ 화면 밖으로 나가면 노래 끄기 추가 ▼▼▼
    const handleVisibilityChange = () => {
      if (document.hidden) {
        currentAudio.pause(); // 다른 앱을 켜면 노래 정지
      } else {
        // 앱으로 돌아왔을 때, 음소거 상태가 아니라면 다시 재생
        if (!currentAudio.muted) {
          currentAudio.play().catch(e => console.log("재생 대기"));
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    // ▲▲▲ 여기까지 ▲▲▲

    // 5. 화면을 벗어날 때 정리 (음악 끄기)
    return () => {
      currentAudio.pause();
      currentAudio.removeEventListener('ended', playNext);
      document.removeEventListener('click', handleFirstClick);
      document.removeEventListener("visibilitychange", handleVisibilityChange); // 정리 코드 추가
    };
  }, []);
  // ▲▲▲ 여기까지입니다 ▲▲▲
  const [loaded, setLoaded] = useState(false)
  const [screen, setScreen] = useState<Screen>("INTRO")

  // 저장 데이터
  const [nickname, setNickname] = useState<string | null>(null)
  const [hearts, setHearts] = useState(5)
  const [heartDate, setHeartDate] = useState(today())
  const [unlocked, setUnlocked] = useState(0)
  const [records, setRecords] = useState<Record<number, number>>({})
  const [muted, setMuted] = useState(false)
  // 🔇 소리 끄기 상태 (효과음 재생 함수들이 항상 최신 값을 보도록 ref로도 보관)
  const mutedRef = useRef(muted)
  mutedRef.current = muted
  const playSound = (src: string) => {
    if (mutedRef.current) return
    new Audio(src).play().catch(() => {})
  }
  const [points, setPoints] = useState(0);
  const [lifetimePoints, setLifetimePoints] = useState(0); // 🌟 누적 포인트
  const [monthlyPoints, setMonthlyPoints] = useState(0);   // 🌟 월간 포인트
  const [monthlyDate, setMonthlyDate] = useState(today().slice(0, 7)); // 🌟 이번 달 (예: 2026-10)
  const [isFever, setIsFever] = useState(false);
  const [fastCombo, setFastCombo] = useState(0);
  // 🥋 승급 애니메이션 상태
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionBelt, setPromotionBelt] = useState<{ badge: string; style: string; from?: string } | null>(null);
  const prevBeltRef = useRef<string | null>(null); // 이전 띠 기억용
  // 게임 중 승급하면 바로 띄우지 않고 '대기'시켰다가 게임이 끝난 뒤(결과 화면) 보여줌
  const [promotionPending, setPromotionPending] = useState(false);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  // 🌟 [핵심 수술] 포인트 획득 자동 감지 센서!
  // 게임이나 출석으로 points가 올라가면, 센서가 감지해서 누적/월간 포인트도 같이 올려줍니다.
  const prevPointsRef = useRef(0);
  const pointsSyncedRef = useRef(false); // 저장 데이터 불러온 직후 기준점 잡았는지 여부
 useEffect(() => {
    if (!loaded) return;
    if (!pointsSyncedRef.current) {
      // 🛡️ 저장된 포인트/띠를 '획득'으로 착각하지 않도록, 불러오기 완료 직후 값을 기준점으로 기억
      pointsSyncedRef.current = true;
      prevPointsRef.current = points;
      prevBeltRef.current = getBeltInfo(lifetimePoints).currentRank.badge;
      return;
    }
    const diff = points - prevPointsRef.current;
    
    if (diff > 0) {
      const nextTotalPoints = lifetimePoints + diff;
      setLifetimePoints(prev => prev + diff);
      
      // 🥋 승급 감지 모니터링
      const oldBelt = prevBeltRef.current;
      const newBeltInfo = getBeltInfo(nextTotalPoints).currentRank;
      
      if (oldBelt && oldBelt !== newBeltInfo.badge) {
        // 이전 띠와 다른 더 높은 띠로 올라갔다면 축하 연출 발동!
        // (게임/결과 화면이면 게임이 끝난 뒤 결과 화면에서 보여주도록 대기)
        setPromotionBelt({ ...newBeltInfo, from: oldBelt });
        if (screenRef.current === "GAME" || screenRef.current === "RESULT") setPromotionPending(true);
        else setShowPromotionModal(true);
        prevBeltRef.current = newBeltInfo.badge; // 새로운 띠로 기억 갱신
      }
      
      const currentMonth = today().slice(0, 7);
      if (monthlyDate !== currentMonth) {
        setMonthlyPoints(diff);
        setMonthlyDate(currentMonth);
      } else {
        setMonthlyPoints(prev => prev + diff);
      }
    }
    prevPointsRef.current = points;
  }, [points, loaded, monthlyDate]);
  // 🏆 누적 포인트(lifetimePoints)에 따른 주짓수 정통 그랄(Stripe) 승급 함수
  // 🏆 누적 포인트(lifetimePoints)에 따른 주짓수 정통 그랄(Stripe) 승급 함수
  const getBeltInfo = (lp: number) => {
    const ranks = [
      // ⬜ 화이트 벨트 구간 (0 ~ 10,000) - 2000P마다 1그랄
      { req: 0,     badge: "⬜ 화이트",        style: "bg-white text-gray-700 border border-gray-300 shadow-sm" },
      { req: 2000,  badge: "⬜ 화이트 1그랄",  style: "bg-white text-gray-700 border border-gray-300 shadow-sm" },
      { req: 4000,  badge: "⬜ 화이트 2그랄",  style: "bg-white text-gray-700 border border-gray-300 shadow-sm" },
      { req: 6000,  badge: "⬜ 화이트 3그랄",  style: "bg-white text-gray-700 border border-gray-300 shadow-sm" },
      { req: 8000,  badge: "⬜ 화이트 4그랄",  style: "bg-white text-gray-700 border border-gray-300 shadow-sm" },
      
      // 🟦 블루 벨트 구간 (10,000 ~ 30,000) - 4000P마다 1그랄
      { req: 10000, badge: "🟦 블루",        style: "bg-blue-600 text-white shadow-sm" },
      { req: 14000, badge: "🟦 블루 1그랄",  style: "bg-blue-600 text-white shadow-sm" },
      { req: 18000, badge: "🟦 블루 2그랄",  style: "bg-blue-600 text-white shadow-sm" },
      { req: 22000, badge: "🟦 블루 3그랄",  style: "bg-blue-600 text-white shadow-sm" },
      { req: 26000, badge: "🟦 블루 4그랄",  style: "bg-blue-600 text-white shadow-sm" },
      
      // 🟪 퍼플 벨트 구간 (30,000 ~ 60,000) - 6000P마다 1그랄
      { req: 30000, badge: "🟪 퍼플",        style: "bg-purple-600 text-white shadow-sm" },
      { req: 36000, badge: "🟪 퍼플 1그랄",  style: "bg-purple-600 text-white shadow-sm" },
      { req: 42000, badge: "🟪 퍼플 2그랄",  style: "bg-purple-600 text-white shadow-sm" },
      { req: 48000, badge: "🟪 퍼플 3그랄",  style: "bg-purple-600 text-white shadow-sm" },
      { req: 54000, badge: "🟪 퍼플 4그랄",  style: "bg-purple-600 text-white shadow-sm" },
      
      // 🟫 브라운 벨트 구간 (60,000 ~ 100,000) - 8000P마다 1그랄
      { req: 60000, badge: "🟫 브라운",        style: "bg-amber-800 text-white shadow-sm" },
      { req: 68000, badge: "🟫 브라운 1그랄",  style: "bg-amber-800 text-white shadow-sm" },
      { req: 76000, badge: "🟫 브라운 2그랄",  style: "bg-amber-800 text-white shadow-sm" },
      { req: 84000, badge: "🟫 브라운 3그랄",  style: "bg-amber-800 text-white shadow-sm" },
      { req: 92000, badge: "🟫 브라운 4그랄",  style: "bg-amber-800 text-white shadow-sm" },
      
      // ⬛ 블랙 벨트 (100,000 ~ )
      { req: 100000, badge: "⬛ 블랙 벨트",    style: "bg-zinc-900 text-yellow-400 ring-1 ring-yellow-400/30 shadow-md" },
    ];
    
    let currentRankIndex = 0;
    for (let i = 0; i < ranks.length; i++) {
      if (lp >= ranks[i].req) currentRankIndex = i;
      else break;
    }
    
    return { 
      currentRank: ranks[currentRankIndex], 
      nextRank: currentRankIndex < ranks.length - 1 ? ranks[currentRankIndex + 1] : null 
    };
  };

  // 내 실제 누적 포인트에 맞는 칭호와 다음 목표 세팅!
  const myRankInfo = getBeltInfo(lifetimePoints);
  const myTitle = myRankInfo.currentRank;
// 🎬 12단계 배경 데이터 (경로: /assets/mp4/)
  // 🎬 배경 데이터 (경로: /assets/mp4/)
  const BACKGROUNDS = [
    { id: 0, name: "가로수드라이브 (기본)", file: "가로수드라이브.mp4", price: 0, unlockLevel: 0 }, // 👈 새로 추가된 기존 배경!
    { id: 1, name: "해변의드라이브", file: "해변의드라이브.mp4", price: 0, unlockLevel: 0 }, // (가격은 원하시는 대로 수정 가능합니다)
    { id: 2, name: "벚꽃드라이브", file: "벚꽃드라이브.mp4", price: 20, unlockLevel: 1 },
    { id: 3, name: "단풍길", file: "단풍길.mp4", price: 40, unlockLevel: 2 },
    { id: 4, name: "한밤의도심", file: "한밤의도심.mp4", price: 60, unlockLevel: 3 },
    { id: 5, name: "눈오는산속", file: "눈오는산속.mp4", price: 10, unlockLevel: 4 },
    { id: 6, name: "사막의질주", file: "사막의질주.mp4", price: 10, unlockLevel: 5 },
    { id: 7, name: "아이스크림과캔디", file: "아이스크림과캔디.mp4", price: 10, unlockLevel: 6 },
    { id: 8, name: "지하도시", file: "지하도시.mp4", price: 20, unlockLevel: 7 },
    { id: 9, name: "스핑크스로드", file: "스핑크스로드.mp4", price: 30, unlockLevel: 8 },
    { id: 10, name: "화산과용암", file: "화산과용암.mp4", price: 40, unlockLevel: 9 },
    { id: 11, name: "우주도시", file: "우주도시.mp4", price: 50, unlockLevel: 10 },
    { id: 12, name: "황금의나라", file: "황금의나라.mp4", price: 70, unlockLevel: 11 },
  ];
    
// 📸 이모티콘 팩 리스트 (9종 캐릭터 x 5가지 감정)
  const EMOTICON_PACKS = [
    { id: "pangi", name: "팡이", price: 30, unlockLevel: 0 },
    { id: "croc", name: "주둥이 짧은 악어", price: 50, unlockLevel: 1 },
    { id: "elephant", name: "코가 짧은 코끼리", price: 70, unlockLevel: 2 },
    { id: "giraffe", name: "목이 짧은 기린", price: 90, unlockLevel: 3 },
    { id: "hippo", name: "입이 작은 하마", price: 110, unlockLevel: 4 },
    { id: "lion", name: "대머리 사자", price: 130, unlockLevel: 5 },
    { id: "ostrich", name: "다리가 짧은 타조", price: 150, unlockLevel: 6 },
    { id: "owl", name: "눈이 작은 부엉이", price: 170, unlockLevel: 7 },
    { id: "rabbit", name: "귀가 작은 토끼", price: 190, unlockLevel: 8 },
  ];

  const EMOTIONS = [
    { id: "joy", name: "기쁨" },
    { id: "sad", name: "슬픔" },
    { id: "angry", name: "화남" },
    { id: "love", name: "사랑해" },
    { id: "cheer", name: "화이팅" },
  ];

  // 🚗 카트(세트) 리스트 (실제 폴더의 이미지 파일명과 100% 일치)
  const KARTS = [
    { id: "kart_basic", name: "기본 차량", file: "kart_default_yellow.png", price: 0 },
    { id: "kart_crocodile", name: "주둥이짧은 악어 카트", file: "kart_crocodile.png", price: 0 },
    { id: "kart_elephant", name: "코가 짧은 코끼리 카트", file: "kart_elephant.png", price: 5 },
    { id: "kart_fire_truck", name: "소방 카트", file: "kart_fire_truck.png", price: 5 },
    { id: "kart_giraffe", name: "목이 짧은 기린 카트", file: "kart_giraffe.png", price: 4 },
    { id: "kart_hippo", name: "입이 작은 하마 카트", file: "kart_hippo.png", price: 6 },
    { id: "kart_lion", name: "대머리사자 카트", file: "kart_lion.png", price: 8 },
    { id: "kart_ostrich", name: "다리가 짧은 타조 카트", file: "kart_ostrich.png", price: 3 },
    { id: "kart_owl", name: "눈이 작은부엉이 카트", file: "kart_owl.png", price: 5 },
    { id: "kart_police", name: "경찰 카트", file: "kart_police.png", price: 7 },
    { id: "kart_rabbit", name: "귀가작은 토끼 카트", file: "kart_rabbit.png", price: 4 },
    { id: "kart_tank", name: "탱크 카트", file: "kart_tank.png", price: 10 },
    // 👇 여기서부터 새롭게 추가된 일반 자동차 6종 👇
    { id: "car_suv", name: "SUV", file: "suv.png", price: 5 },
    { id: "car_police", name: "경찰차", file: "경찰차.png", price: 7 },
    { id: "car_fire", name: "소방차", file: "소방차.png", price: 6 },
    { id: "car_sports", name: "스포츠카", file: "스포츠카.png", price: 8 },
    { id: "car_tank", name: "전투 탱크", file: "탱크.png", price: 10 },
    { id: "car_forklift", name: "포크레인", file: "포크레인.png", price: 9 }
  ];

  // 🌟 가로수드라이브를 기본 장착 배경으로 설정! (해변의 드라이브도 기본 보유)
  const [ownedBgs, setOwnedBgs] = useState<string[]>(["가로수드라이브.mp4", "해변의드라이브.mp4"]);
  const [equippedBg, setEquippedBg] = useState<string>("가로수드라이브.mp4");

  // 🏞️ 앱 실행 시 저장된 보유/적용 배경 불러오기 (기본 보유 배경은 항상 유지)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedOwned = localStorage.getItem("cp_owned_bgs");
      if (savedOwned) {
        const parsed: string[] = JSON.parse(savedOwned);
        setOwnedBgs(prev => Array.from(new Set([...prev, ...parsed])));
      }
      const savedEquipped = localStorage.getItem("cp_equipped_bg");
      if (savedEquipped) setEquippedBg(savedEquipped);
    } catch {
      /* ignore */
    }
  }, []);

  const buyBackground = (file: string, price: number) => {
    if (points >= price) {
      setPoints(prev => prev - price);
      const newOwned = Array.from(new Set([...ownedBgs, file]));
      setOwnedBgs(newOwned);
      localStorage.setItem("cp_owned_bgs", JSON.stringify(newOwned));
      sfxClick();
      flashToast("🎉 배경 구매 완료! 관리 → 내 테마에서 적용해 보세요");
    } else {
      flashToast(`포인트가 부족해요! (${points}P / ${price}P) 😥`);
    }
  };
  React.useEffect(() => {
    const drivingSound = new Audio('/assets/driving.mp3');
    drivingSound.loop = true; 
    drivingSound.volume = 0.4; 

    if (screen === "GAME" && !muted) {
      drivingSound.play().catch(e => console.log("주행 소리 재생 대기"));
    } else {
      drivingSound.pause(); 
    }

    // ▼▼▼ 화면 밖으로 나가면 주행 소리 끄기 추가 ▼▼▼
    const handleVis = () => {
      if (document.hidden) {
        drivingSound.pause();
      } else if (screen === "GAME" && !muted) {
        drivingSound.play().catch(e => console.log("주행 소리 재생 대기"));
      }
    };
    document.addEventListener("visibilitychange", handleVis);
    // ▲▲▲ 여기까지 ▲▲▲

    return () => {
      drivingSound.pause();
      document.removeEventListener("visibilitychange", handleVis); // 정리 코드 추가
    };
  }, [screen, muted]);
  const [exitPhase, setExitPhase] = useState<"ask" | "goodbye" | null>(null);

  // 게임 상태
  const [chosenLevel, setChosenLevel] = useState(0)
  // 화면이 처음 켜질 때, 저장된 레벨이 있으면 불러오기
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedLevel = parseInt(localStorage.getItem("pangpang_level") ?? "", 10);
    if (!Number.isNaN(savedLevel)) setChosenLevel(savedLevel);
  }, []);

  // 레벨이 변할 때마다 영구 기억 장치에 자동으로 덮어쓰기
  // (불러오기 완료 전에는 저장하지 않아야 초기값 0이 저장된 레벨을 덮어쓰지 않음)
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("pangpang_level", chosenLevel.toString());
  }, [chosenLevel, loaded]);
  const [questions, setQuestions] = useState<Question[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [input, setInput] = useState("")
  const [selected, setSelected] = useState<number[]>([])
  const [reaction, setReaction] = useState<Reaction>("idle")
  const [locked, setLocked] = useState(false)
  const [timeLeft, setTimeLeft] = useState(15)
  const [isPaused, setIsPaused] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)

  // 결과
  const [passed, setPassed] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [resultPhase, setResultPhase] = useState<"boom" | "cheer">("boom")

  // 기타 UI
  const [nickInput, setNickInput] = useState("")
  const [showVault, setShowVault] = useState(false)
  const [showAttendance, setShowAttendance] = useState(false);
  const [attData, setAttData] = useState({ date: "", weekCount: 0, lastMonday: "" });
  // 💖 포인트 하트 구매 일일 제한 관리 상태
  const [heartBuyData, setHeartBuyData] = useState({ date: "", count: 0 });
// 🚗 [1단계] 자동차 스킨 및 내 보관함(My Page) 상태 관리
  const [ownedCars, setOwnedCars] = useState<string[]>(["kart_basic"]); 
  const [equippedCar, setEquippedCar] = useState("kart_basic");
  const [showMyPage, setShowMyPage] = useState(false); // 내 보관함 팝업 상태
  const [activeCategory, setActiveCategory] = useState("info");
  const [shopCategory, setShopCategory] = useState("emoticon"); // 🌟 포인트 상점 탭 상태

  // --- 📸 이모티콘 보유 및 구매 관련 상태 & 함수 ---
  const [ownedEmoticons, setOwnedEmoticons] = useState<string[]>([]); // 👈 서버 에러 방지를 위해 일단 빈 배열로 시작

  // 앱 실행 시 저장된 이모티콘 데이터 불러오기 (화면이 켜진 후 안전하게 실행)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedEmots = localStorage.getItem("cp_owned_emoticons");
      if (savedEmots) setOwnedEmoticons(JSON.parse(savedEmots));
    }
  }, []);

  // 📸 이모티콘 구매 함수
  const buyEmoticon = (itemId: string, price: number, itemName: string) => {
    if (points < price) {
      flashToast(`포인트가 부족해요! (${points}P / ${price}P) 😥`);
      return;
    }
    sfxClick();
    const newPoints = points - price;
    setPoints(newPoints);
    localStorage.setItem("cp_points", newPoints.toString());

    const updated = [...ownedEmoticons, itemId];
    setOwnedEmoticons(updated);
    localStorage.setItem("cp_owned_emoticons", JSON.stringify(updated));

    flashToast(`${itemName} 구매 완료! 🎉`);
  };
  useEffect(() => {
    const savedOwned = localStorage.getItem("cp_owned_cars");
    if (savedOwned) setOwnedCars(JSON.parse(savedOwned));
    const savedEquipped = localStorage.getItem("cp_equipped_car");
    if (savedEquipped) setEquippedCar(savedEquipped);
  }, []);

  // 🚗 포인트로 차량 스킨 구매하는 함수
  const buyCar = (carId: string, price: number) => {
    sfxClick();
    if (ownedCars.includes(carId)) {
      flashToast("이미 차고에 있는 멋진 차량입니다! 🚗");
      return;
    }
    if (points < price) {
      flashToast(`포인트가 부족해요! (${price}P 필요) 😥`);
      return;
    }
    
    setPoints(prev => prev - price);
    const newOwned = [...ownedCars, carId];
    setOwnedCars(newOwned);
    localStorage.setItem("cp_owned_cars", JSON.stringify(newOwned));
    flashToast("차량 구매 완료! 곧 완성될 '내 차고'에서 장착할 수 있어요 🎁");
  };
  // 앱 켤 때 오늘 날짜의 하트 구매 횟수 불러오기 (자정 24시 리셋 기준)
  useEffect(() => {
    const saved = localStorage.getItem("cp_heart_buy");
    const currentToday = today();
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.date !== currentToday) {
        setHeartBuyData({ date: currentToday, count: 0 });
      } else {
        setHeartBuyData(parsed);
      }
    } else {
      setHeartBuyData({ date: currentToday, count: 0 });
    }
  }, []);

  // 💖 포인트로 하트 구매하는 함수 (50P 소모, 하루 최대 3회)
  const buyHeartWithPoints = () => {
    sfxClick();
    const currentToday = today();
    const currentCount = heartBuyData.date === currentToday ? heartBuyData.count : 0;

    if (currentCount >= 3) {
      flashToast("오늘 하트 충전 횟수(3/3)를 모두 채웠어요! 내일 다시 만나요 ⏰");
      return;
    }

    if (points < 50) {
      flashToast(`포인트가 부족해요! (${points}P / 50P) 😥`);
      return;
    }

    if (hearts >= HEART_CAP) {
      flashToast("이미 하트가 가득 찼어요! 💖");
      return;
    }

    setPoints(prev => prev - 50);
    setHearts(prev => prev + 1);

    const newBuyData = { date: currentToday, count: currentCount + 1 };
    setHeartBuyData(newBuyData);
    localStorage.setItem("cp_heart_buy", JSON.stringify(newBuyData));

    flashToast(`50P로 하트 충전 완료! 💖 (오늘 ${newBuyData.count}/3회)`);
  };

  // 이번 주 월요일 날짜 구하기 (주간 초기화용)
  const getMonday = (d = new Date()) => {
    const dt = new Date(d);
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    return localDate(new Date(dt.setDate(diff)));
  };

  useEffect(() => {
    const saved = localStorage.getItem("cp_attendance");
    const currentMonday = getMonday();
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.lastMonday !== currentMonday) {
        setAttData({ date: "", weekCount: 0, lastMonday: currentMonday });
      } else {
        setAttData(parsed);
      }
    } else {
      setAttData({ date: "", weekCount: 0, lastMonday: currentMonday });
    }
  }, []);

  const handleAttendance = () => {
    sfxClick();
    const todayStr = today();
    if (attData.date === todayStr) {
      flashToast("오늘은 이미 출석했어요! 내일 또 만나요 👋");
      return;
    }

    const newCount = attData.weekCount + 1;
    let bonus = 0;
    if (newCount === 3) bonus = 5;
    else if (newCount === 5) bonus = 10;
    else if (newCount === 7) bonus = 20;

    const totalReward = 5 + bonus;
    setPoints(p => p + totalReward);
    
    const newData = { date: todayStr, weekCount: newCount, lastMonday: attData.lastMonday };
    setAttData(newData);
    localStorage.setItem("cp_attendance", JSON.stringify(newData));

    if (bonus > 0) {
      flashToast(`주 ${newCount}회 출석 달성! 보너스 포함 ${totalReward}P 획득 🎉`);
    } else {
      flashToast(`출석 완료! 5P 획득 🎁`);
    }
    setShowAttendance(false);
  };
  const [toast, setToast] = useState<string | null>(null)
  
// --- 📥 다운로드 미리보기 상태 ---
  const [previewItem, setPreviewItem] = useState<{title: string, file: string, price: number} | null>(null);
  
  // --- 💌 초대하기 및 일일 보상 시스템 ---
  const [inviteCount, setInviteCount] = useState(0);

  // 날짜가 바뀌면 초대 횟수 자동 초기화
  useEffect(() => {
    const todayStr = new Date().toLocaleDateString();
    const savedInvite = localStorage.getItem('cp_invite');
    if (savedInvite) {
      const { date, count } = JSON.parse(savedInvite);
      if (date === todayStr) {
        setInviteCount(count);
      } else {
        setInviteCount(0); 
      }
    }
  }, []);

  // 공유 버튼 클릭 시 실행될 함수
  // 공유 버튼 클릭 시 실행될 함수
  const handleShare = async () => {
    if (inviteCount >= 5) {
      flashToast(`오늘 초대 보상을 모두 받으셨어요! (5/5) 내일 다시 만나요 ⏰`);
      return;
    }

    const shareUrl = 'https://count-pang-pang.vercel.app'; // 대표 메인 주소

    try {
      if (navigator.share) {
        // 1. 일반 브라우저: 스마트폰 기본 공유 창 호출
        await navigator.share({
          title: '카운터 팡팡 🎮',
          text: '내 두뇌 한계에 도전해봐! 꿀잼 두뇌 게임 카운터 팡팡!',
          url: shareUrl
        });
      } else {
        // 2. 카카오톡 인앱 등 공유 미지원 환경: 링크 복사로 대체
        await navigator.clipboard.writeText(shareUrl);
        flashToast("초대 링크가 복사되었습니다! 카톡 창에 붙여넣어 주세요 📋");
      }
      
      // 공유 또는 복사 성공 시 보상 지급
      sfxClick();
      const newCount = inviteCount + 1;
      setInviteCount(newCount);
      setPoints(prev => prev + 30);
      localStorage.setItem('cp_invite', JSON.stringify({ date: new Date().toLocaleDateString(), count: newCount }));
      
      // 알림이 겹치지 않게 살짝 시간차를 두고 보상 알림 띄우기
      setTimeout(() => flashToast(`초대 성공! 30P 지급 완료 🎁 (오늘 ${newCount}/5회)`), 1000);
    } catch (error) {
      // 사용자가 공유 창을 닫은 경우는 조용히 넘어가고, 공유·복사가 막힌 환경이면 안내
      if ((error as Error)?.name === "AbortError") return;
      flashToast("공유가 안 되는 환경이에요 😥 count-pang-pang.vercel.app 주소를 직접 알려 주세요");
    }
  };
  const correctRef = useRef(0)
  const qIndexRef = useRef(0)
  const audioRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    qIndexRef.current = qIndex
  }, [qIndex])

  /* --------------------- 저장/불러오기 --------------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const d = JSON.parse(raw) as SaveData
        let h = typeof d.hearts === "number" ? d.hearts : 5
        let hd = d.heartDate ?? today()
        if (hd !== today()) {
          // 💖 날이 바뀌면 5개까지 채워주되, 전날 5개 이상 모아둔 하트는 그대로 유지
          h = Math.max(h, 5)
          hd = today()
        }
        setNickname(d.nickname ?? null)
        setHearts(h)
        setHeartDate(hd)
        setUnlocked(d.unlocked ?? 0)
       setRecords(d.records ?? {})
        setMuted(!!d.muted)
        setPoints(d.points ?? 0)
        setLifetimePoints(d.lifetimePoints ?? 0) // 🌟 누적 데이터 불러오기
        
        // 🌟 월간 초기화 방어 로직 (접속했는데 저번 달 데이터면 0으로 포맷)
        const currentMonth = today().slice(0, 7);
        if (d.monthlyDate && d.monthlyDate !== currentMonth) {
          setMonthlyPoints(0);
          setMonthlyDate(currentMonth);
        } else {
          setMonthlyPoints(d.monthlyPoints ?? 0);
          setMonthlyDate(d.monthlyDate ?? currentMonth);
        }

        if (d.nickname) setScreen("INTRO")
      }
    } catch {
      /* ignore */
    }
    setLoaded(true)
  }, [])

  // 🌟 모든 데이터 영구 저장 엔진 추가
  useEffect(() => {
    if (!loaded) return;
    const data: SaveData = {
      nickname, hearts, heartDate, unlocked, records, muted, points,
      lifetimePoints, monthlyPoints, monthlyDate
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [loaded, nickname, hearts, heartDate, unlocked, records, muted, points, lifetimePoints, monthlyPoints, monthlyDate]);

 // 📱 스마트폰 뒤로가기(하드웨어) 완벽 동기화 로직 (대표님 피드백 반영 완결판)
  const [quitConfirm, setQuitConfirm] = useState(false); // 게임 중 뒤로가기 → "그만둘까요?" 확인창
  const [showTutorial, setShowTutorial] = useState(false); // 🎓 Lv.0 튜토리얼(게임 방법)
  // 🔥 오늘의 도전: 매일 열린 레벨 중 하나를 골라, 오늘 처음 통과하면 통과 보너스 2배
  const [daily, setDaily] = useState<{ date: string; level: number; done: boolean }>({ date: "", level: 0, done: false });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = JSON.parse(localStorage.getItem("cp_daily") ?? "null");
      if (saved && saved.date === today()) setDaily(saved);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    // 오늘 도전 레벨이 아직 없으면 정함 (날짜를 씨앗으로 써서 하루 동안 같은 레벨). Lv.1이 열려야 시작
    if (!loaded || unlocked < 1) return;
    const day = today();
    if (daily.date === day) return;
    const seed = Number(day.replace(/-/g, ""));
    const maxLv = Math.min(unlocked, MAX_LEVEL);
    const next = { date: day, level: 1 + (seed % maxLv), done: false };
    setDaily(next);
    localStorage.setItem("cp_daily", JSON.stringify(next));
  }, [loaded, unlocked, daily.date]);
  const dailyActive = daily.date === today() && daily.level >= 1;

  // 📊 학습 기록 (부모님 리포트용)
  const [learnStats, setLearnStats] = useState<LearnStats>(EMPTY_STATS);
  const [statsLoaded, setStatsLoaded] = useState(false); // 불러오기 전엔 저장하지 않음 (빈 기록이 덮어쓰지 않도록)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = JSON.parse(localStorage.getItem(STATS_KEY) ?? "null");
      if (saved && saved.types && saved.days && saved.games) setLearnStats(saved);
    } catch {
      /* ignore */
    }
    setStatsLoaded(true);
  }, []);
  useEffect(() => {
    if (!statsLoaded) return;
    localStorage.setItem(STATS_KEY, JSON.stringify(learnStats));
  }, [learnStats, statsLoaded]);
  const recordAnswer = (logicLevel: number, isCorrect: boolean) => {
    const day = today();
    setLearnStats((st) => {
      const t = st.types[logicLevel] ?? { tries: 0, correct: 0 };
      const d = st.days[day] ?? { games: 0, solved: 0, correct: 0 };
      return {
        ...st,
        types: { ...st.types, [logicLevel]: { tries: t.tries + 1, correct: t.correct + (isCorrect ? 1 : 0) } },
        days: { ...st.days, [day]: { ...d, solved: d.solved + 1, correct: d.correct + (isCorrect ? 1 : 0) } },
      };
    });
  };
  const recordGame = (level: number, score: number) => {
    const day = today();
    setLearnStats((st) => {
      const d = st.days[day] ?? { games: 0, solved: 0, correct: 0 };
      // 날짜별 기록은 최근 60일만 보관
      const days = Object.fromEntries(Object.entries({ ...st.days, [day]: { ...d, games: d.games + 1 } }).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-60));
      return { ...st, days, games: [...st.games, { date: day, level, score }].slice(-30) };
    });
  };
  const [kakaoGuide, setKakaoGuide] = useState(false); // 카카오톡 앱 안에서 저장 시 '다른 브라우저로 열기' 안내
  // 📲 홈 화면에 추가 (PWA 설치)
  const installPromptRef = useRef<any>(null); // 안드로이드 크롬이 주는 '설치' 이벤트 보관
  const [installGuide, setInstallGuide] = useState<null | "ios" | "kakao" | "other" | "done">(null);
  const [isStandalone, setIsStandalone] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsStandalone(window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);
    const onPrompt = (e: Event) => { e.preventDefault(); installPromptRef.current = e; };
    const onInstalled = () => { installPromptRef.current = null; setIsStandalone(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  const handleInstall = async () => {
    sfxClick();
    if (isStandalone) return setInstallGuide("done");
    if (installPromptRef.current) {
      const ev = installPromptRef.current;
      installPromptRef.current = null;
      ev.prompt();
      const choice = await ev.userChoice?.catch(() => null);
      if (choice?.outcome === "accepted") flashToast("홈 화면에 카운터 팡팡이 추가됐어요! 🚗");
      return;
    }
    if (isKakaoInApp()) return setInstallGuide("kakao");
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return setInstallGuide("ios");
    setInstallGuide("other");
  };
  const stateRef = useRef({ showVault, showAttendance, previewItem, screen, exitPhase, showMyPage, showPromotionModal, quitConfirm, showTutorial });
  const isPopRef = useRef(false); // 브라우저 뒤로가기 타이머 (무한 루프 방지용)
  
  useEffect(() => {
    stateRef.current = { showVault, showAttendance, previewItem, screen, exitPhase, showMyPage, showPromotionModal, quitConfirm, showTutorial };
  }, [showVault, showAttendance, previewItem, screen, exitPhase, showMyPage, showPromotionModal, quitConfirm, showTutorial]);

  // 1. 초기 진입 시 기본 방어막 1개 생성
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
  }, []);

  // 2. 화면이동 시 히스토리 쌓기 (🌟 게임에서 튕기는 현상 완벽 해결!)
  useEffect(() => {
    if (isPopRef.current) return;
    if (screen === "GAME" || screen === "RESULT") {
      window.history.pushState(null, "", window.location.href);
    }
  }, [screen]);

  // 3. 팝업이 뜰 때 히스토리 쌓기 (🌟 팝업에서 튕기는 현상 완벽 해결!)
  useEffect(() => {
    if (isPopRef.current) return;
    if (exitPhase || showVault || showAttendance || previewItem || showMyPage || showTutorial) {
      window.history.pushState(null, "", window.location.href);
    }
  }, [exitPhase, showVault, showAttendance, previewItem, showMyPage, showTutorial]);

  // 4. 진짜 뒤로가기를 눌렀을 때의 동작 흐름
  useEffect(() => {
    const handlePopState = () => {
      isPopRef.current = true; // 스마트폰 뒤로가기 감지 켜기
      const current = stateRef.current;
      
      if (current.showTutorial) {
        // 튜토리얼에서 뒤로가기 = 건너뛰기 (Lv.1은 열어줌)
        setShowTutorial(false);
        setUnlocked((u) => Math.max(u, 1));
      } else if (current.showPromotionModal) {
        // 승급 축하 화면은 뒤로가기로 닫기 (다음 뒤로가기에 대비해 방어막 다시 추가)
        window.history.pushState(null, "", window.location.href);
        setShowPromotionModal(false);
      } else if (current.exitPhase === "goodbye") {
        setExitPhase("ask"); 
      } else if (current.exitPhase === "ask") {
        setExitPhase(null);
      } else if (current.previewItem) {
        setPreviewItem(null);
      } else if (current.showVault) {
        setShowVault(false);
      } else if (current.showAttendance) {
        setShowAttendance(false);
      } else if (current.showMyPage) {
        setShowMyPage(false);
      } else if (current.screen === "GAME") {
        // 게임 중엔 바로 나가지 않고 "그만둘까요?" 확인 (확인창에서 한 번 더 누르면 계속하기)
        window.history.pushState(null, "", window.location.href);
        if (current.quitConfirm) {
          setQuitConfirm(false);
          setIsPaused(false);
        } else {
          setQuitConfirm(true);
          setIsPaused(true);
        }
      } else if (current.screen === "RESULT") {
        setScreen("LOBBY");
      } else {
        // 메인 화면에서 뒤로가기 -> 앱 꺼짐 방지용 방어막 추가 후 팝업 띄움
        window.history.pushState(null, "", window.location.href);
        setExitPhase("ask");
      }

      // 0.1초 뒤 감지 끄기 (자연스러운 화면 전환 유도)
      setTimeout(() => { isPopRef.current = false; }, 100); 
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  /* --------------------- 사운드 --------------------- */
  // 🔇 저장된 소리 설정을 배경음악에도 반영 (앱을 다시 켜도 꺼둔 상태 유지)
  useEffect(() => {
    const bgm = (window as any).globalBgm as HTMLAudioElement | undefined
    if (bgm) bgm.muted = muted
  }, [muted, loaded])

  const beep = useCallback(
    (freq: number, dur: number, type: OscillatorType = "sine") => {
      if (muted) return
      try {
        const ac = audioRef.current ?? (audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)())
        const o = ac.createOscillator()
        const g = ac.createGain()
        o.type = type
        o.frequency.value = freq
        o.connect(g)
        g.connect(ac.destination)
        g.gain.setValueAtTime(0.14, ac.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur)
        o.start()
        o.stop(ac.currentTime + dur)
      } catch {
        /* ignore */
      }
    },
    [muted],
  )
  const sfxClick = useCallback(() => beep(620, 0.07), [beep])
  const sfxRight = useCallback(() => playSound('/assets/정답.mp3'), []);
  const sfxWrong = useCallback(() => playSound('/assets/오답.mp3'), []);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashToast = useCallback((msg: string) => {
    setToast(msg)
    // 긴 안내는 읽을 수 있게 더 오래 표시 (최소 1.6초, 최대 4초), 새 알림이 오면 이전 타이머는 취소
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), Math.min(4000, Math.max(1600, msg.length * 70)))
  }, [])

  /* --------------------- 게임 진행 --------------------- */
  const currentQ = questions[qIndex]
  const isExample = qIndex < 3
// --- 🎵 피버타임 진입 효과음 ---
  useEffect(() => {
    if (isFever) playSound('/assets/피버타임.mp3');
  }, [isFever]);
  // 문제 전환 시 초기화
  useEffect(() => {
    if (screen !== "GAME") return
    const q = questions[qIndex]
    if (!q) return
    setInput("")
    setSelected([])
    setReaction("idle")
    setLocked(false)
    setTimeLeft(q.timer)
  }, [screen, qIndex, questions])

  const finishGame = useCallback(() => {
    const score = correctRef.current
    const ok = score >= PASS_LINE
    setFinalScore(score)
    setPassed(ok)
    setResultPhase("boom")
    recordGame(chosenLevel, score)
    if (ok) {
        setRecords((r) => ({ ...r, [chosenLevel]: Math.max(r[chosenLevel] ?? 0, score) }))
        if (chosenLevel < MAX_LEVEL) setUnlocked((u) => Math.max(u, chosenLevel + 1))
        
        // 레벨 패스 보너스 지급 (레벨0: 5점, 레벨1: 30점 ~ 최대 110점)
        const bonus = chosenLevel === 0 ? 5 : Math.min(20 + (chosenLevel * 10), 110);
        // 🔥 오늘의 도전 레벨을 오늘 처음 통과하면 보너스 2배
        const isDaily = daily.date === today() && !daily.done && chosenLevel === daily.level;
        setPoints(prev => prev + (isDaily ? bonus * 2 : bonus));
        if (isDaily) {
          const doneDaily = { ...daily, done: true };
          setDaily(doneDaily);
          localStorage.setItem("cp_daily", JSON.stringify(doneDaily));
          setTimeout(() => flashToast(`🔥 오늘의 도전 성공! 통과 보너스 2배 +${bonus * 2}P`), 300);
        }
      }
    setScreen("RESULT")
  }, [chosenLevel, daily])

  const advance = useCallback(() => {
    if (screenRef.current !== "GAME") return // 게임 도중 나갔으면 진행 중단
    const next = qIndexRef.current + 1
    if (next >= TOTAL_Q) {
      finishGame()
    } else {
      // 다음 문제로 넘어가는 같은 순간에 입력·선택을 비워서, 이전 문제의 선택이 새 번호판에 잠깐 남지 않게 함
      setInput("")
      setSelected([])
      setQIndex(next)
    }
  }, [finishGame])

  const resolve = useCallback(
    (isCorrect: boolean) => {
      if (locked) return
      setLocked(true)
      // 📊 학습 기록 (예제 3문제는 정답을 보여주므로 제외)
      const q = questions[qIndexRef.current]
      if (q && qIndexRef.current >= 3) recordAnswer(q.level, isCorrect)
      if (isCorrect) {
        correctRef.current += 1
        setCorrectCount(correctRef.current)
        setReaction("correct")
        sfxRight()
      } else {
        setReaction("wrong")
        sfxWrong()
      }
      setTimeout(advance, isCorrect ? 950 : 1800) // 틀리면 정답을 볼 수 있게 조금 더 오래 머묾
    },
    [locked, advance, sfxRight, sfxWrong, questions],
  )
 
 
  // 타이머
  useEffect(() => {
    // isPaused(일시정지) 상태일 때는 시간이 안 줄어듦!
    if (screen !== "GAME" || locked || isPaused) return
    if (timeLeft <= 0) {
      setIsFever(false);
      setFastCombo(0);
      resolve(false);
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearTimeout(id)
  }, [screen, locked, timeLeft, resolve, isPaused])
  // ▲▲▲ 여기까지 교체 완료 ▲▲▲
// ⏱️ 실시간 피버 감시자: 남은 시간이 2/3 미만으로 떨어지는 순간 즉시 피버 강제 종료
  // (문제가 바뀐 직후엔 timeLeft가 아직 이전 문제 값이라 판정을 건너뜀 → 그랜드 마스터에서 피버가 잘못 꺼지던 문제 방지)
  const feverQRef = useRef(-1);
  useEffect(() => {
    if (feverQRef.current !== qIndex) {
      feverQRef.current = qIndex;
      return;
    }
    if (isFever && currentQ && timeLeft < currentQ.timer * (2 / 3)) {
      setIsFever(false);
      setFastCombo(0);
    }
  }, [timeLeft, isFever, currentQ, qIndex]);
  const startLevel = useCallback(
    (level: number) => {
      // 🎓 Lv.0은 게임이 아니라 튜토리얼 (하트 사용 안 함)
      if (level === 0) {
        sfxClick()
        setShowTutorial(true)
        return
      }
      if (level > unlocked) {
        flashToast("아직 잠긴 레벨이에요! 🔒")
        return
      }
      if (hearts <= 0) {
        flashToast("하트가 없어요. 광고로 충전해요! 💖")
        return
      }
      sfxClick()
      setHearts((h) => h - 1)
      const qs = buildGame(level)
      correctRef.current = 0
      qIndexRef.current = 0
      setChosenLevel(level)
      setQuestions(qs)
      setQIndex(0)
    setCorrectCount(0)
    setIsPaused(false)
    setQuitConfirm(false)
    setIsFever(false) // 새 게임 시작 시 피버타임 강제 종료
    setFastCombo(0)   // 연속 정답 콤보 0으로 초기화
    setScreen("GAME")
    },
    [unlocked, hearts, sfxClick, flashToast],
  )

  // 🥋 대기 중인 승급 축하 화면 표시: 결과 화면 연출(팡!) 이 끝난 뒤, 또는 결과 화면을 벗어나면 바로
  useEffect(() => {
    if (!promotionPending || screen === "GAME") return
    if (screen === "RESULT") {
      const id = setTimeout(() => {
        setPromotionPending(false)
        setShowPromotionModal(true)
      }, 1700)
      return () => clearTimeout(id)
    }
    setPromotionPending(false)
    setShowPromotionModal(true)
  }, [promotionPending, screen])

  // 결과 연출 (통과 시 boom -> cheer)
  useEffect(() => {
    if (screen === "RESULT" && passed) {
      setResultPhase("boom")
      const id = setTimeout(() => setResultPhase("cheer"), 1500)
      return () => clearTimeout(id)
    }
  }, [screen, passed])

  /* --------------------- 입력 핸들러 --------------------- */
  const onKey = (k: string) => {
    if (locked) return
    sfxClick()
    if (typeof window !== "undefined" && navigator.vibrate) navigator.vibrate(30); // 📱 숫자 입력 시 짧은 진동
    setInput((v) => (v.length >= 4 ? v : v + k))
  }
  
  const onBackspace = () => {
    if (locked) return
    sfxClick()
    if (typeof window !== "undefined" && navigator.vibrate) navigator.vibrate(30); // 📱 지우기 입력 시 짧은 진동
    setInput((v) => v.slice(0, -1))
  }
  // 🎯 공통 채점 (숫자 입력 / 비교 / 이등분 모두 같은 규칙)
  // - 예제 문제(1~3번)는 포인트 없음
  // - 빨리(남은 시간 2/3 이상) 맞히면: 피버 중 15P, 아니면 10P + 콤보 증가 (3연속이면 피버 발동)
  // - 늦게 맞히면: 10P, 피버·콤보 해제
  // - 틀리면: 피버·콤보 해제
  const applyScore = (isCorrect: boolean) => {
    if (!currentQ || isExample) return
    if (!isCorrect) {
      setIsFever(false);
      setFastCombo(0);
      return
    }
    const isFast = timeLeft >= currentQ.timer * (2 / 3);
    if (!isFast) {
      setIsFever(false);
      setFastCombo(0);
      setPoints((prev) => prev + 10);
      return
    }
    setPoints((prev) => prev + (isFever ? 15 : 10));
    setFastCombo((prev) => {
      const newCombo = prev + 1;
      if (newCombo >= 3 && qIndex >= 3) setIsFever(true);
      return newCombo;
    });
  }

  const onNumSubmit = () => {
    if (!currentQ || input === "" || locked) return
    const isCorrect = Number(input) === currentQ.answer;
    applyScore(isCorrect);
    resolve(isCorrect);
  }
  const onCompare = (choice: "front" | "back" | "equal") => {
    if (!currentQ || locked) return
    sfxClick()
    const isCorrect = choice === currentQ.answer;
    applyScore(isCorrect);
    resolve(isCorrect);
  }
  const togglePartition = (i: number) => {
    if (locked) return
    sfxClick()
    setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))
  }
  const onPartitionSubmit = () => {
    if (!currentQ || locked) return
    const all = [...currentQ.front, ...currentQ.back]
    const selSum = selected.reduce((a, i) => a + all[i], 0)
    const total = sum(all)
    const valid = selected.length > 0 && selected.length < all.length && selSum === total - selSum
    applyScore(valid)
    resolve(valid)
  }
  const onPartitionImpossible = () => {
    if (!currentQ || locked) return
    sfxClick()
    const isCorrect = !currentQ.canPartition
    applyScore(isCorrect)
    resolve(isCorrect)
  }

  // 🎁 무료 하트 충전: 하루 3회 (날짜가 바뀌면 다시 3회). 나중에 광고를 붙이면 이 함수에서 광고 시청 후 지급하면 됨
  const FREE_HEART_PER_DAY = 3
  const [freeHeart, setFreeHeart] = useState({ date: "", count: 0 })
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const saved = JSON.parse(localStorage.getItem("cp_free_heart") ?? "null")
      if (saved && saved.date === today()) setFreeHeart(saved)
    } catch {
      /* ignore */
    }
  }, [])
  const freeHeartLeft = FREE_HEART_PER_DAY - (freeHeart.date === today() ? freeHeart.count : 0)
  const rechargeAd = () => {
    sfxClick()
    if (freeHeartLeft <= 0) {
      flashToast("오늘 무료 충전을 모두 사용했어요! 내일 다시 받을 수 있어요 ⏰")
      return
    }
    if (hearts >= HEART_CAP) {
      flashToast("하트가 가득 찼어요!")
      return
    }
    const next = { date: today(), count: FREE_HEART_PER_DAY - freeHeartLeft + 1 }
    setFreeHeart(next)
    localStorage.setItem("cp_free_heart", JSON.stringify(next))
    setHearts((h) => Math.min(HEART_CAP, h + 1))
    flashToast(`무료 하트 +1 💖 (오늘 남은 횟수 ${FREE_HEART_PER_DAY - next.count}회)`)
  }

  const reactionState = reaction === "correct" ? 1 : reaction === "wrong" ? 6 : 3
  const reactionEmoji = reaction === "correct" ? "🎉" : reaction === "wrong" ? "😵" : "🚗"

  /* --------------------- 렌더 --------------------- */
 const MuteButton = (
    <button
      type="button"
      onClick={() => {
        setMuted((m) => {
          const nextMuted = !m;
          // [핵심] 재생 중인 배경음악을 찾아서 실제로 음소거(muted) 시키는 마법의 코드
          if (typeof window !== "undefined" && (window as any).globalBgm) {
            (window as any).globalBgm.muted = nextMuted;
          }
          return nextMuted;
        });
      }}
      // 동그라미를 빼고, 글씨가 여유 있게 들어가도록 가로 폭(px-4)을 늘린 예쁜 알약 모양
      className="absolute right-3 top-3 z-40 flex h-10 px-4 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white backdrop-blur-md shadow-lg"
    >
      {muted ? "🔇 소리 켜기" : "🔊 소리 끄기"}
    </button>
  );

  return (
    <div
      className="flex w-full items-center justify-center overflow-hidden bg-zinc-950"
      style={{ height: "100dvh" }}
    >
      <div className="relative mx-auto flex h-full w-full max-w-[440px] flex-col overflow-hidden bg-[#0b1020] text-white">
        {/* 🎵 BGM 끄기/켜기 버튼은 로비에서만 표시 */}
        {screen === "LOBBY" && MuteButton}

        {/* 토스트 */}
        {toast && (
          <div className="pointer-events-none absolute left-1/2 top-16 z-50 -translate-x-1/2 rounded-full bg-black/80 px-5 py-2 text-sm font-bold text-white shadow-lg backdrop-blur cpp-pop">
            {toast}
          </div>
        )}

        {/* ============================ INTRO ============================ */}
        {screen === "INTRO" && (
          <section className="relative flex h-full flex-col items-center justify-between overflow-hidden">
            {/* 1. 시원한 도로 배경 */}
          <div 
            className="absolute inset-0 z-0"
            style={{ backgroundImage: "url('/assets/road-bg.png')", backgroundSize: "cover", backgroundPosition: "center" }}
          />
          {/* 칙칙한 검은 필름을 걷어내고, 햇살처럼 화사한 투명 필름으로 교체! */}
        <div className="absolute inset-0 z-0 bg-white/10" aria-hidden />
          
        {/* 2. 둥둥 떠다니는 팡이 크루 4인방! (클릭 방해 안 되게 pointer-events-none 추가) */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            {/* 좌측 상단 */}
            <img src="/assets/0-2-2.png" alt="" className="absolute -left-6 top-[15%] h-32 w-32 object-contain opacity-90 drop-shadow-2xl cpp-float" style={{ animationDelay: "0s" }} />
            {/* 우측 상단 */}
            <img src="/assets/0-3-5.png" alt="" className="absolute -right-8 top-[35%] h-40 w-40 object-contain opacity-90 drop-shadow-2xl cpp-float" style={{ animationDelay: "1s" }} />
            {/* 좌측 하단 */}
            <img src="/assets/0-7-7.png" alt="" className="absolute left-4 bottom-[25%] h-28 w-28 object-contain opacity-90 drop-shadow-2xl cpp-float" style={{ animationDelay: "0.5s" }} />
            {/* 우측 하단 */}
            <img src="/assets/0-10-3.png" alt="" className="absolute -right-4 bottom-[10%] h-36 w-36 object-contain opacity-90 drop-shadow-2xl cpp-float" style={{ animationDelay: "1.5s" }} />
          </div>
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
            {/* 상단 타이틀 영역 (cpp-float 클래스를 추가해서 통째로 둥둥 떠다니게 만들기!) */}
          <div className="absolute top-12 left-0 right-0 flex flex-col items-center justify-center cpp-float">
            {/* 1번째 줄 */}
            <p className="mb-1 text-xl font-black tracking-widest text-yellow-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" style={{ fontFamily: "'MaplestoryOTFBold', sans-serif" }}>
              팡이와 함께하는
            </p>
            
            {/* 2번째 줄 (윗줄과 완벽하게 똑같은 글씨체, 색상, 그림자로 깔끔하게 통일!) */}
            <h1
              className="text-5xl whitespace-nowrap font-black tracking-tight text-yellow-300 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]"
              style={{ fontFamily: "'MaplestoryOTFBold', sans-serif" }}
            >
              카운터 팡팡
            </h1>
          </div>
              <GameImage
                src="/assets/car.png"
                alt="자동차"
                fallback={<span style={{ fontSize: "6rem" }}>🐣</span>}
                className="mt-6 h-40 w-40 rounded-full object-cover ring-4 ring-white/20 drop-shadow-[0_10px_16px_rgba(0,0,0,0.5)] cpp-float"
              />
            </div>
            <div className="relative z-10 w-full px-6 pb-10">
              <button
                type="button"
                onClick={() => {
                  sfxClick()
                  setScreen(nickname ? "LOBBY" : "LOGIN")
                }}
                className="w-full rounded-2xl bg-gradient-to-b from-yellow-300 to-amber-400 py-4 text-xl font-black text-amber-950 shadow-[0_6px_0_#b45309] active:translate-y-1 active:shadow-[0_2px_0_#b45309]"
              >
                시작하기 🚗
              </button>
              {/* 👇 여기서부터 추가: 물리적인 게임 종료 버튼 👇 */}
              <button
                type="button"
                onClick={() => {
                  sfxClick();
                  setExitPhase("ask"); // 누르면 1단계 팝업 호출!
                }}
                className="mt-3 w-full rounded-2xl bg-white/10 py-3.5 text-lg font-black text-white ring-1 ring-white/30 active:translate-y-1"
              >
                게임 종료하기 🚪
              </button>
              {/* 👆 여기까지 추가 👆 */}
            </div>
          </section>
        )}

        {/* ============================ LOGIN ============================ */}
        {screen === "LOGIN" && (
          <section className="relative flex h-full flex-col items-center justify-center overflow-hidden px-6">
            {/* 1. 도로 배경 추가 & 어두운 필터(bg-gradient) 완전 제거 */}
        <img src="/assets/road-bg.png" alt="로그인배경" className="absolute inset-0 z-0 h-full w-full object-cover" />
        
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const name = nickInput.trim()
            if (!name) {
              flashToast("닉네임을 입력해 주세요!")
              return
            }
            sfxClick()
            setNickname(name)
            setScreen("LOBBY")
            // 🎓 처음 가입했고 아직 Lv.1이 안 열렸다면 게임 방법을 자동으로 한 번 보여줌
            if (unlocked < 1) setShowTutorial(true)

            if ((window as any).globalBgm) {
              (window as any).globalBgm.play().catch(() => console.log("BGM 재생 대기"));
            }
          }}
          /* 2. 닉네임 박스(테두리, 배경색) 삭제하고 내용물만 남김 */
          className="relative z-10 w-full max-w-sm"
        >
          {/* 👇 여기서부터 원하는 문구로 수정하세요 👇 */}
          <div className="mb-2 flex justify-center">
  <img src="/assets/0-2-2.png" alt="상단 장식" className="h-32 object-contain" />
</div>
          <h2 className="mb-1 text-center text-3xl font-black text-black drop-shadow-md">반가워요 </h2>
          <p className="mb-6 text-center text-base font-bold text-black drop-shadow-md">닉네임은 선물로 받을 이모티콘에 시그니처로 사용됩니다.</p>
          {/* 👆 여기까지 👆 */}

          <label className="mb-2 block text-sm font-bold text-black drop-shadow-md" htmlFor="nick">
            닉네임
          </label>
          <input
            id="nick"
            value={nickInput}
            onChange={(e) => setNickInput(e.target.value)}
            maxLength={12}
            placeholder="예: 계산왕팡이"
            /* 입력창 자체는 글씨가 잘 보이도록 하얀 배경에 검은 글씨로 변경 */
            className="mb-5 w-full rounded-xl border-2 border-black/20 bg-white px-4 py-3 text-lg font-bold text-black placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-yellow-400/50"
          />
              <button
                type="submit"
                className="w-full rounded-2xl bg-gradient-to-b from-pink-400 to-pink-500 py-3.5 text-lg font-black text-white shadow-[0_5px_0_#be185d] active:translate-y-1 active:shadow-[0_1px_0_#be185d]"
              >
              
                입장하기
              </button>
            </form>
          </section>
        )}

        {/* ============================ LOBBY ============================ */}
        {screen === "LOBBY" && (
          <section className="relative flex h-full flex-col overflow-hidden">
            
            {/* 1. 메인 화면과 똑같은 도로 배경 이미지 깔기! */}
            {/* 💡 주의: 아래 "bg.png" 자리에 대표님이 메인 화면에 쓰신 실제 도로 배경 파일 이름을 넣어주세요! */}
            {/* 파일 이름을 bg.png 에서 road-bg.png 로 변경! */}
            <img src="/assets/road-bg.png" alt="로비배경" className="absolute inset-0 z-0 h-full w-full object-cover" />
            
            {/* 아까 메인 화면에 넣었던 화사한 햇살 투명 필름 똑같이 추가 */}
            <div className="absolute inset-0 z-0 bg-white/10" />

           {/* 2. 기존 글씨와 내용들이 배경에 가려지지 않도록 위로 띄워주기 (relative z-10) */}
        <header className="relative z-10 flex-none px-4 pb-3 pt-4">
          {/* 상단 닉네임 + 하트 영역 (가로 정렬 묶음) */}
          <div className="relative flex items-center justify-between pr-12">
            {/* 왼쪽 닉네임 */}
            <div>
              <p className="text-xs text-black/60">반가워요</p>
             {/* 실제 유저 레벨 연동 칭호 뱃지 (닉네임은 아랫줄 '관리' 버튼 앞에만 표시) */}
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-2 py-1 text-[11px] font-black ${myTitle.style}`}>
                  {myTitle.badge}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-black text-black">{nickname} 님</p>
                <button
                type="button"
                onClick={() => {
                  sfxClick();
                  setShowMyPage(true);
                }}
                className="flex items-center gap-1 rounded-full bg-black/10 px-2.5 py-1 text-xs font-bold text-black/70 active:scale-95"
              >
                ⚙️ 관리
              </button>
              </div>
            </div>

            {/* 하트 개수: 위아래 중앙 + 가로 중앙 정렬로 완벽 고정 */}
           
          </div>

          {/* 🌟 1줄: 초대하기(1/4) + 하트 충전(3/4) 가로 배치 */}
          <div className="mt-3 flex w-full items-center gap-2">
            {/* 1. 현재 하트 개수 (포인트 박스처럼 왼쪽에 고정) */}
              <div className="flex flex-none items-center justify-center gap-1 rounded-2xl bg-white/40 px-3 py-2 text-sm font-black text-black/80 shadow-sm backdrop-blur-sm">
                💖 <span>{hearts}</span>
              </div>
            {/* 왼쪽: 초대하기 (flex-1) */}
            <button
              type="button"
              onClick={handleShare}
              className="flex flex-none items-center justify-center gap-1 whitespace-nowrap rounded-2xl bg-sky-200/60 px-2.5 py-3 text-sm font-bold text-black/80 shadow-sm active:scale-95"
            >
              💌 초대
            </button>
            
            {/* 오른쪽: 무료 하트 충전 (하루 3회, 남은 폭 전부 사용, 작은 폰에서도 한 줄 유지) */}
            <button
              type="button"
              onClick={rechargeAd}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-2xl bg-sky-200/60 px-1.5 py-3 text-[clamp(10px,3.3vw,14px)] font-black text-black/80 active:scale-95",
                freeHeartLeft <= 0 && "opacity-50",
              )}
            >
              🎁 무료 하트 충전 <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[0.8em]">+1 💖 {freeHeartLeft}/{FREE_HEART_PER_DAY}</span>
            </button>
          </div>

          {/* 🌟 2줄: 포인트 창 + 출석체크 + 포인트 상점 */}
          <div className="mt-2 flex w-full items-center gap-2">
            
            {/* 💰 보유 포인트 + 이번 달 누적 포인트 */}
            <div className="flex flex-col w-[110px] items-center justify-center rounded-2xl bg-sky-200/60 py-1.5 text-xs font-bold text-black/80">
              <span className="text-blue-700">현재: {points}P</span>
              <span className="text-[10px] text-amber-700">월간 누적: {monthlyPoints}P</span>
            </div>

            <button
              type="button"
              onClick={() => {
                sfxClick();
                setShowAttendance(true);
              }}
              className="flex flex-[2] items-center justify-center gap-1 rounded-2xl bg-sky-200/60 py-2.5 text-sm font-bold text-black/80 active:scale-95"
            >
              📅 출석체크
            </button>

            <button
              type="button"
              onClick={() => {
                sfxClick();
                setShowVault(true);
              }}
              className="flex flex-[3] items-center justify-center gap-2 rounded-2xl bg-sky-200/60 py-2.5 text-sm font-bold text-black/80 active:scale-95"
            >
              🛒 포인트 상점
            </button>
          </div>
        </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 cpp-no-scrollbar">
              {/* 🔥 오늘의 도전 배너 */}
              {dailyActive && (
                <div className={cn(
                  "relative z-10 mb-3 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-sm ring-1", // z-10: 로비 배경 덮개보다 앞에 (안 그러면 버튼이 안 눌림)
                  daily.done ? "bg-white/70 ring-black/10" : "bg-gradient-to-r from-orange-400 to-rose-400 ring-orange-300",
                )}>
                  <span className="text-3xl">{daily.done ? "✅" : "🔥"}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-black", daily.done ? "text-black/50" : "text-white/90")}>
                      오늘의 도전{!daily.done && " · 통과 보너스 2배!"}
                    </p>
                    <p className={cn("break-keep text-sm font-black leading-tight", daily.done ? "text-black/70" : "text-white")}>
                      {daily.done ? "완료! 내일 또 새로운 도전이 열려요" : `Lv.${daily.level} ${(LEVEL_DESC[daily.level] ?? LEVEL_NAMES[daily.level]).replace("\n", " ")}`}
                    </p>
                  </div>
                  {!daily.done && (
                    <button type="button" onClick={() => startLevel(daily.level)} className="flex-none rounded-full bg-white px-3 py-1.5 text-sm font-black text-rose-500 shadow active:scale-95">
                      도전 ▶
                    </button>
                  )}
                </div>
              )}
              <p className="mb-2 mt-1 text-sm font-bold text-black/70">스테이지 선택</p>
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 12 }, (_, lv) => {
                  const isLocked = lv > unlocked
                  const cleared = (records[lv] ?? 0) >= PASS_LINE
                  return (
                  <button
            key={lv}
            type="button"
            onClick={() => startLevel(lv)}
            disabled={isLocked}
            className={cn(
              "relative flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-2xl p-2 text-center ring-1 transition-all overflow-hidden",
              isLocked
                ? "bg-black/5 ring-black/10" // 바뀐 노란 배경에 맞게 잠긴 카드는 반투명 검정으로!
                : "bg-white ring-black/10 shadow-sm active:scale-95", // ✨ 요청하신 깔끔한 흰색 바탕!
            )}
          >
            {cleared && (
              <span className="absolute right-1.5 top-1.5 z-20 text-sm drop-shadow-md">⭐</span>
            )}
            {dailyActive && !daily.done && daily.level === lv && (
              <span className="absolute left-1.5 top-1.5 z-20 rounded-full bg-gradient-to-r from-orange-400 to-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow">🔥 x2</span>
            )}

            {/* 1. 꽉 찬 이미지 */}
            <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl">
              <GameImage
                src={`/assets/cards/${lv}.webp`}
                alt={`Lv.${lv} 팡이`}
                fallback={
                  <img
                    src="/assets/pangi.png"
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                }
                className={cn(
                  "h-full w-full object-cover transition-all duration-300",
                  isLocked ? "opacity-40 grayscale" : "opacity-90" 
                )}
              />
            </div>
{/* 💖 하트 중앙에 표시될 클리어 보상 포인트 텍스트 (잠긴 레벨도 노출, 노란색, 레벨별 차등 지급) */}
        <div className="pointer-events-none absolute bottom-[12%] left-1/2 z-20 flex -translate-x-1/2 items-center justify-center">
          <span className="text-sm font-black text-yellow-400 drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">
            {lv === 0 ? (cleared ? "" : "+5P") : `+${Math.min(110, 20 + lv * 10)}P`}
          </span>
        </div>
            {/* 2. 글씨 (레벨은 입체감 유지, 아래 이름은 깔끔한 평면 캡슐 글씨로 변경!) */}
          <div className="relative z-10 flex flex-col items-center gap-1">
            
            {/* 윗줄: 레벨 표시 (대표님이 만족하신 입체 효과 그대로 유지!) */}
            <span 
              className={cn("text-lg font-black tracking-wide", isLocked ? "text-yellow-400/80" : "text-yellow-400")}
              style={{ WebkitTextStroke: "1px #000000", textShadow: "0px 3px 3px rgba(0,0,0,0.8)" }}
            >
              Lv.{lv}
            </span>
            
            {/* 아랫줄: 이름 표시 (입체 효과 싹 빼고, 깔끔한 평면 글씨 + 반투명 캡슐 배경) */}
            <span 
              className={cn("whitespace-pre text-center leading-tight text-[11px] font-bold px-2 py-0.5 rounded-full tracking-wide", isLocked ? "bg-black/40 text-white/70" : "bg-black/60 text-white")}
            >
              {isLocked ? "🔒 " : ""}{LEVEL_DESC[lv] ?? LEVEL_NAMES[lv]}
            </span>
            
          </div>
          </button>
             
           
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* ============================ GAME ============================ */}
        {screen === "GAME" && currentQ && (
          <section className="relative flex h-full flex-col overflow-hidden">
          
          {/* 🔥 피버 타임 시각 효과 (오렌지색 깜빡임 + 중앙 텍스트) */}
          {isFever && (
            <>
              <style>{`
                @keyframes fastFever {
                  0%, 100% { background-color: rgba(255, 165, 0, 0); }
                  50% { background-color: rgba(255, 140, 0, 0.35); }
                }
                .fever-bg {
                  animation: fastFever 0.6s infinite;
                }
              `}</style>
              
              <div className="pointer-events-none absolute inset-0 z-40 fever-bg" />
              
              <div className="pointer-events-none absolute left-1/2 top-[40%] z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center whitespace-nowrap">
                <span 
                  className="text-5xl font-black italic text-orange-500 drop-shadow-md"
                  style={{ textShadow: '0 0 15px #FFD700, 0 0 30px #FF8C00' }}
                >
                  FEVER TIME
                </span>
                <span className="mt-1 animate-pulse text-3xl font-bold text-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  +50%
                </span>
              </div>
            </>
          )}

          {/* ⏸️ 게임 중 뒤로가기 → 그만둘지 확인 (이 동안 타이머 멈춤) */}
          {quitConfirm && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
              <div className="w-full max-w-[320px] rounded-3xl bg-white p-6 text-center shadow-2xl cpp-pop">
                <p className="text-4xl">⏸️</p>
                <h2 className="mt-2 text-2xl font-black text-zinc-900">게임을 그만둘까요?</h2>
                <p className="mt-2 text-sm font-bold text-zinc-500">지금 그만두면 사용한 하트 💖는<br />돌려받을 수 없어요.</p>
                <div className="mt-6 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sfxClick()
                      setQuitConfirm(false)
                      setIsPaused(false)
                      setScreen("LOBBY")
                    }}
                    className="rounded-2xl bg-zinc-200 py-3.5 text-base font-black text-zinc-700 active:scale-95"
                  >
                    그만두기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sfxClick()
                      setQuitConfirm(false)
                      setIsPaused(false)
                    }}
                    className="rounded-2xl bg-gradient-to-b from-yellow-300 to-amber-400 py-3.5 text-base font-black text-amber-950 shadow-[0_4px_0_#b45309] active:translate-y-1 active:shadow-none"
                  >
                    계속하기 ▶
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 상태바 */}
            <header className="flex-none px-4 pb-2 pt-4">
              <div className="flex items-center justify-between gap-2 py-1">
                {/* 1. 왼쪽: 레벨 · 타이머 · 문제 번호 */}
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-black ring-1 ring-white/20">
                    Lv.{chosenLevel}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-sm font-black tabular-nums ring-1",
                      timeLeft <= 5 ? "bg-rose-500/80 ring-rose-300 animate-pulse" : "bg-white/10 ring-white/20",
                    )}
                  >
                    ⏰ {timeLeft}s
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-black tabular-nums ring-1 ring-white/20">
                    {qIndex + 1}/{TOTAL_Q}
                  </span>
                </div>

                {/* 2. 오른쪽: 포인트 지갑 (게임 중엔 BGM 버튼 대신 이 자리에 표시) */}
                <span className="flex items-center gap-1 rounded-full bg-yellow-400/20 px-3 py-1 text-sm font-black tabular-nums text-yellow-400 ring-1 ring-yellow-400/50">
                  {points}P
                </span>
              </div>

              {/* 진행도 바 (이 부분은 원래 있던 그대로 유지됩니다) */}
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-pink-400 transition-all duration-300"
                  style={{ width: `${((qIndex + 1) / TOTAL_Q) * 100}%` }}
                />
              </div>
            </header>

            {/* 무대: 도로 + 자동차 + 번호판 + 팡이 리액션 */}
            <div className="relative min-h-0 flex-1 overflow-hidden">
              
              {/* 🚗 AI로 만든 움직이는 동영상 배경 (워터마크 가리기 위해 5% 확대) */}
              {/* 🚗 장착한 배경에 따라 동적으로 바뀌는 움직이는 동영상 배경 */}
        <video
          key={equippedBg}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover scale-[1.05] brightness-110"
        >
          <source src={`/assets/mp4/${equippedBg}`} type="video/mp4" />
        </video>
              
              {/* 문제 글씨가 잘 보이게 위쪽에만 살짝 그라데이션 그림자 깔기 */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" aria-hidden />
          
              {/* 🌟 게임 화면: 완성형(원세트) 아바타 구역 */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-64 h-64 flex items-end justify-center z-0 pointer-events-none">
                
                {/* 🏎️ 카트(세트) 장착 상태: 옛날 데이터 오류 방어 로직 추가! */}
                <img 
                  src={lightImg("karts", KARTS.find(k => k.id === equippedCar)?.file || "kart_default_yellow.png", "md")} 
                  className="absolute bottom-0 w-[90%] object-contain drop-shadow-xl z-10 cpp-bounce origin-bottom" 
                  alt="카트 스킨" 
                />
                
              </div>
              

<div className="relative z-10 flex h-full flex-col items-center pt-4 pb-2 px-4">
                
                {/* 1. 문제 안내 (맨 위로) */}
                <div className="text-center mb-3">
                  <p className="text-xl font-black text-yellow-300 drop-shadow-md">{currentQ.title}</p>
                  <p className="text-sm font-bold text-white/90 drop-shadow-md">{currentQ.desc}</p>
                  {currentQ.type === "numpad" && currentQ.hiddenPos != null && (
                    <p className="mt-1 text-sm font-bold text-white/90 drop-shadow-md">
                      전체 합 = <span className="text-yellow-300">{currentQ.totalForHidden}</span>
                    </p>
                  )}
                </div>

                {/* 2 & 3. 팡이 리액션 + 물음표 + 예시 정답 (세로 공간 절약을 위해 한 줄로 통합) */}
                <div className="flex h-16 items-center justify-center gap-2 mb-2 z-20 transition-all">
                  <GameImage
                    src={
                      reaction === "correct" ? "/assets/정답이미지.png" : 
                      reaction === "wrong" ? "/assets/오답이미지.png" : 
                      "/assets/기본이미지.png"
                    }
                    alt="팡이 리액션"
                    fallback={<span style={{ fontSize: "2.4rem" }}>{reactionEmoji}</span>}
                    className={cn(
                      "h-16 w-16 rounded-2xl bg-white/10 object-contain p-1 ring-1 ring-white/20",
                      reaction === "wrong" && "cpp-shake",
                      reaction === "correct" && "cpp-pop",
                    )}
                  />
                  
                  {currentQ.type === "numpad" && (
                    <div className="min-w-[80px] rounded-2xl border border-white/20 bg-black/60 px-4 py-2 text-center backdrop-blur shadow-lg">
                      <span className="text-3xl font-black tabular-nums text-white">{input || "?"}</span>
                    </div>
                  )}

                  {/* 예시 정답을 물음표 우측으로 이동! (세로 공간 절약) */}
                  {isExample && reaction !== "wrong" && (
                    <div className="rounded-full bg-emerald-400/90 px-3 py-1.5 text-xs font-black text-emerald-950 shadow cpp-pop">
                      정답: {exampleText(currentQ)}
                    </div>
                  )}
                  {/* ❌ 틀렸을 때(시간 초과 포함) 정답 알려주기 */}
                  {reaction === "wrong" && (
                    <div className="rounded-full bg-rose-500 px-3 py-1.5 text-sm font-black text-white shadow-lg ring-2 ring-white/70 cpp-pop">
                      정답: {exampleText(currentQ)}
                    </div>
                  )}
                </div>

                {/* 🌟 4. 자동차 + 번호판 (물리적 크기 자체를 다단계로 축소!) */}
                <div className="relative flex flex-col items-center mt-auto mb-2">
                  {/* Tailwind 세로 미디어 쿼리를 이용해 박스의 실제 크기(w, h)를 확 줄여 밀려나지 않게 완벽 방어 */}
                  <div className="relative transition-all duration-300
                    w-48 h-40 
                    [@media(max-height:700px)]:w-40 [@media(max-height:700px)]:h-32 
                    [@media(max-height:600px)]:w-32 [@media(max-height:600px)]:h-24 
                    [@media(max-height:550px)]:w-28 [@media(max-height:550px)]:h-20"
                  >
                   
                    {/* 번호판도 박스 크기에 맞춰 축소! origin-bottom으로 자동차 바닥에 찰싹 고정 */}
                    <div className="absolute bottom-0 left-1/2 origin-bottom -translate-x-1/2 transform whitespace-nowrap z-30
                      scale-90 
                      [@media(max-height:700px)]:scale-75 
                      [@media(max-height:600px)]:scale-[0.6] 
                      [@media(max-height:550px)]:scale-[0.45]"
                    >
                      <Plate
                        q={currentQ}
                        selected={currentQ.type === "partition" ? selected : undefined}
                        onToggle={currentQ.type === "partition" && !locked ? togglePartition : undefined}
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div> {/* ✅ 1226번 줄부터 이어졌던 배경 박스를 여기서 완벽히 닫아줍니다! */}

        {/* 입력 영역 (레벨별 UI 스위칭) */}
        <div className="flex-none rounded-t-3xl border-t border-white/15 bg-white/5 px-4 pb-2 pt-2 backdrop-blur-xl">
          {currentQ.type === "numpad" && (
            <Numpad
              value={input}
              onKey={onKey}
              onBackspace={onBackspace}
              onSubmit={onNumSubmit}
              disabled={locked}
            />
          )}

          {currentQ.type === "compare" && (
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { k: "front", label: "앞이 큼", emoji: "⬅️" },
                  { k: "equal", label: "같음", emoji: "🟰" },
                  { k: "back", label: "뒤가 큼", emoji: "➡️" },
                ] as const
              ).map((b) => (
                <button
                  key={b.k}
                  type="button"
                  disabled={locked}
                  onClick={() => onCompare(b.k)}
                  className="flex flex-col items-center gap-1 rounded-2xl bg-gradient-to-b from-sky-400 to-sky-500 py-4 text-base font-black text-white shadow-[0_5px_0_#0369a1] active:translate-y-1 active:shadow-[0_1px_0_#0369a1] disabled:opacity-40"
                >
                  <span className="text-2xl">{b.emoji}</span>
                  {b.label}
                </button>
              ))}
            </div>
          )}

          {currentQ.type === "partition" && (
            <div className="space-y-2">
              <p className="text-center text-xs text-white/60">
                번호판 숫자를 눌러 파란 불을 켜세요 · 현재 선택 합{" "}
                <span className="font-black text-sky-300">
                  {selected.reduce((a, i) => a + ([...currentQ.front, ...currentQ.back][i] ?? 0), 0)}
                </span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={locked}
                  onClick={onPartitionSubmit}
                  className="rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-500 py-4 text-lg font-black text-emerald-950 shadow-[0_5px_0_#047857] active:translate-y-1 active:shadow-[0_1px_0_#047857] disabled:opacity-40"
                >
                  제출 ✅
                </button>
                <button
                  type="button"
                  disabled={locked}
                  onClick={onPartitionImpossible}
                  className="rounded-2xl bg-gradient-to-b from-rose-400 to-rose-500 py-4 text-lg font-black text-white shadow-[0_5px_0_#be123c] active:translate-y-1 active:shadow-[0_1px_0_#be123c] disabled:opacity-40"
                >
                  이등분 불가 🚫
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    )}
        {screen === "RESULT" && (
          <section className="relative flex h-full flex-col items-center justify-center overflow-hidden px-6 text-center">
           <div 
              className="absolute inset-0"
              style={{ backgroundImage: "url('/assets/road-bg.png')", backgroundSize: "cover", backgroundPosition: "center" }}
            />
            {/* 결과창 글씨와 이미지가 잘 보이도록 어두운 반투명 필름 덮기 */}
            <div className="absolute inset-0 bg-black/75" aria-hidden />

            <div className="relative z-10 flex flex-col items-center">
              {passed ? (
                resultPhase === "boom" ? (
                  <>
                    <GameImage
                      key="boom"
                      src={`/assets/${chosenLevel}-10.png`}
                      alt="팡!!"
                      fallback={<span style={{ fontSize: "7rem" }}>💥</span>}
                      className="h-44 w-44 object-contain cpp-pop"
                    />
                    <p className="mt-4 text-4xl font-black text-yellow-300 cpp-pop">팡!!</p>
                  </>
                ) : (
                  <>
                    <GameImage
                      key="cheer"
                      src="/assets/정답이미지.png" // 👈 레벨업 글씨가 없는 환호 이미지로 교체!
                      alt="통과 축하"
                      fallback={<span style={{ fontSize: "6rem" }}>🎉</span>}
                      className="h-40 w-40 object-contain cpp-float"
                    />
                    <p className="mt-4 text-2xl font-black text-white">통과! 🎉</p>
                    <p className="mt-2 max-w-xs text-sm text-white/80">
                      실제 자동차를 보고도 카운터 팡팡을 해봐요!
                    </p>
                  </>
                )
              ) : (
                <>
                  <GameImage
                   src="/assets/실패이미지.png"
                    alt="아쉬워요"
                    fallback={<span style={{ fontSize: "6rem" }}>😢</span>}
                    className="h-40 w-40 object-contain cpp-shake"
                  />
                  <p className="mt-4 text-2xl font-black text-white">아쉬워요!</p>
                  <p className="mt-1 text-sm text-white/70">13문제 이상 맞혀야 통과예요</p>
                </>
              )}

              <div className="mt-5 rounded-2xl bg-white/10 px-6 py-3 ring-1 ring-white/20">
                <p className="text-sm text-white/70">이번 점수</p>
                <p className="text-3xl font-black tabular-nums">
                  {finalScore}
                  <span className="text-lg text-white/60"> / {TOTAL_Q}</span>
                </p>
              </div>

              {passed && chosenLevel < MAX_LEVEL && (
                <p className="mt-3 rounded-full bg-yellow-300/90 px-4 py-1.5 text-sm font-black text-amber-950 cpp-pop">
                  🔓 Lv.{chosenLevel + 1} 성공!
                </p>
              )}
            </div>

            <div className="relative z-10 mt-8 w-full max-w-sm space-y-2">
              {/* 🔁 바로 이어서 하기 (하트 1개 사용) */}
              {(() => {
                // 승급 축하 화면이 아직 대기 중이면 먼저 보여주고, 그다음에 이어서 시작
                const playNow = (lv: number) => {
                  if (promotionPending) {
                    setPromotionPending(false)
                    setShowPromotionModal(true)
                    return
                  }
                  startLevel(lv)
                }
                return (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => playNow(chosenLevel)}
                  className={cn(
                    "rounded-2xl py-3.5 text-base font-black active:translate-y-0.5",
                    passed && chosenLevel < MAX_LEVEL
                      ? "bg-white/15 text-white ring-1 ring-white/30"
                      : "col-span-2 bg-gradient-to-b from-sky-300 to-sky-500 text-sky-950 shadow-[0_4px_0_#0369a1]",
                  )}
                >
                  🔁 다시 하기
                </button>
                {passed && chosenLevel < MAX_LEVEL && (
                  <button
                    type="button"
                    onClick={() => playNow(chosenLevel + 1)}
                    className="rounded-2xl bg-gradient-to-b from-emerald-300 to-emerald-500 py-3.5 text-base font-black text-emerald-950 shadow-[0_4px_0_#047857] active:translate-y-0.5"
                  >
                    다음 레벨 ▶
                  </button>
                )}
              </div>
                )
              })()}
              {passed && (
                <button
                  type="button"
                  onClick={() => {
                    sfxClick()
                    setShowVault(true)
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 text-sm font-bold text-white ring-1 ring-white/20 active:scale-[0.99]"
                >
                  🛒 포인트 상점 열기 
                  <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[11px] text-yellow-400">내 포인트: {points}P</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  sfxClick()
                  setScreen("LOBBY")
                }}
                className="w-full rounded-2xl bg-gradient-to-b from-yellow-300 to-amber-400 py-3.5 text-lg font-black text-amber-950 shadow-[0_5px_0_#b45309] active:translate-y-1 active:shadow-[0_1px_0_#b45309]"
              >
                확인
              </button>
            </div>
          </section>
        )}
{/* ============================ 📅 출석체크 모달 ============================ */}
        {showAttendance && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
            <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <button
                onClick={() => setShowAttendance(false)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                ✕
              </button>
              
              <h2 className="mb-2 text-center text-2xl font-black text-gray-800">📅 주간 출석부</h2>
              <p className="mb-5 text-center text-sm font-bold text-gray-500">
                매일 <span className="text-emerald-500">5P</span> 지급! 꾸준히 접속하면 보너스까지!
              </p>
              
              {/* 도장판 UI */}
              <div className="mb-6 grid grid-cols-4 gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                  const isChecked = attData.weekCount >= day;
                  const isBonus = day === 3 || day === 5 || day === 7;
                  const bonusText = day === 3 ? "+5P" : day === 5 ? "+10P" : "+20P";
                  
                  return (
                    <div 
                      key={day} 
                      className={cn(
                        "relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 transition-all",
                        isChecked ? "border-emerald-500 bg-emerald-50" : "border-gray-200 bg-gray-50"
                      )}
                    >
                      <span className="mb-1 text-xs font-bold text-gray-400">{day}일차</span>
                      {isChecked ? (
                        <span className="text-2xl cpp-pop">💮</span>
                      ) : (
                        <span className="text-2xl opacity-20">⚪</span>
                      )}
                      {isBonus && !isChecked && (
                        <div className="absolute -top-2 -right-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm">
                          {bonusText}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleAttendance}
                disabled={attData.date === today()}
                className="w-full rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-500 py-3.5 text-lg font-black text-white shadow-[0_5px_0_#047857] active:translate-y-1 active:shadow-[0_1px_0_#047857] disabled:opacity-50 disabled:shadow-none disabled:translate-y-1"
              >
                {attData.date === today() ? "오늘 출석 완료 ✅" : "출석하고 포인트 받기 🎁"}
              </button>
            </div>
          </div>
        )}
        {/* ============================ 🛒 포인트 상점 모달 ============================ */}
        
        {/* ==================== 👤 종합 마이페이지 (내 정보 관리) 모달 ==================== */}
      {showMyPage && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-3xl border-t border-white/50 bg-slate-50 backdrop-blur-md">
            
            {/* 1. 고정 헤더 */}
            <div className="flex-none flex items-center justify-between border-b border-black/5 bg-slate-100 px-5 py-4">
              <h3 className="text-lg font-black text-slate-900">👤 내 정보 관리</h3>
              <button
                type="button"
                onClick={() => {
                  sfxClick();
                  setShowMyPage(false);
                }}
                className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-lg text-zinc-900 hover:bg-black/10 active:scale-90"
              >
                ✕
              </button>
            </div>

            {/* 🌟 승급 대시보드 (경험치 바) */}
            <div className="flex-none bg-white p-5 border-b border-gray-100 shadow-sm z-10 relative overflow-hidden">
              <div className="absolute -right-6 -top-6 text-8xl opacity-5 pointer-events-none">🥋</div>
              
              <div className="relative flex justify-between items-end mb-2">
                <div>
                  <p className="text-xs font-bold text-gray-400 mb-1">나의 띠 등급</p>
                  <span className={`rounded-md px-2 py-1 text-xs font-black ${myTitle.style}`}>
                    {myTitle.badge}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400 mb-1">누적 경험치</p>
                  <p className="text-sm font-black text-slate-800">{lifetimePoints.toLocaleString()} P</p>
                </div>
              </div>
              
              {myRankInfo.nextRank ? (
                <>
                  <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden mt-3 ring-1 ring-inset ring-gray-200">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700 ease-out" 
                      style={{ width: `${Math.min(100, Math.max(0, ((lifetimePoints - myTitle.req) / (myRankInfo.nextRank.req - myTitle.req)) * 100))}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-bold text-gray-500 text-right mt-1.5">
                    다음 승급(<span className="text-emerald-600">{myRankInfo.nextRank.badge}</span>)까지 {(myRankInfo.nextRank.req - lifetimePoints).toLocaleString()}P 남음
                  </p>
                </>
              ) : (
                <p className="text-xs font-bold text-emerald-500 text-right mt-3">🎉 최고 등급(블랙 벨트)에 도달했습니다!</p>
              )}
            </div>

            {/* 2. 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto px-5 py-6 cpp-no-scrollbar">
              {/* 🌟 카테고리 탭 메뉴 */}
              <div className="flex gap-1.5 mb-6 border-b border-gray-200 pb-4 shrink-0 overflow-x-auto whitespace-nowrap cpp-no-scrollbar">
                <button onClick={() => setActiveCategory("info")} className={`px-2 py-1.5 text-xs min-[380px]:px-2.5 min-[380px]:text-[13px] font-bold rounded-lg transition-colors ${activeCategory === "info" ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-500"}`}>👤 내 정보</button>
                <button onClick={() => setActiveCategory("car")} className={`px-2 py-1.5 text-xs min-[380px]:px-2.5 min-[380px]:text-[13px] font-bold rounded-lg transition-colors ${activeCategory === "car" ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-500"}`}>🚗 내 차고</button>
                <button onClick={() => setActiveCategory("bg")} className={`px-2 py-1.5 text-xs min-[380px]:px-2.5 min-[380px]:text-[13px] font-bold rounded-lg transition-colors ${activeCategory === "bg" ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-500"}`}>🏞️ 내 테마</button>
                <button onClick={() => setActiveCategory("report")} className={`px-2 py-1.5 text-xs min-[380px]:px-2.5 min-[380px]:text-[13px] font-bold rounded-lg transition-colors ${activeCategory === "report" ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-500"}`}>📊 리포트</button>
              </div>

              {/* 📊 부모님 리포트 구역 */}
              {activeCategory === "report" && (
                <div className="mb-8">
                  <p className="mb-3 text-xs font-bold text-slate-400">👨‍👩‍👧 {nickname} 님의 학습 기록이에요. (이 기기에만 저장돼요)</p>
                  <ParentReport stats={learnStats} />
                </div>
              )}

              {/* 👤 내 정보 구역 */}
              <div className="mb-8 space-y-2" style={{ display: activeCategory === "info" ? "block" : "none" }}>
                <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="text-xs font-bold text-slate-400">닉네임</p>
                  <p className="mt-0.5 text-base font-black text-slate-800">{nickname} 님</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sfxClick();
                    setShowMyPage(false);
                    setShowTutorial(true);
                  }}
                  className="flex w-full items-center justify-between rounded-xl bg-amber-50 px-4 py-3.5 text-sm font-black text-amber-800 ring-1 ring-amber-200 active:scale-[0.99]"
                >
                  📖 게임 방법 다시 보기 <span>›</span>
                </button>
                <button
                  type="button"
                  onClick={handleInstall}
                  className="flex w-full items-center justify-between rounded-xl bg-sky-50 px-4 py-3.5 text-sm font-black text-sky-800 ring-1 ring-sky-200 active:scale-[0.99]"
                >
                  📲 홈 화면에 추가 (앱처럼 쓰기) <span>{isStandalone ? "✅" : "›"}</span>
                </button>
                <a
                  href="/privacy"
                  className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-600 ring-1 ring-slate-200"
                >
                  🔒 개인정보처리방침 <span>›</span>
                </a>
              </div>

              {/* 🚗 내 차고 구역 (보유 차량만 표시) */}
              <div className="mb-8" style={{ display: activeCategory === "car" ? "block" : "none" }}>
                <h4 className="mb-3 text-sm font-bold text-slate-700">🚗 장착 가능한 카트</h4>
                {ownedCars.length === 0 ? (
                   <p className="text-sm text-gray-500 text-center py-10">보유 중인 카트가 없습니다.<br/>포인트 상점에서 구매해 보세요!</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {KARTS.filter(item => ownedCars.includes(item.id)).map(item => {
                      const isSelected = equippedCar === item.id;
                      return (
                        <div key={item.id} className={`relative p-3 rounded-xl border-2 transition-all ${isSelected ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                          <div className="h-20 bg-slate-100 rounded-lg mb-2 flex items-center justify-center p-1 overflow-hidden">
                            {item.file ? <img src={lightImg("karts", item.file, "sm")} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-contain drop-shadow-md" /> : <span className="text-xs text-slate-400">기본(없음)</span>}
                          </div>
                          <p className="font-bold text-sm text-slate-700 text-center">{item.name}</p>
                          <div className="mt-2 flex justify-center">
                            <button 
                              onClick={() => {
                                sfxClick();
                                setEquippedCar(item.id);
                                localStorage.setItem("cp_equipped_car", item.id);
                                flashToast(`${item.name} 장착 완료! 💨`);
                              }} 
                              className={`w-full py-1.5 rounded-lg text-xs font-bold ${isSelected ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600 active:scale-95"}`}
                            >
                              {isSelected ? "장착중" : "장착"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 🏞️ 테마(배경) 구역 (보유 테마만 표시) */}
              <div className="mb-8" style={{ display: activeCategory === "bg" ? "block" : "none" }}>
                <h4 className="mb-3 text-sm font-bold text-slate-700">🏞️ 장착 가능한 테마</h4>
                {ownedBgs.length === 0 ? (
                   <p className="text-sm text-gray-500 text-center py-10">보유 중인 테마가 없습니다.<br/>포인트 상점에서 구매해 보세요!</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {BACKGROUNDS.filter(item => ownedBgs.includes(item.file)).map(item => {
                      const isSelected = equippedBg === item.file;
                      return (
                        <div key={item.id} className={`relative p-3 rounded-xl border-2 transition-all ${isSelected ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                          <div className="h-20 bg-slate-800 rounded-lg mb-2 flex items-center justify-center overflow-hidden relative shadow-inner">
                            <video src={`/assets/mp4/${item.file}#t=0.1`} className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none" preload="metadata" />
                            <span className="relative z-10 text-white font-black text-xs drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] text-center px-1 break-keep">
                              {item.name}
                            </span>
                          </div>
                          <div className="mt-2 flex justify-center">
                            <button 
                              onClick={() => {
                                sfxClick();
                                setEquippedBg(item.file);
                                localStorage.setItem("cp_equipped_bg", item.file);
                                flashToast(`${item.name} 테마가 적용되었습니다! 🏞️`);
                              }} 
                              className={`w-full py-1.5 rounded-lg text-xs font-bold ${isSelected ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600 active:scale-95"}`}
                            >
                              {isSelected ? "적용중" : "적용"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* 3. 하단 닫기 버튼 */}
            <div className="flex-none border-t border-gray-200 bg-white p-4 pb-6">
              <button
                type="button"
                onClick={() => {
                  sfxClick();
                  setShowMyPage(false);
                }}
                className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-lg active:scale-95"
              >
                닫기
              </button>
            </div>

          </div>
        </div>
      )}
      {/* ============================ 🛒 포인트 상점 모달 ============================ */}
      {showVault && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="max-h-[80%] w-full max-w-[440px] overflow-hidden rounded-t-3xl border-t border-white/50 bg-yellow-50/95 backdrop-blur-md shadow-2xl flex flex-col">
            
            {/* 상점 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 flex-none border-b border-yellow-400/20">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-zinc-900">🛒 포인트 상점</h3>
                <span className="rounded-full bg-yellow-400/30 px-2 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-500/50">
                  보유: {points}P
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  sfxClick();
                  setShowVault(false);
                }}
                className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-lg text-zinc-900 hover:bg-black/10 active:scale-90"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8 cpp-no-scrollbar">
              {/* 💖 하트 즉시 충전 (어떤 탭에서든 고정 노출) */}
              <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">💖</span>
                    <div>
                      <h4 className="text-sm font-black text-zinc-900">하트 즉시 충전</h4>
                      <p className="text-[11px] font-bold text-zinc-500">50P로 하트 1개 충전</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-black text-amber-800">
                    오늘 잔여: {3 - (heartBuyData.date === today() ? heartBuyData.count : 0)}회
                  </span>
                </div>

                <button
                  type="button"
                  onClick={buyHeartWithPoints}
                  className="w-full rounded-xl bg-gradient-to-b from-rose-400 to-rose-500 py-3 text-sm font-black text-white shadow-[0_3px_0_#be123c] active:translate-y-0.5 active:shadow-none"
                >
                  💖 하트 +1 충전하기 (50P)
                </button>
              </div>

              {/* 🌟 상점 카테고리 탭 */}
              <div className="flex gap-2 mb-6 pb-2 shrink-0 overflow-x-auto whitespace-nowrap cpp-no-scrollbar">
                <button onClick={() => { sfxClick(); setShopCategory("emoticon"); }} className={`px-4 py-2 text-sm font-black rounded-xl transition-all shadow-sm ${shopCategory === "emoticon" ? "bg-yellow-400 text-yellow-950 ring-2 ring-yellow-500" : "bg-white/60 text-zinc-600"}`}>📸 이모티콘</button>
                <button onClick={() => { sfxClick(); setShopCategory("car"); }} className={`px-4 py-2 text-sm font-black rounded-xl transition-all shadow-sm ${shopCategory === "car" ? "bg-yellow-400 text-yellow-950 ring-2 ring-yellow-500" : "bg-white/60 text-zinc-600"}`}>🏎️ 카트</button>
                <button onClick={() => { sfxClick(); setShopCategory("bg"); }} className={`px-4 py-2 text-sm font-black rounded-xl transition-all shadow-sm ${shopCategory === "bg" ? "bg-yellow-400 text-yellow-950 ring-2 ring-yellow-500" : "bg-white/60 text-zinc-600"}`}>🏞️ 배경</button>
              </div>

              {/* 📸 이모티콘 구매 탭 */}
              <div style={{ display: shopCategory === "emoticon" ? "block" : "none" }}>
                <p className="mb-4 text-center text-sm font-bold text-zinc-700">
                  마음에 드는 캐릭터 감정 이모티콘을 포인트로 구매해 보세요! 🎨
                </p>

                {/* 🌟 팝업창 (미리보기 / 구매 / 다운로드 통합) */}
                {previewItem && (() => {
                  const itemId = previewItem.file.replace('.png', '');
                  const isOwned = ownedEmoticons && ownedEmoticons.includes(itemId);
                  
                  return (
                    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-yellow-100/95 p-6 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                      <h3 className="mb-2 text-2xl font-black text-zinc-900">{previewItem.title}</h3>
                      <p className="mb-6 text-sm font-bold text-amber-700">내 포인트: {points}P</p>

                      {/* 미리보기 이미지 박스 */}
                      <div className={`relative mb-8 h-56 w-56 overflow-hidden rounded-2xl bg-white/80 ring-4 ${isOwned ? 'ring-emerald-400 shadow-emerald-200' : 'ring-yellow-400/80 shadow-yellow-200'} shadow-xl transition-all duration-500`}>
                        <img
                          src={lightImg("emoticons", previewItem.file, "md")}
                          alt="preview"
                          className={`h-full w-full object-cover transition-all duration-500 ${!isOwned ? "opacity-30 grayscale brightness-50 scale-95" : "opacity-100 drop-shadow-md scale-100"}`}
                        />
                        {/* 미구매 시 중앙에 큰 자물쇠 아이콘 표시 */}
                        {!isOwned && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-white text-5xl opacity-80 drop-shadow-lg">🔒</span>
                          </div>
                        )}
                      </div>

                      {/* 버튼 영역 (구매 전/후 자동 스위칭) */}
                      {!isOwned ? (
                        <button
                          type="button"
                          onClick={() => {
                            // 구매 시 함수 호출! (성공하면 isOwned가 true로 바뀌면서 위 이미지와 버튼이 다운로드로 실시간 변신함)
                            buyEmoticon(itemId, previewItem.price, previewItem.title);
                          }}
                          className="w-full max-w-[240px] rounded-full bg-yellow-400 py-3.5 text-lg font-black text-zinc-900 shadow-lg active:scale-95 transition-all"
                        >
                          💰 {previewItem.price}P로 구매하기
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            sfxClick();
                            // 카카오톡 앱 안에서는 저장이 막혀 있어서 다른 브라우저로 여는 방법을 안내
                            if (isKakaoInApp()) {
                              setKakaoGuide(true);
                              return;
                            }
                            const fileName = previewItem.file;
                            const img = new Image();
                            img.crossOrigin = "anonymous";
                            img.onerror = () => flashToast("이미지를 불러오지 못했어요. 잠시 후 다시 시도해 주세요 😥");
                            img.onload = () => {
                              // 원본 고화질 이미지에 닉네임 각인
                              const canvas = document.createElement("canvas");
                              canvas.width = img.width;
                              canvas.height = img.height;
                              const ctx = canvas.getContext("2d");
                              if (!ctx) return;
                              ctx.drawImage(img, 0, 0);
                              const fontSize = Math.max(16, img.width * 0.1);
                              ctx.font = `900 ${fontSize}px 'MaplestoryOTFBold', sans-serif`;
                              ctx.textAlign = "right";
                              ctx.textBaseline = "bottom";
                              ctx.lineWidth = fontSize * 0.2;
                              ctx.strokeStyle = "white";
                              ctx.strokeText(`@${nickname}`, canvas.width - (img.width * 0.05), canvas.height - (img.width * 0.05));
                              ctx.fillStyle = "#333333";
                              ctx.fillText(`@${nickname}`, canvas.width - (img.width * 0.05), canvas.height - (img.width * 0.05));

                              canvas.toBlob(async (blob) => {
                                if (!blob) return;
                                const file = new File([blob], fileName, { type: "image/png" });
                                // 1) 휴대폰: 공유 창 → '이미지 저장'으로 사진첩에 바로 저장 (아이폰/안드로이드)
                                if (isMobileDevice() && navigator.canShare?.({ files: [file] })) {
                                  try {
                                    await navigator.share({ files: [file], title: "카운터 팡팡 이모티콘" });
                                    flashToast("이모티콘 공유 창을 열었어요! '이미지 저장'을 누르면 사진첩에 저장돼요 📸");
                                    setPreviewItem(null);
                                    return;
                                  } catch (e) {
                                    if ((e as Error).name === "AbortError") return; // 사용자가 공유 창을 닫음
                                  }
                                }
                                // 2) 그 외(PC 등): 파일로 다운로드
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = fileName;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                setTimeout(() => URL.revokeObjectURL(url), 2000);
                                flashToast("이모티콘을 다운로드했어요! 📥 (다운로드 폴더를 확인해 주세요)");
                                setPreviewItem(null);
                              }, "image/png");
                            };
                            img.src = `/assets/emoticons/${fileName}`; // 저장은 원본 고화질로
                          }}
                          className="w-full max-w-[240px] rounded-full bg-emerald-400 py-3.5 text-lg font-black text-emerald-950 shadow-lg active:scale-95 transition-all"
                        >
                          📥 닉네임 넣어서 저장하기
                        </button>
                      )}

                      <button
                        onClick={() => { sfxClick(); setPreviewItem(null); }}
                        className="mt-5 text-sm font-bold text-zinc-500 underline active:scale-95"
                      >
                        돌아가기
                      </button>
                    </div>
                  );
                })()}

                <div className="space-y-6">
                  {EMOTICON_PACKS.map(pack => {
                    const isLocked = unlocked < pack.unlockLevel;

                    return (
                      <div key={pack.id} className="rounded-xl bg-yellow-900/5 p-3 ring-1 ring-yellow-900/10">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-bold text-zinc-800">{pack.name} 팩 {isLocked && "🔒"}</h4>
                          {isLocked ? (
                            <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-bold shadow-sm">Lv.{pack.unlockLevel} 해제</span>
                          ) : (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold shadow-sm">단품 각 {pack.price} P</span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-5 gap-2">
                          {EMOTIONS.map(emotion => {
                            const itemId = `${pack.id}_${emotion.id}`;
                            const fileName = `${itemId}.png`;
                            const isOwned = ownedEmoticons && ownedEmoticons.includes(itemId);

                            return (
                              <div key={emotion.id} className="flex flex-col items-center bg-white rounded-lg p-1.5 ring-1 ring-black/5 shadow-sm">
                                {/* 🌟 썸네일 이미지 자체를 클릭해도 팝업이 뜨도록 버튼으로 감싸기 */}
                                <button 
                                  type="button"
                                  disabled={isLocked}
                                  onClick={() => { sfxClick(); setPreviewItem({ title: `${pack.name} (${emotion.name})`, file: fileName, price: pack.price }); }}
                                  className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-slate-50 active:scale-95 transition-transform"
                                >
                                  <img 
                                    src={lightImg("emoticons", fileName, "sm")} 
                                    alt={emotion.name} 
                                    loading="lazy"
                                    decoding="async"
                                    className={`h-full w-full object-cover transition-all duration-300 ${
                                      isLocked 
                                        ? "opacity-10 grayscale" 
                                        : !isOwned 
                                          ? "opacity-30 grayscale brightness-50" 
                                          : "opacity-100 drop-shadow-md"
                                    }`}
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      if (e.currentTarget.nextElementSibling) {
                                        (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                      }
                                    }}
                                  />
                                  <div className="absolute inset-0 hidden items-center justify-center bg-slate-200 text-[9px] font-bold text-slate-500 text-center p-0.5 break-keep">
                                    {emotion.name}
                                  </div>
                                </button>

                                <span className={`text-[10px] font-bold my-1 ${!isOwned ? "text-slate-400" : "text-slate-700"}`}>
                                  {emotion.name}
                                </span>
                                
                                {isLocked ? (
                                  <button disabled className="w-full py-1 rounded text-[9px] font-bold bg-gray-200 text-gray-400 cursor-not-allowed">잠김</button>
                                ) : isOwned ? (
                                  <button 
                                    type="button"
                                    onClick={() => { sfxClick(); setPreviewItem({ title: `${pack.name} (${emotion.name})`, file: fileName, price: pack.price }); }}
                                    className="w-full py-1 rounded text-[9px] font-black bg-emerald-400 text-emerald-950 active:scale-95 shadow-sm transition-transform"
                                  >
                                    다운로드
                                  </button>
                                ) : (
                                  <button 
                                    type="button"
                                    onClick={() => { sfxClick(); setPreviewItem({ title: `${pack.name} (${emotion.name})`, file: fileName, price: pack.price }); }}
                                    className="w-full py-1 rounded text-[9px] font-black bg-yellow-400 text-slate-900 active:scale-95 shadow-sm transition-transform"
                                  >
                                    {pack.price} P
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 🏎️ 카트 구매 탭 */}
              <div style={{ display: shopCategory === "car" ? "block" : "none" }}>
                <div className="grid grid-cols-2 gap-4">
                  {KARTS.map(item => {
                    const isOwned = ownedCars.includes(item.id);
                    return (
                      <div key={item.id} className="relative p-3 rounded-xl border-2 border-slate-200 bg-white">
                        <div className="h-20 bg-slate-100 rounded-lg mb-2 flex items-center justify-center p-1 overflow-hidden">
                          {item.file ? <img src={lightImg("karts", item.file, "sm")} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-contain drop-shadow-md" /> : <span className="text-xs text-slate-400">기본</span>}
                        </div>
                        <p className="font-bold text-sm text-slate-700 text-center mb-2">{item.name}</p>
                        {isOwned ? (
                          <button disabled className="w-full py-1.5 rounded-lg text-xs font-bold bg-gray-200 text-gray-500">보유중</button>
                        ) : (
                          <button 
                            onClick={() => buyCar(item.id, item.price)} 
                            className="w-full py-1.5 rounded-lg text-xs font-bold bg-yellow-400 text-slate-900 shadow-sm active:scale-95"
                          >
                            {item.price} P 구매
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 🏞️ 배경 구매 탭 */}
              <div style={{ display: shopCategory === "bg" ? "block" : "none" }}>
                <div className="grid grid-cols-2 gap-4">
                  {BACKGROUNDS.map(item => {
                    const isOwned = ownedBgs.includes(item.file);
                    const isLocked = unlocked < item.unlockLevel;
                    return (
                      <div key={item.id} className="relative p-3 rounded-xl border-2 border-slate-200 bg-white">
                        <div className="h-20 bg-slate-800 rounded-lg mb-2 flex items-center justify-center overflow-hidden relative shadow-inner">
                          <video src={`/assets/mp4/${item.file}#t=0.1`} className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none" preload="metadata" />
                          <span className="relative z-10 text-white font-black text-xs drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] px-1 text-center break-keep">{item.name}</span>
                        </div>
                        <div className="mt-2">
                          {isLocked ? (
                            <button disabled className="w-full py-1.5 rounded-lg text-[11px] font-bold bg-gray-200 text-gray-500">Lv.{item.unlockLevel} 해제</button>
                          ) : isOwned ? (
                            <button disabled className="w-full py-1.5 rounded-lg text-xs font-bold bg-gray-200 text-gray-500">보유중</button>
                          ) : (
                            <button 
                              onClick={() => buyBackground(item.file, item.price)} 
                              className="w-full py-1.5 rounded-lg text-xs font-bold bg-yellow-400 text-slate-900 shadow-sm active:scale-95"
                            >
                              {item.price} P 구매
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
      {/* ============================ 🥋 승급 축하 연출 (그랄: '축' / 띠: Congratulations) ============================ */}
      {/* ============================ 📲 홈 화면에 추가 안내 ============================ */}
      {installGuide && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm" onClick={() => setInstallGuide(null)}>
          <div className="w-full max-w-[320px] rounded-3xl bg-white p-6 text-center shadow-2xl cpp-pop" onClick={(e) => e.stopPropagation()}>
            <img src="/icon-192.png" alt="" className="mx-auto h-16 w-16 rounded-2xl shadow" />
            {installGuide === "done" && (
              <>
                <h2 className="mt-3 text-xl font-black text-zinc-900">이미 앱으로 쓰고 있어요! ✅</h2>
                <p className="mt-2 text-sm font-bold text-zinc-500">홈 화면의 카운터 팡팡 아이콘으로 실행 중이에요.</p>
              </>
            )}
            {installGuide === "ios" && (
              <>
                <h2 className="mt-3 text-xl font-black text-zinc-900">아이폰에서 추가하기</h2>
                <ol className="mt-3 space-y-2 text-left text-sm font-bold text-zinc-600">
                  <li>① 사파리 화면 아래 <b className="text-sky-600">공유 버튼 (⬆️)</b>을 눌러요</li>
                  <li>② 목록에서 <b className="text-sky-600">&lsquo;홈 화면에 추가&rsquo;</b>를 눌러요</li>
                  <li>③ 오른쪽 위 <b className="text-sky-600">&lsquo;추가&rsquo;</b>를 누르면 끝!</li>
                </ol>
                <p className="mt-3 text-xs font-bold text-zinc-400">※ 사파리에서만 할 수 있어요</p>
              </>
            )}
            {installGuide === "kakao" && (
              <>
                <h2 className="mt-3 text-xl font-black text-zinc-900">카카오톡 안에서는<br />추가할 수 없어요</h2>
                <p className="mt-2 text-sm font-bold text-zinc-500">크롬(안드로이드)이나 사파리(아이폰)로 연 다음<br />다시 이 버튼을 눌러 주세요.</p>
                <button
                  type="button"
                  onClick={() => { window.location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(window.location.href); }}
                  className="mt-4 w-full rounded-2xl bg-yellow-300 py-3 text-base font-black text-zinc-900 active:scale-95"
                >
                  다른 브라우저로 열기
                </button>
              </>
            )}
            {installGuide === "other" && (
              <>
                <h2 className="mt-3 text-xl font-black text-zinc-900">홈 화면에 추가하기</h2>
                <ol className="mt-3 space-y-2 text-left text-sm font-bold text-zinc-600">
                  <li>① 브라우저 오른쪽 위(또는 아래)의 <b className="text-sky-600">메뉴 (⋮ 또는 ≡)</b>를 눌러요</li>
                  <li>② <b className="text-sky-600">&lsquo;홈 화면에 추가&rsquo;</b> 또는 <b className="text-sky-600">&lsquo;앱 설치&rsquo;</b>를 눌러요</li>
                </ol>
              </>
            )}
            <button type="button" onClick={() => setInstallGuide(null)} className="mt-5 text-sm font-bold text-zinc-500 underline">닫기</button>
          </div>
        </div>
      )}
      {/* ============================ 📱 카카오톡 앱 안 브라우저 안내 ============================ */}
      {kakaoGuide && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm" onClick={() => setKakaoGuide(false)}>
          <div className="w-full max-w-[320px] rounded-3xl bg-white p-6 text-center shadow-2xl cpp-pop" onClick={(e) => e.stopPropagation()}>
            <p className="text-4xl">📱</p>
            <h2 className="mt-2 text-xl font-black text-zinc-900">카카오톡 안에서는<br />저장이 안 돼요</h2>
            <p className="mt-3 text-sm font-bold leading-relaxed text-zinc-500">
              크롬·사파리 같은 <b className="text-zinc-700">다른 브라우저</b>로 열면<br />이모티콘을 저장할 수 있어요.
              <br />(구매한 이모티콘은 이 휴대폰의 다른 브라우저에선 보이지 않을 수 있어요)
            </p>
            <button
              type="button"
              onClick={() => {
                window.location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(window.location.href);
              }}
              className="mt-5 w-full rounded-2xl bg-yellow-300 py-3.5 text-base font-black text-zinc-900 active:scale-95"
            >
              다른 브라우저로 열기
            </button>
            <p className="mt-3 text-xs font-bold text-zinc-400">안 되면: 화면 아래 ⋮ 버튼 → &lsquo;다른 브라우저로 열기&rsquo;</p>
            <button type="button" onClick={() => setKakaoGuide(false)} className="mt-4 text-sm font-bold text-zinc-500 underline">닫기</button>
          </div>
        </div>
      )}
      {/* ============================ 🎓 튜토리얼 (Lv.0 게임 방법) ============================ */}
      {showTutorial && (
        <Tutorial
          playClick={sfxClick}
          onSkip={() => {
            // 건너뛰기: Lv.1은 열어주고 보상/별은 없음
            setShowTutorial(false)
            if (unlocked < 1) flashToast("Lv.1이 열렸어요! 언제든 Lv.0에서 다시 볼 수 있어요 📖")
            setUnlocked((u) => Math.max(u, 1))
          }}
          onFinish={() => {
            setShowTutorial(false)
            setUnlocked((u) => Math.max(u, 1))
            if ((records[0] ?? 0) < PASS_LINE) {
              // 처음 끝까지 본 경우에만 ⭐ + 5P (테스트 단계 값, 출시 전 조정 예정)
              setRecords((r) => ({ ...r, 0: TOTAL_Q }))
              setPoints((pt) => pt + 5)
              flashToast("게임 방법 완료! ⭐ +5P, Lv.1이 열렸어요 🎉")
            }
          }}
        />
      )}
      {showPromotionModal && promotionBelt && (
        <PromotionCelebration
          from={promotionBelt.from}
          to={promotionBelt}
          onClose={() => {
            playSound('/assets/피버타임.mp3');
            sfxClick();
            setShowPromotionModal(false);
          }}
        />
      )}
      {/* ============================ 🚨 앱 종료 연출 모달 (순수 UI 버튼 작업) ============================ */}
        {exitPhase && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
            <div className="w-full max-w-[320px] rounded-3xl bg-white p-6 text-center shadow-2xl">
              
              {/* 1단계 팝업: 물어보기 */}
              {exitPhase === "ask" ? (
                <>
                  <h2 className="mb-6 mt-2 text-2xl font-black text-zinc-900">종료하시겠습니까?</h2>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        sfxClick();
                        setExitPhase("goodbye"); // 2단계 작별인사로 넘어가기
                      }}
                      className="flex-1 rounded-2xl bg-rose-500 py-3.5 text-lg font-black text-white shadow-[0_4px_0_#be123c] active:translate-y-1 active:shadow-none"
                    >
                      네
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sfxClick();
                        setExitPhase(null); // 팝업 닫기 (로비/메인으로 복귀)
                      }}
                      className="flex-1 rounded-2xl bg-gray-200 py-3.5 text-lg font-black text-gray-700 shadow-[0_4px_0_#9ca3af] active:translate-y-1 active:shadow-none"
                    >
                      아니요
                    </button>
                  </div>
                </>
              ) : (
                /* 2단계 팝업: 작별인사 */
                <>
                  <GameImage
                    src="/assets/car.png"
                    alt="자동차"
                    fallback={<span style={{ fontSize: "4rem" }}>🚕</span>}
                    className="mx-auto mb-4 h-24 w-24 object-contain"
                  />
                  <p className="mb-6 text-lg font-bold text-zinc-800 leading-snug">
                    실제 자동차 번호판을 보고도<br/>숫자놀이 해보세요^^
                  </p>
                 <button
                    type="button"
                    onClick={() => {
                      sfxClick();
                      setExitPhase(null);
                      
                      // 🚨 모바일 웹앱 강제 종료 마스터 로직 (카톡/네이버/일반 브라우저 모두 대응)
                      const ua = navigator.userAgent.toLowerCase();
                      
                      if (ua.indexOf('kakaotalk') > -1) {
                        // 1. 카카오톡을 타고 들어왔을 때: 카톡 창 자체를 부수고 나감
                        window.location.href = 'kakaotalk://inappbrowser/close';
                      } else if (ua.indexOf('naver') > -1) {
                        // 2. 네이버를 타고 들어왔을 때: 네이버 창 강제 종료
                        window.location.href = 'naversearchapp://inappbrowser/close';
                      } else {
                        // 3. 삼성인터넷, 크롬, 사파리 등 일반 브라우저
                        // 브라우저 탭 자체를 끌 수는 없으므로, 앱 방문 기록을 지우고 껍데기만 남은 '하얀 빈 화면'으로 강제로 던져버립니다.
                        window.history.go(-100);
                        setTimeout(() => {
                          window.open('about:blank', '_self');
                          window.close();
                        }, 100);
                      }
                    }}
                    className="w-full rounded-2xl bg-amber-400 py-3.5 text-lg font-black text-amber-950 shadow-[0_4px_0_#b45309] active:translate-y-1 active:shadow-none"
                  >
                    확인
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}