import type { MetadataRoute } from "next"

// 📲 홈 화면에 추가(PWA) 정보: 아이콘을 누르면 주소창 없이 앱처럼 전체 화면으로 실행됨
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "카운터 팡팡",
    short_name: "카운터 팡팡",
    description: "자동차 번호판으로 계산 실력을 키우는 사칙연산 두뇌 게임",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1020",
    theme_color: "#0b1020",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
