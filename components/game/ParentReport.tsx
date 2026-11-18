"use client"
import { cn } from "@/lib/utils"
import { LEVEL_DESC, LEVEL_NAMES, MAX_LEVEL, PASS_LINE, TOTAL_Q } from "@/lib/game/constants"
import { LearnStats } from "@/lib/game/stats"
import { localDate } from "@/lib/game/utils"

export function ParentReport({ stats }: { stats: LearnStats }) {
  const typeRows = Array.from({ length: MAX_LEVEL - 1 }, (_, i) => i + 1).map((lv) => {
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
        <p className="mt-3 text-[10px] font-bold text-slate-400">괄호 안은 푼 문제 수예요. 그랜드 마스터(Lv.14)에서 푼 문제도 유형별로 함께 계산돼요.</p>
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
