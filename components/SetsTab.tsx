'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, SetData, ModelPrediction } from '@/lib/types'
import { fmt } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { MomBadge } from './CardItem'
import CardModal from './CardModal'

interface SetsTabProps {
  cards: Card[]
  setsData: SetData[]
  loading: boolean
  setsMap: Map<number, SetData>
}

export interface SetRow extends SetData {
  median:    number | null
  packPrice: number | null
  boxPrice:  number | null
  etbPrice:  number | null
  logoUrl:   string
}

// ── Set detail modal ──────────────────────────────────────────────────────────

export function SetModal({ setRow, cards, setsMap, onClose }: {
  setRow:  SetRow
  cards:   Card[]
  setsMap: Map<number, SetData>
  onClose: () => void
}) {
  const [predictions,   setPredictions]   = useState<Record<string, ModelPrediction>>({})
  const [selectedCard,  setSelectedCard]  = useState<Card | null>(null)

  const setCards = useMemo(() =>
    cards
      .filter(c => c.set?.id === setRow.id && c.price != null)
      .sort((a, b) => (b.price ?? 0) - (a.price ?? 0)),
    [cards, setRow.id]
  )

  const top5       = setCards.slice(0, 5)
  const totalValue = setCards.reduce((s, c) => s + (c.price ?? 0), 0)

  // Cards with pull odds data
  const cardsWithOdds = useMemo(() =>
    setCards.filter(c => c.specific_card_odds != null && c.specific_card_odds > 0),
    [setCards]
  )

  useEffect(() => {
    const tcgIds = top5.map(c => c.tcg_id).filter(Boolean) as string[]
    if (tcgIds.length) {
      supabase
        .from('model_predictions')
        .select('tcg_id, signal, ratio, prediction_confidence, predicted_price')
        .in('tcg_id', tcgIds)
        .order('predicted_date', { ascending: false })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(({ data }) => {
          const map: Record<string, ModelPrediction> = {}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(data ?? []).forEach((p: any) => {
            if (!map[p.tcg_id]) map[p.tcg_id] = p as ModelPrediction
          })
          setPredictions(map)
        })
    }

    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRow.id, onClose])

  const signalColor = (s: string | null | undefined) =>
    s === 'UNDERVALUED' ? 'var(--green)' : s === 'OVERVALUED' ? 'var(--red)' : 'var(--ink-mid)'

  const dataCells = [
    { label: 'ETB Price',      value: setRow.etbPrice  ? fmt(setRow.etbPrice)  : null, sub: setRow.is_special_set ? 'Primary sealed product' : undefined, highlight: !!setRow.etbPrice && !!setRow.is_special_set },
    { label: 'Box Price',      value: setRow.boxPrice  ? fmt(setRow.boxPrice)  : null, sub: undefined, highlight: false },
    { label: 'Pack Price',     value: setRow.packPrice ? fmt(setRow.packPrice) : null, sub: undefined, highlight: false },
    { label: 'Avg SIR Price',  value: setRow.median    ? fmt(setRow.median)    : null, sub: undefined, highlight: false },
    { label: 'Total Value',    value: totalValue > 0   ? fmt(totalValue)       : null, sub: undefined, highlight: false },
  ]

  return (
    <>
    <div
      className="modal-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-box">

        {/* Header */}
        <div className="modal-padding" style={{
          padding: '18px 24px 0',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img
              src={setRow.logoUrl}
              alt={setRow.set_name}
              style={{ height: 44, objectFit: 'contain', flexShrink: 0 }}
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--ink-light)', marginBottom: 3 }}>
                {setRow.era} Era · {setRow.set_code?.toUpperCase()}
                {setRow.is_special_set && (
                  <span style={{ marginLeft: 8, color: 'var(--gold)', fontWeight: 700 }}>Special</span>
                )}
              </div>
              <h2 style={{ fontFamily: 'var(--fd)', fontSize: 24, color: 'var(--ink)', lineHeight: 1.1, fontStyle: 'italic', marginBottom: 3 }}>
                {setRow.set_name}
              </h2>
              <div style={{ fontSize: 12, color: 'var(--ink-mid)' }}>
                {setCards.length} SIRs tracked
                {setRow.sir_count != null ? ` of ${setRow.sir_count}` : ''}
              </div>
            </div>
          </div>

          <button
            className="modal-close-btn"
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 7, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: 'var(--ink-light)', background: 'var(--c2)',
            }}
          >✕</button>
        </div>

        {/* Data strip */}
        <div className="modal-market-grid modal-padding" style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
          margin: '16px 24px 0', borderRadius: 9, overflow: 'hidden',
          border: '1px solid var(--cborder)',
        }}>
          {dataCells.map((cell, i) => (
            <div key={i} className="modal-market-cell" style={{
              padding: '10px 13px', background: 'var(--c1)',
              borderRight: i < 4 ? '1px solid var(--cborder)' : 'none',
            }}>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-light)', marginBottom: 4 }}>
                {cell.label}
              </div>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 600, color: cell.value ? (cell.highlight ? 'var(--gold)' : 'var(--ink)') : 'var(--cborder)' }}>
                {cell.value ?? '—'}
              </div>
              {cell.sub && (
                <div style={{ fontSize: 9, color: 'var(--gold)', marginTop: 2 }}>{cell.sub}</div>
              )}
            </div>
          ))}
        </div>

        {/* Top 5 leaderboard */}
        <div className="modal-padding" style={{ padding: '16px 24px 0' }}>
          <div style={{ borderTop: '1px solid var(--cborder)', paddingTop: 14 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-light)', marginBottom: 10 }}>
              Top Cards by Market Price
            </div>

            {top5.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-light)', textAlign: 'center', padding: '20px 0' }}>
                No price data available for this set
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {top5.map((card, i) => {
                  const pred = card.tcg_id ? predictions[card.tcg_id] : null
                  const pullCost = card.pull_cost
                  const pullOdds = card.specific_card_odds
                  return (
                    <div
                      key={card.id}
                      onClick={() => setSelectedCard(card)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '24px 44px 1fr auto auto',
                        alignItems: 'center', gap: 10,
                        background: 'var(--c2)', borderRadius: 8, padding: '8px 12px',
                        cursor: 'pointer',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--cborder)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--c2)' }}
                    >
                      <span style={{
                        fontFamily: 'var(--fm)', fontSize: 11,
                        color: i < 3 ? 'var(--gold)' : 'var(--ink-light)',
                        fontWeight: i < 3 ? 700 : 400,
                      }}>
                        #{i + 1}
                      </span>

                      <div style={{ width: 44, height: 60 }}>
                        {card.image_url
                          ? <img src={card.image_url} alt={card.card_name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          : <div style={{ width: '100%', height: '100%', background: 'var(--c1)', borderRadius: 4 }} />
                        }
                      </div>

                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', lineHeight: 1.25 }}>
                          {card.card_name}
                        </div>
                        {card.character_name && card.character_name !== card.card_name && (
                          <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 1 }}>
                            {card.character_name}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                          {pullCost != null && (
                            <span style={{ fontSize: 9.5, color: 'var(--ink-light)', fontFamily: 'var(--fm)' }}>
                              Pull cost {fmt(pullCost)}
                            </span>
                          )}
                          {pullOdds != null && pullOdds > 0 && (
                            <span style={{ fontSize: 9.5, color: 'var(--ink-light)' }}>
                              1 in {Math.round(1 / pullOdds)} packs
                            </span>
                          )}
                        </div>
                      </div>

                      {pred?.signal ? (
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap',
                          padding: '2px 7px', borderRadius: 12,
                          background: 'var(--c1)', border: '1px solid var(--cborder)',
                          color: signalColor(pred.signal),
                        }}>
                          {pred.signal}
                        </span>
                      ) : <span />}

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                          {fmt(card.price)}
                        </div>
                        <MomBadge value={card.demand?.price_momentum_30d} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Pull rates section */}
        {cardsWithOdds.length > 0 && (
          <div className="modal-padding" style={{ padding: '16px 24px 0' }}>
            <div style={{ borderTop: '1px solid var(--cborder)', paddingTop: 14 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-light)', marginBottom: 10 }}>
                Pull Rates
              </div>

              {/* Group header — all cards in this modal are SIRs */}
              <div style={{ marginBottom: 8 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--gold)', marginBottom: 6,
                }}>
                  Special Illustration Rares
                  {(() => {
                    // Use shared odds if all cards have the same rate
                    const odds = cardsWithOdds.map(c => c.specific_card_odds!)
                    const allSame = odds.every(o => Math.abs(o - odds[0]) < 0.0001)
                    return allSame
                      ? <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}> · 1 in {Math.round(1 / odds[0])} packs</span>
                      : null
                  })()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {cardsWithOdds.map(card => {
                    const odds = card.specific_card_odds!
                    const allSame = cardsWithOdds.every(c => Math.abs((c.specific_card_odds ?? 0) - (cardsWithOdds[0].specific_card_odds ?? 0)) < 0.0001)
                    return (
                      <div
                        key={card.id}
                        onClick={() => setSelectedCard(card)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 10px', borderRadius: 7, background: 'var(--c2)',
                          cursor: 'pointer', transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--cborder)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--c2)' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {card.card_name}
                          </span>
                          {!allSame && (
                            <span style={{ fontSize: 10, color: 'var(--ink-light)', whiteSpace: 'nowrap' }}>
                              1 in {Math.round(1 / odds)} packs
                            </span>
                          )}
                        </div>
                        <span style={{ fontFamily: 'var(--fm)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', flexShrink: 0 }}>
                          {fmt(card.price)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ height: 24 }} />

      </div>
    </div>

      {selectedCard && (
        <CardModal
          card={selectedCard}
          setsMap={setsMap}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </>
  )
}

// ── Main SetsTab ──────────────────────────────────────────────────────────────

export default function SetsTab({ cards, setsData, loading, setsMap }: SetsTabProps) {
  const [gridSort,    setGridSort]    = useState<'newest' | 'oldest'>('newest')
  const [query,       setQuery]       = useState('')
  const [selectedSet, setSelectedSet] = useState<SetRow | null>(null)

  const rows = useMemo<SetRow[]>(() => {
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

  const filtered = useMemo(() => {
    const base = [...rows].sort((a, b) => {
      const ad = a.release_date ?? ''
      const bd = b.release_date ?? ''
      if (!ad && !bd) return b.id - a.id
      if (!ad) return 1
      if (!bd) return -1
      return gridSort === 'newest' ? bd.localeCompare(ad) : ad.localeCompare(bd)
    })
    if (!query.trim()) return base
    const q = query.trim().toLowerCase()
    return base.filter(s => s.set_name.toLowerCase().includes(q) || s.set_code.toLowerCase().includes(q))
  }, [rows, gridSort, query])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="shimmer" style={{ height: 58, borderRadius: 10 }} />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', position: 'relative' }}>
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
            placeholder="Search sets…"
            style={{
              width: '100%', padding: '9px 12px 9px 32px',
              background: 'var(--c1)', border: '1px solid var(--cborder)',
              borderRadius: 8, fontSize: 13, color: 'var(--ink)', outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--cborder)')}
          />
        </div>

        {/* Sort toggle */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--c1)', border: '1px solid var(--cborder)', borderRadius: 8, padding: 3 }}>
          {([{ id: 'newest', label: 'Newest First' }, { id: 'oldest', label: 'Oldest First' }] as const).map(v => (
            <button
              key={v.id}
              onClick={() => setGridSort(v.id)}
              style={{
                padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: gridSort === v.id ? 'var(--ink)' : 'transparent',
                color: gridSort === v.id ? 'var(--c1)' : 'var(--ink-mid)',
                transition: 'all 0.15s',
              }}
            >
              {v.label}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>
          {filtered.length} sets · {gridSort === 'newest' ? 'newest first' : 'oldest first'}
        </span>
      </div>

      {/* GRID VIEW */}
      <div className="sets-grid">
        {filtered.map(s => (
          <div
            key={s.id}
            className="card-item"
            onClick={() => setSelectedSet(s)}
            style={{
              background: 'var(--c1)', borderRadius: 12,
              border: '1px solid var(--cborder)', overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(26,18,8,0.05)',
              cursor: 'pointer',
            }}
          >
            <div style={{
              height: 100, position: 'relative', overflow: 'hidden',
              borderBottom: '1px solid var(--cborder)',
            }}>
              {/* Blurred logo background */}
              <div style={{
                position: 'absolute', inset: -8,
                backgroundImage: `url(${s.logoUrl})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                filter: 'blur(14px) brightness(0.7) saturate(1.4)',
                transform: 'scale(1.12)',
              }} />
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(237,232,216,0.32)' }} />
              {/* Logo image */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 20px', zIndex: 1 }}>
                <img
                  src={s.logoUrl}
                  alt={s.set_name}
                  loading="lazy"
                  style={{ maxWidth: '100%', maxHeight: 72, objectFit: 'contain' }}
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
              </div>
            </div>

            <div style={{ padding: '10px 14px 13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 3 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', lineHeight: 1.25, flex: 1 }}>
                  {s.set_name}
                </span>
                {s.is_special_set && (
                  <span style={{
                    fontSize: 9, padding: '2px 7px', borderRadius: 20,
                    background: 'var(--c2)', color: 'var(--gold)', fontWeight: 700,
                    border: '1px solid var(--gold-l)', whiteSpace: 'nowrap',
                  }}>
                    Special
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-light)', marginBottom: 10 }}>
                {s.set_code?.toUpperCase()} · {s.sir_count} SIRs
              </div>
              <div style={{ borderTop: '1px solid var(--cborder)', paddingTop: 9, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  {s.etbPrice != null ? (
                    <>
                      <div style={{ fontSize: 9.5, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>ETB Price</div>
                      <div style={{ fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 600, color: s.is_special_set ? 'var(--gold)' : 'var(--ink)' }}>{fmt(s.etbPrice)}</div>
                    </>
                  ) : s.boxPrice != null ? (
                    <>
                      <div style={{ fontSize: 9.5, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Box Price</div>
                      <div style={{ fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{fmt(s.boxPrice)}</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 9.5, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Avg SIR Price</div>
                      <div style={{ fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{fmt(s.median)}</div>
                    </>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 9.5, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Pack Price</div>
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 600, color: 'var(--ink-mid)' }}>{fmt(s.packPrice)}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Set detail modal */}
      {selectedSet && (
        <SetModal
          setRow={selectedSet}
          cards={cards}
          setsMap={setsMap}
          onClose={() => setSelectedSet(null)}
        />
      )}
    </div>
  )
}
