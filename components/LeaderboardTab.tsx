'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, SetData, SetPriceSnapshot } from '@/lib/types'
import { fmt } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { SearchSchema, safeValidate } from '@/lib/validation'
import CardModal from './CardModal'
import { SetModal, SetRow } from './SetsTab'
import SealedTab from './SealedTab'

type Entity      = 'cards' | 'sets' | 'sealed'
type CardSort    = 'momentum' | 'psa10_roi' | 'ebay_sales' | 'tcg_sales' | 'combined_sales'
type SetSortMode = 'avg_sir' | 'box_change'

interface LatestEbaySnap {
  grading_roi_psa10:      number | null
  ebay_psa10_sales_count: number | null
  ebay_raw_sales_count:   number | null
}

interface LeaderboardTabProps {
  cards:    Card[]
  loading:  boolean
  setsMap:  Map<number, SetData>
  setsData: SetData[]
}

const CARD_SORTS: { id: CardSort; label: string }[] = [
  { id: 'momentum',       label: 'Price Momentum' },
  { id: 'psa10_roi',      label: 'PSA 10 ROI' },
  { id: 'ebay_sales',     label: 'eBay Total Sales' },
  { id: 'tcg_sales',      label: 'TCGPlayer Sales' },
  { id: 'combined_sales', label: 'Combined Sales' },
]

const SET_SORTS: { id: SetSortMode; label: string }[] = [
  { id: 'avg_sir',    label: 'Avg SIR Price' },
  { id: 'box_change', label: '30d Price Change' },
]

// Returns number = valid %, 'insufficient' = < 25d span, null = no data
function computeBoxChange30d(snaps: SetPriceSnapshot[]): number | 'insufficient' | null {
  if (!snaps.length) return null
  const latest = snaps[0]?.booster_box_market_price ?? null
  if (latest == null) return null
  const oldest = snaps[snaps.length - 1]?.snapshot_date ?? ''
  const daySpan = oldest
    ? Math.floor((Date.now() - new Date(oldest + 'T12:00:00').getTime()) / 86400000)
    : 0
  if (daySpan < 25) return 'insufficient'
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const past = snaps.find(s => s.snapshot_date <= cutoff)
  const pastVal = past?.booster_box_market_price ?? null
  if (!pastVal) return 'insufficient'
  return ((latest - pastVal) / pastVal) * 100
}

