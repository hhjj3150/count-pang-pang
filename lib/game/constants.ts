// 📐 게임 기본 숫자 (레벨 이름·시간, 경제 수치, 연령)

// 💹 포인트·캐시·하트 숫자 모음 (⚠️ 테스트 단계 값 — 출시 전 여기서 한 번에 조정)
//  - 게임 포인트(P): 게임으로 적립 → 띠 승급·월간 랭킹·아이템 구매 (돈으로 바꾸지 않음)
//  - 캐시(C, 1C ≈ 1원): 광고 끝까지 보기·친구 초대 가입으로 적립 → 모바일 상품권 교환 (월 1회)
//    캐시는 서버 통장(supabase/04_cash.sql)에만 있음. 카카오 연결한 사람만, 손님은 적립·저장 안 함. 유효기간 없음
export const ECONOMY = {
  cashPerAd: 2, // 광고를 건너뛰지 않고 끝까지 봤을 때 1회당 캐시 (서버가 광고 회사 확인 후 지급)
  cashPerInvite: 5, // 초대 링크로 들어온 친구가 카카오로 가입(연결)하면 1명당 캐시 (supabase/04_cash.sql 의 5와 같게)
  giftCardCash: 5000, // 모바일 상품권 5,000원 교환에 필요한 캐시
  giftCardWon: 5000, // 상품권 금액
  giftCardMinAge: 14, // 상품권 교환 가능 나이 (만 14세 미만은 보호자 동의 필요 → 일단 제외)
}

// 🎂 연령: 만 14세 미만은 '어린이'로 보고 어린이용 광고만 요청 (나이를 모르면 어린이로 취급)
export const CHILD_AGE = 14
export const ageFromBirthYear = (y?: number | null) => (y ? new Date().getFullYear() - y : null)
export const isChildUser = (y?: number | null) => {
  const age = ageFromBirthYear(y)
  return age === null || age < CHILD_AGE
}
// 📺 나중에 광고(AdMob 등)를 붙일 때 광고 요청에 그대로 넘길 설정
//   (구글 혼합 연령 앱 정책: 어린이에게는 어린이 대상 표시 + 전체관람가(G) 광고 + 맞춤 광고 끄기)
export const adRequestConfig = (birthYear?: number | null) =>
  isChildUser(birthYear)
    ? { tagForChildDirectedTreatment: true, maxAdContentRating: "G", nonPersonalizedAds: true }
    : { tagForChildDirectedTreatment: false, maxAdContentRating: "T", nonPersonalizedAds: false }

// 태어난 해 선택 목록 (올해 ~ 1930년). 기본값 없이 고르게 함(중립적 나이 확인)
export const BIRTH_YEARS = Array.from({ length: new Date().getFullYear() - 1930 + 1 }, (_, i) => new Date().getFullYear() - i)
export const TOTAL_Q = 15
export const PASS_LINE = 13
export const MAX_LEVEL = 14
export const HEART_CAP = 10

export const LEVEL_NAMES: Record<number, string> = {
  0: "게임 방법",
  1: "앞자리 팡팡",
  2: "뒷자리 팡팡",
  3: "구형 완전정복",
  4: "신형 완전정복",
  5: "앞뒤 비교왕",
  6: "앞뒤 차이왕",
  7: "홀짝 마법사",
  8: "숨은 숫자 탐정",
  9: "20 만들기",
  10: "숫자 만들기",
  11: "큰 수 덧셈",
  12: "이등분 퍼즐",
  13: "불빛 곱셈",
  14: "그랜드 마스터",
}

// 🎮 스테이지 선택 카드 이름 캡슐에 표시되는 레벨별 게임 설명 (없으면 LEVEL_NAMES 사용)
export const LEVEL_DESC: Record<number, string> = {
  0: "📖 게임 방법",
  1: "앞자리 합",
  2: "뒷자리 합",
  3: "6자리 합",
  4: "7자리 합",
  5: "앞뒤 자리 비교",
  6: "앞뒤 차이",
  7: "홀수/짝수만 합",
  8: "?에 들어갈 숫자",
  9: "골라서 20 만들기",
  10: "골라서 제시된\n숫자 만들기",
  11: "뒷자리+앞자리\n큰 수 덧셈", // \n = 카드 안에서 줄바꿈
  12: "전체합의 이등분\n조합선택",
  13: "붉은 숫자의 곱",
}

export const LEVEL_TIMER: Record<number, number> = {
  0: 15,
  1: 15,
  2: 15,
  3: 20,
  4: 20,
  5: 15,
  6: 20,
  7: 18,
  8: 20,
  9: 25,
  10: 30,
  11: 30,
  12: 30,
  13: 18,
  14: 20,
}

// 🖼️ 레벨 카드·결과 그림: Lv.0~10은 숫자가 그려진 전용 그림, Lv.11~14는 왕관 그림(11번 그림)을 임시로 사용
export const LEVEL_ART = (lv: number) => (lv <= 10 ? lv : 11)
// 왕관 그림을 같이 쓰는 레벨끼리 구분되도록 색만 살짝 다르게
export const LEVEL_ART_FILTER: Record<number, string> = { 11: "hue-rotate(-70deg)", 12: "hue-rotate(-35deg)", 13: "hue-rotate(35deg)" }
