import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "개인정보처리방침 - 카운터 팡팡",
  description: "카운터 팡팡 개인정보처리방침",
}

// ⚠️ 초안입니다. [ ] 로 표시된 칸(운영자 이름, 연락처, 시행일)은 출시 전에 채워 주세요.
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. 수집하는 정보",
    body: [
      "카운터 팡팡은 회원가입이 없으며, 이름·전화번호·이메일 같은 개인을 알아볼 수 있는 정보를 수집하지 않습니다.",
      "게임을 위해 아래 정보를 이용자의 기기(브라우저 저장소) 안에만 저장합니다: 닉네임, 태어난 해(연령 확인용), 하트·포인트·캐시·레벨 기록, 구매한 아이템, 출석·초대 횟수, 학습 기록, 소리 설정.",
      "이 정보는 운영자의 서버로 전송되지 않으며, 운영자는 이 정보를 볼 수 없습니다.",
    ],
  },
  {
    title: "2. 자동으로 수집되는 정보",
    body: [
      "서비스 개선을 위해 Vercel Web Analytics를 사용하여 방문한 페이지, 브라우저·기기 종류, 접속 국가 등 개인을 식별할 수 없는 통계 정보를 수집합니다.",
      "이 통계는 쿠키를 사용하지 않으며, 특정 개인을 알아보는 데 사용되지 않습니다.",
    ],
  },
  {
    title: "3. 정보의 보관 및 삭제",
    body: [
      "기기에 저장된 게임 정보는 앱을 삭제하거나 브라우저의 사이트 데이터를 삭제하면 함께 삭제됩니다.",
      "기기를 바꾸면 게임 기록은 옮겨지지 않습니다.",
    ],
  },
  {
    title: "4. 제3자 제공",
    body: ["카운터 팡팡은 이용자의 정보를 제3자에게 제공하거나 판매하지 않습니다."],
  },
  {
    title: "5. 어린이 이용자 보호",
    body: [
      "카운터 팡팡은 어린이부터 어른까지 이용할 수 있는 게임입니다. 처음 시작할 때 태어난 해를 확인하며, 만 14세 미만 이용자에게는 어린이에게 적합한 광고만 보여 주고 맞춤형 광고를 사용하지 않습니다. 닉네임에는 실명을 쓰지 않도록 권장합니다.",
      "친구 초대 기능은 기기의 기본 공유 기능(또는 링크 복사)을 사용하며, 이 과정에서 운영자에게 어떤 정보도 전달되지 않습니다.",
      "이모티콘 저장 기능은 이미지에 닉네임을 새겨 이용자의 기기에만 저장합니다.",
    ],
  },
  {
    title: "6. 문의처",
    body: ["운영자: [운영자 이름]", "이메일: [문의 이메일 주소]"],
  },
  {
    title: "7. 시행일",
    body: ["이 개인정보처리방침은 [2026년 ○월 ○일]부터 적용됩니다."],
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-amber-50 px-5 py-8 text-zinc-800">
      <div className="mx-auto max-w-[440px]">
        <Link href="/" className="text-sm font-bold text-sky-700 underline">
          ← 게임으로 돌아가기
        </Link>
        <h1 className="mt-4 text-2xl font-black">카운터 팡팡 개인정보처리방침</h1>
        <p className="mt-2 text-sm text-zinc-500">
          카운터 팡팡(이하 &lsquo;서비스&rsquo;)은 이용자의 개인정보를 소중히 다루며, 아래와 같이 처리합니다.
        </p>
        {SECTIONS.map((sec) => (
          <section key={sec.title} className="mt-6">
            <h2 className="text-base font-black">{sec.title}</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
              {sec.body.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
