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

## 수익·보상 구조 결정 사항
- **포인트(P)와 캐시(C)를 분리**합니다.
  - P: 게임 실력으로 얻습니다(문제, 레벨 통과, 출석, 카트 클리어 보너스). 띠 승급, 아이템, 월간 순위에 씁니다. **현금성 상품과 연결하지 않습니다.**
  - C: 게임과 무관한 **활동**으로만 얻습니다(광고 보기, 친구 초대, 추후 오퍼월 미션). **기프티콘 교환**에만 씁니다.
- **실물 보상은 기프티콘 중개 업체(예: 기프티쇼 비즈, 카카오톡 선물하기 비즈니스)와 계약하는 방향**으로 결정했습니다(사용자 결정).
  - 앱에는 작은 상품부터 고를 수 있는 "기프티콘 교환소"를 둡니다(예: 아이스크림 1,000C ~ 치킨 20,000C).
  - 초기에는 업체 관리자 웹에서 수동으로 발송하고, 사용자가 늘면 서버와 API로 자동 발송합니다.
  - 사용자가 사업자등록과 업체 계약을 진행해야 합니다. 휴대폰 번호 수집·제공 내용은 개인정보처리방침에 추가해야 합니다.
- **하지 않기로 한 것**: 포인트를 추첨권으로 바꿔 상품권 뽑기를 하는 방식. 게임 결과와 우연과 현금성 경품이 결합되어 사행성 위험이 큽니다.
- 경제 수치는 `components/counter-pang-pang.tsx`의 `ECONOMY`에 모아 둡니다. 현재 값은 테스트용이며 출시 전에 조정합니다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
