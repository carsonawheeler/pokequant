'use client'

import { useEffect, useState } from 'react'
import { Card, SetData, PricePoint, ModelPrediction } from '@/lib/types'
import { fmt, fmtP } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import PriceChart from './PriceChart'
import { MomBadge, DemBar } from './CardItem'

interface CardModalProps {
  card: Card
  setsMap: Map<number, SetData>
  onClose: () => void
}

export default function CardModal({ card, setsMap, onClose }: CardModalProps) {
  const [hist,       setHist]       = useState<PricePoint[] | null>(null)
  const [prediction, setPrediction] = useState<ModelPrediction | null | undefined>(undefined) // undefined = loading

  useEffect(() => {
    async function fetchPrediction() {
      if (!card.tcg_id) { setPrediction(null); return }
      try {
        const { data } = await supabase
          .from('model_predictions')
          .select('predicted_price, ci_lower_90, ci_upper_90, signal, ratio, prediction_confidence')
          .eq('tcg_id', card.tcg_id)
          .order('predicted_date', { ascending: false })
          .limit(1)
        setPrediction((data && data.length > 0) ? data[0] as ModelPrediction : null)
      } catch {
        setPrediction(null)
      }
    }

    async function fetchHistory() {
      try {
        const { data } = await supabase
          .from('card_price_snapshots')
          .select('snapshot_date, tcgplayer_market_price')
          .eq('card_id', card.id)
          .neq('price_source', 'ppt_historical')
          .order('snapshot_date', { ascending: true })
        const points = (data ?? []).filter(
          d => d.tcgplayer_market_price != null
        ) as PricePoint[]
        setHist(points)
      } catch {
        setHist([])
      }
    }
    fetchPrediction()
    fetchHistory()

    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [card.id, onClose])

  const d = card.demand
  const setInfo = setsMap.get(card.set?.id ?? -1)
  const packPrice = setInfo?.set_price_snapshots?.[0]?.pack_market_price ?? null

  const marketCells = [
    { label: 'Pack Price',     value: packPrice ? fmt(packPrice) : null,                               sub: 'Secondary market' },
    { label: 'Set Median SIR', value: card.set_median_sir_price ? fmt(card.set_median_sir_price) : null, sub: card.set?.set_name ?? '' },
    { label: 'eBay Avg Sale',  value: null,                                                            sub: '7-day rolling · soon' },
    { label: 'PSA 10 ROI',     value: null,                                                            sub: 'Raw → gem rate · soon' },
  ]

  return (
    <div
      className="modal-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-box">

        {/* Header */}
        <div style={{ padding: '18px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--ink-light)', marginBottom: 4 }}>
              {card.set?.set_name} · Special Illustration Rare
            </div>
            <h2 style={{ fontFamily: 'var(--fd)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.1, fontStyle: 'italic', marginBottom: 2 }}>
              {card.card_name}
            </h2>
            {card.character_name && card.character_name !== card.card_name && (
              <div style={{ fontSize: 12, color: 'var(--ink-mid)' }}>{card.character_name}</div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: 'var(--ink-light)', background: 'var(--c2)', flexShrink: 0,
            }}
          >✕</button>
        </div>

        {/* Top 2-col grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '168px 1fr', gap: 20, padding: '14px 24px 0' }}>

          {/* Card image */}
          <div>
            <div style={{
              borderRadius: 10, overflow: 'hidden', background: 'var(--c2)',
              aspectRatio: '2.5/3.5', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(26,18,8,0.12)',
            }}>
              {card.image_url
                ? <img src={card.image_url} alt={card.card_name} style={{ width: '100%', display: 'block' }} loading="lazy" />
                : <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>No image</span>
              }
            </div>
            {card.is_competitive === 1 && (
              <div style={{
                marginTop: 7, textAlign: 'center', fontSize: 10,
                color: 'var(--ink-light)', background: 'var(--c2)', borderRadius: 6, padding: '3px 8px',
              }}>
                Competitive Tier-1
              </div>
            )}
          </div>

          {/* Price + Model */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Price section */}
            <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--cborder)' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-light)', marginBottom: 5 }}>
                TCGPlayer Market Price
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 34, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {fmt(card.price)}
                </span>
                <MomBadge value={d?.price_momentum_30d} lg />
              </div>
              {(d?.price_momentum_14d != null || d?.price_momentum_30d != null) && (
                <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                  {d?.price_momentum_14d != null && (
                    <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>
                      14d:{' '}
                      <span style={{
                        fontFamily: 'var(--fm)',
                        color: (d.price_momentum_14d ?? 0) >= 0 ? 'var(--green)' : 'var(--red)',
                        fontWeight: 600,
                      }}>
                        {fmtP(d.price_momentum_14d)}
                      </span>
                    </span>
                  )}
                  {d?.price_momentum_30d != null && (
                    <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>
                      30d:{' '}
                      <span style={{
                        fontFamily: 'var(--fm)',
                        color: (d.price_momentum_30d ?? 0) >= 0 ? 'var(--green)' : 'var(--red)',
                        fontWeight: 600,
                      }}>
                        {fmtP(d.price_momentum_30d)}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Algorithmic Model Prediction */}
            <div style={{ flex: 1, padding: '12px 13px', background: 'var(--c2)', borderRadius: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-light)' }}>
                  Algorithmic Model Prediction
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '2px 7px', borderRadius: 12,
                  background: 'var(--c1)', color: 'var(--gold)', border: '1px solid var(--cborder)',
                }}>XGBoost v8</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
                {(() => {
                  const loading = prediction === undefined
                  const p = prediction

                  const signalColor = p?.signal === 'UNDERVALUED' ? 'var(--green)'
                    : p?.signal === 'OVERVALUED' ? 'var(--red)'
                    : p?.signal ? 'var(--ink)'
                    : 'var(--cborder)'

                  const fairValue = loading ? '…' : p?.predicted_price != null ? fmt(p.predicted_price) : '—'
                  const ciRange   = loading ? '…' : (p?.ci_lower_90 != null && p?.ci_upper_90 != null)
                    ? `${fmt(p.ci_lower_90)} – ${fmt(p.ci_upper_90)}`
                    : '—'
                  const signal    = loading ? '…' : p?.signal ?? '—'

                  return [
                    { title: 'Fair Value',   value: fairValue,  valueColor: 'var(--ink)',  desc: "Model's estimated price" },
                    { title: '90% CI Range', value: ciRange,    valueColor: 'var(--ink)',  desc: 'Price band model is 90% confident in' },
                    { title: 'Signal',       value: signal,     valueColor: signalColor,   desc: 'Under/fair/overvalued vs model' },
                  ].map(cell => (
                    <div key={cell.title} style={{ background: 'var(--c1)', borderRadius: 7, padding: '8px 7px', textAlign: 'center' }}>
                      <div style={{
                        fontFamily: 'var(--fm)', fontWeight: 600, marginBottom: 3,
                        fontSize: cell.value.length > 12 ? 11 : 17,
                        color: cell.value === '—' || cell.value === '…' ? 'var(--cborder)' : cell.valueColor,
                      }}>
                        {cell.value}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--ink)', fontWeight: 600, marginBottom: 2 }}>{cell.title}</div>
                      <div style={{ fontSize: 9, color: 'var(--ink-light)', lineHeight: 1.3 }}>{cell.desc}</div>
                    </div>
                  ))
                })()}
              </div>
              {prediction === null && (
                <div style={{ marginTop: 9, fontSize: 10, color: 'var(--ink-light)', textAlign: 'center' }}>
                  Predictions syncing to database — available soon
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Market data strip */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          margin: '14px 24px 0', borderRadius: 9, overflow: 'hidden',
          border: '1px solid var(--cborder)',
        }}>
          {marketCells.map((item, i) => (
            <div key={i} style={{
              padding: '10px 13px', background: 'var(--c1)',
              borderRight: i < 3 ? '1px solid var(--cborder)' : 'none',
            }}>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-light)', marginBottom: 4 }}>
                {item.label}
              </div>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 600, color: item.value ? 'var(--ink)' : 'var(--cborder)' }}>
                {item.value ?? '—'}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--ink-light)', marginTop: 2 }}>{item.sub}</div>
            </div>
          ))}
        </div>

        {/* Demand score */}
        {d?.demand_score != null && (
          <div style={{
            margin: '12px 24px 0', padding: '10px 14px',
            background: 'var(--c2)', borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-light)', marginBottom: 5 }}>
                Demand Score
              </div>
              <DemBar score={d.demand_score} noLabel />
            </div>
            <div style={{ flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 20, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                {d.demand_score.toFixed(1)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>/10</span>
            </div>
          </div>
        )}

        {/* Price history */}
        <div style={{ padding: '14px 24px 24px' }}>
          <div style={{ borderTop: '1px solid var(--cborder)', paddingTop: 16 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-light)', marginBottom: 12 }}>
              Price History
            </div>
            <PriceChart data={hist} />
          </div>
        </div>

      </div>
    </div>
  )
}
