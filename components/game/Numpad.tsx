"use client"
import { cn } from "@/lib/utils"

/* ------------------------------ 넘패드 ------------------------------ */
export function Numpad({
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
