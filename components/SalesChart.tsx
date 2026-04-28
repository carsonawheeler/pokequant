'use client'

import { useRef, useState } from 'react'
import { EbayPoint } from './EbayChart'

export interface SalesPoint {
  sale_date: string
  volume: number | null
  market_price: number | null
}

const W = 480, H = 140, PX = 4, PY = 8
const EBAY_VOL_COL = '#2d7dd2'

type VolTab = 'tcg' | 'ebay_psa10'

interface SalesChartProps {
  data: SalesPoint[] | null
  ebayVolData?: EbayPoint[] | null
}

export default function SalesChart({ data, ebayVolData }: SalesChartProps) {
  const [hover, setHover] = useState<{
    i: number
    x: number
    date: string
    volume: number | null
  } | null>(null)
  const [volTab, setVolTab] = useState<VolTab>('tcg')
  const svgRef = useRef<SVGSVGElement>(null)

  // ── Hooks must come before early returns ──────────────────────────────────

  if (data === null) {
    return <div className="shimmer" style={{ height: 110, borderRadius: 8 }} />
  }

  if (data.length === 0) {
    return (
      <div style={{
        height: 90, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: 'var(--ink-light)', fontSize: 12,
        background: 'var(--c2)', borderRadius: 8,
      }}>
        Data available after tonight&apos;s update
      </div>
    )
  }

  // ── eBay PSA10 vol series ─────────────────────────────────────────────────
  const ebayVolSeries = (ebayVolData ?? [])
    .filter(d => d.ebay_psa10_daily_volume_7day != null)
    .map(d => ({ date: d.snapshot_date, vol: d.ebay_psa10_daily_volume_7day! }))
  const hasEbayVol = ebayVolSeries.length > 0

  // ── Active series ─────────────────────────────────────────────────────────
  const isEbayActive = volTab === 'ebay_psa10' && hasEbayVol

  const activeData: { date: string; volume: number }[] = isEbayActive
    ? ebayVolSeries.map(d => ({ date: d.date, volume: d.vol }))
    : data.map(d => ({ date: d.sale_date, volume: d.volume ?? 0 }))

  // ── Derived geometry ──────────────────────────────────────────────────────

  const n    = activeData.length
  const barW = (W - PX * 2) / Math.max(n, 1)

  const volumes = activeData.map(d => d.volume)
  const maxVol  = Math.max(...volumes, 1)

  const tx   = (i: number) => PX + barW * i + barW / 2
  const barH = (v: number) => (v / maxVol) * (H - PY * 2)

  const barCol      = isEbayActive ? EBAY_VOL_COL : 'var(--gold-l)'
  const barColHover = isEbayActive ? '#4a9de0' : 'var(--gold)'

  // ── Month axis labels ─────────────────────────────────────────────────────

  const months: { label: string }[] = []
  let lastM = ''
  activeData.forEach(d => {
    const m = d.date.slice(0, 7)
    if (m !== lastM) {
      months.push({
        label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }),
      })
      lastM = m
    }
  })

  // ── Event handlers ────────────────────────────────────────────────────────

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width
    const i = Math.min(n - 1, Math.max(0, Math.floor(relX * n)))
    setHover({ i, x: tx(i), date: activeData[i].date, volume: activeData[i].volume })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Volume source toggle */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
        <button
          onClick={() => setVolTab('tcg')}
          style={{
            padding: '3px 11px', borderRadius: 6, fontSize: 11,
            fontFamily: 'var(--fm)', fontWeight: 600,
            background: volTab === 'tcg' ? 'var(--gold)' : 'var(--c2)',
            color:      volTab === 'tcg' ? 'white' : 'var(--ink-light)',
            border:     `1px solid ${volTab === 'tcg' ? 'var(--gold-l)' : 'var(--cborder)'}`,
            transition: 'all 0.12s',
          }}
        >
          TCGPlayer Volume
        </button>
        <button
          onClick={() => hasEbayVol && setVolTab('ebay_psa10')}
          style={{
            padding: '3px 11px', borderRadius: 6, fontSize: 11,
            fontFamily: 'var(--fm)', fontWeight: 600,
            background: volTab === 'ebay_psa10' && hasEbayVol ? EBAY_VOL_COL : 'var(--c2)',
            color:      volTab === 'ebay_psa10' && hasEbayVol ? 'white' : hasEbayVol ? 'var(--ink-light)' : 'var(--cborder)',
            border:     `1px solid ${volTab === 'ebay_psa10' && hasEbayVol ? EBAY_VOL_COL : 'var(--cborder)'}`,
            transition: 'all 0.12s',
            cursor:     hasEbayVol ? 'pointer' : 'default',
            opacity:    hasEbayVol ? 1 : 0.65,
          }}
        >
          PSA 10 Vol{!hasEbayVol ? ' · No data' : ' (7-day avg)'}
        </button>
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
          {/* Volume bars */}
          {activeData.map((d, i) => {
            const bh = barH(d.volume)
            if (bh <= 0) return null
            return (
              <rect
                key={i}
                x={PX + barW * i + barW * 0.12}
                y={H - PY - bh}
                width={barW * 0.76}
                height={bh}
                fill={hover?.i === i ? barColHover : barCol}
                fillOpacity={hover?.i === i ? 0.75 : 0.45}
                rx={1.5}
              />
            )
          })}

          {/* Hover hairline */}
          {hover && (
            <line
              x1={hover.x} y1={PY} x2={hover.x} y2={H - PY}
              stroke="var(--ink)" strokeWidth="1"
              strokeOpacity="0.2" strokeDasharray="3 3"
            />
          )}
        </svg>

        {/* Hover tooltip */}
        {hover && (
          <div style={{
            position: 'absolute',
            top: 4,
            left: `clamp(0px, calc(${(hover.x / W) * 100}% - 60px), calc(100% - 120px))`,
            pointerEvents: 'none',
            background: 'var(--ink)',
            color: 'var(--c1)',
            borderRadius: 7,
            padding: '6px 10px',
            fontSize: 11,
            fontFamily: 'var(--fm)',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 14px rgba(26,18,8,0.25)',
            zIndex: 10,
          }}>
            <div style={{ opacity: 0.85, fontWeight: 600 }}>
              {isEbayActive
                ? `${(hover.volume ?? 0).toFixed(2)} / day (7-day avg)`
                : `${hover.volume ?? 0} sold`
              }
            </div>
            <div style={{ opacity: 0.55, fontSize: 10, marginTop: 2 }}>
              {new Date(hover.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom axis */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px', marginTop: 4 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--fm)', color: 'var(--ink-light)' }}>
          {isEbayActive ? '0/day' : '0 sold'}
        </span>
        <div style={{ display: 'flex', gap: 12 }}>
          {months.slice(0, 8).map((t, i) => (
            <span key={i} style={{ fontSize: 10, color: 'var(--ink-light)' }}>{t.label}</span>
          ))}
        </div>
        <span style={{ fontSize: 10, fontFamily: 'var(--fm)', color: 'var(--ink-light)' }}>
          {isEbayActive ? `${maxVol.toFixed(1)}/day` : `${maxVol} sold`}
        </span>
      </div>
    </div>
  )
}
