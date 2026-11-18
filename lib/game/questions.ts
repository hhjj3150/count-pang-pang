// 🔢 문제 만들기 (레벨별 번호판과 정답)
import { LEVEL_TIMER, TOTAL_Q } from "./constants"
import { Question } from "./types"
import { mkDigits, ri, sum } from "./utils"

export const HANGUL = ["가", "나", "다", "라", "마", "거", "너", "더", "러", "머", "바", "사", "아", "자", "하", "호"]

export function canSplitEven(arr: number[]) {
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

// 숫자 몇 개를 골라 합이 target이 되는 조합이 있는지 (빈 선택 제외)
export function hasSubsetSum(arr: number[], target: number) {
  const dp = new Array(target + 1).fill(false)
  dp[0] = true
  for (const n of arr) for (let j = target; j >= n; j--) if (dp[j - n]) dp[j] = true
  return dp[target]
}

export function pickDistinct(count: number, poolSize: number) {
  const idx = Array.from({ length: poolSize }, (_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = ri(i + 1)
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx.slice(0, count).sort((a, b) => a - b)
}

// 🧩 한 판(15문제) 만들기
// 이등분 퍼즐(Lv.12)은 '이등분 불가' 정답을 한 판에 2~3문제만 섞고, 나머지는 숫자 조합을 골라야 하는 문제로 구성
export function buildGame(chosenLevel: number): Question[] {
  if (chosenLevel === 12) {
    const impossible = new Set(pickDistinct(2 + ri(2), TOTAL_Q))
    return Array.from({ length: TOTAL_Q }, (_, i) => buildQuestion(chosenLevel, i, !impossible.has(i)))
  }
  return Array.from({ length: TOTAL_Q }, (_, i) => buildQuestion(chosenLevel, i))
}

export function buildQuestion(chosenLevel: number, index: number, wantPartition?: boolean): Question {
  // 그랜드 마스터(Lv.14)는 매 문제 Lv1~13 무작위, 그 외엔 선택 레벨(0은 1과 동일 로직)
  const logic = chosenLevel === 14 ? 1 + ri(13) : chosenLevel === 0 ? 1 : chosenLevel
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
    case 9:
    case 10: {
      // 🔢 숫자 골라 만들기: 7자리 번호판에서 숫자를 골라 합이 20(Lv.9) / 문제마다 제시되는 11~30(Lv.10)이 되게 (항상 정답이 있는 번호판만 출제)
      const target = logic === 9 ? 20 : 11 + ri(20)
      let { front, back } = base(3)
      for (let tries = 0; tries < 500 && !hasSubsetSum([...front, ...back], target); tries++) ({ front, back } = base(3))
      return {
        level: logic, front, back, hangul, type: "target", timer,
        title: `${target} 만들기`, desc: `번호판 숫자를 골라 합이 ${target}${[2, 4, 5, 9].includes(target % 10) ? "가" : "이"} 되게 하세요`,
        answer: target, target,
      }
    }
    case 11: {
      // ➕ 큰 수 덧셈: 뒷자리 4자리 수 + 앞자리 2·3자리 수 (예: 37가 4521 → 4521 + 37 = 4558)
      // 정답은 숫자판으로 입력할 수 있게 4자리 이하(9999 이하), 헷갈리지 않게 앞·뒷자리 첫 숫자는 0이 아니게
      const toNum = (ds: number[]) => Number(ds.join(""))
      let front: number[] = []
      let back: number[] = []
      for (let tries = 0; tries < 500; tries++) {
        front = [1 + ri(9), ...mkDigits(1 + ri(2))]
        back = [1 + ri(9), ...mkDigits(3)]
        if (toNum(front) + toNum(back) <= 9999) break
      }
      return {
        level: logic, front, back, hangul, type: "numpad", timer,
        title: "큰 수 덧셈", desc: "뒷자리 네 자리 수 + 앞자리 수를 계산하세요",
        answer: toNum(back) + toNum(front),
      }
    }
    case 12: {
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
    case 13:
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

export function exampleText(q: Question) {
  if (q.type === "compare") return q.answer === "front" ? "앞이 큼" : q.answer === "back" ? "뒤가 큼" : "같음"
  if (q.type === "target" && q.target) {
    const all = [...q.front, ...q.back]
    for (let m = 1; m < 1 << all.length; m++) {
      const picked = all.filter((_, i) => (m >> i) & 1)
      if (sum(picked) === q.target && !picked.includes(0)) return `${picked.join("+")} = ${q.target}`
    }
    return String(q.target)
  }
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
