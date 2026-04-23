'use client'

import { useState, useMemo } from 'react'
import { Card } from '@/lib/types'
import { fmt } from '@/lib/utils'

interface MoversTabProps {
  cards: Card[]
  loading: boolean
}

export default function MoversTab({ cards, loading }: MoversTabProps) {
  const [dir, setDir] = useState<'all' | 'up' | 'down'>('all')

  const movers = useMemo(() => {
    const eligible = cards.filter(c => c.demand?.price_momentum_30d != null && c.price != null)
    if (dir === 'up') {
      return eligible
        .filter(c => (c.demand!.price_momentum_30d ?? 0) > 0)
        .sort((a, b) => b.demand!.price_momentum_30d! - a.demand!.price_momentum_30d!)
        .slice(0, 100)
    }
    if (dir === 'down') {
      return eligible
        .filter(c => (c.demand!.price_momentum_30d ?? 0) < 0)
        .sort((a, b) => a.demand!.price_momentum_30d! - b.demand!.price_momentum_30d!)
        .slice(0, 100)
    }
    // 'all': sort by absolute momentum descending
    return eligible
      .sort((a, b) => Math.abs(b.demand!.price_momentum_30d!) - Math.abs(a.demand!.price_momentum_30d!))
      .slice(0, 100)
  }, [cards, dir])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="shimmer" style={{ height: 68, borderRadius: 10 }} />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        {([
          { id: 'all',  label: 'All Movers' },
          { id: 'up',   label: '▲ Gainers' },
          { id: 'down', label: '▼ Losers' },
        ] as const).map(b => (
          <button key={b.id} onClick={() => setDir(b.id)} style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: dir === b.id ? 'var(--ink)' : 'var(--c1)',
            color: dir === b.id ? 'var(--c1)' : 'var(--ink-mid)',
            border: `1px solid ${dir === b.id ? 'var(--ink)' : 'var(--cborder)'}`,
            transition: 'all 0.15s',
          }}>{b.label}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-light)' }}>30-day momentum</span>
      </div>

      {/* Column headers */}
      <div className="movers-head" style={{
        display: 'grid', gridTemplateColumns: '36px 56px 1fr 110px 120px',
        padding: '5px 16px', gap: 14, marginBottom: 5,
        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--ink-light)',
      }}>
        <span className="mover-rank-col" /><span /><span>Card</span>
        <span style={{ textAlign: 'right' }}>30d</span>
        <span style={{ textAlign: 'right' }}>Price</span>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {movers.map((card, i) => {
          const mom = card.demand!.price_momentum_30d!
          const up  = mom > 0
          return (
            <div key={card.id} className="mover-row movers-grid" style={{
              background: 'var(--c1)', borderRadius: 10, padding: '10px 16px',
              border: '1px solid var(--cborder)',
              display: 'grid', gridTemplateColumns: '36px 56px 1fr 110px 120px',
              alignItems: 'center', gap: 14,
              boxShadow: '0 1px 4px rgba(26,18,8,0.04)',
            }}>
              <span className="mover-rank-col" style={{ fontSize: 11, fontFamily: 'var(--fm)', color: 'var(--ink-light)' }}>#{i + 1}</span>
              <div style={{ width: 56, height: 76 }}>
                {card.image_url
                  ? <img src={card.image_url} alt={card.card_name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <div style={{ width: '100%', height: '100%', background: 'var(--c2)', borderRadius: 4 }} />
                }
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 2 }}>{card.card_name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-light)' }}>{card.set?.set_name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 19,
                  color: up ? 'var(--green)' : 'var(--red)', letterSpacing: '-0.02em',
                }}>
                  {mom > 0 ? '+' : ''}{mom.toFixed(1)}%
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-light)', marginTop: 2 }}>% change</div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>
                {fmt(card.price)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
