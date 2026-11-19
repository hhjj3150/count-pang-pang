"use client"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { getBeltInfo } from "@/lib/game/belts"
import { BIRTH_YEARS, ECONOMY, HEART_CAP, LEVEL_ART, LEVEL_ART_FILTER, LEVEL_DESC, LEVEL_NAMES, MAX_LEVEL, PASS_LINE, TOTAL_Q, adRequestConfig, isChildUser } from "@/lib/game/constants"
import { BACKGROUNDS, EMOTICON_PACKS, EMOTIONS, HEART_PRICE, KARTS, bgBonus, kartBonus, kartNeedLabel } from "@/lib/game/items"
import { buildGame, exampleText } from "@/lib/game/questions"
import { MonthBest, RANK_SIZE, RANK_TABS, RECORD_LEVELS, RankTab, buildRanking, fmtRecord, monthBestTotal } from "@/lib/game/records"
import { SAVE_VERSION, STORAGE_KEY, SaveData, migrateSave } from "@/lib/game/save"
import { EMPTY_STATS, LearnStats } from "@/lib/game/stats"
import { Question, Reaction, Screen } from "@/lib/game/types"
import { isKakaoInApp, isMobileDevice, lfs, lightImg, localDate, sum, today } from "@/lib/game/utils"
import { GameGuide } from "@/components/game/GameGuide"
import { GameImage } from "@/components/game/GameImage"
import { Numpad } from "@/components/game/Numpad"
import { ParentReport } from "@/components/game/ParentReport"
import { Plate } from "@/components/game/Plate"
import { PromotionCelebration } from "@/components/game/Promotion"
import { Tutorial } from "@/components/game/Tutorial"
import { useCloudAccount } from "@/components/game/useCloudAccount"
import { GuardianLink } from "@/components/game/GuardianLink"

/* =========================================================================
   카운터 팡팡 — 아이부터 어른까지 즐기는 번호판 두뇌 계산 모바일 웹 게임
   플로우: INTRO -> LOGIN -> LOBBY -> GAME -> RESULT
   (게임 데이터·문제 만들기는 lib/game/, 작은 화면 조각은 components/game/ 에 있어요)
   ========================================================================= */

