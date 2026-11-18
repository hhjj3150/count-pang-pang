"use client"
import React, { useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { BELT_COLORS } from "@/lib/game/belts"
import { ECONOMY, HEART_CAP } from "@/lib/game/constants"
import { HEART_PRICE, KARTS } from "@/lib/game/items"
import { RANK_TABS } from "@/lib/game/records"
import { lightImg } from "@/lib/game/utils"
import { GameImage } from "./GameImage"

export const TUTORIAL_PAGES = ["게임 시작", "하트", "포인트 · 캐시", "오늘의 도전", "랭킹", "출석 · 친구 초대", "포인트 상점", "카트 · 배경 보너스", "띠 승급", "관리 메뉴"]

export function Tutorial({ onFinish, onSkip, playClick }: { onFinish: () => void; onSkip: () => void; playClick: () => void }) {
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

  const Bubble = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl bg-white/90 p-4 text-left text-[15px] font-bold leading-relaxed text-zinc-700 shadow-sm ring-1 ring-black/5">{children}</div>
  )

  const body = (() => {
    switch (TUTORIAL_PAGES[page]) {
      case "게임 시작":
        return (
          <>
            <div className="flex justify-center"><GameImage src="/assets/0-2-2.png" alt="팡이" className="h-16 w-16 object-contain" fallback={<span className="text-5xl">🐣</span>} /></div>
            <Bubble>
              <div className="text-sm">
                <p>🚗 자동차 <b>번호판 숫자</b>로 계산하는 두뇌 게임이에요. 레벨이 <b>14개</b> 있어요.</p>
                <p className="mt-1.5">① 로비의 <b>레벨 카드</b>를 눌러요</p>
                <p className="mt-1">② <b>게임 설명</b>을 읽고 <b className="whitespace-nowrap rounded bg-emerald-200 px-1.5 text-emerald-800">닫기 · 게임 시작</b></p>
                <p className="mt-1">③ 15문제 중 <b className="text-emerald-600">13개 이상</b> 맞히면 통과! <b>다음 레벨</b>이 열려요</p>
              </div>
            </Bubble>
            <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-bold text-zinc-600">
              <div className="rounded-xl bg-white/90 px-1 py-2 shadow-sm ring-1 ring-black/5"><p className="text-base font-black text-yellow-500">+30P</p>카드 아래 숫자는<br />통과 보너스</div>
              <div className="rounded-xl bg-white/90 px-1 py-2 shadow-sm ring-1 ring-black/5"><p className="text-base">⭐</p>통과한 레벨</div>
              <div className="rounded-xl bg-white/90 px-1 py-2 shadow-sm ring-1 ring-black/5"><p className="text-base">🔒</p>아직 잠긴 레벨</div>
            </div>
            <p className="text-center text-xs font-bold text-zinc-500">💡 게임 설명은 ⚙️ 관리 → 내 정보에서 켜고 끌 수 있어요</p>
          </>
        )
      case "하트":
        return (
          <>
            <p className="text-center text-6xl">💖</p>
            <Bubble>
              <p>🎮 게임 한 판에 <b className="text-rose-500">하트 1개</b>를 써요.</p>
              <p className="mt-2">🌅 매일 <b>5개</b>까지 다시 채워져요. (5개보다 많이 모아 두었으면 그대로!)</p>
              <p className="mt-2">📺 로비의 <b>광고 보고 하트 충전</b>: 광고 한 번에 하트 +1 (횟수 제한 없음)</p>
              <p className="mt-2">🛒 <b>포인트 상점</b>: {HEART_PRICE}P로 하트 1개, 하루 3번</p>
              <p className="mt-2 text-sm text-zinc-500">하트는 최대 {HEART_CAP}개까지 모을 수 있어요.</p>
            </Bubble>
          </>
        )
      case "포인트 · 캐시":
        return (
          <>
            <div className="space-y-2">
              {[
                { icon: "🪙", name: "보유 포인트", use: "상점에서 아이템을 살 때 써요", tone: "bg-blue-50 text-blue-700 ring-blue-100" },
                { icon: "📅", name: "이번 달 포인트", use: "이번 달에 모은 포인트 · 월간 순위 (준비 중)", tone: "bg-amber-50 text-amber-700 ring-amber-100" },
                { icon: "🥋", name: "누적 포인트", use: "지금까지 모은 전체 포인트 · 띠 승급", tone: "bg-slate-50 text-slate-700 ring-slate-200" },
                { icon: "💵", name: "캐시", use: "광고 보기·친구 초대로 모아요 · 기프티콘 교환 (준비 중)", tone: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
              ].map((r) => (
                <div key={r.name} className={cn("flex items-center gap-3 rounded-2xl px-3 py-1.5 ring-1", r.tone)}>
                  <span className="text-2xl">{r.icon}</span>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-black">{r.name}</p>
                    <p className="text-[13px] font-bold leading-snug text-zinc-600">{r.use}</p>
                  </div>
                </div>
              ))}
            </div>
            <Bubble>
              <div className="text-sm">
                <p>🪙 <b>포인트</b>: 문제 맞히기(10P, 피버 15P) · 레벨 통과 · 출석 · 친구 초대</p>
                <p className="mt-1">💵 <b>캐시</b>: 광고 보고 하트 충전 · 친구 초대</p>
                <p className="mt-1 text-xs text-zinc-500">포인트를 써도 누적 포인트는 줄지 않아요. 만 14세 미만은 보호자 동의 후 기프티콘 교환 (준비 중) · 로비의 포인트 칸을 누르면 한눈에 보여요</p>
              </div>
            </Bubble>
          </>
        )
      case "오늘의 도전":
        return (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-orange-400 to-rose-400 p-3 shadow ring-1 ring-orange-300">
              <span className="text-3xl">🔥</span>
              <div className="text-left">
                <p className="text-xs font-black text-white/90">오늘의 도전 · 통과 보너스 2배!</p>
                <p className="text-sm font-black text-white">매일 레벨 하나가 정해져요</p>
              </div>
            </div>
            <Bubble>
              <p>📆 매일 열린 레벨 중 <b>하나</b>가 오늘의 도전으로 정해져요.</p>
              <p className="mt-2">🏆 그 레벨을 오늘 <b>처음 통과</b>하면 통과 보너스가 <b className="text-rose-500">2배</b>!</p>
              <p className="mt-2">🔁 실패해도 하트만 있으면 <b>몇 번이든</b> 다시 도전할 수 있어요.</p>
              <p className="mt-2 text-sm text-zinc-500">2배 보너스는 하루에 한 번이에요. 내일은 새로운 도전이 열려요.</p>
            </Bubble>
          </>
        )
      case "랭킹":
        return (
          <>
            <div className="grid grid-cols-5 gap-1 text-center">
              {RANK_TABS.map((t) => (
                <span key={t.id} className="flex min-h-[40px] items-center justify-center whitespace-pre-line rounded-xl bg-indigo-500 px-0.5 py-1 text-[11px] font-black leading-tight text-white shadow-sm">{t.label}</span>
              ))}
            </div>
            <Bubble>
              <p>🏆 로비의 <b>랭킹</b> 버튼을 누르면 5가지 순위를 <b>10위까지</b> 볼 수 있어요.</p>
              <p className="mt-2">🪙 <b>월간 포인트</b>: 이번 달에 모은 포인트가 많은 순서</p>
              <p className="mt-2">⏱ <b>Lv.11 · 12 · 13</b>: 15문제를 <b className="text-emerald-600">모두 맞힌(만점)</b> 기록이 빠른 순서</p>
              <p className="mt-2">➕ <b>합산</b>: 세 레벨 만점 기록을 <b>더한 시간</b>이 짧은 순서</p>
              <p className="mt-2 text-sm text-zinc-500">기록은 문제를 푸는 시간만 재요(정답·오답 화면 시간 제외). 매달 1일에 새로 시작해요.</p>
            </Bubble>
          </>
        )
      case "출석 · 친구 초대":
        return (
          <>
            <div className="grid grid-cols-7 gap-1 text-center">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <div key={d} className={cn("rounded-lg py-2 text-xs font-black shadow-sm ring-1 ring-black/5", d === 3 || d === 5 || d === 7 ? "bg-amber-300 text-amber-950" : "bg-white/90 text-zinc-600")}>
                  {d}일
                  <span className="block text-[10px]">{d === 3 ? "+5" : d === 5 ? "+10" : d === 7 ? "+20" : "✔"}</span>
                </div>
              ))}
            </div>
            <Bubble>
              <p>📅 <b>출석체크</b>: 하루 한 번 누르면 <b>+5P</b></p>
              <p className="mt-1">한 주에 <b>3일·5일·7일</b> 출석하면 보너스 <b>+5P · +10P · +20P</b>를 더 받아요. (매주 월요일에 새로 시작)</p>
            </Bubble>
            <Bubble>
              <p>💌 <b>친구 초대</b>: 친구에게 게임을 알려 주면 <b>+30P</b>와 <b>캐시 +{ECONOMY.cashPerInvite}C</b> (하루 5번까지)</p>
            </Bubble>
          </>
        )
      case "포인트 상점":
        return (
          <>
            <div className="grid grid-cols-2 gap-2 text-center text-sm font-black text-zinc-700">
              <div className="rounded-2xl bg-white/90 p-3 shadow-sm ring-1 ring-black/5">🏎️ 카트<span className="block text-xs font-bold text-zinc-500">게임 화면의 내 차 · 정답 보너스</span></div>
              <div className="rounded-2xl bg-white/90 p-3 shadow-sm ring-1 ring-black/5">🏞️ 배경<span className="block text-xs font-bold text-zinc-500">게임 화면 뒤 풍경 · 만점 보너스</span></div>
              <div className="rounded-2xl bg-white/90 p-3 shadow-sm ring-1 ring-black/5">📸 이모티콘<span className="block text-xs font-bold text-zinc-500">사진첩에 저장해서 친구에게 보내기</span></div>
              <div className="rounded-2xl bg-white/90 p-3 shadow-sm ring-1 ring-black/5">💖 하트<span className="block text-xs font-bold text-zinc-500">{HEART_PRICE}P로 1개 (하루 3번)</span></div>
            </div>
            <Bubble>
              <p>🛒 로비의 <b>포인트 상점</b>에서 보유 포인트로 아이템을 사요.</p>
              <p className="mt-2">⚙️ 산 카트와 배경은 <b>관리 → 내 차고 · 내 테마</b>에서 장착해요.</p>
              <p className="mt-2">🎁 <b>상품권</b> 탭: 모은 캐시로 기프티콘을 바꾸는 곳이에요 (준비 중).</p>
            </Bubble>
          </>
        )
      case "카트 · 배경 보너스": {
        const tiers = [
          { pct: 5, label: "일반 자동차 · 화이트부터", ids: ["car_suv", "car_police", "car_fire", "car_sports"] },
          { pct: 10, label: "특수 카트 · 블루 벨트부터", ids: ["kart_fire_truck", "kart_police", "kart_tank"] },
          { pct: 15, label: "동물 카트 · 퍼플 벨트부터", ids: ["kart_crocodile", "kart_lion", "kart_rabbit", "kart_owl"] },
        ]
        return (
          <>
            <div className="space-y-1.5">
              {tiers.map((t) => (
                <div key={t.pct} className="flex items-center gap-2 rounded-2xl bg-white/90 p-1.5 shadow-sm ring-1 ring-black/5">
                  <span className="w-[72px] shrink-0 rounded-xl bg-amber-400 py-1 text-center font-black leading-tight text-amber-950"><span className="block text-[10px]">정답 보너스</span><span className="block text-base">+{t.pct}%</span></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black text-zinc-700">{t.label}</p>
                    <div className="mt-0.5 flex gap-1">
                      {t.ids.map((id) => (
                        <img key={id} src={lightImg("karts", KARTS.find((k) => k.id === id)!.file, "sm")} alt="" className="h-8 w-8 rounded-lg bg-slate-100 object-contain p-0.5" />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Bubble>
              <div className="text-sm">
                <p>🏎️ <b>카트</b>: 문제를 맞혀 받은 포인트를 <b className="text-amber-600">더</b> 받아요. 통과 못 해도 적용!</p>
                <p className="mt-0.5 text-xs text-zinc-500">예) 정답 포인트 150P + 동물 카트 15% = <b>+23P</b></p>
                <p className="mt-1.5">🏞️ <b>배경</b>: <b className="text-emerald-600">만점(15/15)</b>으로 통과하면 그 판 포인트를 +5·10·15% 더 받아요.</p>
                <p className="mt-0.5 text-xs text-zinc-500">💎 유료 회원은 띠와 상관없이 모든 카트를 살 수 있어요 (준비 중)</p>
              </div>
            </Bubble>
          </>
        )
      }
      case "띠 승급":
        return (
          <>
            <div className="flex flex-col items-center gap-2">
              {([["화이트", "0P"], ["블루", "2만P"], ["퍼플", "6만P"], ["브라운", "12만P"], ["블랙", "20만P"]] as const).map(([n, req]) => (
                <div key={n} className="flex w-full max-w-[290px] items-center gap-2">
                  <span className="w-14 text-right text-sm font-black text-zinc-600">{n}</span>
                  <div className="h-5 flex-1 rounded" style={{ background: BELT_COLORS[n].base, boxShadow: `inset 0 0 0 2px ${BELT_COLORS[n].edge}` }}>
                    <div className="ml-auto mr-[10%] h-full w-[28%]" style={{ background: BELT_COLORS[n].bar }} />
                  </div>
                  <span className="w-12 text-xs font-black text-zinc-500">{req}</span>
                </div>
              ))}
            </div>
            <Bubble>
              <p>🥋 지금까지 모은 <b>누적 포인트</b>로 띠가 올라가요. 상점에서 포인트를 써도 줄지 않아요!</p>
              <p className="mt-2">🎀 띠마다 <b>그랄(줄무늬) 4개</b>를 모으면 다음 띠로 승급해요. 그랄을 받거나 승급하면 <b>축하 화면</b>이 나와요!</p>
              <p className="mt-2 text-sm text-zinc-500">내 띠와 다음 승급까지 남은 포인트는 ⚙️ 관리 맨 위에서 볼 수 있어요.</p>
            </Bubble>
          </>
        )
      case "관리 메뉴":
        return (
          <>
            <div className="space-y-1">
              {[
                ["👤", "내 정보", "닉네임 · 연령 구분 · 게임 설명 켜기/끄기"],
                ["🚗", "내 차고 · 🏞️ 내 테마", "산 카트와 배경 장착"],
                ["📊", "리포트", "레벨별 정답률 · 학습 기록 (부모님과 함께 보기)"],
                ["🔊", "소리 끄기/켜기", "로비 오른쪽 위 버튼"],
                ["📲", "홈 화면에 추가", "앱처럼 바로 실행하기"],
              ].map(([icon, name, desc]) => (
                <div key={name} className="flex items-center gap-2.5 rounded-2xl bg-white/90 px-3 py-1.5 text-left shadow-sm ring-1 ring-black/5">
                  <span className="text-2xl">{icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-zinc-700">{name}</p>
                    <p className="text-xs font-bold text-zinc-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Bubble>
              <p className="text-sm">💾 기록은 <b>지금 쓰는 휴대폰(앱·브라우저)</b>에 저장돼요. 다른 앱이나 브라우저로 열면 기록이 따로예요.</p>
              <p className="mt-1.5 text-sm">📖 이 게임 방법은 레벨 목록의 <b>Lv.0</b>에서 언제든 다시 볼 수 있어요.</p>
            </Bubble>
          </>
        )
      default:
        return null
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

        <div key={`b${page}`} className="cpp-rise-in mt-4 flex min-h-0 flex-1 flex-col justify-center-safe gap-4 overflow-y-auto cpp-no-scrollbar">
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
