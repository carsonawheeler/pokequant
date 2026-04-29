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

interface SetRow extends SetData {
  median:   number | null
  packPrice: number | null
  boxPrice:  number | null
  etbPrice:  number | null
  logoUrl:   string
}

// ── Set detail modal ──────────────────────────────────────────────────────────

function SetModal({ setRow, cards, setsMap, onClose }: {
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
    { label: 'ETB Price',   value: setRow.etbPrice  ? fmt(setRow.etbPrice)  : null, sub: setRow.is_special_set ? 'Primary sealed product' : undefined, highlight: !!setRow.etbPrice && !!setRow.is_special_set },
    { label: 'Box Price',   value: setRow.boxPrice  ? fmt(setRow.boxPrice)  : null, sub: undefined, highlight: false },
    { label: 'Pack Price',  value: setRow.packPrice ? fmt(setRow.packPrice) : null, sub: undefined, highlight: false },
    { label: 'Median SIR',  value: setRow.median    ? fmt(setRow.median)    : null, sub: undefined, highlight: false },
    { label: 'Total Value', value: totalValue > 0   ? fmt(totalValue)       : null, sub: undefined, highlight: false },
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
        <div className="modal-padding" style={{ padding: '16px 24px 24px' }}>
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
  const [view,        setView]        = useState<'grid' | 'leaderboard'>('grid')
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
      logoUrl:   `https://images.pokemontcg.io/${s.set_code}/logo.png`,
    }))
  }, [cards, setsData])

  const filtered = useMemo(() => {
    const base = view === 'leaderboard'
      ? [...rows].sort((a, b) => (b.median ?? 0) - (a.median ?? 0))
      : rows
    if (!query.trim()) return base
    const q = query.trim().toLowerCase()
    return base.filter(s => s.set_name.toLowerCase().includes(q) || s.set_code.toLowerCase().includes(q))
  }, [rows, view, query])

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

        <div style={{ display: 'flex', gap: 4, background: 'var(--c1)', border: '1px solid var(--cborder)', borderRadius: 8, padding: 3 }}>
          {([{ id: 'grid', label: '⊞  Grid' }, { id: 'leaderboard', label: '↕  Leaderboard' }] as const).map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              style={{
                padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: view === v.id ? 'var(--ink)' : 'transparent',
                color: view === v.id ? 'var(--c1)' : 'var(--ink-mid)',
                transition: 'all 0.15s',
              }}
            >
              {v.label}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>
          {filtered.length} sets{view === 'grid' ? ' · release order' : ' · ranked by median SIR price'}
        </span>
      </div>

      {/* GRID VIEW */}
      {view === 'grid' && (
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
                height: 100, background: 'var(--c2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderBottom: '1px solid var(--cborder)', padding: '12px 20px',
              }}>
                <img
                  src={s.logoUrl}
                  alt={s.set_name}
                  loading="lazy"
                  style={{ maxWidth: '100%', maxHeight: 72, objectFit: 'contain' }}
                  onError={e => {
                    const img = e.currentTarget
                    img.style.display = 'none'
                    const sib = img.nextElementSibling as HTMLElement | null
                    if (sib) sib.style.display = 'block'
                  }}
                />
                <span style={{ display: 'none', fontFamily: 'var(--fd)', fontSize: 15, fontStyle: 'italic', color: 'var(--ink-mid)' }}>
                  {s.set_name}
                </span>
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
                        <div style={{ fontSize: 9.5, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Median SIR</div>
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
      )}

      {/* LEADERBOARD VIEW */}
      {view === 'leaderboard' && (
        <div>
          <div className="lb-head" style={{
            display: 'grid',
            gridTemplateColumns: '40px 48px 1fr 130px 110px 110px 110px 72px',
            padding: '6px 16px', gap: 14, marginBottom: 6,
            fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--ink-light)',
          }}>
            <span>#</span><span></span><span>Set</span>
            <span style={{ textAlign: 'right' }}>Median SIR</span>
            <span className="lb-box-header" style={{ textAlign: 'right' }}>Pack</span>
            <span className="lb-box-header" style={{ textAlign: 'right' }}>Box</span>
            <span className="lb-box-header" style={{ textAlign: 'right' }}>ETB</span>
            <span />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {filtered.map((s, i) => (
              <div
                key={s.id}
                className="lb-row"
                onClick={() => setSelectedSet(s)}
                style={{
                  background: 'var(--c1)', borderRadius: 10, padding: '11px 16px',
                  border: '1px solid var(--cborder)',
                  display: 'grid',
                  gridTemplateColumns: '40px 48px 1fr 130px 110px 110px 110px 72px',
                  alignItems: 'center', gap: 14,
                  boxShadow: '0 1px 4px rgba(26,18,8,0.04)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontFamily: 'var(--fm)', fontSize: 13, fontWeight: i < 3 ? 700 : 400, color: i < 3 ? 'var(--gold)' : 'var(--ink-light)' }}>
                  {i + 1}
                </span>
                <div style={{ width: 48, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={s.logoUrl}
                    alt={s.set_name}
                    loading="lazy"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{s.set_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 1 }}>
                    {s.set_code?.toUpperCase()} · {s.sir_count} SIRs
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{fmt(s.median)}</div>
                <div className="lb-box-cell" style={{ textAlign: 'right', fontFamily: 'var(--fm)', fontSize: 14, color: 'var(--ink-mid)' }}>{fmt(s.packPrice)}</div>
                <div className="lb-box-cell" style={{ textAlign: 'right', fontFamily: 'var(--fm)', fontSize: 14, color: 'var(--ink-mid)' }}>{fmt(s.boxPrice)}</div>
                <div className="lb-box-cell" style={{ textAlign: 'right', fontFamily: 'var(--fm)', fontSize: 14, color: s.etbPrice && s.is_special_set ? 'var(--gold)' : 'var(--ink-mid)' }}>{fmt(s.etbPrice)}</div>
                <div className="lb-badge-cell" style={{ textAlign: 'right' }}>
                  {s.is_special_set && (
                    <span style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 20,
                      background: 'var(--c2)', color: 'var(--gold)', fontWeight: 700,
                      border: '1px solid var(--gold-l)',
                    }}>Special</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