export default function CounterPangPang() {
  // 🔁 옛 저장 데이터의 레벨 번호 변환 (다른 저장값 불러오기보다 먼저 실행되도록 맨 위에 둠)
  useEffect(() => { migrateSave() }, [])
  
  
  // (그 아래로는 BGM 코드 등이 이어집니다)

  
  // ▼▼▼ 13곡 랜덤 무한 재생 BGM 코드 ▼▼▼
  React.useEffect(() => {
    // 1. 곡 번호 목록을 만들고 무작위로 섞어주는 마법의 함수 (피셔-예이츠 셔플)
    const shuffleArray = (array: number[]) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };

    // 2. 플레이리스트 생성 및 초기 세팅
    // /public/assets/bgm1.mp3 ~ bgm13.mp3 (곡을 추가하면 이 숫자만 늘리면 됨)
    const BGM_COUNT = 13;
    let playlist = shuffleArray(Array.from({ length: BGM_COUNT }, (_, i) => i + 1));
    let currentIndex = 0;
    
    // 첫 번째 곡 세팅
    let currentAudio = new Audio(`/assets/bgm${playlist[currentIndex]}.mp3`);
    currentAudio.volume = 0.3; // 볼륨 크기 (0.3이 적당합니다)
    
    // ▼▼▼ 이 한 줄을 꼭 추가해 주세요! (버튼과 음악을 연결해 줍니다) ▼▼▼
    (window as any).globalBgm = currentAudio;
   

    // 3. 한 곡이 끝났을 때 다음 곡으로 부드럽게 넘기는 함수
    const playNext = () => {
      currentIndex++;
      
      // 만약 모든 곡을 다 들었다면? -> 다시 새롭게 섞어서 처음부터 무한 반복!
      if (currentIndex >= playlist.length) {
        playlist = shuffleArray([...playlist]);
        currentIndex = 0;
      }
      
      // 다음 곡으로 오디오 소스 교체 후 재생
      currentAudio.src = `/assets/bgm${playlist[currentIndex]}.mp3`;
      currentAudio.play().catch(e => console.log("음악 재생 대기 중..."));
    };

    // 현재 음악이 끝나는 순간(ended)을 감지해서 playNext를 실행하게 만듭니다.
    currentAudio.addEventListener('ended', playNext);
    // 곡 파일을 못 불러오면(없거나 네트워크 오류) 음악이 멈추지 않도록 다음 곡으로 넘어감
    let errorSkips = 0;
    const onError = () => {
      if (++errorSkips > BGM_COUNT) return; // 모든 곡이 실패하면 무한 반복 방지
      playNext();
    };
    const onPlaying = () => { errorSkips = 0; };
    currentAudio.addEventListener('error', onError);
    currentAudio.addEventListener('playing', onPlaying);

    // 4. 브라우저 자동재생 차단 방지 (유저가 화면을 처음 '클릭'하면 1번 트랙 시작!)
    const handleFirstClick = () => {
      currentAudio.play().catch(e => console.log("자동재생 대기"));
      document.removeEventListener('click', handleFirstClick); // 한 번 시작되면 클릭 이벤트는 삭제
    };
    
    document.addEventListener('click', handleFirstClick);

    // ▼▼▼ 화면 밖으로 나가면 노래 끄기 추가 ▼▼▼
    const handleVisibilityChange = () => {
      if (document.hidden) {
        currentAudio.pause(); // 다른 앱을 켜면 노래 정지
      } else {
        // 앱으로 돌아왔을 때, 음소거 상태가 아니라면 다시 재생
        if (!currentAudio.muted) {
          currentAudio.play().catch(e => console.log("재생 대기"));
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    // ▲▲▲ 여기까지 ▲▲▲

    // 5. 화면을 벗어날 때 정리 (음악 끄기)
    return () => {
      currentAudio.pause();
      currentAudio.removeEventListener('ended', playNext);
      currentAudio.removeEventListener('error', onError);
      currentAudio.removeEventListener('playing', onPlaying);
      document.removeEventListener('click', handleFirstClick);
      document.removeEventListener("visibilitychange", handleVisibilityChange); // 정리 코드 추가
    };
  }, []);
  // ▲▲▲ 여기까지입니다 ▲▲▲
  const [loaded, setLoaded] = useState(false)
  const [screen, setScreen] = useState<Screen>("INTRO")

  // 저장 데이터
  const [nickname, setNickname] = useState<string | null>(null)
  const [hearts, setHearts] = useState(5)
  const [heartDate, setHeartDate] = useState(today())
  const [unlocked, setUnlocked] = useState(0)
  const [records, setRecords] = useState<Record<number, number>>({})
  const [muted, setMuted] = useState(false)
  // 🔇 소리 끄기 상태 (효과음 재생 함수들이 항상 최신 값을 보도록 ref로도 보관)
  const mutedRef = useRef(muted)
  mutedRef.current = muted
  const playSound = (src: string) => {
    if (mutedRef.current) return
    new Audio(src).play().catch(() => {})
  }
  const [points, setPoints] = useState(0);
  const [lifetimePoints, setLifetimePoints] = useState(0); // 🌟 누적 포인트
  const [monthlyPoints, setMonthlyPoints] = useState(0);   // 🌟 월간 포인트
  const [monthlyDate, setMonthlyDate] = useState(today().slice(0, 7)); // 🌟 이번 달 (예: 2026-10)
  const [isFever, setIsFever] = useState(false);
  const [fastCombo, setFastCombo] = useState(0);
  // 🥋 승급 애니메이션 상태
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionBelt, setPromotionBelt] = useState<{ badge: string; style: string; from?: string } | null>(null);
  const prevBeltRef = useRef<string | null>(null); // 이전 띠 기억용
  // 게임 중 승급하면 바로 띄우지 않고 '대기'시켰다가 게임이 끝난 뒤(결과 화면) 보여줌
  const [promotionPending, setPromotionPending] = useState(false);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  // 🌟 [핵심 수술] 포인트 획득 자동 감지 센서!
  // 게임이나 출석으로 points가 올라가면, 센서가 감지해서 누적/월간 포인트도 같이 올려줍니다.
  const prevPointsRef = useRef(0);
  const pointsSyncedRef = useRef(false); // 저장 데이터 불러온 직후 기준점 잡았는지 여부
 useEffect(() => {
    if (!loaded) return;
    if (!pointsSyncedRef.current) {
      // 🛡️ 저장된 포인트/띠를 '획득'으로 착각하지 않도록, 불러오기 완료 직후 값을 기준점으로 기억
      pointsSyncedRef.current = true;
      prevPointsRef.current = points;
      prevBeltRef.current = getBeltInfo(lifetimePoints).currentRank.badge;
      return;
    }
    const diff = points - prevPointsRef.current;
    
    if (diff > 0) {
      const nextTotalPoints = lifetimePoints + diff;
      setLifetimePoints(prev => prev + diff);
      
      // 🥋 승급 감지 모니터링
      const oldBelt = prevBeltRef.current;
      const newBeltInfo = getBeltInfo(nextTotalPoints).currentRank;
      
      if (oldBelt && oldBelt !== newBeltInfo.badge) {
        // 이전 띠와 다른 더 높은 띠로 올라갔다면 축하 연출 발동!
        // (게임/결과 화면이면 게임이 끝난 뒤 결과 화면에서 보여주도록 대기)
        setPromotionBelt({ ...newBeltInfo, from: oldBelt });
        if (screenRef.current === "GAME" || screenRef.current === "RESULT") setPromotionPending(true);
        else setShowPromotionModal(true);
        prevBeltRef.current = newBeltInfo.badge; // 새로운 띠로 기억 갱신
      }
      
      const currentMonth = today().slice(0, 7);
      if (monthlyDate !== currentMonth) {
        setMonthlyPoints(diff);
        setMonthlyDate(currentMonth);
      } else {
        setMonthlyPoints(prev => prev + diff);
      }
    }
    prevPointsRef.current = points;
  }, [points, loaded, monthlyDate]);
  // 🏆 누적 포인트(lifetimePoints)에 따른 주짓수 정통 그랄(Stripe) 승급 함수
  // 🏆 누적 포인트(lifetimePoints)에 따른 주짓수 정통 그랄(Stripe) 승급 함수

  // 내 실제 누적 포인트에 맞는 칭호와 다음 목표 세팅!
  const myRankInfo = getBeltInfo(lifetimePoints);
  const myTitle = myRankInfo.currentRank;
// 🎬 12단계 배경 데이터 (경로: /assets/mp4/)
  // 🎬 배경 데이터 (경로: /assets/mp4/)
    
// 📸 이모티콘 팩 리스트 (9종 캐릭터 x 5가지 감정)


  // 🌟 가로수드라이브를 기본 장착 배경으로 설정! (해변의 드라이브도 기본 보유)
  const [ownedBgs, setOwnedBgs] = useState<string[]>(["가로수드라이브.mp4", "해변의드라이브.mp4"]);
  const [equippedBg, setEquippedBg] = useState<string>("가로수드라이브.mp4");

  const buyBackground = (file: string, price: number) => {
    if (points >= price) {
      setPoints(prev => prev - price);
      setOwnedBgs(prev => Array.from(new Set([...prev, file])));
      sfxClick();
      flashToast("🎉 배경 구매 완료! 관리 → 내 테마에서 적용해 보세요");
    } else {
      flashToast(`포인트가 부족해요! (${points}P / ${price}P) 😥`);
    }
  };
  React.useEffect(() => {
    const drivingSound = new Audio('/assets/driving.mp3');
    drivingSound.loop = true; 
    drivingSound.volume = 0.4; 

    if (screen === "GAME" && !muted) {
      drivingSound.play().catch(e => console.log("주행 소리 재생 대기"));
    } else {
      drivingSound.pause(); 
    }

    // ▼▼▼ 화면 밖으로 나가면 주행 소리 끄기 추가 ▼▼▼
    const handleVis = () => {
      if (document.hidden) {
        drivingSound.pause();
      } else if (screen === "GAME" && !muted) {
        drivingSound.play().catch(e => console.log("주행 소리 재생 대기"));
      }
    };
    document.addEventListener("visibilitychange", handleVis);
    // ▲▲▲ 여기까지 ▲▲▲

    return () => {
      drivingSound.pause();
      document.removeEventListener("visibilitychange", handleVis); // 정리 코드 추가
    };
  }, [screen, muted]);
  const [exitPhase, setExitPhase] = useState<"ask" | "goodbye" | null>(null);

  // 게임 상태
  const [chosenLevel, setChosenLevel] = useState(0)
  const [questions, setQuestions] = useState<Question[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [input, setInput] = useState("")
  const [selected, setSelected] = useState<number[]>([])
  const [reaction, setReaction] = useState<Reaction>("idle")
  const [locked, setLocked] = useState(false)
  const [timeLeft, setTimeLeft] = useState(15)
  const [isPaused, setIsPaused] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)

  // 결과
  const [passed, setPassed] = useState(false)
  // 결과 화면 보너스: base 통과 보너스, kart 카트 보너스(정답 포인트 기준), bg 배경 만점 보너스
  const [clearReward, setClearReward] = useState<{ base: number; kart: number; kartPct: number; bg: number; bgPct: number } | null>(null)
  const questionPtsRef = useRef(0) // 이번 판에서 문제를 맞혀 받은 포인트 합 (카트·배경 보너스 계산용)
  // 🏆 이번 달 신기록 (Lv.11·12·13 만점 최단 시간)
  const [monthBestData, setMonthBestData] = useState<{ month: string; best: MonthBest }>({ month: "", best: {} })
  const monthBest: MonthBest = monthBestData.month === today().slice(0, 7) ? monthBestData.best : {} // 달이 바뀌면 새로 시작
  const [recordResult, setRecordResult] = useState<{ ms: number | null; isNew: boolean; prev: number | null } | null>(null)
  const [showRecords, setShowRecords] = useState(false) // 🏆 랭킹 창
  // 📖 게임 시작 전 설명 팝업 (관리 → 내 정보에서 보기/끄기, 기본은 보기)
  const [guideLevel, setGuideLevel] = useState<number | null>(null)
  const [showGuide, setShowGuide] = useState(true)
  const changeShowGuide = (on: boolean) => setShowGuide(on)
  const [rankTab, setRankTab] = useState<RankTab>("points")
  const playMsRef = useRef(0) // 이번 판에서 문제를 푸는 데 쓴 시간 (일시정지·정답 연출 시간 제외)
  const [finalScore, setFinalScore] = useState(0)
  const [resultPhase, setResultPhase] = useState<"boom" | "cheer">("boom")

  // 기타 UI
  const [nickInput, setNickInput] = useState("")
  // 🎂 태어난 해 / 💰 캐시
  const [birthYear, setBirthYear] = useState<number | null>(null)
  const [birthInput, setBirthInput] = useState("") // 가입 화면·연령 확인 창의 선택값
  const [cash, setCash] = useState(0)
  const [premium, setPremium] = useState(false) // 💎 유료 회원: 모든 카트를 화이트 벨트부터 구매 가능
  const [cashExchangeMonth, setCashExchangeMonth] = useState("")
  const isChild = isChildUser(birthYear)
  const adConfig = adRequestConfig(birthYear) // 📺 광고를 붙일 때 이 설정으로 요청 (어린이면 어린이용 광고만)
  const [showVault, setShowVault] = useState(false)
  const [showAttendance, setShowAttendance] = useState(false);
  const [attData, setAttData] = useState({ date: "", weekCount: 0, lastMonday: "" });
  // 💖 포인트 하트 구매 일일 제한 관리 상태
  const [heartBuyData, setHeartBuyData] = useState({ date: "", count: 0 });
// 🚗 [1단계] 자동차 스킨 및 내 보관함(My Page) 상태 관리
  const [ownedCars, setOwnedCars] = useState<string[]>(["kart_basic"]); 
  const [equippedCar, setEquippedCar] = useState("kart_basic");
  const [showMyPage, setShowMyPage] = useState(false); // 내 보관함 팝업 상태
  const [confirmDelete, setConfirmDelete] = useState(false); // 🗑️ 내 정보 모두 삭제 확인창
  const deletingRef = useRef(false); // 삭제 중에는 저장하지 않음
  // ☁️ 계정 연결 (components/game/useCloudAccount.ts)
  const [cloudUserId, setCloudUserId] = useState<string | undefined>(undefined); // 이 기록이 연결된 서버 계정
  const savedAtRef = useRef(0); // 마지막으로 내용이 바뀌어 저장한 시각
  const lastBodyRef = useRef<string | null>(null); // 마지막으로 저장한 내용 (바뀌었는지 비교용)
  const cloudNotifyRef = useRef<() => void>(() => {}); // 저장할 때마다 서버 올리기 예약
  const [activeCategory, setActiveCategory] = useState("info");
  const [shopCategory, setShopCategory] = useState("emoticon"); // 🌟 포인트 상점 탭 상태

  // --- 📸 이모티콘 보유 및 구매 관련 상태 & 함수 ---
  const [ownedEmoticons, setOwnedEmoticons] = useState<string[]>([]); // 👈 서버 에러 방지를 위해 일단 빈 배열로 시작

  // 📸 이모티콘 구매 함수
  const buyEmoticon = (itemId: string, price: number, itemName: string) => {
    if (points < price) {
      flashToast(`포인트가 부족해요! (${points}P / ${price}P) 😥`);
      return;
    }
    sfxClick();
    setPoints(prev => prev - price);
    setOwnedEmoticons(prev => [...prev, itemId]);

    flashToast(`${itemName} 구매 완료! 🎉`);
  };
  // 🚗 포인트로 차량 스킨 구매하는 함수
  const buyCar = (carId: string, price: number) => {
    sfxClick();
    const kart = KARTS.find((k) => k.id === carId);
    if (kart && !premium && lifetimePoints < kart.minLifetime) {
      flashToast(`🔒 ${kartNeedLabel(kart.minLifetime)} 살 수 있어요!`);
      return;
    }
    if (ownedCars.includes(carId)) {
      flashToast("이미 차고에 있는 멋진 차량입니다! 🚗");
      return;
    }
    if (points < price) {
      flashToast(`포인트가 부족해요! (${price}P 필요) 😥`);
      return;
    }
    
    setPoints(prev => prev - price);
    setOwnedCars(prev => [...prev, carId]);
    flashToast("차량 구매 완료! ⚙️ 관리 → 🚗 내 차고에서 장착해 보세요 🎁");
  };
  // 💖 포인트로 하트 구매하는 함수 (HEART_PRICE 소모, 하루 최대 3회)
  const buyHeartWithPoints = () => {
    sfxClick();
    const currentToday = today();
    const currentCount = heartBuyData.date === currentToday ? heartBuyData.count : 0;

    if (currentCount >= 3) {
      flashToast("오늘 하트 충전 횟수(3/3)를 모두 채웠어요! 내일 다시 만나요 ⏰");
      return;
    }

    if (points < HEART_PRICE) {
      flashToast(`포인트가 부족해요! (${points}P / ${HEART_PRICE}P) 😥`);
      return;
    }

    if (hearts >= HEART_CAP) {
      flashToast("이미 하트가 가득 찼어요! 💖");
      return;
    }

    setPoints(prev => prev - HEART_PRICE);
    setHearts(prev => prev + 1);

    const newBuyData = { date: currentToday, count: currentCount + 1 };
    setHeartBuyData(newBuyData);

    flashToast(`${HEART_PRICE}P로 하트 충전 완료! 💖 (오늘 ${newBuyData.count}/3회)`);
  };

  // 이번 주 월요일 날짜 구하기 (주간 초기화용)
  const getMonday = (d = new Date()) => {
    const dt = new Date(d);
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    return localDate(new Date(dt.setDate(diff)));
  };

  const handleAttendance = () => {
    sfxClick();
    const todayStr = today();
    if (attData.date === todayStr) {
      flashToast("오늘은 이미 출석했어요! 내일 또 만나요 👋");
      return;
    }

    // 이번 주(월요일 기준)가 아니면 0회부터 (앱을 켜 둔 채 주가 바뀌거나, 처음 출석하는 경우)
    const monday = getMonday();
    const newCount = (attData.lastMonday === monday ? attData.weekCount : 0) + 1;
    let bonus = 0;
    if (newCount === 3) bonus = 5;
    else if (newCount === 5) bonus = 10;
    else if (newCount === 7) bonus = 20;

    const totalReward = 5 + bonus;
    setPoints(p => p + totalReward);
    
    const newData = { date: todayStr, weekCount: newCount, lastMonday: monday };
    setAttData(newData);

    if (bonus > 0) {
      flashToast(`주 ${newCount}회 출석 달성! 보너스 포함 ${totalReward}P 획득 🎉`);
    } else {
      flashToast(`출석 완료! 5P 획득 🎁`);
    }
    setShowAttendance(false);
  };
  const [toast, setToast] = useState<string | null>(null)
  
// --- 📥 다운로드 미리보기 상태 ---
  const [previewItem, setPreviewItem] = useState<{title: string, file: string, price: number} | null>(null);
  
  // --- 💌 초대하기 및 일일 보상 시스템 ---
  const [invite, setInvite] = useState({ date: "", count: 0 });
  const inviteCount = invite.date === today() ? invite.count : 0; // 날짜가 바뀌면 0부터

  // 공유 버튼 클릭 시 실행될 함수
  // 공유 버튼 클릭 시 실행될 함수
  const handleShare = async () => {
    if (inviteCount >= 5) {
      flashToast(`오늘 초대 보상을 모두 받으셨어요! (5/5) 내일 다시 만나요 ⏰`);
      return;
    }

    const shareUrl = 'https://count-pang-pang.vercel.app'; // 대표 메인 주소

    try {
      if (navigator.share) {
        // 1. 일반 브라우저: 스마트폰 기본 공유 창 호출
        await navigator.share({
          title: '카운터 팡팡 🎮',
          text: '내 두뇌 한계에 도전해봐! 꿀잼 두뇌 게임 카운터 팡팡!',
          url: shareUrl
        });
      } else {
        // 2. 카카오톡 인앱 등 공유 미지원 환경: 링크 복사로 대체
        await navigator.clipboard.writeText(shareUrl);
        flashToast("초대 링크가 복사되었습니다! 카톡 창에 붙여넣어 주세요 📋");
      }
      
      // 공유 또는 복사 성공 시 보상 지급
      sfxClick();
      const newCount = inviteCount + 1;
      setInvite({ date: today(), count: newCount });
      setPoints(prev => prev + 30);
      setCash(c => c + ECONOMY.cashPerInvite);
      
      // 알림이 겹치지 않게 살짝 시간차를 두고 보상 알림 띄우기
      setTimeout(() => flashToast(`초대 성공! 30P + 캐시 ${ECONOMY.cashPerInvite}C 지급 🎁 (오늘 ${newCount}/5회)`), 1000);
    } catch (error) {
      // 사용자가 공유 창을 닫은 경우는 조용히 넘어가고, 공유·복사가 막힌 환경이면 안내
      if ((error as Error)?.name === "AbortError") return;
      flashToast("공유가 안 되는 환경이에요 😥 count-pang-pang.vercel.app 주소를 직접 알려 주세요");
    }
  };
  const correctRef = useRef(0)
  const qIndexRef = useRef(0)
  const audioRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    qIndexRef.current = qIndex
  }, [qIndex])

  /* --------------------- 저장/불러오기 --------------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const d = JSON.parse(raw) as SaveData
        let h = typeof d.hearts === "number" ? d.hearts : 5
        let hd = d.heartDate ?? today()
        if (hd !== today()) {
          // 💖 날이 바뀌면 5개까지 채워주되, 전날 5개 이상 모아둔 하트는 그대로 유지
          h = Math.max(h, 5)
          hd = today()
        }
        setNickname(d.nickname ?? null)
        setBirthYear(typeof d.birthYear === "number" ? d.birthYear : null)
        setCash(typeof d.cash === "number" ? d.cash : 0)
        setPremium(d.premium === true)
        setCashExchangeMonth(d.cashExchangeMonth ?? "")
        setHearts(h)
        setHeartDate(hd)
        setUnlocked(d.unlocked ?? 0)
       setRecords(d.records ?? {})
        setMuted(!!d.muted)
        setPoints(d.points ?? 0)
        setLifetimePoints(d.lifetimePoints ?? 0) // 🌟 누적 데이터 불러오기
        
        // 🌟 월간 초기화 방어 로직 (접속했는데 저번 달 데이터면 0으로 포맷)
        const currentMonth = today().slice(0, 7);
        if (d.monthlyDate && d.monthlyDate !== currentMonth) {
          setMonthlyPoints(0);
          setMonthlyDate(currentMonth);
        } else {
          setMonthlyPoints(d.monthlyPoints ?? 0);
          setMonthlyDate(d.monthlyDate ?? currentMonth);
        }

        // ── 한 묶음에 들어 있는 나머지 항목들 (ver5)
        if (Array.isArray(d.ownedCars) && d.ownedCars.length) setOwnedCars(d.ownedCars)
        if (d.equippedCar) setEquippedCar(d.equippedCar)
        if (Array.isArray(d.ownedBgs)) setOwnedBgs((prev) => Array.from(new Set([...prev, ...(d.ownedBgs ?? [])]))) // 기본 배경은 항상 유지
        if (d.equippedBg) setEquippedBg(d.equippedBg)
        if (Array.isArray(d.ownedEmoticons)) setOwnedEmoticons(d.ownedEmoticons)
        // 하트 구매 횟수는 날짜가 바뀌면 0부터
        setHeartBuyData(d.heartBuy && d.heartBuy.date === today() ? d.heartBuy : { date: today(), count: 0 })
        // 출석은 주(월요일)가 바뀌면 새로 시작
        const monday = getMonday()
        setAttData(d.attendance && d.attendance.lastMonday === monday ? d.attendance : { date: "", weekCount: 0, lastMonday: monday })
        if (d.invite) setInvite(d.invite)
        if (d.daily && d.daily.date === today()) setDaily(d.daily)
        if (d.monthBest) setMonthBestData(d.monthBest)
        if (d.stats && d.stats.types && d.stats.days && d.stats.games) setLearnStats(d.stats)
        if (typeof d.showGuide === "boolean") setShowGuide(d.showGuide)
        if (typeof d.lastLevel === "number") setChosenLevel(d.lastLevel)
        if (d.cloudUserId) setCloudUserId(d.cloudUserId)
        if (typeof d.savedAt === "number") savedAtRef.current = d.savedAt

        if (d.nickname) setScreen("INTRO")
      }
    } catch {
      /* ignore */
    }
    setLoaded(true)
  }, [])


 // 📱 스마트폰 뒤로가기(하드웨어) 완벽 동기화 로직 (대표님 피드백 반영 완결판)
  const [quitConfirm, setQuitConfirm] = useState(false); // 게임 중 뒤로가기 → "그만둘까요?" 확인창
  const [showTutorial, setShowTutorial] = useState(false); // 🎓 Lv.0 튜토리얼(게임 방법)
  // 🔥 오늘의 도전: 매일 열린 레벨 중 하나를 골라, 오늘 처음 통과하면 통과 보너스 2배
  const [daily, setDaily] = useState<{ date: string; level: number; done: boolean }>({ date: "", level: 0, done: false });
  useEffect(() => {
    // 오늘 도전 레벨이 아직 없으면 정함 (날짜를 씨앗으로 써서 하루 동안 같은 레벨). Lv.1이 열려야 시작
    if (!loaded || unlocked < 1) return;
    const day = today();
    if (daily.date === day) return;
    const seed = Number(day.replace(/-/g, ""));
    const maxLv = Math.min(unlocked, MAX_LEVEL);
    const next = { date: day, level: 1 + (seed % maxLv), done: false };
    setDaily(next);
  }, [loaded, unlocked, daily.date]);
  const dailyActive = daily.date === today() && daily.level >= 1;

  // 📊 학습 기록 (부모님 리포트용)
  const [learnStats, setLearnStats] = useState<LearnStats>(EMPTY_STATS);

  // 💾 내 정보 한 묶음 저장: 불러오기가 끝난 뒤, 무엇이든 바뀌면 묶음 전체를 저장 (서버를 붙이면 이 묶음을 올리면 됨)
  // (모든 상태를 선언한 뒤에 두어야 함)
  useEffect(() => {
    if (!loaded || deletingRef.current) return;
    const data: SaveData = {
      ver: SAVE_VERSION,
      nickname, hearts, heartDate, unlocked, records, muted, points, birthYear, cash, cashExchangeMonth, premium,
      lifetimePoints, monthlyPoints, monthlyDate,
      ownedCars, equippedCar, ownedBgs, equippedBg, ownedEmoticons,
      heartBuy: heartBuyData, attendance: attData, invite, daily, monthBest: monthBestData,
      stats: learnStats, showGuide, lastLevel: chosenLevel, cloudUserId,
    };
    // 내용이 실제로 바뀌었을 때만 저장 시각을 새로 (앱을 켜기만 해도 '최신 기록'이 되지 않게)
    const body = JSON.stringify(data);
    if (lastBodyRef.current !== null && lastBodyRef.current !== body) savedAtRef.current = Date.now();
    const changed = lastBodyRef.current !== body;
    lastBodyRef.current = body;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, savedAt: savedAtRef.current || undefined }));
    if (changed) cloudNotifyRef.current();
  }, [loaded, cloudUserId, nickname, hearts, heartDate, unlocked, records, muted, points, lifetimePoints, monthlyPoints, monthlyDate, birthYear, cash, cashExchangeMonth, premium,
      ownedCars, equippedCar, ownedBgs, equippedBg, ownedEmoticons, heartBuyData, attData, invite, daily, monthBestData, learnStats, showGuide, chosenLevel]);
  const recordAnswer = (logicLevel: number, isCorrect: boolean) => {
    const day = today();
    setLearnStats((st) => {
      const t = st.types[logicLevel] ?? { tries: 0, correct: 0 };
      const d = st.days[day] ?? { games: 0, solved: 0, correct: 0 };
      return {
        ...st,
        types: { ...st.types, [logicLevel]: { tries: t.tries + 1, correct: t.correct + (isCorrect ? 1 : 0) } },
        days: { ...st.days, [day]: { ...d, solved: d.solved + 1, correct: d.correct + (isCorrect ? 1 : 0) } },
      };
    });
  };
  const recordGame = (level: number, score: number) => {
    const day = today();
    setLearnStats((st) => {
      const d = st.days[day] ?? { games: 0, solved: 0, correct: 0 };
      // 날짜별 기록은 최근 60일만 보관
      const days = Object.fromEntries(Object.entries({ ...st.days, [day]: { ...d, games: d.games + 1 } }).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-60));
      return { ...st, days, games: [...st.games, { date: day, level, score }].slice(-30) };
    });
  };
  const [kakaoGuide, setKakaoGuide] = useState(false); // 카카오톡 앱 안에서 저장 시 '다른 브라우저로 열기' 안내
  // 📲 홈 화면에 추가 (PWA 설치)
  const installPromptRef = useRef<any>(null); // 안드로이드 크롬이 주는 '설치' 이벤트 보관
  const [installGuide, setInstallGuide] = useState<null | "ios" | "kakao" | "other" | "done">(null);
  const [isStandalone, setIsStandalone] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsStandalone(window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);
    const onPrompt = (e: Event) => { e.preventDefault(); installPromptRef.current = e; };
    const onInstalled = () => { installPromptRef.current = null; setIsStandalone(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  const handleInstall = async () => {
    sfxClick();
    if (isStandalone) return setInstallGuide("done");
    if (installPromptRef.current) {
      const ev = installPromptRef.current;
      installPromptRef.current = null;
      ev.prompt();
      const choice = await ev.userChoice?.catch(() => null);
      if (choice?.outcome === "accepted") flashToast("홈 화면에 카운터 팡팡이 추가됐어요! 🚗");
      return;
    }
    if (isKakaoInApp()) return setInstallGuide("kakao");
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return setInstallGuide("ios");
    setInstallGuide("other");
  };
  // 🗑️ 내 정보 모두 삭제 (탈퇴): 기기에 저장된 내 정보 묶음을 지우고 처음 화면으로
  const deleteMyData = async () => {
    if (cloud.user) {
      // 계정을 연결했으면 서버 기록·계정부터 지움
      const ok = await cloud.deleteServerAccount();
      if (!ok) return flashToast("서버 기록을 지우지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요 📶");
    }
    deletingRef.current = true;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    window.location.replace("/");
  };
  const stateRef = useRef({ showVault, showAttendance, previewItem, screen, exitPhase, showMyPage, showPromotionModal, quitConfirm, showTutorial, showRecords, guideLevel, confirmDelete });
  const isPopRef = useRef(false); // 브라우저 뒤로가기 타이머 (무한 루프 방지용)
  
  useEffect(() => {
    stateRef.current = { showVault, showAttendance, previewItem, screen, exitPhase, showMyPage, showPromotionModal, quitConfirm, showTutorial, showRecords, guideLevel, confirmDelete };
  }, [showVault, showAttendance, previewItem, screen, exitPhase, showMyPage, showPromotionModal, quitConfirm, showTutorial, showRecords, guideLevel, confirmDelete]);

  // 1. 초기 진입 시 기본 방어막 1개 생성
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
  }, []);

  // 2. 화면이동 시 히스토리 쌓기 (🌟 게임에서 튕기는 현상 완벽 해결!)
  useEffect(() => {
    if (isPopRef.current) return;
    if (screen === "GAME" || screen === "RESULT") {
      window.history.pushState(null, "", window.location.href);
    }
  }, [screen]);

  // 3. 팝업이 뜰 때 히스토리 쌓기 (🌟 팝업에서 튕기는 현상 완벽 해결!)
  useEffect(() => {
    if (isPopRef.current) return;
    if (exitPhase || showVault || showAttendance || previewItem || showMyPage || showTutorial || showRecords || guideLevel !== null || confirmDelete) {
      window.history.pushState(null, "", window.location.href);
    }
  }, [exitPhase, showVault, showAttendance, previewItem, showMyPage, showTutorial, showRecords, guideLevel, confirmDelete]);

  // 4. 진짜 뒤로가기를 눌렀을 때의 동작 흐름
  useEffect(() => {
    const handlePopState = () => {
      isPopRef.current = true; // 스마트폰 뒤로가기 감지 켜기
      const current = stateRef.current;
      
      if (current.showTutorial) {
        // 튜토리얼에서 뒤로가기 = 건너뛰기 (Lv.1은 열어줌)
        setShowTutorial(false);
        setUnlocked((u) => Math.max(u, 1));
      } else if (current.showPromotionModal) {
        // 승급 축하 화면은 뒤로가기로 닫기 (다음 뒤로가기에 대비해 방어막 다시 추가)
        window.history.pushState(null, "", window.location.href);
        setShowPromotionModal(false);
      } else if (current.exitPhase === "goodbye") {
        setExitPhase("ask"); 
      } else if (current.exitPhase === "ask") {
        setExitPhase(null);
      } else if (current.previewItem) {
        setPreviewItem(null);
      } else if (current.confirmDelete) {
        setConfirmDelete(false);
      } else if (current.guideLevel !== null) {
        setGuideLevel(null);
      } else if (current.showRecords) {
        setShowRecords(false);
      } else if (current.showVault) {
        setShowVault(false);
      } else if (current.showAttendance) {
        setShowAttendance(false);
      } else if (current.showMyPage) {
        setShowMyPage(false);
      } else if (current.screen === "GAME") {
        // 게임 중엔 바로 나가지 않고 "그만둘까요?" 확인 (확인창에서 한 번 더 누르면 계속하기)
        window.history.pushState(null, "", window.location.href);
        if (current.quitConfirm) {
          setQuitConfirm(false);
          setIsPaused(false);
        } else {
          setQuitConfirm(true);
          setIsPaused(true);
        }
      } else if (current.screen === "RESULT") {
        setScreen("LOBBY");
      } else {
        // 메인 화면에서 뒤로가기 -> 앱 꺼짐 방지용 방어막 추가 후 팝업 띄움
        window.history.pushState(null, "", window.location.href);
        setExitPhase("ask");
      }

      // 0.1초 뒤 감지 끄기 (자연스러운 화면 전환 유도)
      setTimeout(() => { isPopRef.current = false; }, 100); 
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  /* --------------------- 사운드 --------------------- */
  // 🔇 저장된 소리 설정을 배경음악에도 반영 (앱을 다시 켜도 꺼둔 상태 유지)
  useEffect(() => {
    const bgm = (window as any).globalBgm as HTMLAudioElement | undefined
    if (bgm) bgm.muted = muted
  }, [muted, loaded])

  const beep = useCallback(
    (freq: number, dur: number, type: OscillatorType = "sine") => {
      if (muted) return
      try {
        const ac = audioRef.current ?? (audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)())
        const o = ac.createOscillator()
        const g = ac.createGain()
        o.type = type
        o.frequency.value = freq
        o.connect(g)
        g.connect(ac.destination)
        g.gain.setValueAtTime(0.14, ac.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur)
        o.start()
        o.stop(ac.currentTime + dur)
      } catch {
        /* ignore */
      }
    },
    [muted],
  )
  const sfxClick = useCallback(() => beep(620, 0.07), [beep])
  const sfxRight = useCallback(() => playSound('/assets/정답.mp3'), []);
  const sfxWrong = useCallback(() => playSound('/assets/오답.mp3'), []);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashToast = useCallback((msg: string) => {
    setToast(msg)
    // 긴 안내는 읽을 수 있게 더 오래 표시 (최소 1.6초, 최대 4초), 새 알림이 오면 이전 타이머는 취소
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), Math.min(4000, Math.max(1600, msg.length * 70)))
  }, [])

  // ☁️ 계정 연결 (만 14세 이상만. 어린이는 보호자 연동이 생기면 열어요)
  const suspendLocalSave = useCallback(() => { deletingRef.current = true }, [])
  const cloud = useCloudAccount({ loaded, setCloudUserId, suspendLocalSave, toast: flashToast })
  cloudNotifyRef.current = cloud.notifySaved
  const canLinkAccount = birthYear !== null && !isChild
  // 🆕 처음 시작: 닉네임·태어난 해 저장하고 로비로
  const finishProfile = (name: string, year: number) => {
    setBirthYear(year)
    setNickname(name)
    setScreen("LOBBY")
    // 🔓 처음 가입하면 게임 방법을 띄우지 않고 Lv.1을 바로 열어 줌 (게임 방법은 Lv.0 카드에서 볼 수 있음)
    setUnlocked((u) => Math.max(u, 1))
    if ((window as any).globalBgm) {
      (window as any).globalBgm.play().catch(() => console.log("BGM 재생 대기"));
    }
  }
  // 💬 카카오로 처음 시작 → 닉네임·태어난 해 정하는 화면으로
  const [kidStart, setKidStart] = useState(false) // 카카오로 시작했는데 만 14세 미만: 부모님과 함께 / 손님으로
  useEffect(() => {
    if (cloud.needsProfile) setScreen("LOGIN")
  }, [cloud.needsProfile])
  const startKidAs = async (mode: "guardian" | "guest") => {
    sfxClick()
    setKidStart(false)
    await cloud.leaveKakaoStart()
    finishProfile(nickInput.trim(), Number(birthInput))
    if (mode === "guardian") setShowGuardianLink(true)
    else flashToast("손님으로 시작해요! 기록은 이 휴대폰에만 저장되고, 보호자와 연결하기 전까지 기프티콘은 받을 수 없어요")
  }
  // 👨‍👩‍👧 보호자 연결 (만 14세 미만). 🧪 본인인증 업체 계약 전이라 '테스트 모드'에서만 보여 줌
  //   테스트 모드 켜기: 주소 뒤에 ?guardian-test=1 (끄기: ?guardian-test=0) 또는 Vercel 환경 변수 NEXT_PUBLIC_GUARDIAN_TEST=1
  const [guardianTest, setGuardianTest] = useState(false)
  const [showGuardianLink, setShowGuardianLink] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const url = new URL(window.location.href)
      const q = url.searchParams.get("guardian-test")
      if (q === "1") localStorage.setItem("cp_guardian_test", "1")
      if (q === "0") localStorage.removeItem("cp_guardian_test")
      if (q !== null) {
        url.searchParams.delete("guardian-test")
        window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash)
      }
      setGuardianTest(process.env.NEXT_PUBLIC_GUARDIAN_TEST === "1" || localStorage.getItem("cp_guardian_test") === "1")
    } catch {
      /* ignore */
    }
  }, [])

  /* --------------------- 게임 진행 --------------------- */
  const currentQ = questions[qIndex]
  const isExample = qIndex < 3
