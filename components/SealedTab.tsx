'use client'

import { useState, useMemo, useEffect } from 'react'
import { SetData, SetPriceSnapshot } from '@/lib/types'
import { fmt } from '@/lib/utils'

type SealedSort = 'box' | 'etb' | 'pack' | 'box_change'

interface SealedTabProps {
  setsData: SetData[]
  loading: boolean
}

interface SealedRow extends SetData {
  latestBox:    number | null
  latestEtb:    number | null
  latestPack:   number | null
  boxChange30d: number | 'insufficient' | null
  etbChange30d: number | 'insufficient' | null
  logoUrl:      string
  chronoSnaps:  SetPriceSnapshot[]
}

// Returns number = valid %, 'insufficient' = < 25d span, null = no data
function computeChange30d(snaps: SetPriceSnapshot[], key: keyof SetPriceSnapshot): number | 'insufficient' | null {
  if (!snaps.length) return null
  const latest = snaps[0][key] as number | null
  if (latest == null) return null
  // Check if oldest snapshot is at least 25 days ago
  const oldest = snaps[snaps.length - 1]?.snapshot_date ?? ''
  const daySpan = oldest
    ? Math.floor((Date.now() - new Date(oldest + 'T12:00:00').getTime()) / 86400000)
    : 0
  if (daySpan < 25) return 'insufficient'
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const past = snaps.find(s => s.snapshot_date <= cutoff)
  const pastVal = past?.[key] as number | null
  if (!pastVal) return 'insufficient'
  return ((latest - pastVal) / pastVal) * 100
}

// ── Price history modal ───────────────────────────────────────────────────────

