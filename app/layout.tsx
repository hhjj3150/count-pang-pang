import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '카운터 팡팡 - 번호판 두뇌 계산 게임',
  description: '아이부터 어른까지 누구나 즐기는 두뇌 계산 게임. 자동차 번호판 숫자로 더하고 비교하고 골라 보세요!',
  // 🚗 카운터 팡팡 아이콘 (브라우저 탭 / 아이폰 홈 화면)
  icons: {
    icon: [{ url: '/icon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/apple-icon.png',
  },
  // 📲 아이폰 '홈 화면에 추가' 시 앱처럼 실행
  appleWebApp: {
    capable: true,
    title: '카운터 팡팡',
    statusBarStyle: 'black', // 상태바 아래부터 화면 시작 (화면이 시계·배터리 표시에 가려지지 않게)
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#0b1020',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
