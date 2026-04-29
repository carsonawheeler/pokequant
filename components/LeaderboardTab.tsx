'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardSet, SetData } from '@/lib/types'
import { fmt } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { SearchSchema, SetFilterSchema, safeValidate } from '@/lib/validation'
import SetSearch from './SetSearch'
import CardModal from './CardModal'

type SortMode = 'momentum' | 'psa10_roi' | 'ebay_sales' | 'tcg_sales' | 'combined_sales'

interface LatestEbaySnap {
  grading_roi_psa10: number | null
  ebay_psa10_sales_count: number | null
  ebay_raw_sales_count: number | null
}

interface LeaderboardTabProps {
  cards: Card[]
  loading: boolean
  setsMap: Map<number, SetData>
}

const SORT_MODES: { id: SortMode; label: string }[] = [
  { id: 'momentum',       label: 'Price Momentum' },
  { id: 'psa10_roi',      label: 'PSA 10 ROI' },
  { id: 'ebay_sales',     label: 'eBay Total Sales' },
  { id: 'tcg_sales',      label: 'TCGPlayer Sales' },
  { id: 'combined_sales', label: 'Combined Sales' },
]

export default function LeaderboardTab({ cards, loading, setsMap }: LeaderboardTabProps) {
  const [sortMode,      setSortMode]      = useState<SortMode>('momentum')
  const [query,         setQuery]         = useState('')
  const [activeSet,     setActiveSet]     = useState('')
  const [selectedCard,  setSelectedCard]  = useState<Card | null>(null)
  const [ebayMap,       setEbayMap]       = useState<Record<string, LatestEbaySnap>>({})
  const [tcgSalesMap,   setTcgSalesMap]   = useState<Record<string, number>>({})
  const [dataLoading,   setDataLoading]   = useState(false)
  const [dataFetched,   setDataFetched]   = useState(false)

  useEffect(() => {
    if (dataFetched || loading) return
    setDataLoading(true)
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
    Promise.all([
      supabase
        .from('card_ebay_snapshots')
        .select('card_id, grading_roi_psa10, ebay_psa10_sales_count, ebay_raw_sales_count')
        .order('snapshot_date', { ascending: false })
        .limit(3000),
      supabase
        .from('card_sales_snapshots')
        .select('card_id, volume')
        .gte('sale_date', cutoff)
        .limit(30000),
    ]).then(([ebayRes, tcgRes]) => {
      // Keep latest snapshot per card_id
      const em: Record<string, LatestEbaySnap> = {}
      for (const snap of ebayRes.data ?? []) {
        if (!em[snap.card_id]) em[snap.card_id] = snap as LatestEbaySnap
      }
      setEbayMap(em)

      // Aggregate TCG sales volume per card_id
      const tm: Record<string, number> = {}
      for (const s of tcgRes.data ?? []) {
        if (s.volume != null) tm[s.card_id] = (tm[s.card_id] ?? 0) + s.volume
      }
      setTcgSalesMap(tm)
      setDataFetched(true)
      setDataLoading(false)
    })
  }, [loading, dataFetched])

  const sets: CardSet[] = useMemo(() => {
    const m = new Map<number, CardSet>()
    cards.forEach(c => { if (c.set && !m.has(c.set.id)) m.set(c.set.id, c.set) })
    return [...m.values()].sort((a, b) => a.id - b.id)
  }, [cards])

  const getEbaySales = (c: Card) => {
    const snap = c.tcg_id ? ebayMap[c.tcg_id] : null
    return (snap?.ebay_raw_sales_count ?? 0) + (snap?.ebay_psa10_sales_count ?? 0)
  }

  const ranked = useMemo(() => {
    const safeQuery = safeValidate(SearchSchema, { q: query.trim() || undefined }, {}).q ?? ''
    const safeSet   = safeValidate(SetFilterSchema, { setId: activeSet || undefined }, {}).setId ?? ''

    let eligible = [...cards]
    if (safeQuery) {
      const q = safeQuery.toLowerCase()
      eligible = eligible.filter(c =>
        c.card_name?.toLowerCase().includes(q) ||
        (c.character_name ?? '').toLowerCase().includes(q)
      )
    }
    if (safeSet) eligible = eligible.filter(c => String(c.set?.id) === safeSet)

    switch (sortMode) {
      case 'momentum':
        return eligible
          .filter(c => c.demand?.price_momentum_30d != null)
          .sort((a, b) => Math.abs(b.demand!.price_momentum_30d!) - Math.abs(a.demand!.price_momentum_30d!))
          .slice(0, 100)

      case 'psa10_roi':
        return eligible
          .filter(c => c.tcg_id && (ebayMap[c.tcg_id]?.grading_roi_psa10 ?? 0) > 0)
          .sort((a, b) => (ebayMap[b.tcg_id!]?.grading_roi_psa10 ?? 0) - (ebayMap[a.tcg_id!]?.grading_roi_psa10 ?? 0))
          .slice(0, 100)

      case 'ebay_sales':
        return eligible
          .filter(c => getEbaySales(c) > 0)
          .sort((a, b) => getEbaySales(b) - getEbaySales(a))
          .slice(0, 100)

      case 'tcg_sales':
        return eligible
          .filter(c => c.tcg_id && (tcgSalesMap[c.tcg_id] ?? 0) > 0)
          .sort((a, b) => (tcgSalesMap[b.tcg_id!] ?? 0) - (tcgSalesMap[a.tcg_id!] ?? 0))
          .slice(0, 100)

      case 'combined_sales': {
        const total = (c: Card) => getEbaySales(c) + (c.tcg_id ? (tcgSalesMap[c.tcg_id] ?? 0) : 0)
        return eligible
          .filter(c => total(c) > 0)
          .sort((a, b) => total(b) - total(a))
          .slice(0, 100)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, sortMode, query, activeSet, ebayMap, tcgSalesMap])

  function getMetric(card: Card): { value: string; sub: string; up?: boolean } {
    const snap = card.tcg_id ? ebayMap[card.tcg_id] : null
    switch (sortMode) {
      case 'momentum': {
        const mom = card.demand?.price_momentum_30d
        if (mom == null) return { value: '—', sub: '30d momentum' }
        return { value: `${mom >= 0 ? '+' : ''}${mom.toFixed(1)}%`, sub: '30d momentum', up: mom >= 0 }
      }
      case 'psa10_roi': {
        const roi = snap?.grading_roi_psa10
        if (roi == null) return { value: '—', sub: 'PSA 10 ROI' }
        return { value: `${roi.toFixed(2)}×`, sub: 'PSA 10 ROI' }
      }
      case 'ebay_sales': {
        const total = getEbaySales(card)
        return { value: total.toLocaleString(), sub: 'eBay sales' }
      }
      case 'tcg_sales': {
        const tcg = card.tcg_id ? (tcgSalesMap[card.tcg_id] ?? 0) : 0
        return { value: tcg.toLocaleString(), sub: 'TCG sold (90d)' }
      }
      case 'combined_sales': {
        const ebay = getEbaySales(card)
        const tcg  = card.tcg_id ? (tcgSalesMap[card.tcg_id] ?? 0) : 0
        return { value: (ebay + tcg).toLocaleString(), sub: 'total sales' }
      }
    }
  }

  const metricColor = (m: ReturnType<typeof getMetric>) => {
    if (sortMode === 'momentum') return m.up ? 'var(--green)' : 'var(--red)'
    return 'var(--ink)'
  }

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
      {/* Sort mode pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {SORT_MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setSortMode(m.id)}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: sortMode === m.id ? 'var(--ink)' : 'var(--c1)',
              color:      sortMode === m.id ? 'var(--c1)' : 'var(--ink-mid)',
              border:     `1px solid ${sortMode === m.id ? 'var(--ink)' : 'var(--cborder)'}`,
              transition: 'all 0.15s',
            }}
          >{m.label}</button>
        ))}
      </div>

      {/* Search + set filter */}
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
        {dataLoading && (
          <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>Loading data…</span>
        )}
      </div>

      {/* Column headers */}
      <div className="movers-head" style={{
        display: 'grid', gridTemplateColumns: '36px 56px 1fr 130px 120px',
        padding: '5px 16px', gap: 14, marginBottom: 5,
        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--ink-light)',
      }}>
        <span className="mover-rank-col" /><span /><span>Card</span>
        <span style={{ textAlign: 'right' }}>
          {SORT_MODES.find(m => m.id === sortMode)?.label}
        </span>
        <span style={{ textAlign: 'right' }}>Price</span>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ranked.map((card, i) => {
          const metric = getMetric(card)
          return (
            <div
              key={card.id}
              className="mover-row movers-grid"
              onClick={() => setSelectedCard(card)}
              style={{
                background: 'var(--c1)', borderRadius: 10, padding: '10px 16px',
                border: '1px solid var(--cborder)',
                display: 'grid', gridTemplateColumns: '36px 56px 1fr 130px 120px',
                alignItems: 'center', gap: 14,
                boxShadow: '0 1px 4px rgba(26,18,8,0.04)',
                cursor: 'pointer',
              }}
            >
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
                  fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 18,
                  color: metricColor(metric),
                  letterSpacing: '-0.02em',
                }}>
                  {metric.value}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-light)', marginTop: 2 }}>{metric.sub}</div>
              </div>

              <div style={{ textAlign: 'right', fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>
                {fmt(card.price)}
              </div>
            </div>
          )
        })}
      </div>

      {selectedCard && (
        <CardModal
          card={selectedCard}
          setsMap={setsMap}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  )
}
