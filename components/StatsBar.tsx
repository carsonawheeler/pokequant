import { Card } from '@/lib/types'
import { fmt } from '@/lib/utils'

export default function StatsBar({ cards }: { cards: Card[] }) {
  if (!cards.length) return null

  const withPrice = cards.filter(c => c.price != null)
  const avg = withPrice.reduce((a, c) => a + (c.price ?? 0), 0) / (withPrice.length || 1)
  const maxCard = withPrice.reduce<Card | null>((a, c) => (c.price ?? 0) > (a?.price ?? 0) ? c : a, null)
  const hot = cards.filter(c => (c.demand?.demand_score ?? 0) >= 7.5).length

  const stats = [
    { label: 'Total Cards',   value: String(cards.length),             mono: true },
    { label: 'Avg SIR Price', value: fmt(avg),                         mono: true },
    { label: 'Most Valuable', value: maxCard?.character_name ?? '—',   mono: false },
    { label: 'High Demand',   value: `${hot} cards`,                   mono: true },
  ]

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      background: 'var(--c1)', border: '1px solid var(--cborder)',
      borderRadius: 12, overflow: 'hidden', marginBottom: 30,
      boxShadow: '0 1px 6px rgba(26,18,8,0.05)',
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{
          padding: '14px 20px',
          borderRight: i < 3 ? '1px solid var(--cborder)' : 'none',
        }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--ink-light)', marginBottom: 5 }}>
            {s.label}
          </div>
          <div style={{
            fontFamily: s.mono ? 'var(--fm)' : 'var(--fd)',
            fontSize: s.mono ? 18 : 17,
            fontStyle: s.mono ? 'normal' : 'italic',
            fontWeight: 600,
            color: 'var(--ink)',
            letterSpacing: s.mono ? '-0.02em' : '0',
          }}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  )
}
