"use client"
import React from 'react';
// 

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/* =========================================================================
   카운터 팡팡 — 초등학생 대상 캐주얼 사칙연산 퀴즈 모바일 웹 게임
   플로우: INTRO -> LOGIN -> LOBBY -> GAME -> RESULT
   ========================================================================= */

type Screen = "INTRO" | "LOGIN" | "LOBBY" | "GAME" | "RESULT"
type QType = "numpad" | "compare" | "partition"
type Reaction = "idle" | "correct" | "wrong"

interface SaveData {
  nickname: string | null
  hearts: number
  heartDate: string
  unlocked: number
  records: Record<number, number>
  muted: boolean
  points: number // 👈 포인트 저장 공간 추가!
}

interface Question {
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
}

const STORAGE_KEY = "counter-pang-pang-v1"
const TOTAL_Q = 15
const PASS_LINE = 13
const MAX_LEVEL = 11
const HEART_CAP = 10

const HANGUL = ["가", "나", "다", "라", "마", "거", "너", "더", "러", "머", "바", "사", "아", "자", "하", "호"]

const LEVEL_NAMES: Record<number, string> = {
  0: "앞자리 팡팡",
  1: "앞자리 팡팡",
  2: "뒷자리 팡팡",
  3: "구형 완전정복",
  4: "신형 완전정복",
  5: "앞뒤 비교왕",
  6: "앞뒤 차이왕",
  7: "홀짝 마법사",
  8: "숨은 숫자 탐정",
  9: "이등분 퍼즐",
  10: "불빛 곱셈",
  11: "그랜드 마스터",
}

const LEVEL_TIMER: Record<number, number> = {
  0: 15,
  1: 15,
  2: 15,
  3: 20,
  4: 20,
  5: 15,
  6: 20,
  7: 18,
  8: 20,
  9: 30,
  10: 18,
  11: 20,
}

const FACE_EMOJI = ["🐣", "🐥", "🐤", "🦆", "🐦", "🦉", "🦜", "🦢", "🕊️", "🦅", "🦩", "👑"]

/* ----------------------------- 유틸 ----------------------------- */
const ri = (max: number) => Math.floor(Math.random() * max)
const rd = () => ri(10)
const mkDigits = (n: number) => Array.from({ length: n }, rd)
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const today = () => new Date().toISOString().slice(0, 10)

