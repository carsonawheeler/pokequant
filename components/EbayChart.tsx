'use client'

import { useRef, useState } from 'react'
import { fmt } from '@/lib/utils'

export interface EbayPoint {
  snapshot_date: string
  ebay_raw_avg_price: number | null
  ebay_psa9_smart_price: number | null
  ebay_psa10_smart_price: number | null
  ebay_psa10_confidence: string | null
  ebay_psa10_daily_volume_7day?: number | null
  ebay_psa10_7day_market?: number | null
}

const W = 480, H = 140, PX = 4, PY = 8
const RAW_COL   = '#8C7A5A'   // ink-light — subdued, dashed
const PSA9_COL  = '#D4AF78'   // gold-l
const PSA10_COL = '#2D6B2D'   // green

function confBadgeStyle(conf: string | null): React.CSSProperties {
  if (conf === 'high')   return { background: 'var(--green-bg)', color: 'var(--green)' }
  if (conf === 'medium') return { background: '#FEF3C7', color: '#92400E' }
  return { background: 'var(--c2)', color: 'var(--ink-light)' }
}

function makeLine(
  data: EbayPoint[],
  getter: (d: EbayPoint) => number | null,
  ty: (p: number) => number,
  tx: (i: number) => number,
): string {
  let d = '', drawing = false
  data.forEach((pt, i) => {
    const v = getter(pt)
    if (v == null) { drawing = false; return }
    const x = tx(i).toFixed(1), y = ty(v).toFixed(1)
    d += drawing ? ` L${x} ${y}` : ` M${x} ${y}`
    drawing = true
  })
  return d.trim()
}

