// 🧩 문제·화면 상태 타입

export type Screen = "INTRO" | "LOGIN" | "LOBBY" | "GAME" | "RESULT"
export type QType = "numpad" | "compare" | "partition" | "target"
export type Reaction = "idle" | "correct" | "wrong"

export interface Question {
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
  target?: number // 숫자 골라 만들기의 목표 합 (Lv.9는 20, Lv.10은 문제마다 11~30)
}