// --- 🎵 피버타임 진입 효과음 ---
  useEffect(() => {
    if (isFever) playSound('/assets/피버타임.mp3');
  }, [isFever]);
  // 문제 전환 시 초기화
  useEffect(() => {
    if (screen !== "GAME") return
    const q = questions[qIndex]
    if (!q) return
    setInput("")
    setSelected([])
    setReaction("idle")
    setLocked(false)
    setTimeLeft(q.timer)
  }, [screen, qIndex, questions])

  // ⏱ 문제를 풀 수 있는 동안(잠금·일시정지 아닐 때)만 시간을 더함
  useEffect(() => {
    if (screen !== "GAME" || locked || isPaused) return
    const start = performance.now()
    return () => { playMsRef.current += performance.now() - start }
  }, [screen, locked, isPaused, qIndex])

  const finishGame = useCallback(() => {
    const score = correctRef.current
    const ok = score >= PASS_LINE
    setFinalScore(score)
    setPassed(ok)
    setResultPhase("boom")
    recordGame(chosenLevel, score)
    const qPts = questionPtsRef.current
    // 🏎️ 카트 보너스: 이번 판 정답 포인트의 5·10·15% (통과 못 해도 지급, 최소 1P)
    const kartPct = kartBonus(equippedCar)
    const kartExtra = kartPct > 0 && qPts > 0 ? Math.max(1, Math.round((qPts * kartPct) / 100)) : 0
    let passReward = 0
    let bgExtra = 0
    let bgPct = 0
    if (ok) {
        setRecords((r) => ({ ...r, [chosenLevel]: Math.max(r[chosenLevel] ?? 0, score) }))
        if (chosenLevel < MAX_LEVEL) setUnlocked((u) => Math.max(u, chosenLevel + 1))
        
        // 레벨 패스 보너스 지급 (레벨0: 5점, 레벨1: 30점 ~ 최대 110점)
        const bonus = chosenLevel === 0 ? 5 : Math.min(20 + (chosenLevel * 10), 110);
        // 🔥 오늘의 도전 레벨을 오늘 처음 통과하면 보너스 2배
        const isDaily = daily.date === today() && !daily.done && chosenLevel === daily.level;
        passReward = isDaily ? bonus * 2 : bonus;
        // 🏞️ 배경 보너스: 만점(15/15)으로 통과하면 그 판 포인트(정답 + 통과 보너스)의 5·10·15%
        if (score === TOTAL_Q) {
          bgPct = bgBonus(equippedBg)
          if (bgPct > 0) bgExtra = Math.max(1, Math.round(((qPts + passReward) * bgPct) / 100))
        }
        if (isDaily) {
          const doneDaily = { ...daily, done: true };
          setDaily(doneDaily);
          setTimeout(() => flashToast(`🔥 오늘의 도전 성공! 통과 보너스 2배 +${bonus * 2}P`), 300);
        }
      }
    setClearReward(passReward + kartExtra + bgExtra > 0 ? { base: passReward, kart: kartExtra, kartPct, bg: bgExtra, bgPct } : null)
    if (passReward + kartExtra + bgExtra > 0) setPoints((prev) => prev + passReward + kartExtra + bgExtra)
    // 🏆 Lv.11·12·13 만점이면 이번 달 신기록 확인
    if (RECORD_LEVELS.includes(chosenLevel)) {
      const ms = Math.round(playMsRef.current)
      const best = monthBest
      const prev = best[chosenLevel] ?? null
      if (score === TOTAL_Q) {
        const isNew = prev === null || ms < prev
        if (isNew) {
          const nextBest = { ...best, [chosenLevel]: ms }
          setMonthBestData({ month: today().slice(0, 7), best: nextBest })
        }
        setRecordResult({ ms, isNew, prev })
      } else {
        setRecordResult({ ms: null, isNew: false, prev })
      }
    } else {
      setRecordResult(null)
    }
    setScreen("RESULT")
  }, [chosenLevel, daily, equippedCar, equippedBg, monthBestData])

  const advance = useCallback(() => {
    if (screenRef.current !== "GAME") return // 게임 도중 나갔으면 진행 중단
    const next = qIndexRef.current + 1
    if (next >= TOTAL_Q) {
      finishGame()
    } else {
      // 다음 문제로 넘어가는 같은 순간에 입력·선택을 비워서, 이전 문제의 선택이 새 번호판에 잠깐 남지 않게 함
      setInput("")
      setSelected([])
      setQIndex(next)
    }
  }, [finishGame])

  const resolve = useCallback(
    (isCorrect: boolean) => {
      if (locked) return
      setLocked(true)
      // 📊 학습 기록 (예제 3문제는 정답을 보여주므로 제외)
      const q = questions[qIndexRef.current]
      if (q && qIndexRef.current >= 3) recordAnswer(q.level, isCorrect)
      if (isCorrect) {
        correctRef.current += 1
        setCorrectCount(correctRef.current)
        setReaction("correct")
        sfxRight()
      } else {
        setReaction("wrong")
        sfxWrong()
      }
      setTimeout(advance, isCorrect ? 950 : 1800) // 틀리면 정답을 볼 수 있게 조금 더 오래 머묾
    },
    [locked, advance, sfxRight, sfxWrong, questions],
  )
 
 
  // 타이머
  useEffect(() => {
    // isPaused(일시정지) 상태일 때는 시간이 안 줄어듦!
    if (screen !== "GAME" || locked || isPaused) return
    if (timeLeft <= 0) {
      setIsFever(false);
      setFastCombo(0);
      resolve(false);
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearTimeout(id)
  }, [screen, locked, timeLeft, resolve, isPaused])
  // ▲▲▲ 여기까지 교체 완료 ▲▲▲
// ⏱️ 실시간 피버 감시자: 남은 시간이 2/3 미만으로 떨어지는 순간 즉시 피버 강제 종료
  // (문제가 바뀐 직후엔 timeLeft가 아직 이전 문제 값이라 판정을 건너뜀 → 그랜드 마스터에서 피버가 잘못 꺼지던 문제 방지)
  const feverQRef = useRef(-1);
  useEffect(() => {
    if (feverQRef.current !== qIndex) {
      feverQRef.current = qIndex;
      return;
    }
    if (isFever && currentQ && timeLeft < currentQ.timer * (2 / 3)) {
      setIsFever(false);
      setFastCombo(0);
    }
  }, [timeLeft, isFever, currentQ, qIndex]);
  // 실제 게임 시작 (설명 팝업을 닫은 뒤, 또는 설명 끄기 상태일 때 바로)
  const beginLevel = useCallback(
    (level: number) => {
      // 🎓 Lv.0은 게임이 아니라 튜토리얼 (하트 사용 안 함)
      if (level === 0) {
        sfxClick()
        setShowTutorial(true)
        return
      }
      if (level > unlocked) {
        flashToast("아직 잠긴 레벨이에요! 🔒")
        return
      }
      if (hearts <= 0) {
        flashToast("하트가 없어요. 광고로 충전해요! 💖")
        return
      }
      sfxClick()
      setHearts((h) => h - 1)
      const qs = buildGame(level)
      correctRef.current = 0
      qIndexRef.current = 0
      playMsRef.current = 0
      questionPtsRef.current = 0
      setChosenLevel(level)
      setQuestions(qs)
      setQIndex(0)
    setCorrectCount(0)
    setIsPaused(false)
    setQuitConfirm(false)
    setIsFever(false) // 새 게임 시작 시 피버타임 강제 종료
    setFastCombo(0)   // 연속 정답 콤보 0으로 초기화
    setScreen("GAME")
    },
    [unlocked, hearts, sfxClick, flashToast],
  )
  // 📖 레벨을 누르면: 게임 설명 팝업 먼저 (관리에서 끌 수 있음). 잠김·하트 부족은 팝업 전에 안내
  const startLevel = useCallback(
    (level: number) => {
      if (level === 0 || !showGuide) return beginLevel(level)
      if (level > unlocked) {
        flashToast("아직 잠긴 레벨이에요! 🔒")
        return
      }
      if (hearts <= 0) {
        flashToast("하트가 없어요. 광고로 충전해요! 💖")
        return
      }
      sfxClick()
      setGuideLevel(level)
    },
    [beginLevel, showGuide, unlocked, hearts, sfxClick, flashToast],
  )

  // 🥋 대기 중인 승급 축하 화면 표시: 결과 화면 연출(팡!) 이 끝난 뒤, 또는 결과 화면을 벗어나면 바로
  useEffect(() => {
    if (!promotionPending || screen === "GAME") return
    if (screen === "RESULT") {
      const id = setTimeout(() => {
        setPromotionPending(false)
        setShowPromotionModal(true)
      }, 1700)
      return () => clearTimeout(id)
    }
    setPromotionPending(false)
    setShowPromotionModal(true)
  }, [promotionPending, screen])

  // 결과 연출 (통과 시 boom -> cheer)
  useEffect(() => {
    if (screen === "RESULT" && passed) {
      setResultPhase("boom")
      const id = setTimeout(() => setResultPhase("cheer"), 1500)
      return () => clearTimeout(id)
    }
  }, [screen, passed])

  /* --------------------- 입력 핸들러 --------------------- */
  const onKey = (k: string) => {
    if (locked) return
    sfxClick()
    if (typeof window !== "undefined" && navigator.vibrate) navigator.vibrate(30); // 📱 숫자 입력 시 짧은 진동
    setInput((v) => (v.length >= 4 ? v : v + k))
  }
  
  const onBackspace = () => {
    if (locked) return
    sfxClick()
    if (typeof window !== "undefined" && navigator.vibrate) navigator.vibrate(30); // 📱 지우기 입력 시 짧은 진동
    setInput((v) => v.slice(0, -1))
  }
  // 🎯 공통 채점 (숫자 입력 / 비교 / 이등분 모두 같은 규칙)
  // - 예제 문제(1~3번)는 포인트 없음
  // - 빨리(남은 시간 2/3 이상) 맞히면: 피버 중 15P, 아니면 10P + 콤보 증가 (3연속이면 피버 발동)
  // - 늦게 맞히면: 10P, 피버·콤보 해제
  // - 틀리면: 피버·콤보 해제
  const applyScore = (isCorrect: boolean) => {
    if (!currentQ || isExample) return
    if (!isCorrect) {
      setIsFever(false);
      setFastCombo(0);
      return
    }
    const isFast = timeLeft >= currentQ.timer * (2 / 3);
    if (!isFast) {
      setIsFever(false);
      setFastCombo(0);
      setPoints((prev) => prev + 10);
      questionPtsRef.current += 10
      return
    }
    setPoints((prev) => prev + (isFever ? 15 : 10));
    questionPtsRef.current += isFever ? 15 : 10
    setFastCombo((prev) => {
      const newCombo = prev + 1;
      if (newCombo >= 3 && qIndex >= 3) setIsFever(true);
      return newCombo;
    });
  }

  const onNumSubmit = () => {
    if (!currentQ || input === "" || locked) return
    const isCorrect = Number(input) === currentQ.answer;
    applyScore(isCorrect);
    resolve(isCorrect);
  }
  const onCompare = (choice: "front" | "back" | "equal") => {
    if (!currentQ || locked) return
    sfxClick()
    const isCorrect = choice === currentQ.answer;
    applyScore(isCorrect);
    resolve(isCorrect);
  }
  const togglePartition = (i: number) => {
    if (locked) return
    sfxClick()
    setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))
  }
  const onPartitionSubmit = () => {
    if (!currentQ || locked) return
    const all = [...currentQ.front, ...currentQ.back]
    const selSum = selected.reduce((a, i) => a + all[i], 0)
    const total = sum(all)
    const valid = selected.length > 0 && selected.length < all.length && selSum === total - selSum
    applyScore(valid)
    resolve(valid)
  }
  // 🔟 숫자 골라 만들기 제출: 고른 숫자의 합이 목표(10/20)와 같으면 정답 (조합은 아무거나 OK)
  const onTargetSubmit = () => {
    if (!currentQ || locked || !currentQ.target) return
    const all = [...currentQ.front, ...currentQ.back]
    const selSum = selected.reduce((a, i) => a + (all[i] ?? 0), 0)
    const ok = selected.length > 0 && selSum === currentQ.target
    applyScore(ok)
    resolve(ok)
  }
  const onPartitionImpossible = () => {
    if (!currentQ || locked) return
    sfxClick()
    const isCorrect = !currentQ.canPartition
    applyScore(isCorrect)
    resolve(isCorrect)
  }

  // 📺 광고 보고 하트 충전: 횟수 제한 없음 (하트가 가득 차 있으면 충전 안 함)
  const rechargeAd = () => {
    sfxClick()
    if (hearts >= HEART_CAP) {
      flashToast(`하트가 가득 찼어요! (최대 ${HEART_CAP}개) 💖`)
      return
    }
    // 💰 나중에 실제 광고를 붙이면: 광고(adRequestConfig 설정으로 요청)를 끝까지 본 뒤에 아래 하트·캐시를 지급
    setHearts((h) => Math.min(HEART_CAP, h + 1))
    setCash((c) => c + ECONOMY.cashPerAd)
    flashToast(`광고 시청 완료! 하트 +1 💖 · 캐시 +${ECONOMY.cashPerAd}C`)
  }

  const reactionState = reaction === "correct" ? 1 : reaction === "wrong" ? 6 : 3
  const reactionEmoji = reaction === "correct" ? "🎉" : reaction === "wrong" ? "😵" : "🚗"

  /* --------------------- 렌더 --------------------- */
 const MuteButton = (
    <button
      type="button"
      onClick={() => {
        setMuted((m) => {
          const nextMuted = !m;
          // [핵심] 재생 중인 배경음악을 찾아서 실제로 음소거(muted) 시키는 마법의 코드
          if (typeof window !== "undefined" && (window as any).globalBgm) {
            (window as any).globalBgm.muted = nextMuted;
          }
          return nextMuted;
        });
      }}
      // 동그라미를 빼고, 글씨가 여유 있게 들어가도록 가로 폭(px-4)을 늘린 예쁜 알약 모양
      className="absolute right-3 top-3 z-40 flex h-12 px-4 items-center justify-center rounded-full bg-white/20 font-bold text-white backdrop-blur-md shadow-lg"
      style={lfs(14)}
    >
      {muted ? "🔇 소리 켜기" : "🔊 소리 끄기"}
    </button>
  );

  return (
    <div
      className="flex w-full items-center justify-center overflow-hidden bg-zinc-950"
      style={{ height: "100dvh" }}
    >
      <div className="relative mx-auto flex h-full w-full max-w-[440px] flex-col overflow-hidden bg-[#0b1020] text-white">
        {/* 🎵 BGM 끄기/켜기 버튼은 로비에서만 표시 */}
        {screen === "LOBBY" && MuteButton}

        {/* 토스트 */}
        {toast && (
          <div className="pointer-events-none absolute left-1/2 top-16 z-50 -translate-x-1/2 rounded-full bg-black/80 px-5 py-2 text-sm font-bold text-white shadow-lg backdrop-blur cpp-pop">
            {toast}
          </div>
        )}

        {/* ============================ INTRO ============================ */}
        {screen === "INTRO" && (
          <section className="relative flex h-full flex-col items-center justify-between overflow-hidden">
            {/* 1. 시원한 도로 배경 */}
          <div 
            className="absolute inset-0 z-0"
            style={{ backgroundImage: "url('/assets/road-bg.png')", backgroundSize: "cover", backgroundPosition: "center" }}
          />
          {/* 칙칙한 검은 필름을 걷어내고, 햇살처럼 화사한 투명 필름으로 교체! */}
        <div className="absolute inset-0 z-0 bg-white/10" aria-hidden />
          
        {/* 2. 둥둥 떠다니는 팡이 크루 4인방! (클릭 방해 안 되게 pointer-events-none 추가) */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            {/* 좌측 상단 */}
            <img src="/assets/0-2-2.png" alt="" className="absolute -left-6 top-[15%] h-32 w-32 object-contain opacity-90 drop-shadow-2xl cpp-float" style={{ animationDelay: "0s" }} />
            {/* 우측 상단 */}
            <img src="/assets/0-3-5.png" alt="" className="absolute -right-8 top-[35%] h-40 w-40 object-contain opacity-90 drop-shadow-2xl cpp-float" style={{ animationDelay: "1s" }} />
            {/* 좌측 하단 */}
            <img src="/assets/0-7-7.png" alt="" className="absolute left-4 bottom-[25%] h-28 w-28 object-contain opacity-90 drop-shadow-2xl cpp-float" style={{ animationDelay: "0.5s" }} />
            {/* 우측 하단 */}
            <img src="/assets/0-10-3.png" alt="" className="absolute -right-4 bottom-[10%] h-36 w-36 object-contain opacity-90 drop-shadow-2xl cpp-float" style={{ animationDelay: "1.5s" }} />
          </div>
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
            {/* 상단 타이틀 영역 (cpp-float 클래스를 추가해서 통째로 둥둥 떠다니게 만들기!) */}
          <div className="absolute top-12 left-0 right-0 flex flex-col items-center justify-center cpp-float">
            {/* 1번째 줄 */}
            <p className="mb-1 text-xl font-black tracking-widest text-yellow-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" style={{ fontFamily: "'MaplestoryOTFBold', sans-serif" }}>
              팡이와 함께하는
            </p>
            
            {/* 2번째 줄 (윗줄과 완벽하게 똑같은 글씨체, 색상, 그림자로 깔끔하게 통일!) */}
            <h1
              className="text-5xl whitespace-nowrap font-black tracking-tight text-yellow-300 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]"
              style={{ fontFamily: "'MaplestoryOTFBold', sans-serif" }}
            >
              카운터 팡팡
            </h1>
          </div>
              <GameImage
                src="/assets/car.png"
                alt="자동차"
                fallback={<span style={{ fontSize: "6rem" }}>🐣</span>}
                className="mt-6 h-40 w-40 rounded-full object-cover ring-4 ring-white/20 drop-shadow-[0_10px_16px_rgba(0,0,0,0.5)] cpp-float"
              />
            </div>
            <div className="relative z-10 w-full px-6 pb-10">
              {nickname ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      sfxClick()
                      setScreen("LOBBY")
                    }}
                    className="w-full rounded-2xl bg-gradient-to-b from-yellow-300 to-amber-400 py-4 text-xl font-black text-amber-950 shadow-[0_6px_0_#b45309] active:translate-y-1 active:shadow-[0_2px_0_#b45309]"
                  >
                    시작하기 🚗
                  </button>
                  {cloud.linked ? (
                    <p className="mt-2 text-center text-xs font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">💬 {cloud.kakaoName} 님으로 로그인 중</p>
                  ) : canLinkAccount ? (
                    <button
                      type="button"
                      onClick={() => { sfxClick(); void cloud.linkKakao(); }}
                      className="mt-2 w-full text-center text-xs font-black text-white underline drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                    >
                      손님으로 하는 중 · 💬 카카오 연결하고 기록 보관·기프티콘 받기 ›
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={cloud.busy}
                    onClick={() => { sfxClick(); void cloud.linkKakao(); }}
                    className="w-full rounded-2xl bg-[#FEE500] py-4 text-xl font-black text-[#191919] shadow-[0_6px_0_#c9b400] active:translate-y-1 active:shadow-[0_2px_0_#c9b400] disabled:opacity-70"
                  >
                    {cloud.busy ? "카카오로 이동 중…" : "💬 카카오로 시작하기"}
                  </button>
                  <p className="mt-2 text-center text-xs font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    카카오로 로그인해요. 한 번 로그인하면 다음부터 자동으로 로그인돼요.
                  </p>
                  <button
                    type="button"
                    onClick={() => { sfxClick(); setScreen("LOGIN"); }}
                    className="mt-3 w-full text-center text-sm font-black text-white underline drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                  >
                    손님으로 먼저 해 보기 ›
                  </button>
                </>
              )}
              {/* 👇 여기서부터 추가: 물리적인 게임 종료 버튼 👇 */}
              <button
                type="button"
                onClick={() => {
                  sfxClick();
                  setExitPhase("ask"); // 누르면 1단계 팝업 호출!
                }}
                className="mt-3 w-full rounded-2xl bg-white/10 py-3.5 text-lg font-black text-white ring-1 ring-white/30 active:translate-y-1"
              >
                게임 종료하기 🚪
              </button>
              {/* 👆 여기까지 추가 👆 */}
            </div>
          </section>
        )}

        {/* ============================ LOGIN ============================ */}
        {screen === "LOGIN" && (
          <section className="relative flex h-full flex-col items-center justify-center overflow-hidden px-6">
            {/* 1. 도로 배경 추가 & 어두운 필터(bg-gradient) 완전 제거 */}
        <img src="/assets/road-bg.png" alt="로그인배경" className="absolute inset-0 z-0 h-full w-full object-cover" />
        
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const name = nickInput.trim()
            if (!name) {
              flashToast("닉네임을 입력해 주세요!")
              return
            }
            if (!birthInput) {
              flashToast("태어난 해를 선택해 주세요!")
              return
            }
            sfxClick()
            if (cloud.needsProfile) {
              // 💬 카카오로 시작: 만 14세 미만은 부모님과 함께 (또는 손님으로)
              if (isChildUser(Number(birthInput))) return setKidStart(true)
              finishProfile(name, Number(birthInput))
              cloud.adoptNewProfile()
              return
            }
            finishProfile(name, Number(birthInput))
          }}
          /* 2. 닉네임 박스(테두리, 배경색) 삭제하고 내용물만 남김 */
          className="relative z-10 w-full max-w-sm"
        >
          {/* 👇 여기서부터 원하는 문구로 수정하세요 👇 */}
          <div className="mb-2 flex justify-center">
  <img src="/assets/0-2-2.png" alt="상단 장식" className="h-32 object-contain" />
</div>
          <h2 className="mb-1 text-center text-3xl font-black text-black drop-shadow-md">반가워요 </h2>
          <p className="mb-3 text-center text-base font-bold text-black drop-shadow-md">닉네임은 선물로 받을 이모티콘에 시그니처로 사용됩니다.</p>
          {cloud.needsProfile ? (
            <p data-testid="signup-kakao" className="mb-5 rounded-xl bg-[#FEE500] px-3 py-2.5 text-center text-xs font-black leading-relaxed text-[#191919] shadow">
              💬 카카오 로그인 완료{cloud.kakaoName ? ` (${cloud.kakaoName})` : ""}! 닉네임과 태어난 해만 정하면 시작해요.
            </p>
          ) : (
            <p data-testid="signup-guest" className="mb-5 rounded-xl bg-white/85 px-3 py-2.5 text-center text-xs font-bold leading-relaxed text-zinc-700 shadow">
              👤 <b>손님으로 시작</b>해요. 기록은 이 휴대폰에만 저장돼요.<br />
              <b className="text-rose-600">카카오 계정을 연결하기 전까지는 기프티콘을 받을 수 없어요.</b>
              <br />(캐시는 계속 모이고, 나중에 관리 → 내 정보에서 연결할 수 있어요)
            </p>
          )}
          {/* 👆 여기까지 👆 */}

          <label className="mb-2 block text-sm font-bold text-black drop-shadow-md" htmlFor="nick">
            닉네임
          </label>
          <input
            id="nick"
            value={nickInput}
            onChange={(e) => setNickInput(e.target.value)}
            maxLength={12}
            placeholder="예: 계산왕팡이"
            /* 입력창 자체는 글씨가 잘 보이도록 하얀 배경에 검은 글씨로 변경 */
            className="mb-4 w-full rounded-xl border-2 border-black/20 bg-white px-4 py-3 text-lg font-bold text-black placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-yellow-400/50"
          />
          {/* 🎂 태어난 해 (중립적 나이 확인: 기본값 없이 직접 고름) */}
          <label htmlFor="birth" className="mb-1 block text-sm font-bold text-black drop-shadow-md">
            태어난 해
          </label>
          <select
            id="birth"
            value={birthInput}
            onChange={(e) => setBirthInput(e.target.value)}
            className="mb-5 w-full rounded-xl border-2 border-black/20 bg-white px-4 py-3 text-lg font-bold text-black focus:outline-none focus:ring-4 focus:ring-yellow-400/50"
          >
            <option value="">선택해 주세요</option>
            {BIRTH_YEARS.map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
              <button
                type="submit"
                className="w-full rounded-2xl bg-gradient-to-b from-pink-400 to-pink-500 py-3.5 text-lg font-black text-white shadow-[0_5px_0_#be185d] active:translate-y-1 active:shadow-[0_1px_0_#be185d]"
              >
              
                입장하기
              </button>
              <p className="mt-3 text-center text-xs font-bold text-black/60 drop-shadow-sm">
                입장하면 <a href="/terms" className="underline">이용약관</a>과 <a href="/privacy" className="underline">개인정보처리방침</a>에 동의하는 것으로 봐요.
              </p>
              <button
                type="button"
                onClick={() => { sfxClick(); if (cloud.needsProfile) void cloud.leaveKakaoStart(); setScreen("INTRO"); }}
                className="mt-2 w-full text-center text-xs font-bold text-black/60 underline"
              >
                ← 처음 화면으로
              </button>
            </form>
            {/* 👨‍👩‍👧 카카오로 시작했는데 만 14세 미만 */}
            {kidStart && (
              <div data-testid="kid-start" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
                <div className="w-full max-w-[340px] rounded-3xl bg-white p-6 text-center shadow-2xl cpp-pop">
                  <p className="text-5xl">👨‍👩‍👧</p>
                  <h2 className="mt-2 text-xl font-black text-zinc-900">부모님 인증이 필요해요</h2>
                  <p className="mt-2 text-sm font-bold leading-relaxed text-zinc-600">
                    만 14세 미만은 카카오로 시작하려면 <b className="text-emerald-600">부모님(보호자)의 동의</b>가 필요해요.
                  </p>
                  {guardianTest ? (
                    <button type="button" onClick={() => void startKidAs("guardian")} className="mt-5 w-full rounded-2xl bg-emerald-500 py-3 text-base font-black text-white">
                      👨‍👩‍👧 부모님과 함께 시작하기 <span className="text-xs">(🧪 테스트)</span>
                    </button>
                  ) : (
                    <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold leading-relaxed text-amber-700 ring-1 ring-amber-200">
                      부모님과 함께 시작하기는 준비 중이에요. 그동안은 손님으로 먼저 즐겨 주세요!
                    </p>
                  )}
                  <button type="button" onClick={() => void startKidAs("guest")} className="mt-2 w-full rounded-2xl bg-slate-100 py-3 text-base font-black text-slate-700">
                    손님으로 먼저 하기
                  </button>
                  <p className="mt-2 text-[11px] font-bold leading-relaxed text-zinc-500">
                    손님은 기록이 이 휴대폰에만 저장되고, 보호자와 연결하기 전까지 기프티콘은 받을 수 없어요.
                  </p>
                  <button type="button" onClick={() => { sfxClick(); setKidStart(false); }} className="mt-2 text-xs font-bold text-zinc-400 underline">
                    태어난 해 다시 고르기
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ============================ LOBBY ============================ */}
        {screen === "LOBBY" && (
          <section className="relative flex h-full flex-col overflow-hidden">
            
            {/* 1. 메인 화면과 똑같은 도로 배경 이미지 깔기! */}
            {/* 💡 주의: 아래 "bg.png" 자리에 대표님이 메인 화면에 쓰신 실제 도로 배경 파일 이름을 넣어주세요! */}
            {/* 파일 이름을 bg.png 에서 road-bg.png 로 변경! */}
            <img src="/assets/road-bg.png" alt="로비배경" className="absolute inset-0 z-0 h-full w-full object-cover" />
            
            {/* 아까 메인 화면에 넣었던 화사한 햇살 투명 필름 똑같이 추가 */}
            <div className="absolute inset-0 z-0 bg-white/10" />

           {/* 2. 기존 글씨와 내용들이 배경에 가려지지 않도록 위로 띄워주기 (relative z-10) */}
        <header className="relative z-10 flex-none px-4 pb-3 pt-4">
          {/* 상단 닉네임 + 하트 영역 (가로 정렬 묶음) */}
          <div className="relative flex items-center justify-between pr-12">
            {/* 왼쪽 닉네임 */}
            <div>
              <p className="text-black/60" style={lfs(12)}>반가워요</p>
             {/* 실제 유저 레벨 연동 칭호 뱃지 (닉네임은 아랫줄 '관리' 버튼 앞에만 표시) */}
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-2 py-1 font-black ${myTitle.style}`} style={lfs(11)}>
                  {myTitle.badge}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <p className="font-black text-black" style={lfs(18)}>{nickname} 님</p>
                <button
                type="button"
                onClick={() => {
                  sfxClick();
                  setShowMyPage(true);
                }}
                className="flex items-center gap-1 rounded-full bg-black/10 px-2.5 py-1 font-bold text-black/70 active:scale-95"
                style={lfs(12)}
              >
                ⚙️ 관리
              </button>
              </div>
            </div>

            {/* 하트 개수: 위아래 중앙 + 가로 중앙 정렬로 완벽 고정 */}
           
          </div>

          {/* 🌟 1줄: 초대하기(1/4) + 하트 충전(3/4) 가로 배치 */}
          <div className="mt-3 flex w-full items-center gap-1.5">
            {/* 1. 현재 하트 개수 (포인트 박스처럼 왼쪽에 고정) */}
              <div className="flex flex-none items-center justify-center gap-1 rounded-2xl bg-white/40 px-2 py-2 font-black text-black/80 shadow-sm backdrop-blur-sm" style={lfs(14)}>
                💖 <span>{hearts}</span>
              </div>
            {/* 왼쪽: 초대하기 (flex-1) */}
            <button
              type="button"
              onClick={handleShare}
              className="flex flex-none items-center justify-center gap-1 whitespace-nowrap rounded-2xl bg-sky-200/60 px-2 py-3 font-bold text-black/80 shadow-sm active:scale-95"
              style={lfs(14)}
            >
              💌 초대
            </button>
            
            {/* 오른쪽: 광고 보고 하트 충전 (횟수 제한 없음, 남은 폭 전부 사용, 작은 폰에서도 한 줄 유지) */}
            <button
              type="button"
              onClick={rechargeAd}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-2xl bg-sky-200/60 px-1 py-3 font-black text-black/80 active:scale-95",
                hearts >= HEART_CAP && "opacity-50",
              )}
              style={lfs(11.9)}
            >
              📺 광고 보고 하트 충전 <span className="rounded-full bg-white/60 px-1 py-0.5 text-[0.8em]">+1 💖</span>
            </button>
          </div>

          {/* 🌟 2줄: 포인트 창 + 출석체크 + 포인트 상점 */}
          <div className="mt-2 flex w-full items-center gap-1.5">
            
            {/* 💰 내 지갑: 쓸 수 있는 포인트 + 캐시 (누르면 관리 → 내 정보에서 누적·이번 달 포인트까지 확인) */}
            <button
              type="button"
              onClick={() => {
                sfxClick();
                setActiveCategory("info");
                setShowMyPage(true);
              }}
              className="flex flex-none flex-col items-center justify-center whitespace-nowrap rounded-2xl bg-sky-200/60 px-2 py-1.5 font-bold text-black/80 active:scale-95"
            >
              <span className="font-black text-blue-700" style={lfs(14)}>🪙 {points.toLocaleString()}P</span>
              <span className="text-emerald-700" style={lfs(11)}>💵 {cash.toLocaleString()}C</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sfxClick();
                setShowAttendance(true);
              }}
              className="flex min-w-0 flex-auto items-center justify-center gap-0.5 whitespace-nowrap rounded-2xl bg-sky-200/60 py-2.5 font-bold text-black/80 active:scale-95"
              style={lfs(14)}
            >
              📅 출석체크
            </button>

            <button
              type="button"
              onClick={() => {
                sfxClick();
                setShowVault(true);
              }}
              className="flex min-w-0 flex-auto items-center justify-center gap-0.5 whitespace-nowrap rounded-2xl bg-sky-200/60 py-2.5 font-bold text-black/80 active:scale-95"
              style={lfs(14)}
            >
              🛒 포인트 상점
            </button>
          </div>
        </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 cpp-no-scrollbar">
              {/* 🔥 오늘의 도전 배너 */}
              {dailyActive && (
                <div className={cn(
                  "relative z-10 mb-3 flex items-center gap-1 rounded-2xl px-2.5 py-3 shadow-sm ring-1", // z-10: 로비 배경 덮개보다 앞에 (안 그러면 버튼이 안 눌림)
                  daily.done ? "bg-white/70 ring-black/10" : "bg-gradient-to-r from-orange-400 to-rose-400 ring-orange-300",
                )}>
                  <span style={lfs(30)}>{daily.done ? "✅" : "🔥"}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-black", daily.done ? "text-black/50" : "text-white/90")} style={lfs(12)}>
                      오늘의 도전{!daily.done && " · 통과 보너스 2배!"}
                    </p>
                    <p className={cn("break-keep font-black leading-tight", daily.done ? "text-black/70" : "text-white")} style={lfs(14)}>
                      {daily.done ? "완료! 내일 또 새로운 도전이 열려요" : `Lv.${daily.level} ${(LEVEL_DESC[daily.level] ?? LEVEL_NAMES[daily.level]).replace("\n", " ")}`}
                    </p>
                  </div>
                  {!daily.done && (
                    <button type="button" onClick={() => startLevel(daily.level)} className="flex-none rounded-full bg-white px-2 py-1.5 font-black text-rose-500 shadow active:scale-95" style={lfs(14)}>
                      도전 ▶
                    </button>
                  )}
                </div>
              )}
              {/* 🏆 랭킹 버튼 (월간 포인트 · Lv.11 · 12 · 13 · 합산) */}
              <button
                type="button"
                onClick={() => { sfxClick(); setRankTab("points"); setShowRecords(true) }}
                className="relative z-10 mb-3 flex w-full items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 p-3 text-left shadow-md ring-1 ring-violet-300 active:scale-[0.98]"
              >
                <span style={lfs(30)}>🏆</span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-white" style={lfs(16)}>랭킹</p>
                  <p className="font-bold text-white/85" style={lfs(12)}>월간 포인트 · 신기록 TOP 10</p>
                </div>
                <span className="flex-none rounded-full bg-white px-2.5 py-1.5 font-black text-indigo-600 shadow" style={lfs(14)}>보기</span>
              </button>
              <p className="mb-2 mt-1 text-sm font-bold text-black/70">스테이지 선택</p>
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: MAX_LEVEL + 1 }, (_, lv) => {
                  const isLocked = lv > unlocked
                  const cleared = (records[lv] ?? 0) >= PASS_LINE
                  return (
                  <button
            key={lv}
            type="button"
            onClick={() => startLevel(lv)}
            disabled={isLocked}
            className={cn(
              "relative flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-2xl p-2 text-center ring-1 transition-all overflow-hidden",
              isLocked
                ? "bg-black/5 ring-black/10" // 바뀐 노란 배경에 맞게 잠긴 카드는 반투명 검정으로!
                : "bg-white ring-black/10 shadow-sm active:scale-95", // ✨ 요청하신 깔끔한 흰색 바탕!
            )}
          >
            {cleared && (
              <span className="absolute right-1.5 top-1.5 z-20 text-sm drop-shadow-md">⭐</span>
            )}
            {dailyActive && !daily.done && daily.level === lv && (
              <span className="absolute left-1.5 top-1.5 z-20 rounded-full bg-gradient-to-r from-orange-400 to-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow">🔥 x2</span>
            )}

            {/* 1. 꽉 찬 이미지 */}
            <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl">
              <GameImage
                src={`/assets/cards/${LEVEL_ART(lv)}.webp`}
                style={LEVEL_ART_FILTER[lv] ? { filter: LEVEL_ART_FILTER[lv] } : undefined}
                alt={`Lv.${lv} 팡이`}
                fallback={
                  <img
                    src="/assets/pangi.png"
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                }
                className={cn(
                  "h-full w-full object-cover transition-all duration-300",
                  isLocked ? "opacity-40 grayscale" : "opacity-90" 
                )}
              />
            </div>
{/* 💖 하트 중앙에 표시될 클리어 보상 포인트 텍스트 (잠긴 레벨도 노출, 노란색, 레벨별 차등 지급) */}
        <div className="pointer-events-none absolute bottom-[12%] left-1/2 z-20 flex -translate-x-1/2 items-center justify-center">
          <span className="text-sm font-black text-yellow-400 drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">
            {lv === 0 ? (cleared ? "" : "+5P") : `+${Math.min(110, 20 + lv * 10)}P`}
          </span>
        </div>
            {/* 2. 글씨 (레벨은 입체감 유지, 아래 이름은 깔끔한 평면 캡슐 글씨로 변경!) */}
          <div className="relative z-10 flex flex-col items-center gap-1">
            
            {/* 윗줄: 레벨 표시 (대표님이 만족하신 입체 효과 그대로 유지!) */}
            <span 
              className={cn("text-lg font-black tracking-wide", isLocked ? "text-yellow-400/80" : "text-yellow-400")}
              style={{ WebkitTextStroke: "1px #000000", textShadow: "0px 3px 3px rgba(0,0,0,0.8)" }}
            >
              Lv.{lv}
            </span>
            
            {/* 아랫줄: 이름 표시 (입체 효과 싹 빼고, 깔끔한 평면 글씨 + 반투명 캡슐 배경) */}
            <span 
              className={cn("whitespace-pre text-center leading-tight text-[11px] font-bold px-2 py-0.5 rounded-full tracking-wide", isLocked ? "bg-black/40 text-white/70" : "bg-black/60 text-white")}
            >
              {isLocked ? "🔒 " : ""}{LEVEL_DESC[lv] ?? LEVEL_NAMES[lv]}
            </span>
            
          </div>
          </button>
             
           
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* ============================ GAME ============================ */}
        {screen === "GAME" && currentQ && (
          <section className="relative flex h-full flex-col overflow-hidden">
          
          {/* 🔥 피버 타임 시각 효과 (오렌지색 깜빡임 + 중앙 텍스트) */}
          {isFever && (
            <>
              <style>{`
                @keyframes fastFever {
                  0%, 100% { background-color: rgba(255, 165, 0, 0); }
                  50% { background-color: rgba(255, 140, 0, 0.35); }
                }
                .fever-bg {
                  animation: fastFever 0.6s infinite;
                }
              `}</style>
              
              <div className="pointer-events-none absolute inset-0 z-40 fever-bg" />
              
              <div className="pointer-events-none absolute left-1/2 top-[40%] z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center whitespace-nowrap">
                <span 
                  className="text-5xl font-black italic text-orange-500 drop-shadow-md"
                  style={{ textShadow: '0 0 15px #FFD700, 0 0 30px #FF8C00' }}
                >
                  FEVER TIME
                </span>
                <span className="mt-1 animate-pulse text-3xl font-bold text-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  +50%
                </span>
              </div>
            </>
          )}

          {/* ⏸️ 게임 중 뒤로가기 → 그만둘지 확인 (이 동안 타이머 멈춤) */}
          {quitConfirm && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
              <div className="w-full max-w-[320px] rounded-3xl bg-white p-6 text-center shadow-2xl cpp-pop">
                <p className="text-4xl">⏸️</p>
                <h2 className="mt-2 text-2xl font-black text-zinc-900">게임을 그만둘까요?</h2>
                <p className="mt-2 text-sm font-bold text-zinc-500">지금 그만두면 사용한 하트 💖는<br />돌려받을 수 없어요.</p>
                <div className="mt-6 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sfxClick()
                      setQuitConfirm(false)
                      setIsPaused(false)
                      setScreen("LOBBY")
                    }}
                    className="rounded-2xl bg-zinc-200 py-3.5 text-base font-black text-zinc-700 active:scale-95"
                  >
                    그만두기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sfxClick()
                      setQuitConfirm(false)
                      setIsPaused(false)
                    }}
                    className="rounded-2xl bg-gradient-to-b from-yellow-300 to-amber-400 py-3.5 text-base font-black text-amber-950 shadow-[0_4px_0_#b45309] active:translate-y-1 active:shadow-none"
                  >
                    계속하기 ▶
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 상태바 */}
            <header className="flex-none px-4 pb-2 pt-4">
              <div className="flex items-center justify-between gap-2 py-1">
                {/* 1. 왼쪽: 레벨 · 타이머 · 문제 번호 */}
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-black ring-1 ring-white/20">
                    Lv.{chosenLevel}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-sm font-black tabular-nums ring-1",
                      timeLeft <= 5 ? "bg-rose-500/80 ring-rose-300 animate-pulse" : "bg-white/10 ring-white/20",
                    )}
                  >
                    ⏰ {timeLeft}s
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-black tabular-nums ring-1 ring-white/20">
                    {qIndex + 1}/{TOTAL_Q}
                  </span>
                </div>

                {/* 2. 오른쪽: 포인트 지갑 (게임 중엔 BGM 버튼 대신 이 자리에 표시) */}
                <span className="flex items-center gap-1 rounded-full bg-yellow-400/20 px-3 py-1 text-sm font-black tabular-nums text-yellow-400 ring-1 ring-yellow-400/50">
                  {points}P
                </span>
              </div>

              {/* 진행도 바 (이 부분은 원래 있던 그대로 유지됩니다) */}
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-pink-400 transition-all duration-300"
                  style={{ width: `${((qIndex + 1) / TOTAL_Q) * 100}%` }}
                />
              </div>
            </header>

            {/* 무대: 도로 + 자동차 + 번호판 + 팡이 리액션 */}
            <div className="relative min-h-0 flex-1 overflow-hidden">
              
              {/* 🚗 AI로 만든 움직이는 동영상 배경 (워터마크 가리기 위해 5% 확대) */}
              {/* 🚗 장착한 배경에 따라 동적으로 바뀌는 움직이는 동영상 배경 */}
        <video
          key={equippedBg}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover scale-[1.05] brightness-110"
        >
          <source src={`/assets/mp4/${equippedBg}`} type="video/mp4" />
        </video>
              
              {/* 문제 글씨가 잘 보이게 위쪽에만 살짝 그라데이션 그림자 깔기 */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" aria-hidden />
          
              {/* 🌟 게임 화면: 완성형(원세트) 아바타 구역 */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-64 h-64 flex items-end justify-center z-0 pointer-events-none">
                
                {/* 🏎️ 카트(세트) 장착 상태: 옛날 데이터 오류 방어 로직 추가! */}
                <img 
                  src={lightImg("karts", KARTS.find(k => k.id === equippedCar)?.file || "kart_default_yellow.png", "md")} 
                  className="absolute bottom-0 w-[90%] object-contain drop-shadow-xl z-10 cpp-bounce origin-bottom" 
                  alt="카트 스킨" 
                />
                
              </div>
              

<div className="relative z-10 flex h-full flex-col items-center pt-4 pb-2 px-4">
                
                {/* 1. 문제 안내 (맨 위로) */}
                <div className="text-center mb-3">
                  <p className="text-xl font-black text-yellow-300 drop-shadow-md">{currentQ.title}</p>
                  <p className="text-sm font-bold text-white/90 drop-shadow-md">{currentQ.desc}</p>
                  {currentQ.type === "numpad" && currentQ.hiddenPos != null && (
                    <p className="mt-1 text-sm font-bold text-white/90 drop-shadow-md">
                      전체 합 = <span className="text-yellow-300">{currentQ.totalForHidden}</span>
                    </p>
                  )}
                </div>

                {/* 2 & 3. 팡이 리액션 + 물음표 + 예시 정답 (세로 공간 절약을 위해 한 줄로 통합) */}
                <div className="flex h-16 items-center justify-center gap-2 mb-2 z-20 transition-all">
                  <GameImage
                    src={
                      reaction === "correct" ? "/assets/정답이미지.png" : 
                      reaction === "wrong" ? "/assets/오답이미지.png" : 
                      "/assets/기본이미지.png"
                    }
                    alt="팡이 리액션"
                    fallback={<span style={{ fontSize: "2.4rem" }}>{reactionEmoji}</span>}
                    className={cn(
                      "h-16 w-16 rounded-2xl bg-white/10 object-contain p-1 ring-1 ring-white/20",
                      reaction === "wrong" && "cpp-shake",
                      reaction === "correct" && "cpp-pop",
                    )}
                  />
                  
                  {currentQ.type === "numpad" && (
                    <div className="min-w-[80px] rounded-2xl border border-white/20 bg-black/60 px-4 py-2 text-center backdrop-blur shadow-lg">
                      <span className="text-3xl font-black tabular-nums text-white">{input || "?"}</span>
                    </div>
                  )}

                  {/* 예시 정답을 물음표 우측으로 이동! (세로 공간 절약) */}
                  {isExample && reaction !== "wrong" && (
                    <div className="rounded-full bg-emerald-400/90 px-3 py-1.5 text-xs font-black text-emerald-950 shadow cpp-pop">
                      정답: {exampleText(currentQ)}
                    </div>
                  )}
                  {/* ❌ 틀렸을 때(시간 초과 포함) 정답 알려주기 */}
                  {reaction === "wrong" && (
                    <div className="rounded-full bg-rose-500 px-3 py-1.5 text-sm font-black text-white shadow-lg ring-2 ring-white/70 cpp-pop">
                      정답: {exampleText(currentQ)}
                    </div>
                  )}
                </div>

                {/* 🌟 4. 자동차 + 번호판 (물리적 크기 자체를 다단계로 축소!) */}
                <div className="relative flex flex-col items-center mt-auto mb-2">
                  {/* Tailwind 세로 미디어 쿼리를 이용해 박스의 실제 크기(w, h)를 확 줄여 밀려나지 않게 완벽 방어 */}
                  <div className="relative transition-all duration-300
                    w-48 h-40 
                    [@media(max-height:700px)]:w-40 [@media(max-height:700px)]:h-32 
                    [@media(max-height:600px)]:w-32 [@media(max-height:600px)]:h-24 
                    [@media(max-height:550px)]:w-28 [@media(max-height:550px)]:h-20"
                  >
                   
                    {/* 번호판도 박스 크기에 맞춰 축소! origin-bottom으로 자동차 바닥에 찰싹 고정 */}
                    <div className="absolute bottom-0 left-1/2 origin-bottom -translate-x-1/2 transform whitespace-nowrap z-30
                      scale-90 
                      [@media(max-height:700px)]:scale-75 
                      [@media(max-height:600px)]:scale-[0.6] 
                      [@media(max-height:550px)]:scale-[0.45]"
                    >
                      <Plate
                        q={currentQ}
                        selected={currentQ.type === "partition" || currentQ.type === "target" ? selected : undefined}
                        onToggle={(currentQ.type === "partition" || currentQ.type === "target") && !locked ? togglePartition : undefined}
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div> {/* ✅ 1226번 줄부터 이어졌던 배경 박스를 여기서 완벽히 닫아줍니다! */}

        {/* 입력 영역 (레벨별 UI 스위칭) */}
        <div className="flex-none rounded-t-3xl border-t border-white/15 bg-white/5 px-4 pb-2 pt-2 backdrop-blur-xl">
          {currentQ.type === "numpad" && (
            <Numpad
              value={input}
              onKey={onKey}
              onBackspace={onBackspace}
              onSubmit={onNumSubmit}
              disabled={locked}
            />
          )}

          {currentQ.type === "compare" && (
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { k: "front", label: "앞이 큼", emoji: "⬅️" },
                  { k: "equal", label: "같음", emoji: "🟰" },
                  { k: "back", label: "뒤가 큼", emoji: "➡️" },
                ] as const
              ).map((b) => (
                <button
                  key={b.k}
                  type="button"
                  disabled={locked}
                  onClick={() => onCompare(b.k)}
                  className="flex flex-col items-center gap-1 rounded-2xl bg-gradient-to-b from-sky-400 to-sky-500 py-4 text-base font-black text-white shadow-[0_5px_0_#0369a1] active:translate-y-1 active:shadow-[0_1px_0_#0369a1] disabled:opacity-40"
                >
                  <span className="text-2xl">{b.emoji}</span>
                  {b.label}
                </button>
              ))}
            </div>
          )}

          {currentQ.type === "target" && (
            <div className="space-y-2">
              <p className="text-center text-sm font-bold text-white/70">
                번호판 숫자를 눌러 골라요 · 선택 합{" "}
                <span className={cn("text-lg font-black", selected.reduce((a, i) => a + ([...currentQ.front, ...currentQ.back][i] ?? 0), 0) === currentQ.target ? "text-emerald-300" : "text-sky-300")}>
                  {selected.reduce((a, i) => a + ([...currentQ.front, ...currentQ.back][i] ?? 0), 0)}
                </span>
                <span className="text-white/50"> / 목표 {currentQ.target}</span>
              </p>
              <div className="grid grid-cols-[1fr_2fr] gap-2">
                <button
                  type="button"
                  disabled={locked || selected.length === 0}
                  onClick={() => { sfxClick(); setSelected([]) }}
                  className="rounded-2xl bg-white/15 py-4 text-base font-black text-white ring-1 ring-white/30 active:translate-y-1 disabled:opacity-40"
                >
                  다시 고르기
                </button>
                <button
                  type="button"
                  disabled={locked || selected.length === 0}
                  onClick={onTargetSubmit}
                  className="rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-500 py-4 text-lg font-black text-emerald-950 shadow-[0_5px_0_#047857] active:translate-y-1 active:shadow-[0_1px_0_#047857] disabled:opacity-40"
                >
                  제출 ✅
                </button>
              </div>
            </div>
          )}

          {currentQ.type === "partition" && (
            <div className="space-y-2">
              <p className="text-center text-xs text-white/60">
                번호판 숫자를 눌러 파란 불을 켜세요 · 현재 선택 합{" "}
                <span className="font-black text-sky-300">
                  {selected.reduce((a, i) => a + ([...currentQ.front, ...currentQ.back][i] ?? 0), 0)}
                </span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={locked}
                  onClick={onPartitionSubmit}
                  className="rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-500 py-4 text-lg font-black text-emerald-950 shadow-[0_5px_0_#047857] active:translate-y-1 active:shadow-[0_1px_0_#047857] disabled:opacity-40"
                >
                  제출 ✅
                </button>
                <button
                  type="button"
                  disabled={locked}
                  onClick={onPartitionImpossible}
                  className="rounded-2xl bg-gradient-to-b from-rose-400 to-rose-500 py-4 text-lg font-black text-white shadow-[0_5px_0_#be123c] active:translate-y-1 active:shadow-[0_1px_0_#be123c] disabled:opacity-40"
                >
                  이등분 불가 🚫
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    )}
        {screen === "RESULT" && (
          <section className="relative flex h-full flex-col items-center justify-center overflow-hidden px-6 text-center">
           <div 
              className="absolute inset-0"
              style={{ backgroundImage: "url('/assets/road-bg.png')", backgroundSize: "cover", backgroundPosition: "center" }}
            />
            {/* 결과창 글씨와 이미지가 잘 보이도록 어두운 반투명 필름 덮기 */}
            <div className="absolute inset-0 bg-black/75" aria-hidden />

            <div className="relative z-10 flex flex-col items-center">
              {passed ? (
                resultPhase === "boom" ? (
                  <>
                    <GameImage
                      key="boom"
                      src={`/assets/${LEVEL_ART(chosenLevel)}-10.png`}
                      alt="팡!!"
                      fallback={<span style={{ fontSize: "7rem" }}>💥</span>}
                      className="h-44 w-44 object-contain cpp-pop"
                    />
                    <p className="mt-4 text-4xl font-black text-yellow-300 cpp-pop">팡!!</p>
                  </>
                ) : (
                  <>
                    <GameImage
                      key="cheer"
                      src="/assets/정답이미지.png" // 👈 레벨업 글씨가 없는 환호 이미지로 교체!
                      alt="통과 축하"
                      fallback={<span style={{ fontSize: "6rem" }}>🎉</span>}
                      className="h-40 w-40 object-contain cpp-float"
                    />
                    <p className="mt-4 text-2xl font-black text-white">통과! 🎉</p>
                    <p className="mt-2 max-w-xs text-sm text-white/80">
                      실제 자동차를 보고도 카운터 팡팡을 해봐요!
                    </p>
                  </>
                )
              ) : (
                <>
                  <GameImage
                   src="/assets/실패이미지.png"
                    alt="아쉬워요"
                    fallback={<span style={{ fontSize: "6rem" }}>😢</span>}
                    className="h-40 w-40 object-contain cpp-shake"
                  />
                  <p className="mt-4 text-2xl font-black text-white">아쉬워요!</p>
                  <p className="mt-1 text-sm text-white/70">13문제 이상 맞혀야 통과예요</p>
                </>
              )}

              <div className="mt-5 rounded-2xl bg-white/10 px-6 py-3 ring-1 ring-white/20">
                <p className="text-sm text-white/70">이번 점수</p>
                <p className="text-3xl font-black tabular-nums">
                  {finalScore}
                  <span className="text-lg text-white/60"> / {TOTAL_Q}</span>
                </p>
              </div>

              {recordResult && (
                <div className="mt-3 rounded-2xl bg-violet-500/25 px-4 py-2 text-sm font-bold text-white ring-1 ring-violet-300/40">
                  {recordResult.ms !== null ? (
                    <>
                      <p>⏱ 이번 기록 <b className="text-lg text-yellow-300">{fmtRecord(recordResult.ms)}</b></p>
                      {recordResult.isNew ? (
                        <p className="cpp-pop font-black text-yellow-300">🏆 이번 달 Lv.{chosenLevel} 신기록!{recordResult.prev !== null && ` (이전 ${fmtRecord(recordResult.prev)})`}</p>
                      ) : (
                        <p className="text-white/80">이번 달 최고 기록 {fmtRecord(recordResult.prev as number)}</p>
                      )}
                      {monthBestTotal(monthBest) !== null && <p className="text-white/80">3레벨 합계 {fmtRecord(monthBestTotal(monthBest) as number)}</p>}
                    </>
                  ) : (
                    <p>🏆 15문제 모두 맞히면 이번 달 신기록에 도전할 수 있어요!</p>
                  )}
                </div>
              )}

              {clearReward && (
                <div className="mt-3 space-y-0.5 text-sm font-bold text-white/90">
                  {clearReward.base > 0 && <p>🪙 통과 보너스 <b className="text-yellow-300">+{clearReward.base}P</b></p>}
                  {clearReward.kart > 0 && <p>🏎️ 카트 보너스 <b className="text-amber-300">+{clearReward.kart}P</b> (정답 포인트 {clearReward.kartPct}%)</p>}
                  {clearReward.bg > 0 && <p>🏞️ 만점 보너스 <b className="text-emerald-300">+{clearReward.bg}P</b> (배경 {clearReward.bgPct}%)</p>}
                </div>
              )}

              {passed && chosenLevel < MAX_LEVEL && (
                <p className="mt-3 rounded-full bg-yellow-300/90 px-4 py-1.5 text-sm font-black text-amber-950 cpp-pop">
                  🔓 Lv.{chosenLevel + 1} 성공!
                </p>
              )}
            </div>

            <div className="relative z-10 mt-8 w-full max-w-sm space-y-2">
              {/* 🔁 바로 이어서 하기 (하트 1개 사용) */}
              {(() => {
                // 승급 축하 화면이 아직 대기 중이면 먼저 보여주고, 그다음에 이어서 시작
                const playNow = (lv: number) => {
                  if (promotionPending) {
                    setPromotionPending(false)
                    setShowPromotionModal(true)
                    return
                  }
                  startLevel(lv)
                }
                return (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => playNow(chosenLevel)}
                  className={cn(
                    "rounded-2xl py-3.5 text-base font-black active:translate-y-0.5",
                    passed && chosenLevel < MAX_LEVEL
                      ? "bg-white/15 text-white ring-1 ring-white/30"
                      : "col-span-2 bg-gradient-to-b from-sky-300 to-sky-500 text-sky-950 shadow-[0_4px_0_#0369a1]",
                  )}
                >
                  🔁 다시 하기
                </button>
                {passed && chosenLevel < MAX_LEVEL && (
                  <button
                    type="button"
                    onClick={() => playNow(chosenLevel + 1)}
                    className="rounded-2xl bg-gradient-to-b from-emerald-300 to-emerald-500 py-3.5 text-base font-black text-emerald-950 shadow-[0_4px_0_#047857] active:translate-y-0.5"
                  >
                    다음 레벨 ▶
                  </button>
                )}
              </div>
                )
              })()}
              {passed && (
                <button
                  type="button"
                  onClick={() => {
                    sfxClick()
                    setShowVault(true)
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 text-sm font-bold text-white ring-1 ring-white/20 active:scale-[0.99]"
                >
                  🛒 포인트 상점 열기 
                  <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[11px] text-yellow-400">내 포인트: {points.toLocaleString()}P</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  sfxClick()
                  setScreen("LOBBY")
                }}
                className="w-full rounded-2xl bg-gradient-to-b from-yellow-300 to-amber-400 py-3.5 text-lg font-black text-amber-950 shadow-[0_5px_0_#b45309] active:translate-y-1 active:shadow-[0_1px_0_#b45309]"
              >
                확인
              </button>
            </div>
          </section>
        )}
{/* ============================ 📖 게임 설명 팝업 ============================ */}
          {guideLevel !== null && (
            <GameGuide
              level={guideLevel}
              onClose={() => {
                const lv = guideLevel
                setGuideLevel(null)
                beginLevel(lv)
              }}
            />
          )}
{/* ============================ 🏆 랭킹 창 ============================ */}
          {showRecords && (() => {
            const tabInfo = RANK_TABS.find((t) => t.id === rankTab) ?? RANK_TABS[0]
            const list = buildRanking(rankTab, { name: nickname ?? "나", monthlyPoints, best: monthBest })
            const fmt = (v: number) => (rankTab === "points" ? `${v.toLocaleString()}P` : fmtRecord(v))
            const myIdx = list.findIndex((e) => e.me)
            const isLevelTab = typeof rankTab === "number"
            return (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onClick={() => setShowRecords(false)}>
              <div className="flex max-h-[92vh] w-full max-w-[380px] flex-col rounded-3xl bg-white p-4 shadow-2xl cpp-pop" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-zinc-900">🏆 랭킹 <span className="text-sm font-bold text-zinc-400">{today().slice(0, 4)}년 {Number(today().slice(5, 7))}월</span></h2>
                  <button type="button" onClick={() => { sfxClick(); setShowRecords(false) }} className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-lg text-zinc-900 active:scale-90">✕</button>
                </div>

                {/* 탭 버튼 */}
                <div className="mt-3 grid grid-cols-5 gap-1">
                  {RANK_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { sfxClick(); setRankTab(t.id) }}
                      className={cn(
                        "flex min-h-[40px] items-center justify-center whitespace-pre-line rounded-xl px-0.5 py-1 text-[11px] font-black leading-tight min-[380px]:text-xs",
                        rankTab === t.id ? "bg-indigo-500 text-white shadow" : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-center text-xs font-bold text-zinc-500">{tabInfo.desc} · 매달 1일 새로 시작</p>

                {/* 1~10위 */}
                <ol className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto cpp-no-scrollbar">
                  {Array.from({ length: RANK_SIZE }, (_, i) => {
                    const e = list[i]
                    return (
                      <li key={i} className={cn("flex items-center gap-2 rounded-xl px-3 py-1 min-[400px]:py-1.5", e?.me ? "bg-indigo-50 ring-1 ring-indigo-200" : "bg-slate-50")}>
                        <span className="w-7 flex-none text-center text-sm font-black text-slate-500">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
                        <span className={cn("min-w-0 flex-1 truncate text-sm font-black", e ? "text-slate-800" : "text-slate-300")}>{e ? `${e.name}${e.me ? " (나)" : ""}` : "—"}</span>
                        <span className={cn("flex-none text-sm font-black tabular-nums", e ? "text-indigo-600" : "text-slate-300")}>{e ? fmt(e.value) : ""}</span>
                      </li>
                    )
                  })}
                </ol>

                {/* 내 순위 */}
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-2.5 text-white">
                  <p className="min-w-0 text-sm font-black">
                    {myIdx >= 0 ? `내 순위 ${myIdx + 1}위 · ${fmt(list[myIdx].value)}` : rankTab === "points" ? "이번 달 포인트를 모아 보세요!" : rankTab === "total" ? "Lv.11·12·13 모두 만점 기록이 필요해요" : `Lv.${rankTab} 만점이면 순위에 올라가요`}
                  </p>
                  {isLevelTab && (rankTab as number) <= unlocked && (
                    <button type="button" onClick={() => { setShowRecords(false); startLevel(rankTab as number) }} className="flex-none rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-600 active:scale-95">도전 ▶</button>
                  )}
                </div>
                <p className="mt-2 text-center text-[11px] font-bold text-amber-600">👥 다른 사람과 함께 보는 전체 순위는 서버 연결 후 표시돼요. 지금은 내 기록만 보여요.</p>
              </div>
            </div>
            )
          })()}

{/* ============================ 📅 출석체크 모달 ============================ */}
        {showAttendance && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
            <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <button
                onClick={() => setShowAttendance(false)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                ✕
              </button>
              
              <h2 className="mb-2 text-center text-2xl font-black text-gray-800">📅 주간 출석부</h2>
              <p className="mb-5 text-center text-sm font-bold text-gray-500">
                매일 <span className="text-emerald-500">5P</span> 지급! 꾸준히 접속하면 보너스까지!
              </p>
              
              {/* 도장판 UI */}
              <div className="mb-6 grid grid-cols-4 gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                  const isChecked = attData.weekCount >= day;
                  const isBonus = day === 3 || day === 5 || day === 7;
                  const bonusText = day === 3 ? "+5P" : day === 5 ? "+10P" : "+20P";
                  
                  return (
                    <div 
                      key={day} 
                      className={cn(
                        "relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 transition-all",
                        isChecked ? "border-emerald-500 bg-emerald-50" : "border-gray-200 bg-gray-50"
                      )}
                    >
                      <span className="mb-1 text-xs font-bold text-gray-400">{day}일차</span>
                      {isChecked ? (
                        <span className="text-2xl cpp-pop">💮</span>
                      ) : (
                        <span className="text-2xl opacity-20">⚪</span>
                      )}
                      {isBonus && !isChecked && (
                        <div className="absolute -top-2 -right-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm">
                          {bonusText}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleAttendance}
                disabled={attData.date === today()}
                className="w-full rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-500 py-3.5 text-lg font-black text-white shadow-[0_5px_0_#047857] active:translate-y-1 active:shadow-[0_1px_0_#047857] disabled:opacity-50 disabled:shadow-none disabled:translate-y-1"
              >
                {attData.date === today() ? "오늘 출석 완료 ✅" : "출석하고 포인트 받기 🎁"}
              </button>
            </div>
          </div>
        )}
        {/* ============================ 🛒 포인트 상점 모달 ============================ */}
        
        {/* ==================== 👤 종합 마이페이지 (내 정보 관리) 모달 ==================== */}
      {showMyPage && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-3xl border-t border-white/50 bg-slate-50 backdrop-blur-md">
            
            {/* 1. 고정 헤더 */}
            <div className="flex-none flex items-center justify-between border-b border-black/5 bg-slate-100 px-5 py-4">
              <h3 className="text-lg font-black text-slate-900">👤 내 정보 관리</h3>
              <button
                type="button"
                onClick={() => {
                  sfxClick();
                  setShowMyPage(false);
                }}
                className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-lg text-zinc-900 hover:bg-black/10 active:scale-90"
              >
                ✕
              </button>
            </div>

            {/* 🌟 승급 대시보드 (경험치 바) */}
            <div className="flex-none bg-white p-5 border-b border-gray-100 shadow-sm z-10 relative overflow-hidden">
              <div className="absolute -right-6 -top-6 text-8xl opacity-5 pointer-events-none">🥋</div>
              
              <div className="relative flex justify-between items-end mb-2">
                <div>
                  <p className="text-xs font-bold text-gray-400 mb-1">나의 띠 등급</p>
                  <span className={`rounded-md px-2 py-1 text-xs font-black ${myTitle.style}`}>
                    {myTitle.badge}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400 mb-1">누적 포인트</p>
                  <p className="text-sm font-black text-slate-800">{lifetimePoints.toLocaleString()} P</p>
                </div>
              </div>
              
              {myRankInfo.nextRank ? (
                <>
                  <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden mt-3 ring-1 ring-inset ring-gray-200">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700 ease-out" 
                      style={{ width: `${Math.min(100, Math.max(0, ((lifetimePoints - myTitle.req) / (myRankInfo.nextRank.req - myTitle.req)) * 100))}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-bold text-gray-500 text-right mt-1.5">
                    다음 승급(<span className="text-emerald-600">{myRankInfo.nextRank.badge}</span>)까지 {(myRankInfo.nextRank.req - lifetimePoints).toLocaleString()}P 남음
                  </p>
                </>
              ) : (
                <p className="text-xs font-bold text-emerald-500 text-right mt-3">🎉 최고 등급(블랙 벨트)에 도달했습니다!</p>
              )}

              {/* 💰 포인트 3종 + 캐시 한눈에 보기 */}
              <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-blue-50 py-2 ring-1 ring-blue-100">
                  <p className="text-[10px] font-bold text-blue-400">보유 포인트</p>
                  <p className="text-sm font-black text-blue-700">{points.toLocaleString()}P</p>
                  <p className="text-[10px] font-bold text-slate-400">상점에서 사용</p>
                </div>
                <div className="rounded-xl bg-amber-50 py-2 ring-1 ring-amber-100">
                  <p className="text-[10px] font-bold text-amber-500">이번 달 포인트</p>
                  <p className="text-sm font-black text-amber-700">{monthlyPoints.toLocaleString()}P</p>
                  <p className="text-[10px] font-bold text-slate-400">월간 순위</p>
                </div>
                <div className="rounded-xl bg-emerald-50 py-2 ring-1 ring-emerald-100">
                  <p className="text-[10px] font-bold text-emerald-500">캐시</p>
                  <p className="text-sm font-black text-emerald-700">{cash.toLocaleString()}C</p>
                  <p className="text-[10px] font-bold text-slate-400">기프티콘 교환</p>
                </div>
              </div>
            </div>

            {/* 2. 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto px-5 py-6 cpp-no-scrollbar">
              {/* 🌟 카테고리 탭 메뉴 */}
              <div className="flex gap-1.5 mb-6 border-b border-gray-200 pb-4 shrink-0 overflow-x-auto whitespace-nowrap cpp-no-scrollbar">
                <button onClick={() => setActiveCategory("info")} className={`px-2 py-1.5 text-xs min-[380px]:px-2.5 min-[380px]:text-[13px] font-bold rounded-lg transition-colors ${activeCategory === "info" ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-500"}`}>👤 내 정보</button>
                <button onClick={() => setActiveCategory("car")} className={`px-2 py-1.5 text-xs min-[380px]:px-2.5 min-[380px]:text-[13px] font-bold rounded-lg transition-colors ${activeCategory === "car" ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-500"}`}>🚗 내 차고</button>
                <button onClick={() => setActiveCategory("bg")} className={`px-2 py-1.5 text-xs min-[380px]:px-2.5 min-[380px]:text-[13px] font-bold rounded-lg transition-colors ${activeCategory === "bg" ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-500"}`}>🏞️ 내 테마</button>
                <button onClick={() => setActiveCategory("report")} className={`px-2 py-1.5 text-xs min-[380px]:px-2.5 min-[380px]:text-[13px] font-bold rounded-lg transition-colors ${activeCategory === "report" ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-500"}`}>📊 리포트</button>
              </div>

              {/* 📊 부모님 리포트 구역 */}
              {activeCategory === "report" && (
                <div className="mb-8">
                  <p className="mb-3 text-xs font-bold text-slate-400">👨‍👩‍👧 {nickname} 님의 학습 기록이에요. (이 기기에만 저장돼요)</p>
                  <ParentReport stats={learnStats} />
                </div>
              )}

              {/* 👤 내 정보 구역 */}
              <div className="mb-8 space-y-2" style={{ display: activeCategory === "info" ? "block" : "none" }}>
                <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="text-xs font-bold text-slate-400">닉네임</p>
                  <p className="mt-0.5 text-base font-black text-slate-800">{nickname} 님</p>
                  <p className="mt-2 text-xs font-bold text-slate-400">연령 구분</p>
                  <p className="mt-0.5 text-sm font-black text-slate-700">
                    {birthYear ? `${birthYear}년생 · ${isChild ? "어린이 회원 (만 14세 미만)" : "일반 회원"}` : "미입력"}
                  </p>
                </div>
                {/* ☁️ 계정 연결 */}
                <div data-testid="cloud-card" className="rounded-xl bg-yellow-50 p-4 ring-1 ring-yellow-200">
                  <p className="text-sm font-black text-yellow-900">☁️ 계정 연결</p>
                  {cloud.linked ? (
                    <>
                      <p className="mt-1 text-xs font-bold leading-relaxed text-yellow-800">
                        카카오 계정에 연결됐어요. 기록이 서버에도 자동으로 저장돼서 휴대폰을 바꿔도 이어서 할 수 있어요.
                      </p>
                      <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm font-black text-slate-800 ring-1 ring-yellow-200">
                        💬 연결된 카카오 계정: {cloud.kakaoName}
                      </p>
                      {cloud.guardian && (
                        <p className="mt-1 text-[11px] font-bold text-yellow-700">
                          👨‍👩‍👧 보호자 동의: {cloud.guardian.guardian_name.slice(0, 1)}** 님 · {new Date(cloud.guardian.consented_at).toLocaleDateString("ko-KR")}
                          {cloud.guardian.method === "test" && " (🧪 테스트 인증)"}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] font-bold text-yellow-700">
                        {cloud.lastSyncedAt ? `마지막 서버 저장: ${new Date(cloud.lastSyncedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}` : "서버 저장 준비 완료"}
                      </p>
                      <button
                        type="button"
                        onClick={() => { sfxClick(); void cloud.logout(); }}
                        className="mt-3 w-full rounded-lg bg-white py-2 text-xs font-black text-yellow-800 ring-1 ring-yellow-300 active:scale-[0.99]"
                      >
                        로그아웃
                      </button>
                      {cloud.guardian && (
                        confirmRevoke ? (
                          <div className="mt-2 rounded-lg bg-white p-2.5 ring-1 ring-rose-200">
                            <p className="text-[11px] font-bold leading-relaxed text-rose-600">
                              동의를 취소하면 서버의 기록을 지우고 연결을 끊어요. 이 휴대폰의 기록과 캐시는 그대로 남아요.
                            </p>
                            <div className="mt-2 grid grid-cols-2 gap-1.5">
                              <button type="button" onClick={() => { sfxClick(); setConfirmRevoke(false); }} className="rounded-lg bg-slate-100 py-1.5 text-xs font-black text-slate-600">그대로 두기</button>
                              <button type="button" onClick={async () => { sfxClick(); if (await cloud.revokeGuardian()) setConfirmRevoke(false); }} className="rounded-lg bg-rose-500 py-1.5 text-xs font-black text-white">동의 취소</button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => { sfxClick(); setConfirmRevoke(true); }} className="mt-2 w-full text-[11px] font-bold text-rose-500 underline">
                            보호자 동의 취소
                          </button>
                        )
                      )}
                    </>
                  ) : canLinkAccount ? (
                    <>
                      <p className="mt-1 text-xs font-bold leading-relaxed text-yellow-800">
                        카카오 계정을 연결하면 기록을 서버에 보관해요. 휴대폰을 바꾸거나 앱을 지워도 기록을 되찾을 수 있어요.
                      </p>
                      <p className="mt-1 text-xs font-black text-rose-600">손님은 카카오 계정을 연결하기 전까지 기프티콘을 받을 수 없어요.</p>
                      <button
                        type="button"
                        disabled={cloud.busy}
                        onClick={() => { sfxClick(); void cloud.linkKakao(); }}
                        className="mt-3 w-full rounded-lg bg-[#FEE500] py-2.5 text-sm font-black text-[#191919] shadow-sm active:scale-[0.99] disabled:opacity-60"
                      >
                        {cloud.busy ? "카카오로 이동 중…" : "💬 카카오로 연결하기"}
                      </button>
                      <p className="mt-1.5 text-[11px] font-bold leading-relaxed text-yellow-700">
                        카카오 화면에서 연결할 계정을 고르면 게임으로 돌아와요. 따로 회원가입은 없어요.
                      </p>
                    </>
                  ) : birthYear !== null && guardianTest ? (
                    <>
                      <p className="mt-1 text-xs font-bold leading-relaxed text-yellow-800">
                        만 14세 미만은 보호자님이 동의하고 보호자님의 카카오 계정으로 연결해요. 기록을 서버에 보관해서 휴대폰을 바꿔도 이어서 할 수 있어요.
                      </p>
                      <button
                        type="button"
                        onClick={() => { sfxClick(); setShowGuardianLink(true); }}
                        className="mt-3 w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-black text-white shadow-sm active:scale-[0.99]"
                      >
                        👨‍👩‍👧 보호자와 연결하기 <span className="text-[11px]">(🧪 테스트)</span>
                      </button>
                    </>
                  ) : (
                    <p className="mt-1 text-xs font-bold leading-relaxed text-yellow-800">
                      {birthYear === null
                        ? "태어난 해를 먼저 입력해 주세요."
                        : "만 14세 미만 어린이는 보호자 연결 기능이 생기면 계정을 연결할 수 있어요. 그동안 기록은 이 휴대폰에 그대로 저장돼요 😊"}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 ring-1 ring-emerald-200">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-emerald-800">📋 게임 설명</p>
                    <p className="text-[11px] font-bold text-emerald-600">레벨을 시작할 때 게임 설명 팝업 보여 주기</p>
                  </div>
                  <div className="flex flex-none overflow-hidden rounded-full ring-1 ring-emerald-300">
                    {[true, false].map((on) => (
                      <button
                        key={String(on)}
                        type="button"
                        onClick={() => { sfxClick(); changeShowGuide(on); flashToast(on ? "게임 설명을 켰어요. 레벨 시작 전에 보여 줄게요 📋" : "게임 설명을 껐어요. 바로 게임이 시작돼요") }}
                        className={cn("px-3 py-1.5 text-xs font-black", showGuide === on ? "bg-emerald-500 text-white" : "bg-white text-emerald-700")}
                      >
                        {on ? "켜기" : "끄기"}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleInstall}
                  className="flex w-full items-center justify-between rounded-xl bg-sky-50 px-4 py-3.5 text-sm font-black text-sky-800 ring-1 ring-sky-200 active:scale-[0.99]"
                >
                  📲 홈 화면에 추가 (앱처럼 쓰기) <span>{isStandalone ? "✅" : "›"}</span>
                </button>
                <a
                  href="/privacy"
                  className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-600 ring-1 ring-slate-200"
                >
                  🔒 개인정보처리방침 <span>›</span>
                </a>
                <a
                  href="/terms"
                  className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-600 ring-1 ring-slate-200"
                >
                  📄 이용약관 <span>›</span>
                </a>
                <button
                  type="button"
                  onClick={() => { sfxClick(); setConfirmDelete(true); }}
                  className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold text-rose-500 ring-1 ring-rose-200 active:scale-[0.99]"
                >
                  🗑️ 내 정보 모두 삭제 (탈퇴)
                </button>
                {confirmDelete && (
                  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm" onClick={() => setConfirmDelete(false)}>
                    <div className="w-full max-w-[320px] rounded-3xl bg-white p-6 text-center shadow-2xl cpp-pop" onClick={(e) => e.stopPropagation()}>
                      <p className="text-4xl">🗑️</p>
                      <h2 className="mt-2 text-xl font-black text-zinc-900">정말 모두 삭제할까요?</h2>
                      <p className="mt-2 text-sm font-bold leading-relaxed text-zinc-500">
                        포인트·캐시·하트·띠, 산 아이템, 기록이 모두 사라지고 <b className="text-rose-500">되돌릴 수 없어요.</b>
                      </p>
                      <div className="mt-6 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => { sfxClick(); setConfirmDelete(false); }} className="rounded-2xl bg-slate-100 py-3 text-base font-black text-slate-700">
                          취소
                        </button>
                        <button type="button" onClick={deleteMyData} className="rounded-2xl bg-rose-500 py-3 text-base font-black text-white">
                          삭제하기
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 🚗 내 차고 구역 (보유 차량만 표시) */}
              <div className="mb-8" style={{ display: activeCategory === "car" ? "block" : "none" }}>
                <h4 className="mb-3 text-sm font-bold text-slate-700">🚗 장착 가능한 카트</h4>
                {ownedCars.length === 0 ? (
                   <p className="text-sm text-gray-500 text-center py-10">보유 중인 카트가 없습니다.<br/>포인트 상점에서 구매해 보세요!</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {KARTS.filter(item => ownedCars.includes(item.id)).map(item => {
                      const isSelected = equippedCar === item.id;
                      return (
                        <div key={item.id} className={`relative p-3 rounded-xl border-2 transition-all ${isSelected ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                          {item.bonus > 0 && <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-black text-amber-950 shadow">정답 보너스 +{item.bonus}%</span>}
                          <div className="h-20 bg-slate-100 rounded-lg mb-2 flex items-center justify-center p-1 overflow-hidden">
                            {item.file ? <img src={lightImg("karts", item.file, "sm")} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-contain drop-shadow-md" /> : <span className="text-xs text-slate-400">기본(없음)</span>}
                          </div>
                          <p className="font-bold text-sm text-slate-700 text-center">{item.name}</p>
                          <div className="mt-2 flex justify-center">
                            <button 
                              onClick={() => {
                                sfxClick();
                                setEquippedCar(item.id);
                                flashToast(`${item.name} 장착 완료! 💨`);
                              }} 
                              className={`w-full py-1.5 rounded-lg text-xs font-bold ${isSelected ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600 active:scale-95"}`}
                            >
                              {isSelected ? "장착중" : "장착"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 🏞️ 테마(배경) 구역 (보유 테마만 표시) */}
              <div className="mb-8" style={{ display: activeCategory === "bg" ? "block" : "none" }}>
                <h4 className="mb-3 text-sm font-bold text-slate-700">🏞️ 장착 가능한 테마</h4>
                {ownedBgs.length === 0 ? (
                   <p className="text-sm text-gray-500 text-center py-10">보유 중인 테마가 없습니다.<br/>포인트 상점에서 구매해 보세요!</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {BACKGROUNDS.filter(item => ownedBgs.includes(item.file)).map(item => {
                      const isSelected = equippedBg === item.file;
                      return (
                        <div key={item.id} className={`relative p-3 rounded-xl border-2 transition-all ${isSelected ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                          {item.bonus > 0 && <span className="absolute right-1.5 top-1.5 z-20 rounded-full bg-emerald-400 px-2 py-0.5 text-[11px] font-black text-emerald-950 shadow">만점 보너스 +{item.bonus}%</span>}
                          <div className="h-20 bg-slate-800 rounded-lg mb-2 flex items-center justify-center overflow-hidden relative shadow-inner">
                            <video src={`/assets/mp4/${item.file}#t=0.1`} className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none" preload="metadata" />
                            <span className="relative z-10 text-white font-black text-xs drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] text-center px-1 break-keep">
                              {item.name}
                            </span>
                          </div>
                          <div className="mt-2 flex justify-center">
                            <button 
                              onClick={() => {
                                sfxClick();
                                setEquippedBg(item.file);
                                flashToast(`${item.name} 테마가 적용되었습니다! 🏞️`);
                              }} 
                              className={`w-full py-1.5 rounded-lg text-xs font-bold ${isSelected ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600 active:scale-95"}`}
                            >
                              {isSelected ? "적용중" : "적용"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* 3. 하단 닫기 버튼 */}
            <div className="flex-none border-t border-gray-200 bg-white p-4 pb-6">
              <button
                type="button"
                onClick={() => {
                  sfxClick();
                  setShowMyPage(false);
                }}
                className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-lg active:scale-95"
              >
                닫기
              </button>
            </div>

          </div>
        </div>
      )}
      {/* ============================ 🛒 포인트 상점 모달 ============================ */}
      {showVault && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="max-h-[80%] w-full max-w-[440px] overflow-hidden rounded-t-3xl border-t border-white/50 bg-yellow-50/95 backdrop-blur-md shadow-2xl flex flex-col">
            
            {/* 상점 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 flex-none border-b border-yellow-400/20">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-zinc-900">🛒 포인트 상점</h3>
                <span className="rounded-full bg-yellow-400/30 px-2 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-500/50">
                  보유: {points.toLocaleString()}P
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  sfxClick();
                  setShowVault(false);
                }}
                className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-lg text-zinc-900 hover:bg-black/10 active:scale-90"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8 cpp-no-scrollbar">
              {/* 💖 하트 즉시 충전 (어떤 탭에서든 고정 노출) */}
              <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">💖</span>
                    <div>
                      <h4 className="text-sm font-black text-zinc-900">하트 즉시 충전</h4>
                      <p className="text-[11px] font-bold text-zinc-500">{HEART_PRICE}P로 하트 1개 충전</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-black text-amber-800">
                    오늘 잔여: {3 - (heartBuyData.date === today() ? heartBuyData.count : 0)}회
                  </span>
                </div>

                <button
                  type="button"
                  onClick={buyHeartWithPoints}
                  className="w-full rounded-xl bg-gradient-to-b from-rose-400 to-rose-500 py-3 text-sm font-black text-white shadow-[0_3px_0_#be123c] active:translate-y-0.5 active:shadow-none"
                >
                  💖 하트 +1 충전하기 ({HEART_PRICE}P)
                </button>
              </div>

              {/* 🌟 상점 카테고리 탭 */}
              <div className="flex gap-1.5 mb-6 pb-2 shrink-0 overflow-x-auto whitespace-nowrap cpp-no-scrollbar">
                <button onClick={() => { sfxClick(); setShopCategory("emoticon"); }} className={`px-2.5 py-2 text-[13px] min-[380px]:px-3 font-black rounded-xl transition-all shadow-sm ${shopCategory === "emoticon" ? "bg-yellow-400 text-yellow-950 ring-2 ring-yellow-500" : "bg-white/60 text-zinc-600"}`}>📸 이모티콘</button>
                <button onClick={() => { sfxClick(); setShopCategory("car"); }} className={`px-2.5 py-2 text-[13px] min-[380px]:px-3 font-black rounded-xl transition-all shadow-sm ${shopCategory === "car" ? "bg-yellow-400 text-yellow-950 ring-2 ring-yellow-500" : "bg-white/60 text-zinc-600"}`}>🏎️ 카트</button>
                <button onClick={() => { sfxClick(); setShopCategory("bg"); }} className={`px-2.5 py-2 text-[13px] min-[380px]:px-3 font-black rounded-xl transition-all shadow-sm ${shopCategory === "bg" ? "bg-yellow-400 text-yellow-950 ring-2 ring-yellow-500" : "bg-white/60 text-zinc-600"}`}>🏞️ 배경</button>
                <button onClick={() => { sfxClick(); setShopCategory("gift"); }} className={`px-2.5 py-2 text-[13px] min-[380px]:px-3 font-black rounded-xl transition-all shadow-sm ${shopCategory === "gift" ? "bg-yellow-400 text-yellow-950 ring-2 ring-yellow-500" : "bg-white/60 text-zinc-600"}`}>🎁 상품권</button>
              </div>

              {/* 📸 이모티콘 구매 탭 */}
              <div style={{ display: shopCategory === "emoticon" ? "block" : "none" }}>
                <p className="mb-4 text-center text-sm font-bold text-zinc-700">
                  마음에 드는 캐릭터 감정 이모티콘을 포인트로 구매해 보세요! 🎨
                </p>

                {/* 🌟 팝업창 (미리보기 / 구매 / 다운로드 통합) */}
                {previewItem && (() => {
                  const itemId = previewItem.file.replace('.png', '');
                  const isOwned = ownedEmoticons && ownedEmoticons.includes(itemId);
                  
                  return (
                    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-yellow-100/95 p-6 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                      <h3 className="mb-2 text-2xl font-black text-zinc-900">{previewItem.title}</h3>
                      <p className="mb-6 text-sm font-bold text-amber-700">내 포인트: {points.toLocaleString()}P</p>

                      {/* 미리보기 이미지 박스 */}
                      <div className={`relative mb-8 h-56 w-56 overflow-hidden rounded-2xl bg-white/80 ring-4 ${isOwned ? 'ring-emerald-400 shadow-emerald-200' : 'ring-yellow-400/80 shadow-yellow-200'} shadow-xl transition-all duration-500`}>
                        <img
                          src={lightImg("emoticons", previewItem.file, "md")}
                          alt="preview"
                          className={`h-full w-full object-cover transition-all duration-500 ${!isOwned ? "opacity-30 grayscale brightness-50 scale-95" : "opacity-100 drop-shadow-md scale-100"}`}
                        />
                        {/* 미구매 시 중앙에 큰 자물쇠 아이콘 표시 */}
                        {!isOwned && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-white text-5xl opacity-80 drop-shadow-lg">🔒</span>
                          </div>
                        )}
                      </div>

                      {/* 버튼 영역 (구매 전/후 자동 스위칭) */}
                      {!isOwned ? (
                        <button
                          type="button"
                          onClick={() => {
                            // 구매 시 함수 호출! (성공하면 isOwned가 true로 바뀌면서 위 이미지와 버튼이 다운로드로 실시간 변신함)
                            buyEmoticon(itemId, previewItem.price, previewItem.title);
                          }}
                          className="w-full max-w-[240px] rounded-full bg-yellow-400 py-3.5 text-lg font-black text-zinc-900 shadow-lg active:scale-95 transition-all"
                        >
                          💰 {previewItem.price}P로 구매하기
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            sfxClick();
                            // 카카오톡 앱 안에서는 저장이 막혀 있어서 다른 브라우저로 여는 방법을 안내
                            if (isKakaoInApp()) {
                              setKakaoGuide(true);
                              return;
                            }
                            const fileName = previewItem.file;
                            const img = new Image();
                            img.crossOrigin = "anonymous";
                            img.onerror = () => flashToast("이미지를 불러오지 못했어요. 잠시 후 다시 시도해 주세요 😥");
                            img.onload = () => {
                              // 원본 고화질 이미지에 닉네임 각인
                              const canvas = document.createElement("canvas");
                              canvas.width = img.width;
                              canvas.height = img.height;
                              const ctx = canvas.getContext("2d");
                              if (!ctx) return;
                              ctx.drawImage(img, 0, 0);
                              const fontSize = Math.max(16, img.width * 0.1);
                              ctx.font = `900 ${fontSize}px 'MaplestoryOTFBold', sans-serif`;
                              ctx.textAlign = "right";
                              ctx.textBaseline = "bottom";
                              ctx.lineWidth = fontSize * 0.2;
                              ctx.strokeStyle = "white";
                              ctx.strokeText(`@${nickname}`, canvas.width - (img.width * 0.05), canvas.height - (img.width * 0.05));
                              ctx.fillStyle = "#333333";
                              ctx.fillText(`@${nickname}`, canvas.width - (img.width * 0.05), canvas.height - (img.width * 0.05));

                              canvas.toBlob(async (blob) => {
                                if (!blob) return;
                                const file = new File([blob], fileName, { type: "image/png" });
                                // 1) 휴대폰: 공유 창 → '이미지 저장'으로 사진첩에 바로 저장 (아이폰/안드로이드)
                                if (isMobileDevice() && navigator.canShare?.({ files: [file] })) {
                                  try {
                                    await navigator.share({ files: [file], title: "카운터 팡팡 이모티콘" });
                                    flashToast("이모티콘 공유 창을 열었어요! '이미지 저장'을 누르면 사진첩에 저장돼요 📸");
                                    setPreviewItem(null);
                                    return;
                                  } catch (e) {
                                    if ((e as Error).name === "AbortError") return; // 사용자가 공유 창을 닫음
                                  }
                                }
                                // 2) 그 외(PC 등): 파일로 다운로드
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = fileName;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                setTimeout(() => URL.revokeObjectURL(url), 2000);
                                flashToast("이모티콘을 다운로드했어요! 📥 (다운로드 폴더를 확인해 주세요)");
                                setPreviewItem(null);
                              }, "image/png");
                            };
                            img.src = `/assets/emoticons/${fileName}`; // 저장은 원본 고화질로
                          }}
                          className="w-full max-w-[240px] rounded-full bg-emerald-400 py-3.5 text-lg font-black text-emerald-950 shadow-lg active:scale-95 transition-all"
                        >
                          📥 닉네임 넣어서 저장하기
                        </button>
                      )}

                      <button
                        onClick={() => { sfxClick(); setPreviewItem(null); }}
                        className="mt-5 text-sm font-bold text-zinc-500 underline active:scale-95"
                      >
                        돌아가기
                      </button>
                    </div>
                  );
                })()}

                <div className="space-y-6">
                  {EMOTICON_PACKS.map(pack => {
                    const isLocked = unlocked < pack.unlockLevel;

                    return (
                      <div key={pack.id} className="rounded-xl bg-yellow-900/5 p-3 ring-1 ring-yellow-900/10">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-bold text-zinc-800">{pack.name} 팩 {isLocked && "🔒"}</h4>
                          {isLocked ? (
                            <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-bold shadow-sm">Lv.{pack.unlockLevel} 해제</span>
                          ) : (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold shadow-sm">단품 각 {pack.price} P</span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-5 gap-2">
                          {EMOTIONS.map(emotion => {
                            const itemId = `${pack.id}_${emotion.id}`;
                            const fileName = `${itemId}.png`;
                            const isOwned = ownedEmoticons && ownedEmoticons.includes(itemId);

                            return (
                              <div key={emotion.id} className="flex flex-col items-center bg-white rounded-lg p-1.5 ring-1 ring-black/5 shadow-sm">
                                {/* 🌟 썸네일 이미지 자체를 클릭해도 팝업이 뜨도록 버튼으로 감싸기 */}
                                <button 
                                  type="button"
                                  disabled={isLocked}
                                  onClick={() => { sfxClick(); setPreviewItem({ title: `${pack.name} (${emotion.name})`, file: fileName, price: pack.price }); }}
                                  className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-slate-50 active:scale-95 transition-transform"
                                >
                                  <img 
                                    src={lightImg("emoticons", fileName, "sm")} 
                                    alt={emotion.name} 
                                    loading="lazy"
                                    decoding="async"
                                    className={`h-full w-full object-cover transition-all duration-300 ${
                                      isLocked 
                                        ? "opacity-10 grayscale" 
                                        : !isOwned 
                                          ? "opacity-30 grayscale brightness-50" 
                                          : "opacity-100 drop-shadow-md"
                                    }`}
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      if (e.currentTarget.nextElementSibling) {
                                        (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                      }
                                    }}
                                  />
                                  <div className="absolute inset-0 hidden items-center justify-center bg-slate-200 text-[9px] font-bold text-slate-500 text-center p-0.5 break-keep">
                                    {emotion.name}
                                  </div>
                                </button>

                                <span className={`text-[10px] font-bold my-1 ${!isOwned ? "text-slate-400" : "text-slate-700"}`}>
                                  {emotion.name}
                                </span>
                                
                                {isLocked ? (
                                  <button disabled className="w-full py-1 rounded text-[9px] font-bold bg-gray-200 text-gray-400 cursor-not-allowed">잠김</button>
                                ) : isOwned ? (
                                  <button 
                                    type="button"
                                    onClick={() => { sfxClick(); setPreviewItem({ title: `${pack.name} (${emotion.name})`, file: fileName, price: pack.price }); }}
                                    className="w-full py-1 rounded text-[9px] font-black bg-emerald-400 text-emerald-950 active:scale-95 shadow-sm transition-transform"
                                  >
                                    다운로드
                                  </button>
                                ) : (
                                  <button 
                                    type="button"
                                    onClick={() => { sfxClick(); setPreviewItem({ title: `${pack.name} (${emotion.name})`, file: fileName, price: pack.price }); }}
                                    className="w-full py-1 rounded text-[9px] font-black bg-yellow-400 text-slate-900 active:scale-95 shadow-sm transition-transform"
                                  >
                                    {pack.price} P
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 🏎️ 카트 구매 탭 */}
              <div style={{ display: shopCategory === "car" ? "block" : "none" }}>
                <div className="grid grid-cols-2 gap-4">
                  {KARTS.map(item => {
                    const isOwned = ownedCars.includes(item.id);
                    const beltLocked = !premium && lifetimePoints < item.minLifetime;
                    return (
                      <div key={item.id} className="relative p-3 rounded-xl border-2 border-slate-200 bg-white">
                        {item.bonus > 0 && <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-black text-amber-950 shadow">정답 보너스 +{item.bonus}%</span>}
                        <div className="h-20 bg-slate-100 rounded-lg mb-2 flex items-center justify-center p-1 overflow-hidden">
                          {item.file ? <img src={lightImg("karts", item.file, "sm")} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-contain drop-shadow-md" /> : <span className="text-xs text-slate-400">기본</span>}
                        </div>
                        <p className="font-bold text-sm text-slate-700 text-center mb-2">{item.name}</p>
                        {isOwned ? (
                          <button disabled className="w-full py-1.5 rounded-lg text-xs font-bold bg-gray-200 text-gray-500">보유중</button>
                        ) : beltLocked ? (
                          <button disabled className="w-full py-1.5 rounded-lg text-[11px] font-bold bg-gray-200 text-gray-500">🔒 {kartNeedLabel(item.minLifetime)} · {item.price.toLocaleString()}P</button>
                        ) : (
                          <button 
                            onClick={() => buyCar(item.id, item.price)} 
                            className="w-full py-1.5 rounded-lg text-xs font-bold bg-yellow-400 text-slate-900 shadow-sm active:scale-95"
                          >
                            {item.price.toLocaleString()} P 구매
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!premium && <p className="mt-3 text-center text-[11px] font-bold text-zinc-500">💎 유료 회원은 띠와 상관없이 모든 카트를 살 수 있어요 (준비 중)</p>}
              </div>

              {/* 🏞️ 배경 구매 탭 */}
              {/* 🎁 캐시 → 모바일 상품권 (서버 연결 전이라 교환 버튼은 '준비 중') */}
              {shopCategory === "gift" && (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-200">
                    <p className="text-xs font-bold text-emerald-600">내 캐시</p>
                    <p className="text-3xl font-black text-emerald-700">{cash.toLocaleString()} C</p>
                    <div className="mx-auto mt-2 h-2.5 w-full max-w-[260px] overflow-hidden rounded-full bg-white ring-1 ring-emerald-200">
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, (cash / ECONOMY.giftCardCash) * 100)}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-emerald-600">
                      {cash >= ECONOMY.giftCardCash ? "교환할 수 있는 캐시가 모였어요! 🎉" : `상품권까지 ${(ECONOMY.giftCardCash - cash).toLocaleString()}C 남음`}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-black text-zinc-800">📱 모바일 상품권 {ECONOMY.giftCardWon.toLocaleString()}원</p>
                        <p className="text-xs font-bold text-zinc-500">{ECONOMY.giftCardCash.toLocaleString()}C · 한 달에 1번</p>
                      </div>
                      <button type="button" disabled className="rounded-xl bg-zinc-200 px-3 py-2 text-xs font-black text-zinc-500">
                        준비 중
                      </button>
                    </div>
                    {!cloud.linked && (
                      <div data-testid="gift-guest" className="mt-3 rounded-lg bg-yellow-50 p-2.5 text-[11px] font-bold leading-relaxed text-yellow-800 ring-1 ring-yellow-200">
                        👤 손님은 {isChild ? "보호자와 연결하기" : "카카오 계정을 연결하기"} 전까지 기프티콘을 받을 수 없어요. 캐시는 그대로 계속 모여요.
                        {canLinkAccount && (
                          <button type="button" onClick={() => { sfxClick(); void cloud.linkKakao(); }} className="mt-2 block w-full rounded-lg bg-[#FEE500] py-2 text-xs font-black text-[#191919]">
                            💬 카카오 계정 연결하기
                          </button>
                        )}
                      </div>
                    )}
                    {isChild && (
                      <p className="mt-3 rounded-lg bg-rose-50 p-2 text-[11px] font-bold text-rose-600">
                        만 {ECONOMY.giftCardMinAge}세 미만은 상품권 교환에 보호자 동의가 필요해서, 지금은 캐시 모으기만 할 수 있어요.
                      </p>
                    )}
                    {cashExchangeMonth === today().slice(0, 7) && (
                      <p className="mt-2 text-[11px] font-bold text-zinc-500">이번 달 교환을 이미 했어요. 다음 달에 다시 교환할 수 있어요.</p>
                    )}
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-4 text-xs font-bold leading-relaxed text-zinc-600 ring-1 ring-zinc-200">
                    <p className="mb-1 text-sm font-black text-zinc-700">💡 캐시는 이렇게 모아요</p>
                    <p>📺 광고 보고 하트 충전 1회 +{ECONOMY.cashPerAd}C</p>
                    <p>💌 친구 초대 1회 +{ECONOMY.cashPerInvite}C</p>
                    <p className="mt-2 text-zinc-400">게임 포인트(P)는 띠 승급·랭킹·아이템용이고, 캐시(C)와는 따로 모여요.</p>
                  </div>
                </div>
              )}

              <div style={{ display: shopCategory === "bg" ? "block" : "none" }}>
                <div className="grid grid-cols-2 gap-4">
                  {BACKGROUNDS.map(item => {
                    const isOwned = ownedBgs.includes(item.file);
                    return (
                      <div key={item.id} className="relative p-3 rounded-xl border-2 border-slate-200 bg-white">
                        {item.bonus > 0 && <span className="absolute right-1.5 top-1.5 z-20 rounded-full bg-emerald-400 px-2 py-0.5 text-[11px] font-black text-emerald-950 shadow">만점 보너스 +{item.bonus}%</span>}
                        <div className="h-20 bg-slate-800 rounded-lg mb-2 flex items-center justify-center overflow-hidden relative shadow-inner">
                          <video src={`/assets/mp4/${item.file}#t=0.1`} className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none" preload="metadata" />
                          <span className="relative z-10 text-white font-black text-xs drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] px-1 text-center break-keep">{item.name}</span>
                        </div>
                        <div className="mt-2">
                          {isOwned ? (
                            <button disabled className="w-full py-1.5 rounded-lg text-xs font-bold bg-gray-200 text-gray-500">보유중</button>
                          ) : (
                            <button 
                              onClick={() => buyBackground(item.file, item.price)} 
                              className="w-full py-1.5 rounded-lg text-xs font-bold bg-yellow-400 text-slate-900 shadow-sm active:scale-95"
                            >
                              {item.price.toLocaleString()} P 구매
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
      {/* ============================ 🥋 승급 축하 연출 (그랄: '축' / 띠: Congratulations) ============================ */}
      {/* ============================ 🎂 기존 회원 연령 확인 (태어난 해가 없을 때 한 번만) ============================ */}
      {showGuardianLink && (
        <GuardianLink
          childNickname={nickname ?? "아이"}
          busy={cloud.busy}
          onClose={() => setShowGuardianLink(false)}
          onSubmit={(g, items) => { sfxClick(); void cloud.linkWithGuardian(g, items); }}
        />
      )}
      {/* ☁️ 연결 완료 안내 */}
      {cloud.linkedPopup && !cloud.conflict && (
        <div data-testid="cloud-linked" className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm" onClick={cloud.closeLinkedPopup}>
          <div className="w-full max-w-[330px] rounded-3xl bg-white p-6 text-center shadow-2xl cpp-pop" onClick={(e) => e.stopPropagation()}>
            <p className="text-5xl">✅</p>
            <h2 className="mt-2 text-xl font-black text-zinc-900">카카오 계정과 연결됐어요</h2>
            <p className="mt-3 rounded-xl bg-yellow-50 px-3 py-2.5 text-sm font-black text-slate-800 ring-1 ring-yellow-200">
              💬 {cloud.kakaoName ?? "카카오 계정"}
            </p>
            <p className="mt-3 text-sm font-bold leading-relaxed text-zinc-600">{cloud.linkedPopup}</p>
            <p className="mt-1 text-xs font-bold leading-relaxed text-zinc-500">
              이제 게임 기록이 서버에 자동으로 저장돼요. 다른 휴대폰에서도 이 카카오 계정으로 연결하면 이어서 할 수 있어요.
            </p>
            <button type="button" onClick={() => { sfxClick(); cloud.closeLinkedPopup(); }} className="mt-5 w-full rounded-2xl bg-emerald-500 py-3 text-base font-black text-white">
              확인
            </button>
          </div>
        </div>
      )}
      {/* ☁️ 기록 고르기: 처음 연결할 때 서버에도 기록이 있으면 */}
      {cloud.conflict && (
        <div data-testid="cloud-conflict" className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm">
          <div className="w-full max-w-[360px] rounded-3xl bg-white p-5 shadow-2xl cpp-pop">
            <p className="text-center text-3xl">☁️</p>
            <h2 className="mt-1 text-center text-lg font-black text-zinc-900">어떤 기록으로 할까요?</h2>
            <p className="mt-1 text-center text-xs font-bold leading-relaxed text-zinc-500">
              이 카카오 계정에는 이미 서버 기록이 있어요. 하나를 고르면 <b className="text-rose-500">다른 하나는 사라져요.</b>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {([["local", "📱 이 휴대폰 기록", cloud.conflict.local], ["server", "☁️ 서버 기록", cloud.conflict.server]] as const).map(([key, label, sm]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { sfxClick(); void cloud.resolveConflict(key); }}
                  className="rounded-2xl bg-slate-50 p-3 text-left ring-2 ring-slate-200 active:scale-[0.98] active:ring-emerald-400"
                >
                  <p className="text-xs font-black text-slate-500">{label}</p>
                  <p className="mt-1 truncate text-sm font-black text-slate-800">{sm.nickname}</p>
                  <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-600">
                    {sm.belt}<br />
                    누적 {sm.lifetimePoints.toLocaleString()}P<br />
                    보유 {sm.points.toLocaleString()}P · {sm.cash.toLocaleString()}C<br />
                    Lv.{sm.levels}까지 열림
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-slate-400">
                    {sm.when ? new Date(sm.when).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "저장 시각 모름"}
                  </p>
                  <p className="mt-2 rounded-lg bg-emerald-500 py-1.5 text-center text-xs font-black text-white">이걸로 할래요</p>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { sfxClick(); void cloud.resolveConflict("cancel"); }}
              className="mt-3 w-full rounded-2xl bg-slate-100 py-2.5 text-sm font-black text-slate-600"
            >
              연결하지 않기
            </button>
          </div>
        </div>
      )}
      {loaded && nickname && birthYear === null && screen === "LOBBY" && !showTutorial && (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
          <div className="w-full max-w-[320px] rounded-3xl bg-white p-6 text-center shadow-2xl cpp-pop">
            <p className="text-4xl">🎂</p>
            <h2 className="mt-2 text-xl font-black text-zinc-900">태어난 해를 알려 주세요</h2>
            <p className="mt-2 text-sm font-bold text-zinc-500">나이에 맞는 화면과 광고를 보여 드리기 위해 한 번만 물어봐요.</p>
            <select
              aria-label="태어난 해"
              value={birthInput}
              onChange={(e) => setBirthInput(e.target.value)}
              className="mt-4 w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-lg font-bold text-zinc-800 focus:outline-none focus:ring-4 focus:ring-yellow-400/50"
            >
              <option value="">선택해 주세요</option>
              {BIRTH_YEARS.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!birthInput}
              onClick={() => { sfxClick(); setBirthYear(Number(birthInput)); }}
              className="mt-4 w-full rounded-2xl bg-gradient-to-b from-yellow-300 to-amber-400 py-3.5 text-base font-black text-amber-950 shadow-[0_4px_0_#b45309] active:translate-y-0.5 disabled:opacity-40"
            >
              확인
            </button>
          </div>
        </div>
      )}
      {/* ============================ 📲 홈 화면에 추가 안내 ============================ */}
      {installGuide && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm" onClick={() => setInstallGuide(null)}>
          <div className="w-full max-w-[320px] rounded-3xl bg-white p-6 text-center shadow-2xl cpp-pop" onClick={(e) => e.stopPropagation()}>
            <img src="/icon-192.png" alt="" className="mx-auto h-16 w-16 rounded-2xl shadow" />
            {installGuide === "done" && (
              <>
                <h2 className="mt-3 text-xl font-black text-zinc-900">이미 앱으로 쓰고 있어요! ✅</h2>
                <p className="mt-2 text-sm font-bold text-zinc-500">홈 화면의 카운터 팡팡 아이콘으로 실행 중이에요.</p>
              </>
            )}
            {installGuide === "ios" && (
              <>
                <h2 className="mt-3 text-xl font-black text-zinc-900">아이폰에서 추가하기</h2>
                <ol className="mt-3 space-y-2 text-left text-sm font-bold text-zinc-600">
                  <li>① 사파리 화면 아래 <b className="text-sky-600">공유 버튼 (⬆️)</b>을 눌러요</li>
                  <li>② 목록에서 <b className="text-sky-600">&lsquo;홈 화면에 추가&rsquo;</b>를 눌러요</li>
                  <li>③ 오른쪽 위 <b className="text-sky-600">&lsquo;추가&rsquo;</b>를 누르면 끝!</li>
                </ol>
                <p className="mt-3 text-xs font-bold text-zinc-400">※ 사파리에서만 할 수 있어요</p>
              </>
            )}
            {installGuide === "kakao" && (
              <>
                <h2 className="mt-3 text-xl font-black text-zinc-900">카카오톡 안에서는<br />추가할 수 없어요</h2>
                <p className="mt-2 text-sm font-bold text-zinc-500">크롬(안드로이드)이나 사파리(아이폰)로 연 다음<br />다시 이 버튼을 눌러 주세요.</p>
                <button
                  type="button"
                  onClick={() => { window.location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(window.location.href); }}
                  className="mt-4 w-full rounded-2xl bg-yellow-300 py-3 text-base font-black text-zinc-900 active:scale-95"
                >
                  다른 브라우저로 열기
                </button>
              </>
            )}
            {installGuide === "other" && (
              <>
                <h2 className="mt-3 text-xl font-black text-zinc-900">홈 화면에 추가하기</h2>
                <ol className="mt-3 space-y-2 text-left text-sm font-bold text-zinc-600">
                  <li>① 브라우저 오른쪽 위(또는 아래)의 <b className="text-sky-600">메뉴 (⋮ 또는 ≡)</b>를 눌러요</li>
                  <li>② <b className="text-sky-600">&lsquo;홈 화면에 추가&rsquo;</b> 또는 <b className="text-sky-600">&lsquo;앱 설치&rsquo;</b>를 눌러요</li>
                </ol>
              </>
            )}
            <button type="button" onClick={() => setInstallGuide(null)} className="mt-5 text-sm font-bold text-zinc-500 underline">닫기</button>
          </div>
        </div>
      )}
      {/* ============================ 📱 카카오톡 앱 안 브라우저 안내 ============================ */}
      {kakaoGuide && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm" onClick={() => setKakaoGuide(false)}>
          <div className="w-full max-w-[320px] rounded-3xl bg-white p-6 text-center shadow-2xl cpp-pop" onClick={(e) => e.stopPropagation()}>
            <p className="text-4xl">📱</p>
            <h2 className="mt-2 text-xl font-black text-zinc-900">카카오톡 안에서는<br />저장이 안 돼요</h2>
            <p className="mt-3 text-sm font-bold leading-relaxed text-zinc-500">
              크롬·사파리 같은 <b className="text-zinc-700">다른 브라우저</b>로 열면<br />이모티콘을 저장할 수 있어요.
              <br />(구매한 이모티콘은 이 휴대폰의 다른 브라우저에선 보이지 않을 수 있어요)
            </p>
            <button
              type="button"
              onClick={() => {
                window.location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(window.location.href);
              }}
              className="mt-5 w-full rounded-2xl bg-yellow-300 py-3.5 text-base font-black text-zinc-900 active:scale-95"
            >
              다른 브라우저로 열기
            </button>
            <p className="mt-3 text-xs font-bold text-zinc-400">안 되면: 화면 아래 ⋮ 버튼 → &lsquo;다른 브라우저로 열기&rsquo;</p>
            <button type="button" onClick={() => setKakaoGuide(false)} className="mt-4 text-sm font-bold text-zinc-500 underline">닫기</button>
          </div>
        </div>
      )}
      {/* ============================ 🎓 튜토리얼 (Lv.0 게임 방법) ============================ */}
      {showTutorial && (
        <Tutorial
          playClick={sfxClick}
          onSkip={() => {
            // 건너뛰기: Lv.1은 열어주고 보상/별은 없음
            setShowTutorial(false)
            if (unlocked < 1) flashToast("Lv.1이 열렸어요! 언제든 Lv.0에서 다시 볼 수 있어요 📖")
            setUnlocked((u) => Math.max(u, 1))
          }}
          onFinish={() => {
            setShowTutorial(false)
            setUnlocked((u) => Math.max(u, 1))
            if ((records[0] ?? 0) < PASS_LINE) {
              // 처음 끝까지 본 경우에만 ⭐ + 5P (테스트 단계 값, 출시 전 조정 예정)
              setRecords((r) => ({ ...r, 0: TOTAL_Q }))
              setPoints((pt) => pt + 5)
              flashToast("게임 방법 완료! ⭐ +5P, Lv.1이 열렸어요 🎉")
            }
          }}
        />
      )}
      {showPromotionModal && promotionBelt && (
        <PromotionCelebration
          from={promotionBelt.from}
          to={promotionBelt}
          onClose={() => {
            playSound('/assets/피버타임.mp3');
            sfxClick();
            setShowPromotionModal(false);
          }}
        />
      )}
      {/* ============================ 🚨 앱 종료 연출 모달 (순수 UI 버튼 작업) ============================ */}
        {exitPhase && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
            <div className="w-full max-w-[320px] rounded-3xl bg-white p-6 text-center shadow-2xl">
              
              {/* 1단계 팝업: 물어보기 */}
              {exitPhase === "ask" ? (
                <>
                  <h2 className="mb-6 mt-2 text-2xl font-black text-zinc-900">종료하시겠습니까?</h2>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        sfxClick();
                        setExitPhase("goodbye"); // 2단계 작별인사로 넘어가기
                      }}
                      className="flex-1 rounded-2xl bg-rose-500 py-3.5 text-lg font-black text-white shadow-[0_4px_0_#be123c] active:translate-y-1 active:shadow-none"
                    >
                      네
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sfxClick();
                        setExitPhase(null); // 팝업 닫기 (로비/메인으로 복귀)
                      }}
                      className="flex-1 rounded-2xl bg-gray-200 py-3.5 text-lg font-black text-gray-700 shadow-[0_4px_0_#9ca3af] active:translate-y-1 active:shadow-none"
                    >
                      아니요
                    </button>
                  </div>
                </>
              ) : (
                /* 2단계 팝업: 작별인사 */
                <>
                  <GameImage
                    src="/assets/car.png"
                    alt="자동차"
                    fallback={<span style={{ fontSize: "4rem" }}>🚕</span>}
                    className="mx-auto mb-4 h-24 w-24 object-contain"
                  />
                  <p className="mb-6 text-lg font-bold text-zinc-800 leading-snug">
                    실제 자동차 번호판을 보고도<br/>숫자놀이 해보세요^^
                  </p>
                 <button
                    type="button"
                    onClick={() => {
                      sfxClick();
                      setExitPhase(null);
                      
                      // 🚨 모바일 웹앱 강제 종료 마스터 로직 (카톡/네이버/일반 브라우저 모두 대응)
                      const ua = navigator.userAgent.toLowerCase();
                      
                      if (ua.indexOf('kakaotalk') > -1) {
                        // 1. 카카오톡을 타고 들어왔을 때: 카톡 창 자체를 부수고 나감
                        window.location.href = 'kakaotalk://inappbrowser/close';
                      } else if (ua.indexOf('naver') > -1) {
                        // 2. 네이버를 타고 들어왔을 때: 네이버 창 강제 종료
                        window.location.href = 'naversearchapp://inappbrowser/close';
                      } else {
                        // 3. 삼성인터넷, 크롬, 사파리 등 일반 브라우저
                        // 브라우저 탭 자체를 끌 수는 없으므로, 앱 방문 기록을 지우고 껍데기만 남은 '하얀 빈 화면'으로 강제로 던져버립니다.
                        window.history.go(-100);
                        setTimeout(() => {
                          window.open('about:blank', '_self');
                          window.close();
                        }, 100);
                      }
                    }}
                    className="w-full rounded-2xl bg-amber-400 py-3.5 text-lg font-black text-amber-950 shadow-[0_4px_0_#b45309] active:translate-y-1 active:shadow-none"
                  >
                    확인
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}