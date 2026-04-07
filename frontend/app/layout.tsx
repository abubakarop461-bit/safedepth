import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SafeDepth App',
  description: 'Confined spaces worker safety system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
