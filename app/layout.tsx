import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PokeQuant — Pokemon TCG Analytics',
  description: 'Quantitative analytics and fair value predictions for Pokemon TCG collectors',
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
