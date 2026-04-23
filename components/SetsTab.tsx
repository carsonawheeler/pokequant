'use client'

import { useState, useMemo } from 'react'
import { Card, SetData } from '@/lib/types'
import { fmt } from '@/lib/utils'

interface SetsTabProps {
  cards: Card[]
  setsData: SetData[]
  loading: boolean
}

export default function SetsTab({ cards, setsData, loading }: SetsTabProps) {
  const [view,  setView]  = useState<'grid' | 'leaderboard'>('grid')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const medMap: Record<number, number> = {}
    cards.forEach(c => { if (c.set?.id && c.set_median_sir_price != null) medMap[c.set.id] = c.set_median_sir_price })
    return setsData.map(s => ({
      ...s,
      median:    medMap[s.id] ?? null,
      packPrice: s.set_price_snapshots?.[0]?.pack_market_price ?? null,
      boxPrice:  s.set_price_snapshots?.[0]?.booster_box_market_price ?? null,
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
            <div key={s.id} className="card-item" style={{
              background: 'var(--c1)', borderRadius: 12,
              border: '1px solid var(--cborder)', overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(26,18,8,0.05)',
            }}>
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
                    <div style={{ fontSize: 9.5, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Median SIR</div>
                    <div style={{ fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{fmt(s.median)}</div>
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
            gridTemplateColumns: '40px 48px 1fr 130px 120px 120px 72px',
            padding: '6px 16px', gap: 14, marginBottom: 6,
            fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--ink-light)',
          }}>
            <span>#</span><span></span><span>Set</span>
            <span style={{ textAlign: 'right' }}>Median SIR</span>
            <span className="lb-box-header" style={{ textAlign: 'right' }}>Pack</span>
            <span className="lb-box-header" style={{ textAlign: 'right' }}>Box</span>
            <span />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {filtered.map((s, i) => (
              <div key={s.id} className="lb-row" style={{
                background: 'var(--c1)', borderRadius: 10, padding: '11px 16px',
                border: '1px solid var(--cborder)',
                display: 'grid',
                gridTemplateColumns: '40px 48px 1fr 130px 120px 120px 72px',
                alignItems: 'center', gap: 14,
                boxShadow: '0 1px 4px rgba(26,18,8,0.04)',
              }}>
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
    </div>
  )
}
