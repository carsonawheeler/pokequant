'use client'

import { useState, useEffect } from 'react'
import { SetPriceSnapshot } from '@/lib/types'
import { fmt } from '@/lib/utils'

export type ProductTab = 'box' | 'etb' | 'pack' | 'bundle' | 'bnb'
export type ChangeResult = number | 'new' | null

type SeriesKey = 'booster_box_market_price' | 'etb_market_price' | 'pack_market_price' | 'bundle_price' | 'build_and_battle_price'

const CHART_SERIES: { key: SeriesKey; label: string; col: string; tab: ProductTab }[] = [
  { key: 'booster_box_market_price', label: 'Box',    col: '#2d7dd2',         tab: 'box'    },
  { key: 'etb_market_price',         label: 'ETB',    col: 'var(--gold)',      tab: 'etb'    },
  { key: 'pack_market_price',        label: 'Pack',   col: 'var(--ink-light)', tab: 'pack'   },
  { key: 'bundle_price',             label: 'Bundle', col: '#9b59b6',          tab: 'bundle' },
  { key: 'build_and_battle_price',   label: 'B&B',    col: '#e67e22',          tab: 'bnb'    },
]

// Returns %, 'new' (< 9 days of history), or null (no data)
export function computeChange(snaps: SetPriceSnapshot[], key: keyof SetPriceSnapshot): ChangeResult {
  if (snaps.length < 2) return null
  const latest = snaps[0][key] as number | null
  if (latest == null) return null
  const oldest = snaps[snaps.length - 1]?.snapshot_date ?? ''
  const daySpan = oldest
    ? Math.floor((Date.now() - new Date(oldest + 'T12:00:00').getTime()) / 86400000)
    : 0
  if (daySpan < 9) return 'new'
  const target30 = Date.now() - 30 * 86400000
  let best: SetPriceSnapshot | null = null
  let bestDiff = Infinity
  for (const s of snaps.slice(1)) {
    const diff = Math.abs(new Date(s.snapshot_date + 'T12:00:00').getTime() - target30)
    if (diff < bestDiff) { bestDiff = diff; best = s }
  }
  if (!best) return null
  const pastVal = best[key] as number | null
  if (!pastVal) return null
  return ((latest - pastVal) / pastVal) * 100
}

function computeChange7d(snaps: SetPriceSnapshot[], key: keyof SetPriceSnapshot): number | null {
  if (snaps.length < 2) return null
  const latest = snaps[0][key] as number | null
  if (latest == null) return null
  const target7 = Date.now() - 7 * 86400000
  let best: SetPriceSnapshot | null = null
  let bestDiff = Infinity
  for (const s of snaps.slice(1)) {
    const diff = Math.abs(new Date(s.snapshot_date + 'T12:00:00').getTime() - target7)
    if (diff < bestDiff) { bestDiff = diff; best = s }
  }
  if (!best) return null
  const pastVal = best[key] as number | null
  if (!pastVal) return null
  return ((latest - pastVal) / pastVal) * 100
}

export function changeStr(ch: ChangeResult | number | null): string {
  if (ch === 'new') return 'New'
  if (typeof ch === 'number') return `${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%`
  return '—'
}

export function changeColor(ch: ChangeResult | number | null): string {
  if (typeof ch === 'number') return ch >= 0 ? 'var(--green)' : 'var(--red)'
  return 'var(--ink-light)'
}