export default function LeaderboardTab({ cards, loading, setsMap, setsData }: LeaderboardTabProps) {
  const [entity,         setEntity]         = useState<Entity>('cards')
  const [cardSort,       setCardSort]       = useState<CardSort>('momentum')
  const [setSort,        setSetSort]        = useState<SetSortMode>('avg_sir')
  const [query,          setQuery]          = useState('')
  const [selectedCard,   setSelectedCard]   = useState<Card | null>(null)
  const [selectedSetRow, setSelectedSetRow] = useState<SetRow | null>(null)
  const [ebayMap,        setEbayMap]        = useState<Record<string, LatestEbaySnap>>({})
  const [tcgSalesMap,    setTcgSalesMap]    = useState<Record<string, number>>({})
  const [dataLoading,    setDataLoading]    = useState(false)
  const [dataFetched,    setDataFetched]    = useState(false)
  const [cols,           setCols]           = useState(5)

  // Responsive column count — matches CardGrid breakpoints
  useEffect(() => {
    function update() {
      const w = window.innerWidth
      setCols(w < 480 ? 2 : w < 640 ? 3 : w < 900 ? 4 : 5)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Reset search when switching entities
  useEffect(() => { setQuery('') }, [entity])

  // Fetch eBay + TCG data once
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
      const em: Record<string, LatestEbaySnap> = {}
      for (const snap of ebayRes.data ?? []) {
        if (!em[snap.card_id]) em[snap.card_id] = snap as LatestEbaySnap
      }
      setEbayMap(em)

      const tm: Record<string, number> = {}
      for (const s of tcgRes.data ?? []) {
        if (s.volume != null) tm[s.card_id] = (tm[s.card_id] ?? 0) + s.volume
      }
      setTcgSalesMap(tm)
      setDataFetched(true)
      setDataLoading(false)
    })
  }, [loading, dataFetched])

  // ── Set rows ──────────────────────────────────────────────────────────────────

  const setRows = useMemo<SetRow[]>(() => {
    const medMap: Record<number, number> = {}
    cards.forEach(c => { if (c.set?.id && c.set_median_sir_price != null) medMap[c.set.id] = c.set_median_sir_price })
    return setsData.map(s => ({
      ...s,
      median:    medMap[s.id] ?? null,
      packPrice: s.set_price_snapshots?.[0]?.pack_market_price ?? null,
      boxPrice:  s.set_price_snapshots?.[0]?.booster_box_market_price ?? null,
      etbPrice:  s.set_price_snapshots?.[0]?.etb_market_price ?? null,
      logoUrl:   s.logo_url ?? `https://images.pokemontcg.io/${s.set_code}/logo.png`,
    }))
  }, [cards, setsData])

  const rankedSetRows = useMemo(() => {
    const base = [...setRows]
    switch (setSort) {
      case 'avg_sir':    return base.sort((a, b) => (b.median ?? 0) - (a.median ?? 0))
      case 'box_change': return base.sort((a, b) => {
        const av = computeBoxChange30d(a.set_price_snapshots ?? [])
        const bv = computeBoxChange30d(b.set_price_snapshots ?? [])
        return (typeof bv === 'number' ? bv : -999) - (typeof av === 'number' ? av : -999)
      })
    }
  }, [setRows, setSort])

  // ── Card helpers ──────────────────────────────────────────────────────────────

  const getEbaySales = (c: Card) => {
    const snap = c.tcg_id ? ebayMap[c.tcg_id] : null
    return (snap?.ebay_raw_sales_count ?? 0) + (snap?.ebay_psa10_sales_count ?? 0)
  }

  const rankedCards = useMemo(() => {
    const safeQuery = safeValidate(SearchSchema, { q: query.trim() || undefined }, {}).q ?? ''
    let eligible = [...cards]
    if (safeQuery) {
      const q = safeQuery.toLowerCase()
      eligible = eligible.filter(c =>
        c.card_name?.toLowerCase().includes(q) ||
        (c.character_name ?? '').toLowerCase().includes(q)
      )
    }
    switch (cardSort) {
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
        return eligible.filter(c => total(c) > 0).sort((a, b) => total(b) - total(a)).slice(0, 100)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, cardSort, query, ebayMap, tcgSalesMap])

  function getCardMetric(card: Card): { value: string; sub: string; up?: boolean } {
    const snap = card.tcg_id ? ebayMap[card.tcg_id] : null
    switch (cardSort) {
      case 'momentum': {
        const mom = card.demand?.price_momentum_30d
        if (mom == null) return { value: '—', sub: '30d momentum' }
        return { value: `${mom >= 0 ? '+' : ''}${mom.toFixed(1)}%`, sub: '30d momentum', up: mom >= 0 }
      }
      case 'psa10_roi': {
        const roi = snap?.grading_roi_psa10
        return roi != null
          ? { value: `${roi.toFixed(2)}×`, sub: 'PSA 10 ROI' }
          : { value: '—', sub: 'PSA 10 ROI' }
      }
      case 'ebay_sales':
        return { value: getEbaySales(card).toLocaleString(), sub: 'PSA 10 eBay sold (lifetime)' }
      case 'tcg_sales': {
        const tcg = card.tcg_id ? (tcgSalesMap[card.tcg_id] ?? 0) : 0
        return { value: tcg.toLocaleString(), sub: 'TCG sold (90d)' }
      }
      case 'combined_sales': {
        const ebay = getEbaySales(card)
        const tcg  = card.tcg_id ? (tcgSalesMap[card.tcg_id] ?? 0) : 0
        return { value: (ebay + tcg).toLocaleString(), sub: 'eBay (lifetime) + TCG (90d)' }
      }
    }
  }

  const cardMetricColor = (m: ReturnType<typeof getCardMetric>) => {
    if (cardSort === 'momentum') return m.up ? 'var(--green)' : 'var(--red)'
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
      {/* ── Entity selector — full-width segmented control ───────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        background: 'var(--c1)', border: '1px solid var(--cborder)',
        borderRadius: 10, padding: 4, marginBottom: 10, gap: 4,
      }}>
        {(['cards', 'sets', 'sealed'] as const).map(e => (
          <button
            key={e}
            onClick={() => setEntity(e)}
            style={{
              padding: '11px 0', borderRadius: 7,
              fontSize: 15, fontWeight: 700, letterSpacing: '0.01em',
              background: entity === e ? 'var(--ink)' : 'transparent',
              color:      entity === e ? 'var(--c1)' : 'var(--ink-mid)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {e === 'cards' ? 'Cards' : e === 'sets' ? 'Sets' : 'Sealed'}
          </button>
        ))}
      </div>

      {/* ── Entity description ───────────────────────────────────────────────── */}
      <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 18, transition: 'opacity 0.15s' }}>
        {entity === 'cards' && 'Rank all tracked SV era cards by price momentum, PSA 10 grading ROI, and sales volume across TCGPlayer and eBay'}
        {entity === 'sets'  && 'Rank all SV era sets by cultural premium score, average SIR price, and 30-day price movement'}
        {entity === 'sealed' && 'Rank sealed booster boxes and ETBs by current price and 30-day price change'}
      </p>

      {/* ── Cards entity ─────────────────────────────────────────────────────── */}
      {entity === 'cards' && (
        <div>
          {/* Sort pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {CARD_SORTS.map(m => (
              <button
                key={m.id}
                onClick={() => setCardSort(m.id)}
                style={{
                  padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: cardSort === m.id ? 'var(--ink)' : 'var(--c1)',
                  color:      cardSort === m.id ? 'var(--c1)' : 'var(--ink-mid)',
                  border:     `1px solid ${cardSort === m.id ? 'var(--ink)' : 'var(--cborder)'}`,
                  transition: 'all 0.15s',
                }}
              >{m.label}</button>
            ))}
          </div>

          {/* Search */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
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
            {dataLoading && <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>Loading data…</span>}
          </div>

          {/* Card grid — same layout as Cards tab */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 13 }}>
            {rankedCards.map((card, i) => {
              const metric = getCardMetric(card)
              const imgH = cols <= 2 ? 160 : cols === 3 ? 200 : cols === 4 ? 240 : 210
              const isTop3 = i < 3
              return (
                <div
                  key={card.id}
                  className="card-item fadeup"
                  onClick={() => setSelectedCard(card)}
                  style={{
                    background: 'var(--c1)', borderRadius: 12,
                    border: '1px solid var(--cborder)', overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(26,18,8,0.05)',
                    display: 'flex', flexDirection: 'column', cursor: 'pointer',
                  }}
                >
                  {/* Image area */}
                  <div style={{
                    height: imgH, flexShrink: 0, position: 'relative',
                    borderBottom: '1px solid var(--cborder)', overflow: 'hidden',
                    background: 'var(--c2)',
                  }}>
                    {card.image_url && (
                      <div style={{
                        position: 'absolute', inset: -8,
                        backgroundImage: `url(${card.image_url})`,
                        backgroundSize: 'cover', backgroundPosition: 'center top',
                        filter: 'blur(14px) brightness(0.7) saturate(1.4)',
                        transform: 'scale(1.12)',
                      }} />
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(237,232,216,0.28)' }} />
                    {card.image_url
                      ? (
                        <img
                          src={card.image_url}
                          alt={card.card_name}
                          loading="lazy"
                          style={{
                            position: 'absolute', inset: 0, zIndex: 1,
                            height: '100%', width: '100%',
                            objectFit: 'contain', padding: '6px 4px',
                          }}
                        />
                      )
                      : (
                        <span style={{
                          position: 'absolute', inset: 0, zIndex: 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, color: 'var(--ink-light)',
                        }}>
                          {card.character_name}
                        </span>
                      )
                    }
                  </div>

                  {/* Info area */}
                  <div style={{ padding: '8px 11px 11px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    {/* Rank + card name row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 2 }}>
                      <span style={{
                        fontFamily: 'var(--fm)', fontWeight: 800,
                        fontSize: cols <= 2 ? 18 : 22,
                        color: isTop3 ? 'var(--gold)' : 'var(--ink-light)',
                        lineHeight: 1, flexShrink: 0, letterSpacing: '-0.03em',
                      }}>
                        #{i + 1}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {card.card_name}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--ink-light)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {card.set?.set_name}
                        </div>
                      </div>
                    </div>
                    {/* Metric (large) + price (small) */}
                    <div style={{ borderTop: '1px solid var(--cborder)', paddingTop: 7, marginTop: 5 }}>
                      {metric.value !== '—' && (
                        <div style={{ fontFamily: 'var(--fm)', fontSize: cols <= 2 ? 18 : 21, fontWeight: 700, color: cardMetricColor(metric), letterSpacing: '-0.02em', lineHeight: 1 }}>
                          {metric.value}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                        <span style={{ fontSize: 9.5, color: 'var(--ink-light)' }}>{metric.sub}</span>
                        <span style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--ink-mid)', fontWeight: 500 }}>{fmt(card.price)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Sets entity ──────────────────────────────────────────────────────── */}
      {entity === 'sets' && (
        <div>
          {/* Sort pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {SET_SORTS.map(m => (
              <button
                key={m.id}
                onClick={() => setSetSort(m.id)}
                style={{
                  padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: setSort === m.id ? 'var(--ink)' : 'var(--c1)',
                  color:      setSort === m.id ? 'var(--c1)' : 'var(--ink-mid)',
                  border:     `1px solid ${setSort === m.id ? 'var(--ink)' : 'var(--cborder)'}`,
                  transition: 'all 0.15s',
                }}
              >{m.label}</button>
            ))}
          </div>

          {/* Set card grid — same layout as Cards leaderboard */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 13 }}>
            {rankedSetRows.map((s, i) => {
              const isTop3     = i < 3
              const boxChange  = computeBoxChange30d(s.set_price_snapshots ?? [])
              const imgH       = cols <= 2 ? 100 : cols === 3 ? 120 : cols === 4 ? 130 : 120

              // Metric value + label + color for active sort
              let metricValue: string
              let metricLabel: string
              let metricColor: string
              if (setSort === 'avg_sir') {
                metricValue = s.median != null ? fmt(s.median)! : '—'
                metricLabel = 'Avg SIR Price'
                metricColor = 'var(--ink)'
              } else {
                if (typeof boxChange === 'number') {
                  metricValue = `${boxChange >= 0 ? '▲' : '▼'} ${Math.abs(boxChange).toFixed(1)}%`
                  metricLabel = '30-day change'
                  metricColor = boxChange >= 0 ? 'var(--green)' : 'var(--red)'
                } else {
                  metricValue = '—'
                  metricLabel = boxChange === 'insufficient' ? '< 30d data' : '30-day change'
                  metricColor = 'var(--ink-light)'
                }
              }

              return (
                <div
                  key={s.id}
                  className="card-item fadeup"
                  onClick={() => setSelectedSetRow(s)}
                  style={{
                    background: 'var(--c1)', borderRadius: 12,
                    border: '1px solid var(--cborder)', overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(26,18,8,0.05)',
                    display: 'flex', flexDirection: 'column', cursor: 'pointer',
                  }}
                >
                  {/* Logo image area — same blur treatment as Sets tab */}
                  <div style={{
                    height: imgH, flexShrink: 0, position: 'relative',
                    borderBottom: '1px solid var(--cborder)', overflow: 'hidden',
                    background: 'var(--c2)',
                  }}>
                    <div style={{
                      position: 'absolute', inset: -16,
                      backgroundImage: `url(${s.logoUrl})`,
                      backgroundSize: '130%', backgroundPosition: 'center',
                      filter: 'blur(18px) brightness(0.65) saturate(1.5)',
                      transform: 'scale(1.15)',
                    }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(237,232,216,0.32)' }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 10px', zIndex: 1 }}>
                      <img
                        src={s.logoUrl}
                        alt={s.set_name}
                        loading="lazy"
                        style={{ maxWidth: '100%', maxHeight: imgH - 16, objectFit: 'contain' }}
                        onError={e => { e.currentTarget.style.display = 'none' }}
                      />
                    </div>
                  </div>

                  {/* Info area */}
                  <div style={{ padding: '8px 11px 11px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    {/* Rank + set name */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 2 }}>
                      <span style={{
                        fontFamily: 'var(--fm)', fontWeight: 800,
                        fontSize: cols <= 2 ? 18 : 22,
                        color: isTop3 ? 'var(--gold)' : 'var(--ink-light)',
                        lineHeight: 1, flexShrink: 0, letterSpacing: '-0.03em',
                      }}>
                        #{i + 1}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.set_name}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--ink-light)', marginTop: 1 }}>
                          {s.set_code?.toUpperCase()}{s.is_special_set ? ' · Special' : ''}
                        </div>
                      </div>
                    </div>
                    {/* Metric (large) + SIR count (small) */}
                    <div style={{ borderTop: '1px solid var(--cborder)', paddingTop: 7, marginTop: 5 }}>
                      <div style={{ fontFamily: 'var(--fm)', fontSize: cols <= 2 ? 18 : 21, fontWeight: 700, color: metricColor, letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {metricValue}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                        <span style={{ fontSize: 9.5, color: 'var(--ink-light)' }}>{metricLabel}</span>
                        {s.sir_count != null && (
                          <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink-mid)', fontWeight: 500 }}>{s.sir_count} SIRs</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Sealed entity — reuse SealedTab ──────────────────────────────────── */}
      {entity === 'sealed' && (
        <SealedTab setsData={setsData} loading={loading} />
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {selectedCard && (
        <CardModal card={selectedCard} setsMap={setsMap} onClose={() => setSelectedCard(null)} />
      )}
      {selectedSetRow && (
        <SetModal
          setRow={selectedSetRow}
          cards={cards}
          setsMap={setsMap}
          onClose={() => setSelectedSetRow(null)}
        />
      )}
    </div>
  )
}
