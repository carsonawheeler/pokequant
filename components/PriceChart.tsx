'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { PricePoint, GradedPoint } from '@/lib/types'
import { EbayPoint } from './EbayChart'
import { fmt } from '@/lib/utils'

type LineKey = 'tcg' | 'ebay_raw' | 'psa9' | 'psa10'

const RANGE_OPTS = [
  { id: '1m',  label: '1M' },
  { id: '3m',  label: '3M' },
  { id: '6m',  label: '6M' },
  { id: 'all', label: 'All' },
]

const LINE_LABELS: Record<LineKey, string> = {
  tcg:      'TCGPlayer',
  ebay_raw: 'Raw eBay',
  psa9:     'PSA 9',
  psa10:    'PSA 10',
}

// Active button colors (background when toggled on)
const BTN_COLORS: Record<LineKey, string> = {
  tcg:      'var(--gold)',
  ebay_raw: '#e07b39',
  psa9:     '#7b5ea7',
  psa10:    '#2d7dd2',
}

// SVG line colors
const LINE_COLORS: Record<LineKey, string> = {
  tcg:      '', // set dynamically from trend
  ebay_raw: '#e07b39',
  psa9:     '#7b5ea7',
  psa10:    '#2d7dd2',
}

const W = 480, H = 140, PX = 4, PY = 8

