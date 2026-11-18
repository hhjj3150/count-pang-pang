// 🔧 작은 도구 (무작위 숫자, 날짜, 글씨 크기, 이미지 경로, 실행 환경)
import type React from "react"

/* ----------------------------- 유틸 ----------------------------- */
export const ri = (max: number) => Math.floor(Math.random() * max)
export const rd = () => ri(10)
export const mkDigits = (n: number) => Array.from({ length: n }, rd)
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
// 📅 휴대폰 현지 시간 기준 날짜 (YYYY-MM-DD). toISOString()은 UTC라 한국에선 오전 9시에 날짜가 바뀌는 문제가 있음
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
export const today = () => localDate()

// 🔠 로비 위쪽(닉네임·버튼·배너) 글씨 크기: 원래 글씨 비율은 그대로 두고 화면 폭에 맞춰 최대한 크게
//  - 폭 385px 화면에서 원래의 1.2배 → 360px 폰 약 1.12배, 412px 폰 약 1.28배, 최대 폭(440px) 약 1.37배
//  - 하트 10개·포인트 여섯 자리일 때도 한 줄에 들어가는 최대 크기로 맞춤
export const LOBBY_TEXT_SCALE = 1.2
export const LOBBY_REF_WIDTH = 385
export const lfs = (px: number): React.CSSProperties => {
  const size = px * LOBBY_TEXT_SCALE
  const cap = (size * 440) / LOBBY_REF_WIDTH // 게임 화면 최대 폭(440px)에서 멈춤
  return { fontSize: `min(${+cap.toFixed(2)}px, ${+((size * 100) / LOBBY_REF_WIDTH).toFixed(3)}vw)` }
}

/* ------------------------ 화면용 가벼운 이미지 경로 ------------------------ */
// 원본 PNG(1254px, 장당 ~1MB)는 이모티콘 저장할 때만 쓰고, 화면에는 미리 줄여 둔 webp를 사용 (데이터 절약)
//  - sm: 상점·차고 목록용 작은 이미지 / md: 미리보기·게임 화면용 중간 이미지
export const lightImg = (folder: "emoticons" | "karts", file: string, size: "sm" | "md") =>
  `/assets/${folder}/${size}/${file.replace(/\.png$/, ".webp")}`

// 📱 실행 환경 확인 (카카오톡 앱 안 브라우저는 파일 다운로드가 막혀 있음)
export const isKakaoInApp = () => typeof navigator !== "undefined" && /KAKAOTALK/i.test(navigator.userAgent)
export const isMobileDevice = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
