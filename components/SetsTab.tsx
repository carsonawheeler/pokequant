'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, SetData, ModelPrediction, SetPriceSnapshot } from '@/lib/types'
import { fmt } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { MomBadge } from './CardItem'
import CardModal from './CardModal'
import SealedProductModal, { ProductTab, computeChange, ChangeBadge } from './SealedProductModal'

// ── Static pull rate lookup — sourced from pull_rates_by_set.csv ──────────────
// rate = "1 in X packs" for any card of that rarity (pull_rate_1_in_x_packs)
// count = number of cards in that rarity slot
type RarityPullData = { rate: number; count: number }
const PULL_RATE_TABLE: Record<string, Partial<Record<string, RarityPullData>>> = {
  sv1:      { 'Special Illustration Rare': { rate: 31.7, count: 10 }, 'Hyper Rare': { rate: 54.1, count: 6 },  'Illustration Rare': { rate: 13.0, count: 24 }, 'Ultra Rare': { rate: 15.2, count: 20 }, 'Double Rare': { rate: 7.3, count: 12 } },
  sv2:      { 'Special Illustration Rare': { rate: 31.5, count: 15 }, 'Hyper Rare': { rate: 56.8, count: 9 },  'Illustration Rare': { rate: 13.0, count: 36 }, 'Ultra Rare': { rate: 15.1, count: 26 }, 'Double Rare': { rate: 7.3, count: 17 } },
  sv3:      { 'Special Illustration Rare': { rate: 31.9, count: 6  }, 'Hyper Rare': { rate: 52.1, count: 3 },  'Illustration Rare': { rate: 13.2, count: 12 }, 'Ultra Rare': { rate: 15.1, count: 12 }, 'Double Rare': { rate: 7.3, count: 21 } },
  sv3pt5:   { 'Special Illustration Rare': { rate: 32.2, count: 7  }, 'Hyper Rare': { rate: 51.5, count: 3 },  'Illustration Rare': { rate: 11.8, count: 16 }, 'Ultra Rare': { rate: 15.5, count: 16 }, 'Double Rare': { rate: 7.5, count: 12 } },
  sv4:      { 'Special Illustration Rare': { rate: 47.4, count: 15 }, 'Hyper Rare': { rate: 82.0, count: 7 },  'Illustration Rare': { rate: 13.0, count: 34 }, 'Ultra Rare': { rate: 15.1, count: 28 }, 'Double Rare': { rate: 6.4, count: 20 } },
  sv4pt5:   { 'Special Illustration Rare': { rate: 58.1, count: 8  }, 'Hyper Rare': { rate: 62.1, count: 6 },  'Illustration Rare': { rate: 13.9, count: 3  }, 'Ultra Rare': { rate: 15.1, count: 5  }, 'Double Rare': { rate: 6.3, count: 10 } },
  sv5:      { 'Special Illustration Rare': { rate: 85.5, count: 10 }, 'Hyper Rare': { rate: 138.9, count: 6 }, 'Illustration Rare': { rate: 13.0, count: 22 }, 'Ultra Rare': { rate: 15.0, count: 18 }, 'Double Rare': { rate: 5.9, count: 15 } },
  sv6:      { 'Special Illustration Rare': { rate: 85.5, count: 11 }, 'Hyper Rare': { rate: 147.1, count: 6 }, 'Illustration Rare': { rate: 12.9, count: 21 }, 'Ultra Rare': { rate: 15.1, count: 21 }, 'Double Rare': { rate: 5.9, count: 14 } },
  sv6pt5:   { 'Special Illustration Rare': { rate: 87.2, count: 5  }, 'Hyper Rare': { rate: 128.3, count: 5 }, 'Illustration Rare': { rate: 13.0, count: 15 }, 'Ultra Rare': { rate: 14.3, count: 10 }, 'Double Rare': { rate: 6.0, count: 6  } },
  sv7:      { 'Special Illustration Rare': { rate: 90.1, count: 6  }, 'Hyper Rare': { rate: 137.0, count: 3 }, 'Illustration Rare': { rate: 12.8, count: 13 }, 'Ultra Rare': { rate: 14.8, count: 11 }, 'Double Rare': { rate: 5.9, count: 14 } },
  sv8:      { 'Special Illustration Rare': { rate: 87.0, count: 11 }, 'Hyper Rare': { rate: 188.7, count: 6 }, 'Illustration Rare': { rate: 13.0, count: 23 }, 'Ultra Rare': { rate: 14.8, count: 21 }, 'Double Rare': { rate: 5.9, count: 18 } },
  sv8pt5:   { 'Special Illustration Rare': { rate: 45.0, count: 32 }, 'Hyper Rare': { rate: 178.6, count: 5 },                                                  'Ultra Rare': { rate: 13.4, count: 12 }, 'Double Rare': { rate: 6.1, count: 25 } },
  sv9:      { 'Special Illustration Rare': { rate: 86.2, count: 6  }, 'Hyper Rare': { rate: 137.0, count: 3 }, 'Illustration Rare': { rate: 11.8, count: 11 }, 'Ultra Rare': { rate: 15.3, count: 11 }, 'Double Rare': { rate: 4.9, count: 16 } },
  sv10:     { 'Special Illustration Rare': { rate: 94.3, count: 11 }, 'Hyper Rare': { rate: 149.3, count: 6 }, 'Illustration Rare': { rate: 12.1, count: 23 }, 'Ultra Rare': { rate: 15.6, count: 22 }, 'Double Rare': { rate: 5.0, count: 17 } },
  // Japanese dual-set releases — no Hyper Rare slot (uses Black White Rare instead)
  zsv10pt5: { 'Special Illustration Rare': { rate: 80.0, count: 7  },                                          'Illustration Rare': { rate: 6.1,  count: 69 }, 'Ultra Rare': { rate: 17.2, count: 8  }, 'Double Rare': { rate: 4.7, count: 6  } },
  rsv10pt5: { 'Special Illustration Rare': { rate: 80.0, count: 7  },                                          'Illustration Rare': { rate: 6.1,  count: 70 }, 'Ultra Rare': { rate: 17.2, count: 8  }, 'Double Rare': { rate: 4.7, count: 6  } },
}

