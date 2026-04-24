'use client'

import { useState, useMemo } from 'react'
import { Card, CardSet } from '@/lib/types'
import { fmt } from '@/lib/utils'
import { SearchSchema, SetFilterSchema, DirSchema, safeValidate } from '@/lib/validation'
import SetSearch from './SetSearch'

interface MoversTabProps {
  cards: Card[]
  loading: boolean
}

export default function MoversTab({ cards, loading }: MoversTabProps) {
  const [dir,       setDir]       = useState<'all' | 'up' | 'down'>('all')
  const [query,     setQuery]     = useState('')
  const [activeSet, setActiveSet] = useState('')

  const sets: CardSet[] = useMemo(() => {
    const m = new Map<number, CardSet>()
    cards.forEach(c => { if (c.set && !m.has(c.set.id)) m.set(c.set.id, c.set) })
    return [...m.values()].sort((a, b) => a.id - b.id)
  }, [cards])

  const movers = useMemo(() => {
    // OWASP: Input validation — reject unexpected shapes before they reach the DB query.
    // Inputs filter an in-memory array; validation caps length, constrains character sets,
    // and locks direction to the known enum. Invalid inputs fall back to safe defaults.
    const safeQuery = safeValidate(SearchSchema, { q: query.trim() || undefined }, {}).q ?? ''
    const safeSet   = safeValidate(SetFilterSchema, { setId: activeSet || undefined }, {}).setId ?? ''
    const safeDir   = safeValidate(DirSchema, dir, 'all' as const)

    let eligible = cards.filter(c => c.demand?.price_momentum_30d != null && c.price != null)

    // text search
    if (safeQuery) {
      const q = safeQuery.toLowerCase()
      eligible = eligible.filter(c =>
        c.card_name?.toLowerCase().includes(q) ||
        (c.character_name ?? '').toLowerCase().includes(q)
      )
    }

    // set filter
    if (safeSet) eligible = eligible.filter(c => String(c.set?.id) === safeSet)

    if (safeDir === 'up') {
      return eligible
        .filter(c => (c.demand!.price_momentum_30d ?? 0) > 0)
        .sort((a, b) => b.demand!.price_momentum_30d! - a.demand!.price_momentum_30d!)
        .slice(0, 100)
    }
    if (safeDir === 'down') {
      return eligible
        .filter(c => (c.demand!.price_momentum_30d ?? 0) < 0)
        .sort((a, b) => a.demand!.price_momentum_30d! - b.demand!.price_momentum_30d!)
        .slice(0, 100)
    }
    // 'all': sort by absolute momentum descending
    return eligible
      .sort((a, b) => Math.abs(b.demand!.price_momentum_30d!) - Math.abs(a.demand!.price_momentum_30d!))
      .slice(0, 100)
  }, [cards, dir, query, activeSet])

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
      {/* Search + set filter row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ flex: '1 1 200px', position: 'relative' }}>
          <svg
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.4 }}
            width="14" height="14" viewBox="0 0 14 14" fill="none"
          >
            <circle cx="6" cy="6" r="4.5" stroke="var(--ink)" strokeWidth="1.5" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search card name…"
            style={{
              width: '100%', padding: '9px 12px 9px 32px',
              background: 'var(--c1)', border: '1px solid var(--cborder)',
              borderRadius: 8, fontSize: 13, color: 'var(--ink)', outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--cborder)')}
          />
        </div>
        <SetSearch sets={sets} activeSet={activeSet} setActiveSet={setActiveSet} />
      </div>

      {/* Direction toggle */}
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