/** Forward-fill a sparse price series into a daily series from first to last date. */
function forwardFill(pts: { date: string; price: number }[]): { date: string; price: number }[] {
  if (pts.length < 2) return pts
  const sorted = [...pts].sort((a, b) => a.date.localeCompare(b.date))
  const result: { date: string; price: number }[] = []
  let pIdx = 0
  let lastPrice = sorted[0].price

  const cur = new Date(sorted[0].date + 'T12:00:00')
  const end = new Date(sorted[sorted.length - 1].date + 'T12:00:00')

  while (cur <= end) {
    const dateStr = cur.toISOString().slice(0, 10)
    while (pIdx < sorted.length && sorted[pIdx].date <= dateStr) {
      lastPrice = sorted[pIdx].price
      pIdx++
    }
    result.push({ date: dateStr, price: lastPrice })
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

function makePath(pts: { date: string; price: number }[], mn: number, mx: number): string {
  if (pts.length < 2) return ''
  const rng = mx - mn || 1
  const tx = (i: number) => PX + (i / (pts.length - 1)) * (W - PX * 2)
  const ty = (p: number) => H - PY - ((p - mn) / rng) * (H - PY * 2)
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${tx(i).toFixed(1)} ${ty(p.price).toFixed(1)}`).join(' ')
}

interface PriceChartProps {
  data: PricePoint[] | null
  gradedData?: GradedPoint[] | null
  ebayData?: EbayPoint[] | null
  showToggle?: boolean
}

export default function PriceChart({ data, gradedData, ebayData, showToggle }: PriceChartProps) {
  const [range,     setRange]    = useState('all')
  const [active,    setActive]   = useState<Set<LineKey>>(new Set(['tcg']))
  const [hoverRatio, setHoverRatio] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const uid    = useRef(`g${Math.random().toString(36).slice(2, 8)}`).current

  const toggleLine = useCallback((key: LineKey) => {
    setActive(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size > 1) next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  // Build raw series from props
  const allSeries = useMemo<Record<LineKey, { date: string; price: number }[]>>(() => {
    const rawPsa9  = ebayData
      ? ebayData.filter(d => d.ebay_psa9_smart_price != null)
                .map(d => ({ date: d.snapshot_date, price: d.ebay_psa9_smart_price! }))
      : []
    const rawPsa10 = ebayData
      ? ebayData.filter(d => d.ebay_psa10_smart_price != null)
                .map(d => ({ date: d.snapshot_date, price: d.ebay_psa10_smart_price! }))
      : []
    const rawEbay  = ebayData
      ? ebayData.filter(d => d.ebay_raw_avg_price != null)
                .map(d => ({ date: d.snapshot_date, price: d.ebay_raw_avg_price! }))
      : []
    return {
      tcg: data
        ? data.map(d => ({ date: d.snapshot_date, price: d.tcgplayer_market_price }))
        : [],
      ebay_raw: forwardFill(rawEbay),
      psa9:     forwardFill(rawPsa9),
      psa10:    forwardFill(rawPsa10),
    }
  }, [data, ebayData])

  const hasData = useMemo<Record<LineKey, boolean>>(() => ({
    tcg:      allSeries.tcg.length > 0,
    ebay_raw: allSeries.ebay_raw.length > 0,
    psa9:     allSeries.psa9.length > 0,
    psa10:    allSeries.psa10.length > 0,
  }), [allSeries])

  const cutoff = useMemo(() => {
    if (range === 'all') return ''
    const days = ({ '1m': 30, '3m': 90, '6m': 180 } as Record<string, number>)[range]
    return new Date(Date.now() - days * 864e5).toISOString().slice(0, 10)
  }, [range])

  const filtered = useMemo<Record<LineKey, { date: string; price: number }[]>>(() => {
    const f = (pts: { date: string; price: number }[]) =>
      cutoff ? pts.filter(p => p.date >= cutoff) : pts
    return {
      tcg:      f(allSeries.tcg),
      ebay_raw: f(allSeries.ebay_raw),
      psa9:     f(allSeries.psa9),
      psa10:    f(allSeries.psa10),
    }
  }, [allSeries, cutoff])

  // Active series with enough points to draw
  const activeLines = useMemo(() =>
    ([...active] as LineKey[]).filter(k => filtered[k].length >= 2),
    [active, filtered]
  )

  // Shared Y range across all active lines
  const { mn, mx } = useMemo(() => {
    const all = activeLines.flatMap(k => filtered[k].map(p => p.price))
    if (all.length === 0) return { mn: 0, mx: 1 }
    return { mn: Math.min(...all), mx: Math.max(...all) }
  }, [activeLines, filtered])

  // TCGPlayer trend color
  const tcgPts = filtered.tcg
  const tcgUp  = tcgPts.length >= 2 && tcgPts[tcgPts.length - 1].price >= tcgPts[0].price
  const tcgCol = tcgUp ? 'var(--green)' : 'var(--red)'
  const lineColors = { ...LINE_COLORS, tcg: tcgCol }

  // TCG change stat
  const tcgChange    = tcgPts.length >= 2 ? tcgPts[tcgPts.length - 1].price - tcgPts[0].price : null
  const tcgChangePct = tcgChange != null && tcgPts[0].price > 0
    ? (tcgChange / tcgPts[0].price) * 100 : null

  // Mouse handlers — store hover as 0..1 ratio
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    setHoverRatio(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)))
  }, [])
  const handleMouseLeave = useCallback(() => setHoverRatio(null), [])

  // Month labels from TCGPlayer (primary reference series)
  const refPts = tcgPts.length >= 2 ? tcgPts : (filtered[activeLines[0]] ?? [])
  const months: { label: string }[] = []
  let lastM = ''
  refPts.forEach(d => {
    const m = d.date.slice(0, 7)
    if (m !== lastM) {
      months.push({ label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }) })
      lastM = m
    }
  })

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (!data) {
    return <div className="shimmer" style={{ height: 110, borderRadius: 8 }} />
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const tx = (i: number, len: number) => PX + (i / (len - 1)) * (W - PX * 2)
  const ty = (p: number) => H - PY - ((p - mn) / (mx - mn || 1)) * (H - PY * 2)

  // For hover: find index in a series given the 0..1 x ratio
  const nearIdx = (pts: { date: string; price: number }[], ratio: number) =>
    Math.max(0, Math.min(pts.length - 1, Math.round(ratio * (pts.length - 1))))

  return (
    <div>
      {/* ── Line toggles ─────────────────────────────────────────────────────── */}
      {showToggle && (
        <div style={{ display: 'flex', gap: 3, marginBottom: 10, flexWrap: 'wrap' }}>
          {(['tcg', 'ebay_raw', 'psa9', 'psa10'] as LineKey[]).map(key => {
            if (key === 'ebay_raw' && !hasData.ebay_raw) return null
            const isOn   = active.has(key)
            const noData = !hasData[key]
            const btnCol = BTN_COLORS[key]
            return (
              <button
                key={key}
                onClick={() => !noData && toggleLine(key)}
                style={{
                  padding: '3px 11px', borderRadius: 6, fontSize: 11,
                  fontFamily: 'var(--fm)', fontWeight: 600,
                  background: isOn && !noData ? btnCol : 'var(--c2)',
                  color:      isOn && !noData ? 'white' : noData ? 'var(--cborder)' : 'var(--ink-light)',
                  border:     `1px solid ${isOn && !noData ? btnCol : 'var(--cborder)'}`,
                  transition: 'all 0.12s',
                  cursor:     noData ? 'default' : 'pointer',
                  opacity:    noData ? 0.65 : 1,
                }}
              >
                {LINE_LABELS[key]}{noData ? ' · No data' : ''}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Range + stat row ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGE_OPTS.map(o => (
            <button
              key={o.id}
              className="chart-btn"
              onClick={() => setRange(o.id)}
              style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 11,
                fontFamily: 'var(--fm)', fontWeight: 600,
                background: range === o.id ? 'var(--ink)' : 'var(--c2)',
                color:      range === o.id ? 'var(--c1)' : 'var(--ink-light)',
                border:     `1px solid ${range === o.id ? 'var(--ink)' : 'var(--cborder)'}`,
                transition: 'all 0.12s',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        {active.has('tcg') && tcgChange != null && tcgChangePct != null && (
          <span style={{ fontSize: 12, fontFamily: 'var(--fm)', color: tcgUp ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
            {tcgChange >= 0 ? '+' : ''}{fmt(tcgChange)} ({tcgChangePct >= 0 ? '+' : ''}{tcgChangePct.toFixed(1)}%)
          </span>
        )}
      </div>

      {/* ── Chart or empty state ─────────────────────────────────────────────── */}
      {activeLines.length === 0 ? (
        <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-light)', fontSize: 12 }}>
          Not enough data for selected range
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <svg
            ref={svgRef}
            className="chart-svg"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: 'crosshair' }}
          >
            <defs>
              {activeLines.includes('tcg') && (
                <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={tcgCol} stopOpacity="0.16" />
                  <stop offset="100%" stopColor={tcgCol} stopOpacity="0.01" />
                </linearGradient>
              )}
            </defs>

            {/* Lines */}
            {activeLines.map(key => {
              const pts   = filtered[key]
              const lineD = makePath(pts, mn, mx)
              const col   = lineColors[key]

              if (key === 'tcg') {
                const areaD = lineD
                  + ` L${tx(pts.length - 1, pts.length)} ${H} L${tx(0, pts.length)} ${H}Z`
                return (
                  <g key="tcg">
                    <path d={areaD} fill={`url(#${uid})`} />
                    <path d={lineD} fill="none" stroke={col} strokeWidth="1.8"
                          strokeLinejoin="round" strokeLinecap="round" />
                    <circle cx={tx(pts.length - 1, pts.length)} cy={ty(pts[pts.length - 1].price)} r="3.5" fill={col} />
                    <circle cx={tx(0, pts.length)} cy={ty(pts[0].price)} r="2.5" fill={col} fillOpacity="0.4" />
                  </g>
                )
              }

              return (
                <path key={key} d={lineD} fill="none" stroke={col} strokeWidth="1.8"
                      strokeLinejoin="round" strokeLinecap="round"
                      strokeDasharray={key === 'psa9' ? '5 2' : undefined} />
              )
            })}

            {/* Hover hairline + dots */}
            {hoverRatio != null && (() => {
              // Anchor X on the longest active series
              const anchor = activeLines.reduce((a, b) =>
                filtered[a].length >= filtered[b].length ? a : b
              )
              const anchorPts = filtered[anchor]
              const ai   = nearIdx(anchorPts, hoverRatio)
              const hx   = tx(ai, anchorPts.length)

              return (
                <>
                  <line
                    x1={hx} y1={PY} x2={hx} y2={H - PY}
                    stroke="var(--ink)" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="3 3"
                  />
                  {activeLines.map(key => {
                    const pts = filtered[key]
                    const i   = nearIdx(pts, hoverRatio)
                    return (
                      <circle key={key}
                        cx={tx(i, pts.length)} cy={ty(pts[i].price)}
                        r="4" fill={lineColors[key]}
                      />
                    )
                  })}
                </>
              )
            })()}
          </svg>

          {/* Hover tooltip */}
          {hoverRatio != null && (() => {
            const anchor = activeLines.reduce((a, b) =>
              filtered[a].length >= filtered[b].length ? a : b
            )
            const anchorPts = filtered[anchor]
            const ai = nearIdx(anchorPts, hoverRatio)
            const hx = tx(ai, anchorPts.length)

            return (
              <div style={{
                position: 'absolute', top: 4,
                left: `clamp(0px, calc(${(hx / W) * 100}% - 60px), calc(100% - 130px))`,
                pointerEvents: 'none',
                background: 'var(--ink)', color: 'var(--c1)',
                borderRadius: 7, padding: '5px 10px',
                fontSize: 11, fontFamily: 'var(--fm)',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 14px rgba(26,18,8,0.25)',
                zIndex: 10,
              }}>
                {activeLines.map(key => {
                  const pts = filtered[key]
                  const i   = nearIdx(pts, hoverRatio)
                  return (
                    <div key={key} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: lineColors[key], fontWeight: 700, fontSize: 10 }}>
                        {LINE_LABELS[key]}
                      </span>
                      <span style={{ fontWeight: 700 }}>{fmt(pts[i].price)}</span>
                    </div>
                  )
                })}
                <div style={{ opacity: 0.6, fontSize: 10, marginTop: 2 }}>
                  {new Date(anchorPts[ai].date + 'T12:00:00').toLocaleDateString(
                    'en-US', { month: 'short', day: 'numeric', year: 'numeric' }
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Bottom axis ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px', marginTop: 4 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--fm)', color: 'var(--ink-light)' }}>{fmt(mn)}</span>
        <div style={{ display: 'flex', gap: 12 }}>
          {months.slice(0, 8).map((t, i) => (
            <span key={i} style={{ fontSize: 10, color: 'var(--ink-light)' }}>{t.label}</span>
          ))}
        </div>
        <span style={{ fontSize: 10, fontFamily: 'var(--fm)', color: 'var(--ink-light)' }}>{fmt(mx)}</span>
      </div>
    </div>
  )
}
