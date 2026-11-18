// 🛒 상점 아이템 (카트·배경·이모티콘·하트 가격과 보너스)

// 🚗 카트(세트) 리스트 (실제 폴더의 이미지 파일명과 100% 일치)
// bonus: 장착하면 그 판에서 문제를 맞혀 받은 포인트에 추가로 주는 비율(%) — 통과 못 해도 적용
// minLifetime: 구매할 수 있는 띠 (누적 포인트 기준). 💎 유료 회원은 띠와 상관없이 모두 구매 가능
export const BELT_BLUE = 20000
export const BELT_PURPLE = 60000
export const KARTS = [
  { id: "kart_basic", name: "기본 차량", file: "kart_default_yellow.png", price: 0, bonus: 0, minLifetime: 0 },
  // 🚙 일반 자동차: +5%, 화이트 벨트부터
  { id: "car_suv", name: "SUV", file: "suv.png", price: 2000, bonus: 5, minLifetime: 0 },
  { id: "car_police", name: "경찰차", file: "경찰차.png", price: 2500, bonus: 5, minLifetime: 0 },
  { id: "car_fire", name: "소방차", file: "소방차.png", price: 2500, bonus: 5, minLifetime: 0 },
  { id: "car_sports", name: "스포츠카", file: "스포츠카.png", price: 3000, bonus: 5, minLifetime: 0 },
  { id: "car_forklift", name: "포크레인", file: "포크레인.png", price: 3000, bonus: 5, minLifetime: 0 },
  { id: "car_tank", name: "전투 탱크", file: "탱크.png", price: 3500, bonus: 5, minLifetime: 0 },
  // 🚒 특수 카트: +10%, 블루 벨트부터
  { id: "kart_fire_truck", name: "소방 카트", file: "kart_fire_truck.png", price: 6000, bonus: 10, minLifetime: BELT_BLUE },
  { id: "kart_police", name: "경찰 카트", file: "kart_police.png", price: 7000, bonus: 10, minLifetime: BELT_BLUE },
  { id: "kart_tank", name: "탱크 카트", file: "kart_tank.png", price: 8000, bonus: 10, minLifetime: BELT_BLUE },
  // 🦁 캐릭터(동물) 카트: +15%, 퍼플 벨트부터
  { id: "kart_ostrich", name: "다리가 짧은 타조 카트", file: "kart_ostrich.png", price: 12000, bonus: 15, minLifetime: BELT_PURPLE },
  { id: "kart_giraffe", name: "목이 짧은 기린 카트", file: "kart_giraffe.png", price: 12000, bonus: 15, minLifetime: BELT_PURPLE },
  { id: "kart_rabbit", name: "귀가작은 토끼 카트", file: "kart_rabbit.png", price: 13000, bonus: 15, minLifetime: BELT_PURPLE },
  { id: "kart_elephant", name: "코가 짧은 코끼리 카트", file: "kart_elephant.png", price: 13000, bonus: 15, minLifetime: BELT_PURPLE },
  { id: "kart_crocodile", name: "주둥이짧은 악어 카트", file: "kart_crocodile.png", price: 14000, bonus: 15, minLifetime: BELT_PURPLE },
  { id: "kart_owl", name: "눈이 작은부엉이 카트", file: "kart_owl.png", price: 14000, bonus: 15, minLifetime: BELT_PURPLE },
  { id: "kart_hippo", name: "입이 작은 하마 카트", file: "kart_hippo.png", price: 15000, bonus: 15, minLifetime: BELT_PURPLE },
  { id: "kart_lion", name: "대머리사자 카트", file: "kart_lion.png", price: 16000, bonus: 15, minLifetime: BELT_PURPLE },
]
export const kartNeedLabel = (minLifetime: number) => (minLifetime >= BELT_PURPLE ? "퍼플 벨트부터" : minLifetime >= BELT_BLUE ? "블루 벨트부터" : "")
export const kartBonus = (id: string) => KARTS.find((k) => k.id === id)?.bonus ?? 0

// 🏞️ 배경(테마) 리스트 (경로: /assets/mp4/). 모두 화이트 벨트부터 구매 가능
// bonus: 장착하고 만점(15/15)으로 통과하면 그 판 포인트(정답 포인트 + 통과 보너스)에 추가로 주는 비율(%). 같은 단계는 같은 가격
export const BACKGROUNDS = [
  { id: 0, name: "가로수드라이브 (기본)", file: "가로수드라이브.mp4", price: 0, bonus: 0 },
  { id: 1, name: "해변의드라이브", file: "해변의드라이브.mp4", price: 0, bonus: 0 },
  { id: 2, name: "벚꽃드라이브", file: "벚꽃드라이브.mp4", price: 1500, bonus: 5 },
  { id: 3, name: "단풍길", file: "단풍길.mp4", price: 1500, bonus: 5 },
  { id: 5, name: "눈오는산속", file: "눈오는산속.mp4", price: 1500, bonus: 5 },
  { id: 6, name: "사막의질주", file: "사막의질주.mp4", price: 1500, bonus: 5 },
  { id: 7, name: "아이스크림과캔디", file: "아이스크림과캔디.mp4", price: 4000, bonus: 10 },
  { id: 4, name: "한밤의도심", file: "한밤의도심.mp4", price: 4000, bonus: 10 },
  { id: 8, name: "지하도시", file: "지하도시.mp4", price: 4000, bonus: 10 },
  { id: 9, name: "스핑크스로드", file: "스핑크스로드.mp4", price: 4000, bonus: 10 },
  { id: 10, name: "화산과용암", file: "화산과용암.mp4", price: 7000, bonus: 15 },
  { id: 11, name: "우주도시", file: "우주도시.mp4", price: 7000, bonus: 15 },
  { id: 12, name: "황금의나라", file: "황금의나라.mp4", price: 7000, bonus: 15 },
]
export const bgBonus = (file: string) => BACKGROUNDS.find((b) => b.file === file)?.bonus ?? 0

// 💖 상점에서 포인트로 사는 하트 가격 (하루 3번까지)
export const HEART_PRICE = 150

export const EMOTICON_PACKS = [
  { id: "pangi", name: "팡이", price: 300, unlockLevel: 0 },
  { id: "croc", name: "주둥이 짧은 악어", price: 500, unlockLevel: 1 },
  { id: "elephant", name: "코가 짧은 코끼리", price: 700, unlockLevel: 2 },
  { id: "giraffe", name: "목이 짧은 기린", price: 900, unlockLevel: 3 },
  { id: "hippo", name: "입이 작은 하마", price: 1100, unlockLevel: 4 },
  { id: "lion", name: "대머리 사자", price: 1300, unlockLevel: 5 },
  { id: "ostrich", name: "다리가 짧은 타조", price: 1500, unlockLevel: 6 },
  { id: "owl", name: "눈이 작은 부엉이", price: 1700, unlockLevel: 7 },
  { id: "rabbit", name: "귀가 작은 토끼", price: 1900, unlockLevel: 8 },
];

export const EMOTIONS = [
  { id: "joy", name: "기쁨" },
  { id: "sad", name: "슬픔" },
  { id: "angry", name: "화남" },
  { id: "love", name: "사랑해" },
  { id: "cheer", name: "화이팅" },
];
