"use client"
import React, { useMemo } from "react"
import { cn } from "@/lib/utils"
import { Question } from "@/lib/game/types"

/* ----------------------------- 번호판 ----------------------------- */
export function Plate({
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
