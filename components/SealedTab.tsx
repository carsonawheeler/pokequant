'use client'

import { useState, useMemo, useEffect } from 'react'
import { SetData, SetPriceSnapshot } from '@/lib/types'
import { fmt } from '@/lib/utils'

type ProductTab = 'box' | 'etb' | 'pack' | 'bundle'
type EraFilter  = 'all' | 'sv' | 'swsh'
type ChangeResult = number | 'new' | null

interface SealedRow extends SetData {
  latestBox:    number | null
  latestEtb:    number | null
  latestPack:   number | null
  latestBundle: number | null
  boxChange:    ChangeResult
  etbChange:    ChangeResult
  packChange:   ChangeResult
  bundleChange: ChangeResult
  logoUrl:      string
  chronoSnaps:  SetPriceSnapshot[]
  etbOnly:      boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPrice(row: SealedRow, tab: ProductTab): number | null {
  return tab === 'box' ? row.latestBox
       : tab === 'etb' ? row.latestEtb
       : tab === 'pack' ? row.latestPack
       : row.latestBundle
}

function getChange(row: SealedRow, tab: ProductTab): ChangeResult {
  return tab === 'box' ? row.boxChange
       : tab === 'etb' ? row.etbChange
       : tab === 'pack' ? row.packChange
       : row.bundleChange
}

// Returns %, 'new' (< 9 days of history), or null (no data)
function computeChange(snaps: SetPriceSnapshot[], key: keyof SetPriceSnapshot): ChangeResult {
  if (snaps.length < 2) return null
  const latest = snaps[0][key] as number | null
  if (latest == null) return null
  const oldest = snaps[snaps.length - 1]?.snapshot_date ?? ''
  const daySpan = oldest
    ? Math.floor((Date.now() - new Date(oldest + 'T12:00:00').getTime()) / 86400000)
    : 0
  if (daySpan < 9) return 'new'
  // Find snapshot (excluding most recent) closest to 30 days ago
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

function changeStr(ch: ChangeResult | number | null): string {
  if (ch === 'new') return 'New'
  if (typeof ch === 'number') return `${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%`
  return '—'
}

function changeColor(ch: ChangeResult | number | null): string {
  if (typeof ch === 'number') return ch >= 0 ? 'var(--green)' : 'var(--red)'
  return 'var(--ink-light)'
}

// Responsive cols
function useCols() {
  const [cols, setCols] = useState(5)
  useEffect(() => {
    function update() {
      const w = window.innerWidth
      setCols(w < 480 ? 2 : w < 640 ? 3 : w < 900 ? 4 : 5)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return cols
}

// ── Change badge ──────────────────────────────────────────────────────────────

function ChangeBadge({ change }: { change: ChangeResult }) {
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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SealedSkel({ cols }: { cols: number }) {
  const imgH = cols <= 2 ? 80 : cols === 3 ? 100 : 110
  return (
    <div style={{ background: 'var(--c1)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--cborder)' }}>
      <div className="shimmer" style={{ height: imgH }} />
      <div style={{ padding: '10px 12px 14px' }}>
        <div className="shimmer" style={{ height: 13, width: '75%', marginBottom: 5 }} />
        <div className="shimmer" style={{ height: 10, width: '40%', marginBottom: 12 }} />
        <div className="shimmer" style={{ height: 22, width: '55%', marginBottom: 6 }} />
        <div className="shimmer" style={{ height: 10, width: '60%' }} />
      </div>
    </div>
  )
}

// ── Sealed card ───────────────────────────────────────────────────────────────

function SealedCard({ row, productTab, cols, onClick }: {
  row: SealedRow
  productTab: ProductTab
  cols: number
  onClick: () => void
}) {
  const imgH = cols <= 2 ? 80 : cols === 3 ? 100 : 110
  const price  = getPrice(row, productTab)
  const change = getChange(row, productTab)

  return (
    <div
      className="card-item fadeup"
      onClick={onClick}
      style={{
        background: 'var(--c1)', borderRadius: 12,
        border: '1px solid var(--cborder)', overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(26,18,8,0.05)',
        display: 'flex', flexDirection: 'column', cursor: 'pointer',
      }}
    >
      {/* Logo with blurred background */}
      <div style={{
        height: imgH, flexShrink: 0, position: 'relative',
        borderBottom: '1px solid var(--cborder)', overflow: 'hidden',
        background: 'var(--c2)',
      }}>
        {row.logoUrl && (
          <div style={{
            position: 'absolute', inset: -8,
            backgroundImage: `url(${row.logoUrl})`,
            backgroundSize: '130%', backgroundPosition: 'center',
            filter: 'blur(18px) brightness(0.65) saturate(1.5)',
            transform: 'scale(1.15)',
          }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(237,232,216,0.32)' }} />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '6px 10px',
        }}>
          <img
            src={row.logoUrl}
            alt={row.set_name}
            loading="lazy"
            style={{ maxWidth: '100%', maxHeight: imgH - 14, objectFit: 'contain' }}
            onError={e => { e.currentTarget.style.opacity = '0' }}
          />
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '8px 11px 11px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{
          fontWeight: 600, fontSize: 12, color: 'var(--ink)', lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {row.set_name}
        </div>
        <div style={{
          fontSize: 10, color: 'var(--ink-light)', marginBottom: 6,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {row.set_code?.toUpperCase()}
        </div>

        <div style={{
          borderTop: '1px solid var(--cborder)', paddingTop: 6,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 5,
        }}>
          <span style={{
            fontFamily: 'var(--fm)', fontSize: 17, fontWeight: 600,
            color: 'var(--ink)', letterSpacing: '-0.02em',
          }}>
            {fmt(price)}
          </span>
          <ChangeBadge change={change} />
        </div>

        {/* Badges row */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
          {row.era === 'SV' && (
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: '#fde8e8', color: 'var(--red)', fontWeight: 700 }}>SV</span>
          )}
          {row.era === 'SWSH' && (
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: '#e8f1fb', color: '#2d7dd2', fontWeight: 700 }}>SWSH</span>
          )}
          {!!row.is_special_set && (
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: '#fdf4dc', color: 'var(--gold)', fontWeight: 700 }}>Special</span>
          )}
          {row.etbOnly && productTab !== 'box' && (
            <span style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 10,
              background: 'var(--c2)', color: 'var(--ink-light)', fontWeight: 600,
              border: '1px solid var(--cborder)',
            }}>ETB Only</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

type SeriesKey = 'booster_box_market_price' | 'etb_market_price' | 'pack_market_price'

const CHART_SERIES: { key: SeriesKey; label: string; col: string; tab: ProductTab }[] = [
  { key: 'booster_box_market_price', label: 'Box',  col: '#2d7dd2',        tab: 'box' },
  { key: 'etb_market_price',         label: 'ETB',  col: 'var(--gold)',     tab: 'etb' },
  { key: 'pack_market_price',        label: 'Pack', col: 'var(--ink-light)', tab: 'pack' },
]

function SealedModal({ setRow, focusProduct, onClose }: {
  setRow: SealedRow
  focusProduct: ProductTab
  onClose: () => void
}) {
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

  const snaps     = setRow.chronoSnaps         // oldest-first for chart
  const newestFirst = setRow.set_price_snapshots ?? [] // newest-first for stats

  const focusKey: keyof SetPriceSnapshot =
    focusProduct === 'box'  ? 'booster_box_market_price' :
    focusProduct === 'etb'  ? 'etb_market_price' :
    focusProduct === 'pack' ? 'pack_market_price' : 'bundle_price'

  const currentPrice = newestFirst[0]?.[focusKey] as number | null ?? null
  const launchSnap   = snaps[0] ?? null
  const launchPrice  = launchSnap?.[focusKey] as number | null ?? null
  const change30d    = getChange(setRow, focusProduct)
  const change7d     = computeChange7d(newestFirst, focusKey)

  const focusLabel =
    focusProduct === 'box'    ? 'Booster Box' :
    focusProduct === 'etb'    ? 'Elite Trainer Box' :
    focusProduct === 'pack'   ? 'Booster Pack' : 'Bundle'

  // SVG chart
  const W = 440, H = 130, PX = 4, PY = 10
  const n = snaps.length
  const uid = `sm${setRow.id}`

  const visibleSeries = CHART_SERIES.filter(s => visibleLines.has(s.tab))

  const allPrices = snaps.flatMap(s =>
    visibleSeries.map(ser => s[ser.key] as number | null)
  ).filter((v): v is number => v != null)

  const maxP = Math.max(...allPrices, 1)
  const minP = Math.min(...allPrices, 0)
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

  // Month axis labels
  const months: string[] = []
  let lastM = ''
  snaps.forEach(s => {
    const m = s.snapshot_date.slice(0, 7)
    if (m !== lastM) {
      months.push(new Date(s.snapshot_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }))
      lastM = m
    }
  })

  // Which series have data
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

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: 520 }}>

        {/* Header */}
        <div style={{ padding: '18px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--ink-light)', marginBottom: 3 }}>
              {setRow.era ?? 'TCG'} · {setRow.set_code?.toUpperCase()}
              {!!setRow.is_special_set && (
                <span style={{ marginLeft: 8, color: 'var(--gold)', fontWeight: 700 }}>Special</span>
              )}
            </div>
            <h2 style={{ fontFamily: 'var(--fd)', fontSize: 22, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.1, marginBottom: 2 }}>
              {setRow.set_name}
            </h2>
            <div style={{ fontSize: 11, color: 'var(--ink-mid)' }}>
              {snaps.length} snapshots · {focusLabel}
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

        {/* Stats strip: current, 7d, 30d, launch */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
          margin: '14px 24px 0', borderRadius: 8, overflow: 'hidden',
          border: '1px solid var(--cborder)',
        }}>
          {([
            { label: 'Current',    val: fmt(currentPrice) ?? '—',   col: 'var(--ink)',        sub: null },
            { label: '7d Change',  val: changeStr(change7d),         col: changeColor(change7d), sub: null },
            { label: '30d Change', val: changeStr(change30d),        col: changeColor(change30d), sub: null },
            { label: 'Launch',     val: fmt(launchPrice) ?? '—',     col: 'var(--ink)',        sub: launchSnap?.snapshot_date?.slice(0, 10) ?? null },
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
              {/* Line toggles */}
              <div style={{ display: 'flex', gap: 5 }}>
                {availableSeries.map(s => {
                  const active = visibleLines.has(s.tab)
                  const isFocus = s.tab === focusProduct
                  return (
                    <button
                      key={s.tab}
                      onClick={() => toggleLine(s.tab)}
                      style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                        background: active ? s.col : 'var(--c2)',
                        color: active ? '#fff' : 'var(--ink-light)',
                        border: `1px solid ${active ? s.col : 'var(--cborder)'}`,
                        opacity: isFocus ? 1 : active ? 0.8 : 0.6,
                      }}
                    >{s.label}</button>
                  )
                })}
              </div>
            </div>

            <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id={`${uid}_box`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2d7dd2" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#2d7dd2" stopOpacity="0.01" />
                </linearGradient>
                <linearGradient id={`${uid}_etb`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A227" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#C9A227" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              {CHART_SERIES.filter(s => visibleLines.has(s.tab)).map(s => {
                const lineD = pathFor(s.key)
                if (!lineD) return null
                const fillId = s.tab === 'box' ? `${uid}_box` : s.tab === 'etb' ? `${uid}_etb` : null
                const area = fillId ? areaFor(s.key) : ''
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

const PRODUCT_TABS: { id: ProductTab; label: string }[] = [
  { id: 'box',    label: 'Booster Box' },
  { id: 'etb',    label: 'ETB' },
  { id: 'pack',   label: 'Pack' },
  { id: 'bundle', label: 'Bundle' },
]

const ERA_FILTERS: { id: EraFilter; label: string }[] = [
  { id: 'all',  label: 'All' },
  { id: 'sv',   label: 'SV' },
  { id: 'swsh', label: 'SWSH' },
]

interface SealedTabProps {
  setsData: SetData[]
  loading: boolean
}

export default function SealedTab({ setsData, loading }: SealedTabProps) {
  const [productTab, setProductTab] = useState<ProductTab>('box')
  const [eraFilter,  setEraFilter]  = useState<EraFilter>('all')
  const [query,      setQuery]      = useState('')
  const [selected,   setSelected]   = useState<{ row: SealedRow; tab: ProductTab } | null>(null)
  const cols = useCols()

  const rows = useMemo<SealedRow[]>(() =>
    setsData
      .filter(s => (s.set_price_snapshots?.length ?? 0) > 0)
      .map(s => {
        const snaps  = s.set_price_snapshots ?? []  // newest-first
        const chrono = [...snaps].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
        return {
          ...s,
          latestBox:    snaps[0]?.booster_box_market_price ?? null,
          latestEtb:    snaps[0]?.etb_market_price ?? null,
          latestPack:   snaps[0]?.pack_market_price ?? null,
          latestBundle: snaps[0]?.bundle_price ?? null,
          boxChange:    computeChange(snaps, 'booster_box_market_price'),
          etbChange:    computeChange(snaps, 'etb_market_price'),
          packChange:   computeChange(snaps, 'pack_market_price'),
          bundleChange: computeChange(snaps, 'bundle_price'),
          logoUrl:      s.logo_url ?? `https://images.pokemontcg.io/${s.set_code}/logo.png`,
          chronoSnaps:  chrono,
          etbOnly:      (snaps[0]?.booster_box_market_price ?? null) === null,
        }
      }),
    [setsData]
  )

  const filtered = useMemo(() => {
    // Filter: must have a price for the selected product tab
    let base = rows.filter(r => getPrice(r, productTab) != null)

    // Era filter
    if (eraFilter === 'sv')   base = base.filter(r => r.era === 'SV')
    if (eraFilter === 'swsh') base = base.filter(r => r.era === 'SWSH')

    // Search
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      base = base.filter(r =>
        r.set_name.toLowerCase().includes(q) ||
        (r.set_code ?? '').toLowerCase().includes(q)
      )
    }

    // Sort by price descending
    return base.sort((a, b) => (getPrice(b, productTab) ?? 0) - (getPrice(a, productTab) ?? 0))
  }, [rows, productTab, eraFilter, query])

  if (loading) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {PRODUCT_TABS.map(t => (
            <div key={t.id} className="shimmer" style={{ height: 36, width: 100, borderRadius: 20 }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 13 }}>
          {Array.from({ length: cols * 3 }).map((_, i) => <SealedSkel key={i} cols={cols} />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Product type tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {PRODUCT_TABS.map(t => {
          const active = productTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setProductTab(t.id)}
              style={{
                padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                background: active ? 'var(--ink)' : 'var(--c1)',
                color:      active ? 'var(--c1)'  : 'var(--ink-mid)',
                border:     `1px solid ${active ? 'var(--ink)' : 'var(--cborder)'}`,
                transition: 'all 0.15s',
              }}
            >{t.label}</button>
          )
        })}
      </div>

      {/* Era filter + search */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {ERA_FILTERS.map(f => {
            const active = eraFilter === f.id
            return (
              <button
                key={f.id}
                onClick={() => setEraFilter(f.id)}
                style={{
                  padding: '5px 12px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                  background: active ? 'var(--gold)' : 'var(--c1)',
                  color:      active ? '#fff' : 'var(--ink-mid)',
                  border:     `1px solid ${active ? 'var(--gold)' : 'var(--cborder)'}`,
                  transition: 'all 0.15s',
                }}
              >{f.label}</button>
            )
          })}
        </div>

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
            placeholder="Search sets…"
            style={{
              width: '100%', padding: '7px 12px 7px 32px',
              background: 'var(--c1)', border: '1px solid var(--cborder)',
              borderRadius: 8, fontSize: 13, color: 'var(--ink)', outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--cborder)')}
          />
        </div>

        <span style={{ fontSize: 11, color: 'var(--ink-light)', whiteSpace: 'nowrap' }}>
          {filtered.length} set{filtered.length !== 1 ? 's' : ''}
          {productTab === 'box' && ' · special sets excluded'}
        </span>
      </div>

      {/* Card grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 13 }}>
        {filtered.map(row => (
          <SealedCard
            key={row.id}
            row={row}
            productTab={productTab}
            cols={cols}
            onClick={() => setSelected({ row, tab: productTab })}
          />
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--ink-light)' }}>
          <div style={{ fontFamily: 'var(--fd)', fontSize: 28, marginBottom: 10, opacity: 0.35, fontStyle: 'italic' }}>
            {productTab === 'bundle' ? 'No bundle data yet' : 'No results'}
          </div>
          <div style={{ fontSize: 14 }}>
            {productTab === 'bundle'
              ? 'Bundle prices will appear here once tracked'
              : 'Try a different product type or era filter'}
          </div>
        </div>
      )}

      {selected && (
        <SealedModal
          setRow={selected.row}
          focusProduct={selected.tab}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
