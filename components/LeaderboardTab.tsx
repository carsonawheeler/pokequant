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
type SetSortMode = 'premium_score' | 'avg_sir' | 'box_change' | 'release_date'

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
  { id: 'premium_score', label: 'Set Premium Score' },
  { id: 'avg_sir',       label: 'Avg SIR Price' },
  { id: 'box_change',    label: '30d Price Change' },
  { id: 'release_date',  label: 'Release Date' },
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
  const [setSort,        setSetSort]        = useState<SetSortMode>('premium_score')
  const [query,          setQuery]          = useState('')
  const [selectedCard,   setSelectedCard]   = useState<Card | null>(null)
  const [selectedSetRow, setSelectedSetRow] = useState<SetRow | null>(null)
  const [ebayMap,        setEbayMap]        = useState<Record<string, LatestEbaySnap>>({})
  const [tcgSalesMap,    setTcgSalesMap]    = useState<Record<string, number>>({})
  const [dataLoading,    setDataLoading]    = useState(false)
  const [dataFetched,    setDataFetched]    = useState(false)

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
      case 'premium_score': return base.sort((a, b) => (b.set_premium_score ?? 0) - (a.set_premium_score ?? 0))
      case 'avg_sir':       return base.sort((a, b) => (b.median ?? 0) - (a.median ?? 0))
      case 'box_change':    return base.sort((a, b) => {
        const av = computeBoxChange30d(a.set_price_snapshots ?? [])
        const bv = computeBoxChange30d(b.set_price_snapshots ?? [])
        return (typeof bv === 'number' ? bv : -999) - (typeof av === 'number' ? av : -999)
      })
      case 'release_date':  return base.sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''))
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
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
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

          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '36px 56px 1fr 130px 120px',
            padding: '5px 16px', gap: 14, marginBottom: 5,
            fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--ink-light)',
          }}>
            <span /><span /><span>Card</span>
            <span style={{ textAlign: 'right' }}>{CARD_SORTS.find(m => m.id === cardSort)?.label}</span>
            <span style={{ textAlign: 'right' }}>Price</span>
          </div>

          {/* Card rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rankedCards.map((card, i) => {
              const metric = getCardMetric(card)
              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedCard(card)}
                  style={{
                    background: 'var(--c1)', borderRadius: 10, padding: '10px 16px',
                    border: '1px solid var(--cborder)',
                    display: 'grid', gridTemplateColumns: '36px 56px 1fr 130px 120px',
                    alignItems: 'center', gap: 14,
                    boxShadow: '0 1px 4px rgba(26,18,8,0.04)', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 11, fontFamily: 'var(--fm)', color: 'var(--ink-light)' }}>#{i + 1}</span>
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
                      color: cardMetricColor(metric), letterSpacing: '-0.02em',
                    }}>{metric.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-light)', marginTop: 2 }}>{metric.sub}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>
                    {fmt(card.price)}
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

          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '36px 48px 1fr 90px 120px 100px',
            padding: '5px 16px', gap: 14, marginBottom: 5,
            fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--ink-light)',
          }}>
            <span>#</span><span /><span>Set</span>
            <span style={{ textAlign: 'right' }}>Premium</span>
            <span style={{ textAlign: 'right' }}>Median SIR</span>
            <span style={{ textAlign: 'right' }}>Box 30d</span>
          </div>

          {/* Set rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rankedSetRows.map((s, i) => {
              const boxChange = computeBoxChange30d(s.set_price_snapshots ?? [])
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedSetRow(s)}
                  style={{
                    background: 'var(--c1)', borderRadius: 10, padding: '10px 16px',
                    border: '1px solid var(--cborder)',
                    display: 'grid', gridTemplateColumns: '36px 48px 1fr 90px 120px 100px',
                    alignItems: 'center', gap: 14,
                    boxShadow: '0 1px 4px rgba(26,18,8,0.04)', cursor: 'pointer',
                  }}
                >
                  <span style={{
                    fontSize: 11, fontFamily: 'var(--fm)',
                    color: i < 3 ? 'var(--gold)' : 'var(--ink-light)',
                    fontWeight: i < 3 ? 700 : 400,
                  }}>#{i + 1}</span>

                  <div style={{ width: 48, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img
                      src={s.logoUrl} alt={s.set_name} loading="lazy"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      onError={e => { e.currentTarget.style.display = 'none' }}
                    />
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{s.set_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 1 }}>
                      {s.set_code?.toUpperCase()}
                      {s.is_special_set && <span style={{ marginLeft: 6, color: 'var(--gold)', fontWeight: 700 }}>· Special</span>}
                    </div>
                  </div>

                  <div style={{
                    textAlign: 'right', fontFamily: 'var(--fm)', fontSize: 14, fontWeight: 500,
                    color: s.set_premium_score != null ? 'var(--ink)' : 'var(--cborder)',
                  }}>
                    {s.set_premium_score != null ? s.set_premium_score.toFixed(1) : '—'}
                  </div>

                  <div style={{
                    textAlign: 'right', fontFamily: 'var(--fm)', fontSize: 14, fontWeight: 500,
                    color: s.median ? 'var(--ink)' : 'var(--cborder)',
                  }}>
                    {fmt(s.median)}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {typeof boxChange === 'number' ? (
                      <span style={{
                        fontFamily: 'var(--fm)', fontSize: 13, fontWeight: 600,
                        color: boxChange >= 0 ? 'var(--green)' : 'var(--red)',
                      }}>
                        {boxChange >= 0 ? '+' : ''}{boxChange.toFixed(1)}%
                      </span>
                    ) : boxChange === 'insufficient' ? (
                      <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>{'< 30d data'}</span>
                    ) : <span style={{ color: 'var(--cborder)', fontSize: 13 }}>—</span>}
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