function canSplitEven(arr: number[]) {
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

function pickDistinct(count: number, poolSize: number) {
  const idx = Array.from({ length: poolSize }, (_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = ri(i + 1)
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx.slice(0, count).sort((a, b) => a - b)
}

function buildQuestion(chosenLevel: number, index: number): Question {
  // 그랜드 마스터는 매 문제 Lv1~10 무작위, 그 외엔 선택 레벨(0은 1과 동일 로직)
  const logic = chosenLevel === 11 ? 1 + ri(10) : chosenLevel === 0 ? 1 : chosenLevel
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
    case 9: {
      const { front, back } = base(2 + ri(2))
      const all = [...front, ...back]
      return {
        level: logic, front, back, hangul, type: "partition", timer,
        title: "이등분 퍼즐", desc: "숫자를 골라 두 그룹의 합을 같게 만드세요",
        answer: null, canPartition: canSplitEven(all),
      }
    }
    case 10:
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

function exampleText(q: Question) {
  if (q.type === "compare") return q.answer === "front" ? "앞이 큼" : q.answer === "back" ? "뒤가 큼" : "같음"
  if (q.type === "partition") return q.canPartition ? "이등분 가능 (숫자 선택 후 제출)" : "이등분 불가"
  return String(q.answer)
}

/* ------------------------ 이미지 (폴백 포함) ------------------------ */
function GameImage({
  src,
  alt,
  fallback,
  className,
  style,
}: {
  src: string
  alt: string
  fallback: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const [err, setErr] = useState(false)
  useEffect(() => setErr(false), [src])
  if (!err && src) {
    return (
      <img
        src={src || "/placeholder.svg"}
        alt={alt}
        className={className}
        style={style}
        draggable={false}
        onError={() => setErr(true)}
      />
    )
  }
  return (
    <div
      className={cn(className, "flex items-center justify-center leading-none select-none overflow-hidden")}
      style={style}
      role="img"
      aria-label={alt}
    >
      {fallback}
    </div>
  )
}

/* ----------------------------- 번호판 ----------------------------- */
function Plate({
  q,
  selected,
  onToggle,
}: {
  q: Question
  selected?: number[]
  onToggle?: (i: number) => void
}) {
  const litSet = useMemo(() => new Set(q.lit ?? []), [q.lit])
  const selSet = useMemo(() => new Set(selected ?? []), [selected])
  const combined = [...q.front, ...q.back]

  const cell = (d: number, gi: number, edge: boolean) => {
    const hidden = q.hiddenPos === gi
    const lit = litSet.has(gi)
    const sel = selSet.has(gi)
    const clickable = !!onToggle
    const content = hidden ? "?" : d
    const classes = cn(
      "grid place-items-center rounded-lg font-black tabular-nums transition-all duration-150",
      "h-11 w-8 sm:h-12 sm:w-9 text-2xl sm:text-3xl",
      "shadow-[inset_0_-3px_0_rgba(0,0,0,0.25),0_2px_4px_rgba(0,0,0,0.3)]",
      hidden
        ? "bg-rose-500 text-white animate-pulse"
        : lit
          ? "bg-red-500 text-white animate-pulse ring-2 ring-red-300 shadow-lg"
          : sel
            ? "bg-sky-400 text-white ring-2 ring-sky-200 scale-105"
            : "bg-white text-zinc-900",
      clickable && "active:scale-95 cursor-pointer",
    )
    if (clickable) {
      return (
        <button
          key={`${edge}-${gi}`}
          type="button"
          onClick={() => onToggle?.(gi)}
          className={classes}
          aria-pressed={sel}
        >
          {content}
        </button>
      )
    }
    return (
      <span key={`${edge}-${gi}`} className={classes}>
        {content}
      </span>
    )
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-2xl border-4 border-zinc-900/80 bg-gradient-to-b from-amber-300 to-amber-400 px-2.5 py-2 shadow-[0_8px_0_rgba(0,0,0,0.35),0_12px_20px_rgba(0,0,0,0.4)]">
      <div className="flex gap-1">{q.front.map((d, i) => cell(d, i, false))}</div>
      <span className="px-0.5 text-2xl sm:text-3xl font-black text-zinc-900">{q.hangul}</span>
      <div className="flex gap-1">{q.back.map((d, i) => cell(d, q.front.length + i, true))}</div>
    </div>
  )
}

/* ------------------------------ 넘패드 ------------------------------ */
function Numpad({
  value,
  onKey,
  onBackspace,
  onSubmit,
  disabled,
}: {
  value: string
  onKey: (k: string) => void
  onBackspace: () => void
  onSubmit: () => void
  disabled: boolean
}) {
  const keyBtn =
    "select-none rounded-2xl bg-white/90 text-zinc-900 text-2xl font-black shadow-[0_4px_0_rgba(0,0,0,0.25)] active:translate-y-0.5 active:shadow-[0_1px_0_rgba(0,0,0,0.25)] disabled:opacity-40 transition-all"
  return (
    <div className="grid grid-cols-3 gap-2">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
        <button key={n} type="button" disabled={disabled} onClick={() => onKey(String(n))} className={cn(keyBtn, "py-2.5")}>
          {n}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={onBackspace}
        className={cn(keyBtn, "py-2.5 bg-rose-200 text-rose-800 text-lg")}
        aria-label="지움"
      >
        ⌫
      </button>
      <button key={0} type="button" disabled={disabled} onClick={() => onKey("0")} className={cn(keyBtn, "py-2.5")}>
        0
      </button>
      <button
        type="button"
        disabled={disabled || value.length === 0}
        onClick={onSubmit}
        className={cn(keyBtn, "py-2.5 bg-emerald-300 text-emerald-950 text-lg")}
        aria-label="입력"
      >
        입력
      </button>
    </div>
  )
}

/* =========================================================================
   메인 앱 컴포넌트
   ========================================================================= */
export default function CounterPangPang() {
  
  
  // (그 아래로는 BGM 코드 등이 이어집니다)

  
  // ▼▼▼ 14곡 랜덤 무한 재생 BGM 코드 ▼▼▼
  React.useEffect(() => {
    // 1. 1부터 14까지의 숫자를 만들고 무작위로 섞어주는 마법의 함수 (피셔-예이츠 셔플)
    const shuffleArray = (array: number[]) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };

    // 2. 플레이리스트 생성 및 초기 세팅
    let playlist = shuffleArray(Array.from({ length: 14 }, (_, i) => i + 1));
    let currentIndex = 0;
    
    // 첫 번째 곡 세팅
    let currentAudio = new Audio(`/assets/bgm${playlist[currentIndex]}.mp3`);
    currentAudio.volume = 0.3; // 볼륨 크기 (0.3이 적당합니다)
    
    // ▼▼▼ 이 한 줄을 꼭 추가해 주세요! (버튼과 음악을 연결해 줍니다) ▼▼▼
    (window as any).globalBgm = currentAudio;
   

    // 3. 한 곡이 끝났을 때 다음 곡으로 부드럽게 넘기는 함수
    const playNext = () => {
      currentIndex++;
      
      // 만약 14곡을 다 들었다면? -> 다시 새롭게 섞어서 처음부터 무한 반복!
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
  const [points, setPoints] = useState(0);
  const [isFever, setIsFever] = useState(false);
  const [fastCombo, setFastCombo] = useState(0);

  React.useEffect(() => {
    const drivingSound = new Audio('/assets/driving.mp3');
    drivingSound.loop = true; 
    drivingSound.volume = 0.4; 

    if (screen === "GAME") {
      drivingSound.play().catch(e => console.log("주행 소리 재생 대기"));
    } else {
      drivingSound.pause(); 
    }

    // ▼▼▼ 화면 밖으로 나가면 주행 소리 끄기 추가 ▼▼▼
    const handleVis = () => {
      if (document.hidden) {
        drivingSound.pause();
      } else if (screen === "GAME") {
        drivingSound.play().catch(e => console.log("주행 소리 재생 대기"));
      }
    };
    document.addEventListener("visibilitychange", handleVis);
    // ▲▲▲ 여기까지 ▲▲▲

    return () => {
      drivingSound.pause();
      document.removeEventListener("visibilitychange", handleVis); // 정리 코드 추가
    };
  }, [screen]);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // ▼▼▼ 10장 세트 ZIP 압축 다운로드 & 워터마크 기능 ▼▼▼
  const downloadLevelPack = async (level: number) => {
    // 1. 압축 파일 만들기 준비
    const JSZip = (await import("jszip")).default;
    const { saveAs } = await import("file-saver");
    const zip = new JSZip();
    const folder = zip.folder(`Pangi_Lv_${level}`);

    if (!folder) return;

    // 2. 안내 메시지 (압축 중...)
    alert(`Lv.${level} 이모티콘 10종 세트를 준비 중입니다! 잠시만 기다려주세요 🎁`);

    // 3. 10개의 이미지를 불러와서 캔버스에 닉네임 박은 뒤 ZIP에 쏙쏙 담기
    for (let i = 1; i <= 10; i++) {
      await new Promise<void>((resolve) => {
        const imageUrl = `/assets/${level}-${i}.png`;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve();

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          // 워터마크 (두꺼운 고딕체)
          ctx.font = "bold 80px 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";
          ctx.textAlign = "center";
          ctx.lineWidth = 10;
          ctx.strokeStyle = "white"; 
          ctx.fillStyle = "black";

          const text = nickname ? `${nickname}` : "GUEST";
          const x = canvas.width / 2;
          const y = canvas.height * 0.8; 

          ctx.strokeText(text, x, y);
          ctx.fillText(text, x, y);

          // 캔버스 이미지를 바이너리(Blob) 데이터로 변환해서 zip 폴더에 추가
          canvas.toBlob((blob) => {
            if (blob) {
              folder.file(`pangi_lv${level}_${i}.png`, blob);
            }
            resolve();
          }, "image/png");
        };
        img.onerror = () => resolve();
        img.src = imageUrl;
      });
    }

    // 4. 10장이 모두 담기면 ZIP 파일로 묶어서 한 번에 다운로드 실행!
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `Pangi_Level_${level}_Emoticons.zip`);
  };
  // ▲▲▲ 여기까지 ▲▲▲
  // 게임 상태
  const [chosenLevel, setChosenLevel] = useState(0)
  // 화면이 처음 켜질 때, 저장된 레벨이 있으면 불러오기
  useEffect(() => {
    const savedLevel = localStorage.getItem("pangpang_level");
    if (savedLevel) {
      setChosenLevel(parseInt(savedLevel, 10));
    }
  }, []);

  // 레벨이 변할 때마다 영구 기억 장치에 자동으로 덮어쓰기
  useEffect(() => {
    localStorage.setItem("pangpang_level", chosenLevel.toString());
  }, [chosenLevel]);
  useEffect(() => {
    const savedLevel = localStorage.getItem("pangpang_level");
    if (savedLevel) {
      setChosenLevel(parseInt(savedLevel, 10));
    }
  }, []);

  // 레벨이 변할 때마다 영구 기억 장치에 자동으로 덮어쓰기
  useEffect(() => {
    localStorage.setItem("pangpang_level", chosenLevel.toString());
  }, [chosenLevel]);
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
  const [finalScore, setFinalScore] = useState(0)
  const [resultPhase, setResultPhase] = useState<"boom" | "cheer">("boom")

  // 기타 UI
  const [nickInput, setNickInput] = useState("")
  const [showVault, setShowVault] = useState(false)
  const [showAttendance, setShowAttendance] = useState(false);
  const [attData, setAttData] = useState({ date: "", weekCount: 0, lastMonday: "" });

  // 이번 주 월요일 날짜 구하기 (주간 초기화용)
  const getMonday = (d = new Date()) => {
    const dt = new Date(d);
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(dt.setDate(diff)).toISOString().slice(0, 10);
  };

  useEffect(() => {
    const saved = localStorage.getItem("cp_attendance");
    const currentMonday = getMonday();
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.lastMonday !== currentMonday) {
        setAttData({ date: "", weekCount: 0, lastMonday: currentMonday });
      } else {
        setAttData(parsed);
      }
    } else {
      setAttData({ date: "", weekCount: 0, lastMonday: currentMonday });
    }
  }, []);

  const handleAttendance = () => {
    sfxClick();
    const todayStr = today();
    if (attData.date === todayStr) {
      flashToast("오늘은 이미 출석했어요! 내일 또 만나요 👋");
      return;
    }

    const newCount = attData.weekCount + 1;
    let bonus = 0;
    if (newCount === 3) bonus = 5;
    else if (newCount === 5) bonus = 10;
    else if (newCount === 7) bonus = 20;

    const totalReward = 5 + bonus;
    setPoints(p => p + totalReward);
    
    const newData = { date: todayStr, weekCount: newCount, lastMonday: attData.lastMonday };
    setAttData(newData);
    localStorage.setItem("cp_attendance", JSON.stringify(newData));

    if (bonus > 0) {
      flashToast(`주 ${newCount}회 출석 달성! 보너스 포함 ${totalReward}P 획득 🎉`);
    } else {
      flashToast(`출석 완료! 5P 획득 🎁`);
    }
    setShowAttendance(false);
  };
  const [toast, setToast] = useState<string | null>(null)
  {/* 🌟 2줄: 포인트 창 + 출석체크 + 포인트 상점 */}
          <div className="mt-2 flex w-full items-center gap-2">
            <div className="flex w-20 items-center justify-center gap-1 rounded-2xl bg-yellow-300/60 py-2.5 text-sm font-bold text-black/80">
              {points}P
            </div>

            <button
              type="button"
              onClick={() => {
                sfxClick();
                setShowAttendance(true);
              }}
              className="flex flex-[2] items-center justify-center gap-1 rounded-2xl bg-emerald-400/80 py-2.5 text-sm font-bold text-emerald-950 active:scale-95"
            >
              📅 출석체크
            </button>

            <button
              type="button"
              onClick={() => {
                sfxClick();
                setShowVault(true);
              }}
              className="flex flex-[3] items-center justify-center gap-2 rounded-2xl bg-yellow-300/60 py-2.5 text-sm font-bold text-black/80 active:scale-95"
            >
              🛒 포인트 상점
            </button>
          </div>
// --- 📥 다운로드 미리보기 상태 ---
  const [previewItem, setPreviewItem] = useState<{lv: number, idx: number, price: number} | null>(null);
  // --- 💌 초대하기 및 일일 보상 시스템 ---
  const [inviteCount, setInviteCount] = useState(0);

  // 날짜가 바뀌면 초대 횟수 자동 초기화
  useEffect(() => {
    const todayStr = new Date().toLocaleDateString();
    const savedInvite = localStorage.getItem('cp_invite');
    if (savedInvite) {
      const { date, count } = JSON.parse(savedInvite);
      if (date === todayStr) {
        setInviteCount(count);
      } else {
        setInviteCount(0); 
      }
    }
  }, []);

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
      setInviteCount(newCount);
      setPoints(prev => prev + 30);
      localStorage.setItem('cp_invite', JSON.stringify({ date: new Date().toLocaleDateString(), count: newCount }));
      
      // 알림이 겹치지 않게 살짝 시간차를 두고 보상 알림 띄우기
      setTimeout(() => flashToast(`초대 성공! 30P 지급 완료 🎁 (오늘 ${newCount}/5회)`), 1000);
    } catch (error) {
      console.log('공유 취소 또는 에러:', error);
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
          h = 5
          hd = today()
        }
        setNickname(d.nickname ?? null)
        setHearts(h)
        setHeartDate(hd)
        setUnlocked(d.unlocked ?? 0)
       setRecords(d.records ?? {})
        setMuted(!!d.muted)
        setPoints(d.points ?? 0) // 👈 앱을 켤 때 저장된 포인트 불러오기!
        if (d.nickname) setScreen("INTRO")
      }
    } catch {
      /* ignore */
    }
    setLoaded(true)
  }, [])

  // 📱 1. 앱이 처음 켜질 때 브라우저 히스토리에 가짜 기록을 밀어넣어 앱 종료 방지
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
  }, []);

  // 📱 2. 스마트폰 뒤로가기 버튼(하드웨어) 제어 로직
  useEffect(() => {
    const handlePopState = () => {
      // 최우선 순위: 이모티콘 팝업(미리보기)이 열려있다면 그것만 닫기
      if (previewItem) {
        setPreviewItem(null);
        window.history.pushState(null, "", window.location.href); // 방어막 재구축
        return;
      }
      
      // 두 번째 순위: 상점이나 출석체크 창이 열려있다면 그것만 닫기
      if (showVault || showAttendance) {
        setShowVault(false);
        setShowAttendance(false);
        window.history.pushState(null, "", window.location.href); // 방어막 재구축
        return;
      }

      // 열려있는 팝업이 없을 때만 이전 화면으로 이동 처리
      setScreen((prevScreen) => {
        if (prevScreen === "GAME" || prevScreen === "RESULT") {
          window.history.pushState(null, "", window.location.href);
          return "LOBBY";
        } else if (prevScreen === "LOBBY" || prevScreen === "LOGIN") {
          window.history.pushState(null, "", window.location.href);
          return "INTRO";
        }
        return prevScreen;
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showVault, showAttendance, previewItem]);

  /* --------------------- 사운드 --------------------- */
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
  const sfxRight = useCallback(() => {
      new Audio('/assets/정답.mp3').play().catch(e => console.log('재생 에러:', e));
    }, []);
    const sfxWrong = useCallback(() => {
      new Audio('/assets/오답.mp3').play().catch(e => console.log('재생 에러:', e));
    }, []);

  const flashToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1600)
  }, [])

  /* --------------------- 게임 진행 --------------------- */
  const currentQ = questions[qIndex]
  const isExample = qIndex < 3
