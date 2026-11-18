"use client"
import React, { useMemo } from "react"
import { LEVEL_NAMES, LEVEL_TIMER } from "@/lib/game/constants"
import { buildQuestion, exampleText } from "@/lib/game/questions"
import { RECORD_LEVELS } from "@/lib/game/records"
import { Plate } from "./Plate"

/* ------------------------- 📖 레벨별 게임 설명 팝업 (게임 시작 전) ------------------------- */
export const GUIDE_HOW: Record<number, string[]> = {
  1: ["번호판 <b>앞자리 숫자</b>를 모두 더해요.", "숫자 버튼으로 답을 누르고 <b>입력</b>!"],
  2: ["번호판 <b>뒷자리 4개</b> 숫자를 모두 더해요.", "숫자 버튼으로 답을 누르고 <b>입력</b>!"],
  3: ["앞자리 2개 + 뒷자리 4개, <b>6개 숫자</b>를 모두 더해요.", "숫자 버튼으로 답을 누르고 <b>입력</b>!"],
  4: ["앞자리 3개 + 뒷자리 4개, <b>7개 숫자</b>를 모두 더해요.", "숫자 버튼으로 답을 누르고 <b>입력</b>!"],
  5: ["앞자리 합과 뒷자리 합을 <b>비교</b>해요.", "<b>앞이 큼 · 같음 · 뒤가 큼</b> 중 하나를 눌러요."],
  6: ["앞자리 합과 뒷자리 합을 각각 구해요.", "<b>큰 쪽에서 작은 쪽을 빼서</b> 입력해요."],
  7: ["문제 위에 나오는 대로 <b>홀수만</b> 또는 <b>짝수만</b> 더해요.", "0은 짝수예요."],
  8: ["번호판의 <b>전체 합</b>이 주어져요.", "<b>?</b> 자리에 들어갈 숫자를 찾아 입력해요."],
  9: ["번호판 숫자를 눌러 골라요 (<b>파란 불</b>).", "고른 숫자의 합이 <b>20</b>이 되면 <b>제출</b>!"],
  10: ["문제마다 <b>만들 숫자가 달라요</b>. (11~30, 예: 17 만들기)", "번호판 숫자를 눌러 골라요 (<b>파란 불</b>).", "고른 숫자의 합이 <b>제시된 숫자</b>가 되면 <b>제출</b>!"],
  11: ["뒷자리 4개를 <b>네 자리 수</b> 하나로 읽어요. (예: 1234)", "거기에 <b>앞자리 수</b>를 더해요. (예: 1234 + 56)"],
  12: ["숫자를 <b>두 묶음</b>으로 나눠 두 묶음의 합이 <b>똑같게</b> 만들어요.", "전체 합의 <b>절반</b>이 되도록 숫자를 골라 <b>제출</b>!", "어떻게 해도 못 나누면 <b>이등분 불가</b> 버튼 (전체 합이 홀수면 무조건 불가)"],
  13: ["<b>붉게 빛나는 숫자</b>만 모두 <b>곱해요</b>.", "숫자 버튼으로 답을 누르고 <b>입력</b>!"],
  14: ["Lv.1~13 문제가 <b>섞여서</b> 나와요!", "문제마다 화면 위의 설명을 잘 읽고 풀어요."],
}

export function GameGuide({ level, onClose }: { level: number; onClose: () => void }) {
  // 설명용 예시 문제 (팝업을 열 때마다 새로 뽑음, 이등분은 나눌 수 있는 문제로)
  const sample = useMemo(() => (level === 14 ? null : buildQuestion(level, 5, level === 12 ? true : undefined)), [level])
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-[380px] flex-col rounded-3xl bg-gradient-to-b from-amber-50 to-white p-4 shadow-2xl cpp-pop">
        <div className="text-center">
          <h2 className="text-xl font-black text-zinc-900"><span className="mr-1.5 rounded-full bg-amber-400 px-2.5 py-0.5 align-middle text-xs font-black text-amber-950">Lv.{level}</span>{LEVEL_NAMES[level]}</h2>
        </div>
        <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto cpp-no-scrollbar">
          {sample && (
            <div className="rounded-2xl bg-zinc-900 px-2 py-2.5 text-center">
              <p className="text-sm font-black text-yellow-300">{sample.desc}</p>
              <div className="mt-2 flex justify-center"><Plate q={sample} /></div>
              {typeof sample.totalForHidden === "number" && (
                <p className="mt-2 text-sm font-black text-white">전체 합 = <span className="text-yellow-300">{sample.totalForHidden}</span></p>
              )}
              <p className="mt-2 text-sm font-black text-emerald-300">예) 정답: {exampleText(sample)}</p>
            </div>
          )}
          <div className="rounded-2xl bg-white px-3 py-2.5 text-left text-sm font-bold leading-snug text-zinc-700 shadow-sm ring-1 ring-black/5">
            {GUIDE_HOW[level]?.map((line, i) => (
              <p key={i} className={i > 0 ? "mt-1" : ""}>
                {i + 1}. <span dangerouslySetInnerHTML={{ __html: line }} />
              </p>
            ))}
          </div>
          <div className="space-y-0.5 rounded-2xl bg-sky-50 px-3 py-2 text-left text-xs font-bold leading-snug text-sky-800 ring-1 ring-sky-100">
            <p>⏰ {level === 14 ? "문제마다 제한 시간이 달라요" : `문제당 ${LEVEL_TIMER[level]}초`}</p>
            <p>✅ 15문제 중 <b>13개 이상</b> 맞히면 통과 · 처음 3문제는 정답을 알려줘요</p>
            <p>⚡ 빨리 3번 연속 맞히면 <b>피버 타임</b> (문제당 15P)</p>
            {RECORD_LEVELS.includes(level) && <p>🏆 만점이면 <b>랭킹 기록</b>에 올라가요</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-2xl bg-gradient-to-b from-emerald-300 to-emerald-500 py-3 text-lg font-black text-emerald-950 shadow-[0_4px_0_#047857] active:translate-y-0.5"
        >
          닫기 · 게임 시작 ▶
        </button>
        <p className="mt-1.5 text-center text-[11px] font-bold text-zinc-400">⚙️ 관리 → 내 정보에서 게임 설명을 끌 수 있어요</p>
      </div>
    </div>
  )
}
