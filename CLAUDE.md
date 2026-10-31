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
- **만 14세 미만 기프티콘 방침** (사용자 결정):
  - 아이가 선택하면 **보호자 연동(동의)**을 진행합니다. 보호자 휴대폰 본인인증(예: PASS, NICE)으로 **처음 한 번만** 동의를 받고, 동의 일시와 방법을 서버에 기록합니다.
  - 동의 후에는 **아이가 직접 교환**합니다. 교환할 때마다 보호자에게 알림을 보내고, 어린이에게는 어린이용 상품만 보여 줍니다. 월 1회 제한은 유지합니다.
  - 보호자는 언제든 동의를 취소할 수 있습니다. 취소해도 모은 캐시는 남습니다.
  - 보호자 연동을 하지 않으면 교환할 수 없습니다. 캐시는 사라지지 않고 계속 모이며, 동의를 받거나 만 14세가 되면 교환할 수 있습니다.
  - 받는 곳은 **① 앱 안 "내 기프티콘함"(기본)**, ② 아이 휴대폰 문자, ③ 보호자 휴대폰 문자 중에서 고릅니다.
  - 기프티콘함은 와이파이가 될 때 바코드를 받아 기기에 저장해 두고, **인터넷 없이도** 가게에서 보여 줄 수 있게 합니다. "사진첩에 저장" 버튼도 둡니다.
  - 기프티콘 업체 계약 때 **바코드 이미지나 번호를 앱에 전달하는 방식(API) 지원 여부**와 **동의 절차의 적법성**을 확인해야 합니다.
  - 서버 로그인을 만들 때 만 14세 미만은 가입 단계부터 보호자 동의가 필요한지도 함께 확인합니다.
- **하지 않기로 한 것**: 포인트를 추첨권으로 바꿔 상품권 뽑기를 하는 방식. 게임 결과와 우연과 현금성 경품이 결합되어 사행성 위험이 큽니다.
- 경제 수치는 `components/counter-pang-pang.tsx`의 `ECONOMY`에 모아 둡니다. 현재 값은 테스트용이며 출시 전에 조정합니다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