// --- 🎵 피버타임 진입 효과음 ---
  useEffect(() => {
    if (isFever) {
      new Audio('/assets/피버타임.mp3').play().catch(e => console.log('재생 에러:', e));
    }
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

  const finishGame = useCallback(() => {
    const score = correctRef.current
    const ok = score >= PASS_LINE
    setFinalScore(score)
    setPassed(ok)
    setResultPhase("boom")
    if (ok) {
        setRecords((r) => ({ ...r, [chosenLevel]: Math.max(r[chosenLevel] ?? 0, score) }))
        if (chosenLevel < MAX_LEVEL) setUnlocked((u) => Math.max(u, chosenLevel + 1))
        
        // 레벨 패스 보너스 지급 (레벨0: 5점, 레벨1: 30점 ~ 최대 110점)
        const bonus = chosenLevel === 0 ? 5 : Math.min(20 + (chosenLevel * 10), 110);
        setPoints(prev => prev + bonus);
      }
    setScreen("RESULT")
  }, [chosenLevel])

  const advance = useCallback(() => {
    const next = qIndexRef.current + 1
    if (next >= TOTAL_Q) {
      finishGame()
    } else {
      setQIndex(next)
    }
  }, [finishGame])

  const resolve = useCallback(
    (isCorrect: boolean) => {
      if (locked) return
      setLocked(true)
      if (isCorrect) {
        correctRef.current += 1
        setCorrectCount(correctRef.current)
        setReaction("correct")
        sfxRight()
      } else {
        setReaction("wrong")
        sfxWrong()
      }
      setTimeout(advance, 950)
    },
    [locked, advance, sfxRight, sfxWrong],
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
  useEffect(() => {
    if (isFever && currentQ && timeLeft < currentQ.timer * (2 / 3)) {
      setIsFever(false);
      setFastCombo(0);
    }
  }, [timeLeft, isFever, currentQ]);
  const startLevel = useCallback(
    (level: number) => {
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
      const qs = Array.from({ length: TOTAL_Q }, (_, i) => buildQuestion(level, i))
      correctRef.current = 0
      qIndexRef.current = 0
      setChosenLevel(level)
      setQuestions(qs)
      setQIndex(0)
    setCorrectCount(0)
    setIsFever(false) // 새 게임 시작 시 피버타임 강제 종료
    setFastCombo(0)   // 연속 정답 콤보 0으로 초기화
    setScreen("GAME")
    },
    [unlocked, hearts, sfxClick, flashToast],
  )

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
    setInput((v) => (v.length >= 4 ? v : v + k))
  }
  const onBackspace = () => {
    if (locked) return
    sfxClick()
    setInput((v) => v.slice(0, -1))
  }
  const onNumSubmit = () => {
    if (!currentQ || input === "") return
    const isCorrect = Number(input) === currentQ.answer;
    
    // 예제 문제가 아닐 경우 피버 및 점수 계산
    if (!isExample) {
      if (isCorrect) {
          // 1. 1/3 시간 안에 맞혔는지 먼저 체크!
          const isFast = timeLeft >= currentQ.timer * (2 / 3);

          if (!isFast) {
            // 🚨 늦게 맞혔을 때: 즉시 피버 해제, 콤보 초기화, 10점만 부여
            setIsFever(false);
            setFastCombo(0);
            setPoints((prev) => prev + 10);
          } else {
            // ⚡ 빨리 맞혔을 때: 기존 피버 상태면 15점, 아니면 10점 부여
            const pointToAdd = isFever ? 15 : 10;
            setPoints((prev) => prev + pointToAdd);

            // 콤보 증가 및 피버 발동 (3연속 정답 & 4번째 문제 이상)
            setFastCombo((prev) => {
              const newCombo = prev + 1;
              if (newCombo >= 3 && qIndex >= 3) setIsFever(true);
              return newCombo;
            });
          }
      } else {
        // 오답 시 피버와 콤보 즉시 해제
        setIsFever(false);
        setFastCombo(0);
      }
    }
    resolve(isCorrect);
  }
  const onCompare = (choice: "front" | "back" | "equal") => {
    if (!currentQ) return
    sfxClick()
    const isCorrect = choice === currentQ.answer;
    
    // 예제 문제가 아닐 경우 피버 및 점수 계산
    if (!isExample) {
      if (isCorrect) {
        const pointToAdd = isFever ? 15 : 10;
        setPoints(prev => prev + pointToAdd);

        if (timeLeft >= currentQ.timer * (2 / 3)) {
          setFastCombo(prev => {
            const newCombo = prev + 1;
            if (newCombo >= 3 && qIndex >= 3) setIsFever(true);
            return newCombo;
          });
        } else {
          setFastCombo(0);
        }
      } else {
        setIsFever(false);
        setFastCombo(0);
      }
    }
    
    resolve(isCorrect);
  }
  const togglePartition = (i: number) => {
    if (locked) return
    sfxClick()
    setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))
  }
  const onPartitionSubmit = () => {
    if (!currentQ) return
    const all = [...currentQ.front, ...currentQ.back]
    const selSum = selected.reduce((a, i) => a + all[i], 0)
    const total = sum(all)
    const valid = selected.length > 0 && selected.length < all.length && selSum === total - selSum
    resolve(valid)
  }
  const onPartitionImpossible = () => {
    if (!currentQ) return
    sfxClick()
    resolve(!currentQ.canPartition)
  }

  const rechargeAd = () => {
    sfxClick()
    if (hearts >= HEART_CAP) {
      flashToast("하트가 가득 찼어요!")
      return
    }
    setHearts((h) => Math.min(HEART_CAP, h + 1))
    flashToast("광고 시청 완료! 하트 +1 💖")
  }

  const reactionState = reaction === "correct" ? 1 : reaction === "wrong" ? 6 : 3
  const reactionEmoji = reaction === "correct" ? "🎉" : reaction === "wrong" ? "😵" : "🚗"

  /* --------------------- 다운로드 (Canvas 각인) --------------------- */
  const downloadPang = (level: number) => {
    const size = 512
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const finish = () => {
      // 하단 각인 텍스트
      const grad = ctx.createLinearGradient(0, size - 120, 0, size)
      grad.addColorStop(0, "rgba(0,0,0,0)")
      grad.addColorStop(1, "rgba(0,0,0,0.75)")
      ctx.fillStyle = grad
      ctx.fillRect(0, size - 120, size, 120)
      ctx.fillStyle = "#ffffff"
      ctx.textAlign = "center"
      ctx.font = "bold 40px system-ui, sans-serif"
      ctx.fillText(`${nickname ?? "게스트"} 팡이 마스터`, size / 2, size - 42)
      ctx.font = "22px system-ui, sans-serif"
      ctx.fillStyle = "#ffd23f"
      ctx.fillText(`카운터 팡팡 · Lv.${level} ${LEVEL_NAMES[level]}`, size / 2, size - 78)

      const link = document.createElement("a")
      link.download = `counter-pangpang-lv${level}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
      flashToast("팡이 저장 완료! 📥")
    }

    const drawPlaceholder = () => {
      const g = ctx.createLinearGradient(0, 0, size, size)
      g.addColorStop(0, "#ff8fc0")
      g.addColorStop(1, "#4fc3f7")
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.font = "200px serif"
      ctx.fillText(FACE_EMOJI[level] ?? "🐣", size / 2, size / 2 - 30)
      ctx.textBaseline = "alphabetic"
    }

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      ctx.fillStyle = "#0b1020"
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, 16, 16, size - 32, size - 32)
      finish()
    }
    img.onerror = () => {
      drawPlaceholder()
      finish()
    }
    img.src = `/assets/${level}-1.png`
  }

  /* --------------------- 렌더 --------------------- */
  const clearedLevels = useMemo(
    () => Object.keys(records).map(Number).filter((l) => (records[l] ?? 0) >= PASS_LINE).sort((a, b) => a - b),
    [records],
  )

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
      className="absolute right-3 top-3 z-40 flex h-10 px-4 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white backdrop-blur-md shadow-lg"
    >
      {muted ? "BGM 켜기" : "BGM 끄기"}
    </button>
  );

  return (
    <div
      className="flex w-full items-center justify-center overflow-hidden bg-zinc-950"
      style={{ height: "100dvh" }}
    >
      <div className="relative mx-auto flex h-full w-full max-w-[440px] flex-col overflow-hidden bg-[#0b1020] text-white">
        {MuteButton}

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
              <button
                type="button"
                onClick={() => {
                  sfxClick()
                  setMuted(false)
                  setScreen(nickname ? "LOBBY" : "LOGIN")
                }}
                className="w-full rounded-2xl bg-gradient-to-b from-yellow-300 to-amber-400 py-4 text-xl font-black text-amber-950 shadow-[0_6px_0_#b45309] active:translate-y-1 active:shadow-[0_2px_0_#b45309]"
              >
                시작하기 🚗
              </button>
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
            sfxClick()
            setNickname(name)
            setScreen("LOBBY")
            
            setMuted(false)

            if ((window as any).globalBgm) {
              (window as any).globalBgm.play().catch(() => console.log("BGM 재생 대기"));
            }
          }}
          /* 2. 닉네임 박스(테두리, 배경색) 삭제하고 내용물만 남김 */
          className="relative z-10 w-full max-w-sm"
        >
          {/* 👇 여기서부터 원하는 문구로 수정하세요 👇 */}
          <div className="mb-2 flex justify-center">
  <img src="/assets/0-2-2.png" alt="상단 장식" className="h-32 object-contain" />
</div>
          <h2 className="mb-1 text-center text-3xl font-black text-black drop-shadow-md">반가워요 </h2>
          <p className="mb-6 text-center text-base font-bold text-black drop-shadow-md">닉네임은 선물로 받을 이모티콘에 시그니처로 사용됩니다.</p>
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
            className="mb-5 w-full rounded-xl border-2 border-black/20 bg-white px-4 py-3 text-lg font-bold text-black placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-yellow-400/50"
          />
              <button
                type="submit"
                className="w-full rounded-2xl bg-gradient-to-b from-pink-400 to-pink-500 py-3.5 text-lg font-black text-white shadow-[0_5px_0_#be185d] active:translate-y-1 active:shadow-[0_1px_0_#be185d]"
              >
              
                입장하기
              </button>
              <p className="mt-4 text-center text-xs text-white/50">* 테스트용 · 추후 인증 연동 예정</p>
            </form>
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
              <p className="text-xs text-black/60">반가워요</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-black text-black">{nickname} 님</p>
                <button
                  onClick={() => setScreen("LOGIN")}
                  className="rounded-full bg-black/10 px-2 py-1 text-xs font-bold text-black/60"
                >
                  수정
                </button>
              </div>
            </div>

            {/* 하트 개수: 위아래 중앙 + 가로 중앙 정렬로 완벽 고정 */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full bg-black/5 px-4 py-1.5 text-lg font-black text-black">
              💖 <span>{hearts}</span>
            </div>
          </div>

          {/* 🌟 1줄: 초대하기(1/4) + 하트 충전(3/4) 가로 배치 */}
          <div className="mt-3 flex w-full items-center gap-2">
            {/* 왼쪽: 초대하기 (flex-1) */}
            <button
              type="button"
              onClick={handleShare}
              className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-sky-200/60 py-3 text-sm font-bold text-black/80 shadow-sm active:scale-95"
            >
              💌 초대
            </button>
            
            {/* 오른쪽: 광고 보고 하트 충전하기 (flex-[3]) */}
            <button
              type="button"
              onClick={rechargeAd}
              className="flex flex-[3] items-center justify-center gap-2 rounded-2xl bg-sky-200/60 py-3 text-sm font-black text-black/80 active:scale-95"
            >
              📺 광고 보고 하트 충전 <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs">+1 💖</span>
            </button>
          </div>

          {/* 🌟 2줄: 포인트 창 + 출석체크 + 포인트 상점 */}
          <div className="mt-2 flex w-full items-center gap-2">
            <div className="flex w-20 items-center justify-center gap-1 rounded-2xl bg-sky-200/60 py-2.5 text-sm font-bold text-black/80">
              {points}P
            </div>

            <button
              type="button"
              onClick={() => {
                sfxClick();
                setShowAttendance(true);
              }}
              className="flex flex-[2] items-center justify-center gap-1 rounded-2xl bg-sky-200/60 py-2.5 text-sm font-bold text-black/80 active:scale-95"
            >
              📅 출석체크
            </button>

            <button
              type="button"
              onClick={() => {
                sfxClick();
                setShowVault(true);
              }}
              className="flex flex-[3] items-center justify-center gap-2 rounded-2xl bg-sky-200/60 py-2.5 text-sm font-bold text-black/80 active:scale-95"
            >
              🛒 포인트 상점
            </button>
          </div>
        </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 cpp-no-scrollbar">
              <p className="mb-2 mt-1 text-sm font-bold text-black/70">스테이지 선택</p>
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 12 }, (_, lv) => {
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

            {/* 1. 꽉 찬 이미지 */}
            <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl">
              <GameImage
                src={`/assets/${lv}-7.png`}
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
            +{lv === 0 ? 5 : Math.min(110, 20 + lv * 10)}P
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
              className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full tracking-wide", isLocked ? "bg-black/40 text-white/70" : "bg-black/60 text-white")}
            >
              {isLocked ? "🔒 잠김" : LEVEL_NAMES[lv]}
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

          {/* 상태바 */}
            {/* 상태바 */}
            <header className="flex-none px-4 pb-2 pt-4">
              {/* relative를 추가해서 중앙 정렬의 기준점을 만들어 줍니다 */}
              <div className="relative flex items-center justify-between py-1">
                
                {/* 1. 레벨 및 포인트 표시 (왼쪽 고정) */}
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-black ring-1 ring-white/20">
            Lv.{chosenLevel}
          </span>
          {/* 포인트 지갑 & 피버 모드 표시 */}
        <span className="flex items-center gap-1 rounded-full bg-yellow-400/20 px-2 py-1 text-sm font-black text-yellow-400 ring-1 ring-yellow-400/50">
          {points}P
        </span>
        </div>

                {/* 2. 타이머 & 문제 번호 (정중앙으로 강제 고정!) */}
                <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2">
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
              <video 
                key="road-video"
                autoPlay 
                loop 
                muted 
                playsInline
                className="absolute inset-0 h-full w-full object-cover scale-[1.05] brightness-110"
              >
                <source src="/assets/road-bg.mp4" type="video/mp4" />
              </video>
              
              {/* 문제 글씨가 잘 보이게 위쪽에만 살짝 그라데이션 그림자 깔기 */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" aria-hidden />
          

              

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
          {isExample && (
            <div className="rounded-full bg-emerald-400/90 px-3 py-1.5 text-xs font-black text-emerald-950 shadow cpp-pop">
              정답: {exampleText(currentQ)}
            </div>
          )}
        </div>

            {/* 4. 자동차 + 번호판 (화면 맨 아래 도로에 착 붙임!) */}
            <div className="relative flex flex-col items-center mt-auto mb-2">
              {/* 자동차 크기를 카카오톡 좁은 화면에 맞게 w-48 h-40으로 축소 */}
              <div className="relative w-48 h-40 sm:w-64 sm:h-56">
                <GameImage
                  src="/assets/car.png"
                  alt="달리는 자동차"
                  fallback={<span style={{ fontSize: "3.5rem" }}>🚕</span>}
                  className="w-full h-full object-contain drop-shadow-[0_20px_20px_rgba(0,0,0,0.8)] cpp-bounce"
                />
                {/* 번호판을 자동차 바닥에 찰싹 붙임 (bottom-0) */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 scale-90 sm:scale-100 origin-top transform whitespace-nowrap z-30">
                  <Plate
                    q={currentQ}
                    selected={currentQ.type === "partition" ? selected : undefined}
                    onToggle={currentQ.type === "partition" && !locked ? togglePartition : undefined}
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

          {currentQ.type === "partition" && (
            <div className="space-y-2">
              <p className="text-center text-xs text-white/60">
                번호판 숫자를 눌러 파란 불을 켜세요 · 현재 선택 합{" "}
                <span className="font-black text-sky-300">
                  {selected.reduce((a, i) => a + [...currentQ.front, ...currentQ.back][i], 0)}
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
          )} {/* ✅ 실수로 지워졌던 조건문 닫기 괄호를 복구했습니다! */}
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
                      src={`/assets/${chosenLevel}-10.png`}
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
                      src="/assets/레벨업이미지.png"
                      alt="화이팅 팡이"
                      fallback={<span style={{ fontSize: "6rem" }}>💪</span>}
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

              {passed && chosenLevel < MAX_LEVEL && (
                <p className="mt-3 rounded-full bg-yellow-300/90 px-4 py-1.5 text-sm font-black text-amber-950 cpp-pop">
                  🔓 Lv.{chosenLevel + 1} 성공!
                </p>
              )}
            </div>

            <div className="relative z-10 mt-8 w-full max-w-sm space-y-2">
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
                  <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[11px] text-yellow-400">내 포인트: {points}P</span>
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
        {showVault && (
          <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
            {/* 1. 상점 메인 배경: 아주 연한 투명 노란색 (bg-yellow-50/95) */}
            <div className="max-h-[80%] w-full max-w-[440px] overflow-hidden rounded-t-3xl border-t border-white/50 bg-yellow-50/95 backdrop-blur-md shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-2">
                  {/* 글씨 색상 어둡게 변경 */}
                  <h3 className="text-lg font-black text-zinc-900">🛒 포인트 상점</h3>
                  <span className="rounded-full bg-yellow-400/30 px-2 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-500/50">
                    보유: {points}P
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sfxClick()
                    setShowVault(false)
                  }}
                  className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-zinc-900 text-lg hover:bg-black/10 active:scale-90"
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>

              {/* ▼▼▼ 도감형 이모티콘 다운로드 화면 ▼▼▼ */}
              <div className="max-h-[60vh] overflow-y-auto px-5 pb-8 cpp-no-scrollbar">
                <p className="mb-4 text-center text-sm font-bold text-zinc-700">
                  열린 팡이를 터치하면 닉네임이 박혀서 저장됩니다 📸
                </p>

                {/* 🌟 2. 미리보기 팝업창 배경: 연하고 투명한 노란색 (bg-yellow-100/95) */}
                {previewItem && (
                  <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-yellow-100/95 p-6 backdrop-blur-md">
                    <h3 className="mb-2 text-2xl font-black text-zinc-900">Lv.{previewItem.lv} 팡이</h3>
                    <p className="mb-6 text-sm font-bold text-amber-700">내 포인트: {points}P</p>
                    
                    <div className="relative mb-8 h-56 w-56 overflow-hidden rounded-2xl bg-white/60 ring-4 ring-yellow-400/80 shadow-xl">
                      <GameImage 
                        src={`/assets/${previewItem.lv}-${previewItem.idx}.png`} 
                        alt="preview" 
                        fallback={<div className="h-full w-full bg-white/50" />}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    {/* 다운로드 버튼 */}
                    <button
                      type="button"
                      onClick={() => {
                        if (points < previewItem.price) {
                          flashToast(`포인트가 부족해요! (${points}P / ${previewItem.price}P) 😥`);
                          return;
                        }
                        
                        setPoints(p => p - previewItem.price);
                        
                        const imgSrc = `/assets/${previewItem.lv}-${previewItem.idx}.png`;
                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        img.onload = () => {
                          const canvas = document.createElement("canvas");
                          canvas.width = img.width;
                          canvas.height = img.height;
                          const ctx = canvas.getContext("2d");
                          if (ctx) {
                            ctx.drawImage(img, 0, 0);
                            const fontSize = Math.max(16, img.width * 0.1);
                            ctx.font = `900 ${fontSize}px sans-serif`;
                            ctx.textAlign = "right";
                            ctx.textBaseline = "bottom";
                            ctx.lineWidth = fontSize * 0.2;
                            ctx.strokeStyle = "white";
                            ctx.strokeText(`@${nickname}`, canvas.width - (img.width * 0.05), canvas.height - (img.width * 0.05));
                            ctx.fillStyle = "#333333";
                            ctx.fillText(`@${nickname}`, canvas.width - (img.width * 0.05), canvas.height - (img.width * 0.05));
                            
                            const a = document.createElement("a");
                            a.href = canvas.toDataURL("image/png");
                            a.download = `pangi_lv${previewItem.lv}_${previewItem.idx}.png`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            
                            flashToast(`${previewItem.price}P 사용! Lv.${previewItem.lv} 이모티콘 저장 완료! 🎉`);
                            setPreviewItem(null); 
                          }
                        };
                        img.src = imgSrc;
                      }}
                      className="w-full max-w-[240px] rounded-full bg-yellow-400 py-3.5 text-lg font-black text-zinc-900 shadow-lg active:scale-95"
                    >
                      📥 {previewItem.price}P로 다운받기
                    </button>

                    {/* 돌아가기 버튼 */}
                    <button 
                      onClick={() => setPreviewItem(null)}
                      className="mt-5 text-sm font-bold text-zinc-500 underline"
                    >
                      돌아가기
                    </button>
                  </div>
                )}

                <div className="space-y-6">
                  {/* 레벨별 이모티콘 목록 */}
                  {Array.from({ length: 11 }, (_, i) => {
                    const lv = i + 1; 
                    const isLocked = lv > unlocked;
                    
                    return (
                      <div key={lv} className="rounded-xl bg-yellow-900/5 p-3 ring-1 ring-yellow-900/10">
                        <h4 className="mb-3 text-sm font-bold text-zinc-800">Lv.{lv} 팡이 팩 {isLocked && "🔒"}</h4>
                        
                        <div className="grid grid-cols-5 gap-2">
                          {Array.from({ length: 10 }, (_, j) => {
                            const imgNum = j + 1; 
                            const price = 30 + (lv - 1) * 20; 

                            return (
                              <button
                                key={imgNum}
                                type="button"
                                disabled={isLocked}
                                onClick={() => {
                                  sfxClick();
                                  setPreviewItem({ lv, idx: imgNum, price });
                                }}
                                className={`relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-black/5 transition-all ${
                                  isLocked ? "cursor-not-allowed opacity-40 grayscale" : "active:scale-95 shadow-sm"
                                }`}
                              >
                                <img
                                  src={`/assets/${lv}-${imgNum}.png`}
                                  alt={`Lv.${lv}-${imgNum}`}
                                  className="h-full w-full object-cover"
                                />
                                <div className="absolute bottom-0 w-full bg-white/90 py-1 text-center text-[10px] font-black text-amber-700 backdrop-blur-sm">
                                  {isLocked ? "🔒 잠김" : `${price} P`}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