export default function EbayChart({ data }: { data: EbayPoint[] | null }) {
  const [hover, setHover] = useState<{ i: number; x: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  if (data === null) {
    return <div className="shimmer" style={{ height: 110, borderRadius: 8 }} />
  }

  const emptyState = (
    <div style={{
      height: 90, display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: 'var(--ink-light)', fontSize: 12,
      background: 'var(--c2)', borderRadius: 8,
    }}>
      Data available after tonight&apos;s update
    </div>
  )

  if (data.length === 0) return emptyState

  const rawVals   = data.map(d => d.ebay_raw_avg_price)
  const psa9Vals  = data.map(d => d.ebay_psa9_smart_price)
  const psa10Vals = data.map(d => d.ebay_psa10_smart_price)

  const showRaw   = rawVals.filter(v => v != null).length >= 3
  const showPsa9  = psa9Vals.filter(v => v != null).length >= 3
  const showPsa10 = psa10Vals.filter(v => v != null).length >= 3

  if (!showRaw && !showPsa9 && !showPsa10) return emptyState

  const allVals = [
    ...(showRaw   ? (rawVals.filter((v): v is number => v != null))   : []),
    ...(showPsa9  ? (psa9Vals.filter((v): v is number => v != null))  : []),
    ...(showPsa10 ? (psa10Vals.filter((v): v is number => v != null)) : []),
  ]
  const mn  = Math.min(...allVals)
  const mx  = Math.max(...allVals)
  const rng = mx - mn || 1
  const n   = data.length

  const tx = (i: number) => PX + (i / Math.max(n - 1, 1)) * (W - PX * 2)
  const ty = (p: number) => H - PY - ((p - mn) / rng) * (H - PY * 2)

  const rawLine   = showRaw   ? makeLine(data, d => d.ebay_raw_avg_price,    ty, tx) : ''
  const psa9Line  = showPsa9  ? makeLine(data, d => d.ebay_psa9_smart_price, ty, tx) : ''
  const psa10Line = showPsa10 ? makeLine(data, d => d.ebay_psa10_smart_price, ty, tx) : ''

  // Month axis labels
  const months: { label: string }[] = []
  let lastM = ''
  data.forEach(d => {
    const m = d.snapshot_date.slice(0, 7)
    if (m !== lastM) {
      months.push({ label: new Date(d.snapshot_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }) })
      lastM = m
    }
  })

  // Latest PSA 10 confidence
  const latestConf = [...data].reverse().find(d => d.ebay_psa10_confidence != null)?.ebay_psa10_confidence ?? null

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width
    const i = Math.min(n - 1, Math.max(0, Math.round(relX * (n - 1))))
    setHover({ i, x: tx(i) })
  }

  const hd = hover != null ? data[hover.i] : null

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {showRaw   && <LegendLine color={RAW_COL}   label="Raw"   dashed />}
        {showPsa9  && <LegendLine color={PSA9_COL}  label="PSA 9" />}
        {showPsa10 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <LegendLine color={PSA10_COL} label="PSA 10" />
            {latestConf && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                letterSpacing: '0.04em', textTransform: 'capitalize',
                ...confBadgeStyle(latestConf),
              }}>
                {latestConf}
              </span>
            )}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <svg
          ref={svgRef}
          className="chart-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(null)}
          style={{ cursor: 'crosshair' }}
        >
          {rawLine   && (
            <path d={rawLine}   fill="none" stroke={RAW_COL}   strokeWidth="1.5"
              strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4 3" />
          )}
          {psa9Line  && (
            <path d={psa9Line}  fill="none" stroke={PSA9_COL}  strokeWidth="1.8"
              strokeLinejoin="round" strokeLinecap="round" />
          )}
          {psa10Line && (
            <path d={psa10Line} fill="none" stroke={PSA10_COL} strokeWidth="1.8"
              strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* Hover hairline */}
          {hover && (
            <line x1={hover.x} y1={PY} x2={hover.x} y2={H - PY}
              stroke="var(--ink)" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="3 3" />
          )}

          {/* Hover dots */}
          {hover && hd?.ebay_raw_avg_price    != null && showRaw   && (
            <circle cx={hover.x} cy={ty(hd.ebay_raw_avg_price)}    r="3.5" fill={RAW_COL} />
          )}
          {hover && hd?.ebay_psa9_smart_price  != null && showPsa9  && (
            <circle cx={hover.x} cy={ty(hd.ebay_psa9_smart_price)}  r="3.5" fill={PSA9_COL} />
          )}
          {hover && hd?.ebay_psa10_smart_price != null && showPsa10 && (
            <circle cx={hover.x} cy={ty(hd.ebay_psa10_smart_price)} r="3.5" fill={PSA10_COL} />
          )}
        </svg>

        {/* Hover tooltip */}
        {hover && hd && (
          <div style={{
            position: 'absolute', top: 4,
            left: `clamp(0px, calc(${(hover.x / W) * 100}% - 62px), calc(100% - 128px))`,
            pointerEvents: 'none',
            background: 'var(--ink)', color: 'var(--c1)',
            borderRadius: 7, padding: '6px 10px',
            fontSize: 11, fontFamily: 'var(--fm)',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 14px rgba(26,18,8,0.25)',
            zIndex: 10,
          }}>
            <div style={{ opacity: 0.55, fontSize: 10, marginBottom: 4 }}>
              {new Date(hd.snapshot_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            {showRaw   && hd.ebay_raw_avg_price    != null && (
              <TooltipRow label="Raw"    color={RAW_COL}   value={fmt(hd.ebay_raw_avg_price)} />
            )}
            {showPsa9  && hd.ebay_psa9_smart_price  != null && (
              <TooltipRow label="PSA 9"  color={PSA9_COL}  value={fmt(hd.ebay_psa9_smart_price)} />
            )}
            {showPsa10 && hd.ebay_psa10_smart_price != null && (
              <TooltipRow label="PSA 10" color={PSA10_COL} value={fmt(hd.ebay_psa10_smart_price)} />
            )}
          </div>
        )}
      </div>

      {/* Bottom axis */}
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

function LegendLine({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <svg width="18" height="8" viewBox="0 0 18 8" style={{ flexShrink: 0 }}>
        <line x1="0" y1="4" x2="18" y2="4"
          stroke={color} strokeWidth="2" strokeLinecap="round"
          strokeDasharray={dashed ? '4 3' : undefined} />
      </svg>
      <span style={{ fontSize: 10, color: 'var(--ink-light)' }}>{label}</span>
    </div>
  )
}

function TooltipRow({ label, color, value }: { label: string; color: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: color, flexShrink: 0, display: 'inline-block',
      }} />
      <span style={{ opacity: 0.65, fontSize: 10, minWidth: 36 }}>{label}</span>
      <span style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>{value}</span>
    </div>
  )
}