export function ChangeBadge({ change }: { change: ChangeResult }) {
  if (change === 'new') {
    return (
      <span style={{
        fontSize: 10, padding: '2px 7px', borderRadius: 20,
        background: 'var(--gold)', color: '#fff', fontWeight: 700,
        letterSpacing: '0.05em', textTransform: 'uppercase' as const,
        whiteSpace: 'nowrap' as const,
      }}>New</span>
    )
  }
  if (typeof change === 'number') {
    const up = change >= 0
    return (
      <span style={{
        fontSize: 10.5, fontFamily: 'var(--fm)', fontWeight: 600,
        color: up ? 'var(--green)' : 'var(--red)',
        whiteSpace: 'nowrap' as const,
      }}>
        {up ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
      </span>
    )
  }
  return null
}

interface SealedProductModalProps {
  setName: string
  setCode: string | null
  era: string | null
  isSpecialSet: boolean | number | null
  logoUrl: string
  snapshots: SetPriceSnapshot[]  // newest-first
  focusProduct: ProductTab
  onClose: () => void
}

export default function SealedProductModal({
  setName, setCode, era, isSpecialSet, logoUrl, snapshots, focusProduct, onClose
}: SealedProductModalProps) {
  const [visibleLines, setVisibleLines] = useState<Set<ProductTab>>(
    () => new Set(['box', 'etb', 'pack'] as ProductTab[])
  )

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

  // newest-first for stats; oldest-first for chart
  const newestFirst = snapshots
  const snaps = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))

  const focusKey: keyof SetPriceSnapshot =
    focusProduct === 'box'    ? 'booster_box_market_price' :
    focusProduct === 'etb'    ? 'etb_market_price' :
    focusProduct === 'pack'   ? 'pack_market_price' :
    focusProduct === 'bundle' ? 'bundle_price' : 'build_and_battle_price'

  const currentPrice = (newestFirst[0]?.[focusKey] as number | null) ?? null
  const launchSnap   = snaps[0] ?? null
  const launchPrice  = (launchSnap?.[focusKey] as number | null) ?? null
  const change30d    = computeChange(newestFirst, focusKey)
  const change7d     = computeChange7d(newestFirst, focusKey)

  const focusLabel =
    focusProduct === 'box'    ? 'Booster Box' :
    focusProduct === 'etb'    ? 'Elite Trainer Box' :
    focusProduct === 'pack'   ? 'Booster Pack' :
    focusProduct === 'bundle' ? 'Booster Bundle' : 'Build & Battle'

  // SVG chart dimensions
  const W = 440, H = 130, PX = 4, PY = 10
  const n = snaps.length
  const uid = `spm_${(setCode ?? setName).replace(/[^a-z0-9]/gi, '_')}`

  const visibleSeries = CHART_SERIES.filter(s => visibleLines.has(s.tab))
  const allPrices = snaps.flatMap(s =>
    visibleSeries.map(ser => s[ser.key] as number | null)
  ).filter((v): v is number => v != null)

  const maxP  = Math.max(...allPrices, 1)
  const minP  = Math.min(...allPrices, 0)
  const range = maxP - minP || 1

  const tx = (i: number) => PX + (i / Math.max(n - 1, 1)) * (W - PX * 2)
  const ty = (v: number | null) => v != null ? H - PY - ((v - minP) / range) * (H - PY * 2) : null

  function pathFor(key: keyof SetPriceSnapshot): string {
    const pts = snaps
      .map((s, i) => ({ x: tx(i), y: ty(s[key] as number | null) }))
      .filter((p): p is { x: number; y: number } => p.y != null)
    if (!pts.length) return ''
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  }

  function areaFor(key: keyof SetPriceSnapshot): string {
    const line = pathFor(key)
    if (!line) return ''
    const pts = snaps
      .map((s, i) => ({ x: tx(i), y: ty(s[key] as number | null) }))
      .filter((p): p is { x: number; y: number } => p.y != null)
    if (pts.length < 2) return ''
    return line + ` L${pts[pts.length - 1].x.toFixed(1)} ${H} L${pts[0].x.toFixed(1)} ${H}Z`
  }

  // Month axis labels from oldest-first chart data
  const months: string[] = []
  let lastM = ''
  snaps.forEach(s => {
    const m = s.snapshot_date.slice(0, 7)
    if (m !== lastM) {
      months.push(new Date(s.snapshot_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }))
      lastM = m
    }
  })

  const availableSeries = CHART_SERIES.filter(s =>
    snaps.some(snap => (snap[s.key] as number | null) != null)
  )

  function toggleLine(tab: ProductTab) {
    setVisibleLines(prev => {
      const next = new Set(prev)
      if (next.has(tab) && next.size > 1) next.delete(tab)
      else next.add(tab)
      return next
    })
  }

  const hasRealImage = logoUrl.includes('product-images.tcgplayer.com')

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: 520 }}>

        {hasRealImage ? (
          /* ── Hero image header for real TCGPlayer product photos ── */
          <div style={{ position: 'relative', height: 200, overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
            <img
              src={logoUrl}
              alt={setName}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
              onError={e => { e.currentTarget.style.opacity = '0' }}
            />
            {/* Gradient overlay for text legibility */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)',
            }} />
            {/* Title text on gradient */}
            <div style={{ position: 'absolute', bottom: 16, left: 24, right: 52 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>
                {era ?? 'TCG'} · {setCode?.toUpperCase()}
                {!!isSpecialSet && (
                  <span style={{ marginLeft: 8, color: 'var(--gold)', fontWeight: 700 }}>Special</span>
                )}
              </div>
              <h2 style={{ fontFamily: 'var(--fd)', fontSize: 22, fontStyle: 'italic', color: '#fff', lineHeight: 1.1, marginBottom: 2 }}>
                {setName}
              </h2>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                {snaps.length} snapshots · {focusLabel}
              </div>
            </div>
            {/* Close button overlaid on image */}
            <button
              className="modal-close-btn"
              onClick={onClose}
              style={{
                position: 'absolute', top: 12, right: 12,
                width: 30, height: 30, borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, color: '#fff', background: 'rgba(0,0,0,0.45)',
                border: 'none',
              }}
            >✕</button>
          </div>
        ) : (
          /* ── Original header for set logo placeholders ── */
          <div style={{ padding: '18px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src={logoUrl}
                alt={setName}
                style={{ height: 36, objectFit: 'contain', flexShrink: 0 }}
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--ink-light)', marginBottom: 3 }}>
                  {era ?? 'TCG'} · {setCode?.toUpperCase()}
                  {!!isSpecialSet && (
                    <span style={{ marginLeft: 8, color: 'var(--gold)', fontWeight: 700 }}>Special</span>
                  )}
                </div>
                <h2 style={{ fontFamily: 'var(--fd)', fontSize: 22, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.1, marginBottom: 2 }}>
                  {setName}
                </h2>
                <div style={{ fontSize: 11, color: 'var(--ink-mid)' }}>
                  {snaps.length} snapshots · {focusLabel}
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
        )}

        {/* Stats strip: current, 7d, 30d, launch */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
          margin: '14px 24px 0', borderRadius: 8, overflow: 'hidden',
          border: '1px solid var(--cborder)',
        }}>
          {([
            { label: 'Current',    val: fmt(currentPrice) ?? '—',   col: 'var(--ink)',           sub: null },
            { label: '7d Change',  val: changeStr(change7d),         col: changeColor(change7d),  sub: null },
            { label: '30d Change', val: changeStr(change30d),        col: changeColor(change30d), sub: null },
            { label: 'Launch',     val: fmt(launchPrice) ?? '—',     col: 'var(--ink)',           sub: launchSnap?.snapshot_date?.slice(0, 10) ?? null },
          ] as { label: string; val: string; col: string; sub: string | null }[]).map((item, i) => (
            <div key={i} style={{
              padding: '10px 12px', background: 'var(--c1)',
              borderRight: i < 3 ? '1px solid var(--cborder)' : 'none',
            }}>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-light)', marginBottom: 4 }}>
                {item.label}
              </div>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 600, color: item.col, whiteSpace: 'nowrap' }}>
                {item.val}
              </div>
              {item.sub && (
                <div style={{ fontSize: 9, color: 'var(--ink-light)', marginTop: 2 }}>{item.sub}</div>
              )}
            </div>
          ))}
        </div>

        {/* Chart */}
        {snaps.length > 1 && (
          <div style={{ padding: '16px 24px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-light)' }}>
                Price History
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                {availableSeries.map(s => {
                  const active   = visibleLines.has(s.tab)
                  const isFocus  = s.tab === focusProduct
                  return (
                    <button
                      key={s.tab}
                      onClick={() => toggleLine(s.tab)}
                      style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                        background: active ? s.col : 'var(--c2)',
                        color:      active ? '#fff' : 'var(--ink-light)',
                        border:     `1px solid ${active ? s.col : 'var(--cborder)'}`,
                        opacity:    isFocus ? 1 : active ? 0.8 : 0.6,
                      }}
                    >{s.label}</button>
                  )
                })}
              </div>
            </div>

            <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id={`${uid}_box`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#2d7dd2" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#2d7dd2" stopOpacity="0.01" />
                </linearGradient>
                <linearGradient id={`${uid}_etb`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#C9A227" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#C9A227" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              {CHART_SERIES.filter(s => visibleLines.has(s.tab)).map(s => {
                const lineD  = pathFor(s.key)
                if (!lineD) return null
                const fillId = s.tab === 'box' ? `${uid}_box` : s.tab === 'etb' ? `${uid}_etb` : null
                const area   = fillId ? areaFor(s.key) : ''
                const isFocus = s.tab === focusProduct
                return (
                  <g key={s.tab}>
                    {area && <path d={area} fill={`url(#${fillId})`} opacity={isFocus ? 1 : 0.35} />}
                    <path
                      d={lineD}
                      fill="none"
                      stroke={s.col}
                      strokeWidth={isFocus ? 2 : 1}
                      strokeOpacity={isFocus ? 1 : 0.45}
                      strokeLinejoin="round"
                      strokeDasharray={s.tab === 'pack' ? '3 3' : undefined}
                    />
                  </g>
                )
              })}
            </svg>

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