// Special sets come in ETBs (~9 packs), not standard booster boxes (36 packs)
const SPECIAL_SET_CODES = new Set(['sv3pt5', 'sv4pt5', 'sv6pt5', 'sv8pt5', 'rsv10pt5', 'zsv10pt5'])
const TRACKED_RARITIES = [
  'Special Illustration Rare',
  'Illustration Rare',
  'Hyper Rare',
  'Ultra Rare',
  'Double Rare',
]

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
  const [sealedFocus,   setSealedFocus]   = useState<ProductTab | null>(null)

  const setCards = useMemo(() =>
    cards
      .filter(c => c.set?.id === setRow.id && c.price != null)
      .sort((a, b) => (b.price ?? 0) - (a.price ?? 0)),
    [cards, setRow.id]
  )

  const top5       = setCards.slice(0, 5)
  const totalValue = setCards.reduce((s, c) => s + (c.price ?? 0), 0)

  // Pull rates from static lookup — covers all SV era sets with complete data
  const isSpecialSet = SPECIAL_SET_CODES.has(setRow.set_code ?? '')
  const packsPerProduct = isSpecialSet ? 9 : 36
  const productLabel    = isSpecialSet ? 'Per ETB (9 packs)' : 'Per Box (36 packs)'

  const pullRates = useMemo(() => {
    const setData = PULL_RATE_TABLE[setRow.set_code ?? '']
    if (!setData) return []
    return TRACKED_RARITIES
      .filter(r => setData[r] != null)
      .map(r => ({ rarity: r, ...setData[r]! }))
  }, [setRow.set_code])

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
                              1 in {Math.round(pullOdds).toLocaleString()} packs
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

        {/* Pull rates table */}
        {pullRates.length > 0 && (
          <div className="modal-padding" style={{ padding: '16px 24px 0' }}>
            <div style={{ borderTop: '1px solid var(--cborder)', paddingTop: 14 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-light)', marginBottom: 10 }}>
                Pull Rates
              </div>

              {/* Table */}
              <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--cborder)' }}>
                {/* Header */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 90px 100px',
                  background: 'var(--ink)', padding: '7px 12px', gap: 8,
                  fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.6)',
                }}>
                  <span>Rarity</span>
                  <span style={{ textAlign: 'right' }}>Any Card</span>
                  <span style={{ textAlign: 'right' }}>{productLabel}</span>
                </div>

                {/* Rows */}
                {pullRates.map((row, i) => {
                  const perProduct = packsPerProduct / row.rate
                  return (
                    <div
                      key={row.rarity}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 90px 100px',
                        padding: '9px 12px', gap: 8, alignItems: 'center',
                        background: i % 2 === 0 ? 'var(--c2)' : 'var(--c1)',
                        borderTop: '1px solid var(--cborder)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>{row.rarity}</div>
                        <div style={{ fontSize: 10, color: 'var(--ink-light)', marginTop: 1 }}>{row.count} cards</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--fm)', color: 'var(--ink-mid)', fontSize: 12 }}>
                          1 in {Math.round(row.rate).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 9.5, color: 'var(--ink-light)', marginTop: 1 }}>packs</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--fm)', color: 'var(--gold)', fontWeight: 600, fontSize: 13 }}>
                          {perProduct < 0.1 ? perProduct.toFixed(2) : perProduct.toFixed(1)}
                        </div>
                        <div style={{ fontSize: 9.5, color: 'var(--ink-light)', marginTop: 1 }}>cards</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ fontSize: 9.5, color: 'var(--ink-light)', marginTop: 7, lineHeight: 1.4 }}>
                Odds shown are for pulling any card of that rarity. Individual card odds depend on the number of cards in the rarity slot for this set.
              </div>
            </div>
          </div>
        )}

        {/* Sealed Products — clickable cards that open price history */}
        {(setRow.boxPrice != null || setRow.etbPrice != null || setRow.packPrice != null) && (
          <div className="modal-padding" style={{ padding: '16px 24px 0' }}>
            <div style={{ borderTop: '1px solid var(--cborder)', paddingTop: 14 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-light)', marginBottom: 10 }}>
                Sealed Products · Price History
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {(
                  [
                    { tab: 'box'    as ProductTab, label: 'Booster Box',      price: setRow.boxPrice,          key: 'booster_box_market_price'  as keyof SetPriceSnapshot },
                    { tab: 'etb'    as ProductTab, label: 'Elite Trainer Box', price: setRow.etbPrice,          key: 'etb_market_price'          as keyof SetPriceSnapshot },
                    { tab: 'pack'   as ProductTab, label: 'Booster Pack',      price: setRow.packPrice,         key: 'pack_market_price'         as keyof SetPriceSnapshot },
                    { tab: 'bundle' as ProductTab, label: 'Booster Bundle',    price: setRow.set_price_snapshots?.[0]?.bundle_price ?? null,          key: 'bundle_price'              as keyof SetPriceSnapshot },
                    { tab: 'bnb'    as ProductTab, label: 'Build & Battle',    price: setRow.set_price_snapshots?.[0]?.build_and_battle_price ?? null, key: 'build_and_battle_price'    as keyof SetPriceSnapshot },
                  ] as { tab: ProductTab; label: string; price: number | null; key: keyof SetPriceSnapshot }[]
                ).map(({ tab, label, price, key }) => {
                  if (price == null) return null
                  const snaps    = setRow.set_price_snapshots ?? []
                  const change30 = computeChange(snaps, key)
                  return (
                    <button
                      key={tab}
                      onClick={() => setSealedFocus(tab)}
                      style={{
                        background: 'var(--c2)', border: '1px solid var(--cborder)',
                        borderRadius: 9, padding: '10px 12px', textAlign: 'left' as const,
                        cursor: 'pointer', transition: 'border-color 0.12s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--gold)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cborder)' }}
                    >
                      <div style={{ fontSize: 9.5, color: 'var(--ink-light)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4 }}>
                        {label}
                      </div>
                      <div style={{ fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                        {fmt(price)}
                      </div>
                      <ChangeBadge change={change30} />
                    </button>
                  )
                })}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--ink-light)', marginTop: 7 }}>
                Click any product to view price history chart
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

      {sealedFocus && (
        <SealedProductModal
          setName={setRow.set_name}
          setCode={setRow.set_code}
          era={setRow.era}
          isSpecialSet={setRow.is_special_set}
          logoUrl={setRow.logoUrl}
          snapshots={setRow.set_price_snapshots ?? []}
          focusProduct={sealedFocus}
          onClose={() => setSealedFocus(null)}
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
                position: 'absolute', inset: -16,
                backgroundImage: `url(${s.logoUrl})`,
                backgroundSize: '130%', backgroundPosition: 'center',
                filter: 'blur(18px) brightness(0.65) saturate(1.5)',
                transform: 'scale(1.15)',
              }} />
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(237,232,216,0.32)' }} />
              {/* Logo image */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 10px', zIndex: 1 }}>
                <img
                  src={s.logoUrl}
                  alt={s.set_name}
                  loading="lazy"
                  style={{ maxWidth: '100%', maxHeight: 90, objectFit: 'contain' }}
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