function SealedModal({ setRow, onClose }: { setRow: SealedRow; onClose: () => void }) {
  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      document.body.style.overflow = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  // Chronological snapshots for chart
  const snaps = setRow.chronoSnaps
  const latest = setRow.set_price_snapshots?.[0] ?? null

  // SVG chart
  const W = 440, H = 130, PX = 4, PY = 10
  const n = snaps.length

  const allPrices = snaps.flatMap(s => [
    s.booster_box_market_price,
    s.etb_market_price,
    s.pack_market_price,
  ]).filter((v): v is number => v != null)

  const maxP = Math.max(...allPrices, 1)
  const minP = Math.min(...allPrices, 0)
  const range = maxP - minP || 1

  const tx = (i: number) => PX + (i / Math.max(n - 1, 1)) * (W - PX * 2)
  const ty = (v: number | null) =>
    v != null ? H - PY - ((v - minP) / range) * (H - PY * 2) : null

  function pathFor(key: 'booster_box_market_price' | 'etb_market_price' | 'pack_market_price'): string {
    const pts = snaps
      .map((s, i) => ({ x: tx(i), y: ty(s[key]) }))
      .filter((p): p is { x: number; y: number } => p.y != null)
    if (!pts.length) return ''
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  }

  const months: string[] = []
  let lastM = ''
  snaps.forEach(s => {
    const m = s.snapshot_date.slice(0, 7)
    if (m !== lastM) {
      months.push(new Date(s.snapshot_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }))
      lastM = m
    }
  })

  const SERIES = [
    { key: 'booster_box_market_price' as const, label: 'Booster Box',   col: '#2d7dd2', val: latest?.booster_box_market_price, change: setRow.boxChange30d },
    { key: 'etb_market_price'         as const, label: 'Elite Trainer', col: 'var(--gold)', val: latest?.etb_market_price,      change: setRow.etbChange30d },
    { key: 'pack_market_price'        as const, label: 'Pack',          col: 'var(--ink-light)', val: latest?.pack_market_price, change: null },
  ]

  return (
    <div
      className="modal-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-box" style={{ maxWidth: 520 }}>

        {/* Header */}
        <div style={{ padding: '18px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--ink-light)', marginBottom: 3 }}>
              {setRow.era} · {setRow.set_code?.toUpperCase()}
              {setRow.is_special_set && (
                <span style={{ marginLeft: 8, color: 'var(--gold)', fontWeight: 700 }}>Special</span>
              )}
            </div>
            <h2 style={{ fontFamily: 'var(--fd)', fontSize: 22, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.1, marginBottom: 2 }}>
              {setRow.set_name}
            </h2>
            <div style={{ fontSize: 11, color: 'var(--ink-mid)' }}>
              {snaps.length} price snapshots
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

        {/* Price strip */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          margin: '14px 24px 0', borderRadius: 8, overflow: 'hidden',
          border: '1px solid var(--cborder)',
        }}>
          {SERIES.map((item, i) => (
            <div key={i} style={{
              padding: '10px 12px', background: 'var(--c1)',
              borderRight: i < 2 ? '1px solid var(--cborder)' : 'none',
            }}>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-light)', marginBottom: 4 }}>
                {item.label}
              </div>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 16, fontWeight: 600, color: item.val ? 'var(--ink)' : 'var(--cborder)' }}>
                {fmt(item.val ?? null)}
              </div>
              {item.change === 'insufficient' && (
                <div style={{ fontSize: 10, color: 'var(--ink-light)', marginTop: 2 }}>{'< 30d data'}</div>
              )}
              {typeof item.change === 'number' && (
                <div style={{ fontSize: 10, color: item.change >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
                  {item.change >= 0 ? '+' : ''}{item.change.toFixed(1)}% 30d
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Chart */}
        {snaps.length > 1 && (
          <div style={{ padding: '16px 24px 24px' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-light)', marginBottom: 8 }}>
              Price History
            </div>
            <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              {SERIES.map(s => {
                const d = pathFor(s.key)
                return d ? (
                  <path
                    key={s.key}
                    d={d}
                    fill="none"
                    stroke={s.col}
                    strokeWidth={s.key === 'pack_market_price' ? 1 : 1.5}
                    strokeLinejoin="round"
                    strokeDasharray={s.key === 'pack_market_price' ? '3 3' : undefined}
                  />
                ) : null
              })}
            </svg>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
              {SERIES.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--ink-light)' }}>
                  <div style={{ width: 16, height: 2, background: s.col, borderRadius: 1, opacity: s.key === 'pack_market_price' ? 0.6 : 1 }} />
                  {s.label}
                </div>
              ))}
            </div>

            {/* Month axis */}
            {months.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {months.slice(0, 8).map((m, i) => (
                  <span key={i} style={{ fontSize: 9, color: 'var(--ink-light)' }}>{m}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main SealedTab ────────────────────────────────────────────────────────────

export default function SealedTab({ setsData, loading }: SealedTabProps) {
  const [sort,        setSort]        = useState<SealedSort>('box')
  const [query,       setQuery]       = useState('')
  const [selectedSet, setSelectedSet] = useState<SealedRow | null>(null)

  const rows = useMemo<SealedRow[]>(() =>
    setsData
      .filter(s => (s.set_price_snapshots?.length ?? 0) > 0)
      .map(s => {
        const snaps = s.set_price_snapshots ?? []        // newest-first (already sorted in page.tsx)
        const chrono = [...snaps].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
        return {
          ...s,
          latestBox:    snaps[0]?.booster_box_market_price ?? null,
          latestEtb:    snaps[0]?.etb_market_price ?? null,
          latestPack:   snaps[0]?.pack_market_price ?? null,
          boxChange30d: computeChange30d(snaps, 'booster_box_market_price'),
          etbChange30d: computeChange30d(snaps, 'etb_market_price'),
          logoUrl:      s.logo_url ?? `https://images.pokemontcg.io/${s.set_code}/logo.png`,
          chronoSnaps:  chrono,
        }
      }),
    [setsData]
  )

  const filtered = useMemo(() => {
    let base = [...rows]
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      base = base.filter(s => s.set_name.toLowerCase().includes(q) || s.set_code.toLowerCase().includes(q))
    }
    switch (sort) {
      case 'box':        return base.sort((a, b) => (b.latestBox ?? 0) - (a.latestBox ?? 0))
      case 'etb':        return base.sort((a, b) => (b.latestEtb ?? 0) - (a.latestEtb ?? 0))
      case 'pack':       return base.sort((a, b) => (b.latestPack ?? 0) - (a.latestPack ?? 0))
      case 'box_change': return base.sort((a, b) => {
        const av = typeof a.boxChange30d === 'number' ? a.boxChange30d : -999
        const bv = typeof b.boxChange30d === 'number' ? b.boxChange30d : -999
        return bv - av
      })
    }
  }, [rows, sort, query])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="shimmer" style={{ height: 56, borderRadius: 10 }} />
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

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {([
            { id: 'box',        label: 'Box Price' },
            { id: 'etb',        label: 'ETB Price' },
            { id: 'pack',       label: 'Pack Price' },
            { id: 'box_change', label: '30d Change' },
          ] as const).map(s => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: sort === s.id ? 'var(--ink)' : 'var(--c1)',
                color:      sort === s.id ? 'var(--c1)' : 'var(--ink-mid)',
                border:     `1px solid ${sort === s.id ? 'var(--ink)' : 'var(--cborder)'}`,
                transition: 'all 0.15s',
              }}
            >{s.label}</button>
          ))}
        </div>

        <span style={{ fontSize: 11, color: 'var(--ink-light)', marginLeft: 'auto' }}>
          {filtered.length} sets · click to view price history
        </span>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: '36px 48px 1fr 110px 110px 100px 100px',
        padding: '5px 16px', gap: 14, marginBottom: 5,
        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--ink-light)',
      }}>
        <span>#</span><span /><span>Set</span>
        <span style={{ textAlign: 'right' }}>Box</span>
        <span style={{ textAlign: 'right' }}>ETB</span>
        <span style={{ textAlign: 'right' }}>Pack</span>
        <span style={{ textAlign: 'right' }}>Box 30d</span>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map((row, i) => (
          <div
            key={row.id}
            onClick={() => setSelectedSet(row)}
            style={{
              background: 'var(--c1)', borderRadius: 10, padding: '11px 16px',
              border: '1px solid var(--cborder)',
              display: 'grid', gridTemplateColumns: '36px 48px 1fr 110px 110px 100px 100px',
              alignItems: 'center', gap: 14,
              boxShadow: '0 1px 4px rgba(26,18,8,0.04)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink-light)' }}>{i + 1}</span>

            <div style={{ width: 48, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={row.logoUrl}
                alt={row.set_name}
                loading="lazy"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{row.set_name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 1 }}>
                {row.set_code?.toUpperCase()}
                {row.is_special_set && (
                  <span style={{ marginLeft: 6, color: 'var(--gold)', fontWeight: 700 }}>· Special</span>
                )}
              </div>
            </div>

            <div style={{
              textAlign: 'right', fontFamily: 'var(--fm)', fontSize: 14, fontWeight: 500,
              color: row.latestBox ? 'var(--ink)' : 'var(--cborder)',
            }}>
              {fmt(row.latestBox)}
            </div>

            <div style={{
              textAlign: 'right', fontFamily: 'var(--fm)', fontSize: 14, fontWeight: 500,
              color: row.latestEtb ? (row.is_special_set ? 'var(--gold)' : 'var(--ink)') : 'var(--cborder)',
            }}>
              {fmt(row.latestEtb)}
            </div>

            <div style={{
              textAlign: 'right', fontFamily: 'var(--fm)', fontSize: 13,
              color: row.latestPack ? 'var(--ink-mid)' : 'var(--cborder)',
            }}>
              {fmt(row.latestPack)}
            </div>

            <div style={{ textAlign: 'right' }}>
              {typeof row.boxChange30d === 'number' ? (
                <span style={{
                  fontFamily: 'var(--fm)', fontSize: 13, fontWeight: 600,
                  color: row.boxChange30d >= 0 ? 'var(--green)' : 'var(--red)',
                }}>
                  {row.boxChange30d >= 0 ? '+' : ''}{row.boxChange30d.toFixed(1)}%
                </span>
              ) : row.boxChange30d === 'insufficient' ? (
                <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>{'< 30d data'}</span>
              ) : (
                <span style={{ color: 'var(--cborder)', fontSize: 13 }}>—</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedSet && (
        <SealedModal
          setRow={selectedSet}
          onClose={() => setSelectedSet(null)}
        />
      )}
    </div>
  )
}
