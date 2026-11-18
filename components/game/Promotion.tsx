"use client"
import React, { useMemo } from "react"
import { cn } from "@/lib/utils"
import { BELT_COLORS, BeltName, parseBelt } from "@/lib/game/belts"

// 화면 가운데 크게 보이는 띠 그림 (끝부분 랭크바에 그랄 최대 4개)
export function BeltGraphic({ name, stripes, flyLastStripe = false }: { name: BeltName; stripes: number; flyLastStripe?: boolean }) {
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

export function PromotionCelebration({ from, to, onClose }: { from?: string; to: { badge: string; style: string }; onClose: () => void }) {
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
