'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardSet, SetData } from '@/lib/types'
import CardItem from './CardItem'
import CardModal from './CardModal'
import SetSearch from './SetSearch'
import StatsBar from './StatsBar'

function CardSkel() {
  return (
    <div style={{ background: 'var(--c1)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--cborder)' }}>
      <div className="shimmer" style={{ height: 170 }} />
      <div style={{ padding: '10px 14px 14px' }}>
        <div className="shimmer" style={{ height: 14, width: '72%', marginBottom: 6 }} />
        <div className="shimmer" style={{ height: 11, width: '48%', marginBottom: 14 }} />
        <div className="shimmer" style={{ height: 22, width: '44%', marginBottom: 10 }} />
        <div className="shimmer" style={{ height: 3, width: '100%' }} />
      </div>
    </div>
  )
}

interface CardGridProps {
  cards: Card[]
  loading: boolean
  setsMap: Map<number, SetData>
}

export default function CardGrid({ cards, loading, setsMap }: CardGridProps) {
  const [query,     setQuery]     = useState('')
  const [activeSet, setActiveSet] = useState('')
  const [sortBy,    setSortBy]    = useState('price_desc')
  const [selected,  setSelected]  = useState<Card | null>(null)
  const [cols,      setCols]      = useState(5)

  useEffect(() => {
    function update() {
      const w = window.innerWidth
      setCols(w < 480 ? 2 : w < 640 ? 3 : w < 900 ? 4 : 5)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const sets: CardSet[] = useMemo(() => {
    const m = new Map<number, CardSet>()
    cards.forEach(c => { if (c.set && !m.has(c.set.id)) m.set(c.set.id, c.set) })
    return [...m.values()].sort((a, b) => a.id - b.id)
  }, [cards])

  const filtered = useMemo(() => {
    let r = [...cards]
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      r = r.filter(c =>
        c.card_name?.toLowerCase().includes(q) ||
        (c.character_name ?? '').toLowerCase().includes(q)
      )
    }
    if (activeSet) r = r.filter(c => String(c.set?.id) === activeSet)
    const sorters: Record<string, (a: Card, b: Card) => number> = {
      price_desc: (a, b) => (b.price ?? 0) - (a.price ?? 0),
      price_asc:  (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9),
      mom_desc:   (a, b) => (b.demand?.price_momentum_30d ?? -1e9) - (a.demand?.price_momentum_30d ?? -1e9),
      mom_asc:    (a, b) => (a.demand?.price_momentum_30d ?? 1e9)  - (b.demand?.price_momentum_30d ?? 1e9),
      demand:     (a, b) => (b.demand?.demand_score ?? 0) - (a.demand?.demand_score ?? 0),
      name:       (a, b) => a.card_name.localeCompare(b.card_name),
    }
    return r.sort(sorters[sortBy] ?? sorters.price_desc)
  }, [cards, query, activeSet, sortBy])

  return (
    <div>
      {/* Controls row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        {/* Search */}
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
            placeholder="Search Pokémon name or card…"
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

        {/* Sort */}
        <div style={{ position: 'relative' }}>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              padding: '9px 30px 9px 12px',
              background: 'var(--c1)', border: '1px solid var(--cborder)',
              borderRadius: 8, fontSize: 13, color: 'var(--ink)', outline: 'none',
              appearance: 'none',
            }}
          >
            <option value="price_desc">Price ↓</option>
            <option value="price_asc">Price ↑</option>
            <option value="mom_desc">Momentum ↑</option>
            <option value="mom_asc">Momentum ↓</option>
            <option value="demand">Demand Score</option>
            <option value="name">Name A→Z</option>
          </select>
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 10, color: 'var(--ink-light)' }}>▾</span>
        </div>
      </div>

      <StatsBar cards={filtered} />

      {/* Result count */}
      <div style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 16 }}>
        {loading
          ? 'Loading live data…'
          : `${filtered.length} card${filtered.length !== 1 ? 's' : ''}${query ? ` matching "${query}"` : ''}`
        }
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 13 }}>
        {loading
          ? Array.from({ length: cols * 3 }).map((_, i) => <CardSkel key={i} />)
          : filtered.map(card => (
              <CardItem key={card.id} card={card} cols={cols} onClick={setSelected} />
            ))
        }
      </div>

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--ink-light)' }}>
          <div style={{ fontFamily: 'var(--fd)', fontSize: 28, marginBottom: 10, opacity: 0.35, fontStyle: 'italic' }}>
            No results
          </div>
          <div style={{ fontSize: 14 }}>Try searching by Pokémon name or clearing filters</div>
        </div>
      )}

      {selected && (
        <CardModal card={selected} setsMap={setsMap} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
