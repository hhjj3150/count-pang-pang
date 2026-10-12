# 카운터 팡팡 (Counter Pang Pang) 작업 규칙

## 사용자와의 작업 방식
- 사용자는 개발 초보자입니다. 모든 안내는 한국어로, 한 단계씩 쉽게 설명합니다.
- 코드 수정은 Claude가 직접 하고, 작업 브랜치에 커밋·푸시합니다. (`main`에는 사용자가 요청할 때만 합칩니다)
- 사용자는 코드를 자신의 PC(VS Code)에도 계속 보관합니다.
  **수정이 `main`에 반영될 때마다 반드시 아래 명령어로 PC에 최신 코드를 받으라고 안내합니다.**
  ```
  git pull origin main
  ```
- 사용자가 직접 코드를 붙여넣고 싶다고 하면, 수정 위치(주석 구역)와 교체할 코드만 부분적으로 제공합니다.

## 프로젝트 핵심
- Next.js + React(`"use client"`) + Tailwind CSS, Vercel 배포. 핵심 로직은 `components/counter-pang-pang.tsx` 한 파일.
- 모바일 세로 화면 최적화(`max-w-[440px]`).
- SSR 안전성 필수: `localStorage`, `navigator` 등 브라우저 API는 `useEffect` 안에서, `typeof window !== "undefined"` 방어와 함께 사용.
- 푸시 전 `next build`로 빌드 통과를 확인합니다. (`next.config.mjs`가 타입 에러를 무시하므로 `npx tsc --noEmit`도 함께 확인)
