import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AI 履歷優化器',
  description: '透過 AI 訪談，讓你的履歷真正說出你的價值',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW" className={inter.variable}>
      <body className="min-h-screen bg-surface">
        <main className="max-w-2xl mx-auto px-4 py-12">
          {children}
        </main>
      </body>
    </html>
  )
}
