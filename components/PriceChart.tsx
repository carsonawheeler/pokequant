'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { PricePoint, GradedPoint } from '@/lib/types'
import { fmt } from '@/lib/utils'

const RANGE_OPTS = [
  { id: '1m',  label: '1M' },
  { id: '3m',  label: '3M' },
  { id: '6m',  label: '6M' },
  { id: 'all', label: 'All' },
]

interface PriceChartProps {
  data: PricePoint[] | null
  gradedData?: GradedPoint[] | null
  showToggle?: boolean
}

export default function PriceChart({ data, gradedData, showToggle }: PriceChartProps) {
  const [range,    setRange]    = useState('all')
  const [chartTab, setChartTab] = useState<'raw' | 'psa10'>('raw')
  const [hover,    setHover]    = useState<{ x: number; y: number; date: string; price: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const activeData: { snapshot_date: string; price: number }[] | null = useMemo(() => {
    if (chartTab === 'psa10') {
      return gradedData ? gradedData.map(d => ({ snapshot_date: d.snapshot_date, price: d.price })) : null
    }
    return data ? data.map(d => ({ snapshot_date: d.snapshot_date, price: d.tcgplayer_market_price })) : null
  }, [chartTab, data, gradedData])

  const filtered = useMemo(() => {
    if (!activeData || range === 'all') return activeData
    const days = ({ '1m': 30, '3m': 90, '6m': 180 } as Record<string, number>)[range]
    const cutoff = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10)
    return activeData.filter(d => d.snapshot_date >= cutoff)
  }, [activeData, range])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!filtered || filtered.length < 2 || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width
    const idx = Math.round(relX * (filtered.length - 1))
    const clamped = Math.max(0, Math.min(filtered.length - 1, idx))
    const W = 480, H = 140, PX = 4, PY = 8
    const prices = filtered.map(d => d.price)
    const mn = Math.min(...prices), mx = Math.max(...prices)
    const rng = mx - mn || 1
    const tx = (i: number) => PX + (i / (prices.length - 1)) * (W - PX * 2)
    const ty = (p: number) => H - PY - ((p - mn) / rng) * (H - PY * 2)
    setHover({
      x: tx(clamped),
      y: ty(prices[clamped]),
      date: filtered[clamped].snapshot_date,
      price: prices[clamped],
    })
  }, [filtered])

  const handleMouseLeave = useCallback(() => setHover(null), [])

  if (!data) {
    return <div className="shimmer" style={{ height: 110, borderRadius: 8 }} />
  }

  const noGraded = chartTab === 'psa10' && (!gradedData || gradedData.length === 0)

  if (noGraded) {
    return (
      <div>
        {showToggle && <ChartTabBar chartTab={chartTab} setChartTab={setChartTab} />}
        <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-light)', fontSize: 12 }}>
          No PSA 10 data available
        </div>
      </div>
    )
  }

  if ((filtered?.length ?? 0) < 3) {
    return (
      <div>
        {showToggle && <ChartTabBar chartTab={chartTab} setChartTab={setChartTab} />}
        <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-light)', fontSize: 12 }}>
          Not enough data for selected range
        </div>
      </div>
    )
  }

  const prices = filtered!.map(d => d.price)
  const dates  = filtered!.map(d => d.snapshot_date)
  const mn = Math.min(...prices)
  const mx = Math.max(...prices)
  const rng = mx - mn || 1
  const W = 480, H = 140, PX = 4, PY = 8

  const tx = (i: number) => PX + (i / (prices.length - 1)) * (W - PX * 2)
  const ty = (p: number) => H - PY - ((p - mn) / rng) * (H - PY * 2)
  const pts = prices.map((p, i) => [tx(i), ty(p)] as [number, number])

  const lineD = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const areaD = lineD + ` L${pts[pts.length - 1][0]} ${H} L${pts[0][0]} ${H}Z`
  const trend = prices[prices.length - 1] >= prices[0]
  const col   = trend ? 'var(--green)' : 'var(--red)'
  const uid   = `g${Math.random().toString(36).slice(2, 8)}`

  const months: { i: number; label: string }[] = []
  let lastM = ''
  dates.forEach((d, i) => {
    const m = d.slice(0, 7)
    if (m !== lastM) {
      months.push({ i, label: new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }) })
      lastM = m
    }
  })

  const change = prices[prices.length - 1] - prices[0]
  const changePct = (change / prices[0]) * 100

  return (
    <div>
      {showToggle && <ChartTabBar chartTab={chartTab} setChartTab={setChartTab} />}

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
                color: range === o.id ? 'var(--c1)' : 'var(--ink-light)',
                border: `1px solid ${range === o.id ? 'var(--ink)' : 'var(--cborder)'}`,
                transition: 'all 0.12s',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, fontFamily: 'var(--fm)', color: trend ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
          {change >= 0 ? '+' : ''}{fmt(change)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%)
        </span>
      </div>

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
            <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={col} stopOpacity="0.18" />
              <stop offset="100%" stopColor={col} stopOpacity="0.01" />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#${uid})`} />
          <path d={lineD} fill="none" stroke={col} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />

          {/* Hover hairline + dot */}
          {hover && (
            <>
              <line
                x1={hover.x} y1={PY} x2={hover.x} y2={H - PY}
                stroke="var(--ink)" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="3 3"
              />
              <circle cx={hover.x} cy={hover.y} r="4" fill={col} />
              <circle cx={hover.x} cy={hover.y} r="6.5" fill={col} fillOpacity="0.2" />
            </>
          )}

          <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill={col} />
          <circle cx={pts[0][0]} cy={pts[0][1]} r="2.5" fill={col} fillOpacity="0.4" />
        </svg>

        {/* Hover tooltip box */}
        {hover && (
          <div style={{
            position: 'absolute',
            top: 4,
            left: `clamp(0px, calc(${(hover.x / W) * 100}% - 56px), calc(100% - 112px))`,
            pointerEvents: 'none',
            background: 'var(--ink)',
            color: 'var(--c1)',
            borderRadius: 7,
            padding: '5px 10px',
            fontSize: 11,
            fontFamily: 'var(--fm)',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 14px rgba(26,18,8,0.25)',
            zIndex: 10,
          }}>
            <div style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>{fmt(hover.price)}</div>
            <div style={{ opacity: 0.65, fontSize: 10 }}>
              {new Date(hover.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        )}
      </div>

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

function ChartTabBar({
  chartTab,
  setChartTab,
}: {
  chartTab: 'raw' | 'psa10'
  setChartTab: (t: 'raw' | 'psa10') => void
}) {
  return (
    <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
      {([{ id: 'raw', label: 'Raw' }, { id: 'psa10', label: 'PSA 10' }] as const).map(t => (
        <button
          key={t.id}
          onClick={() => setChartTab(t.id)}
          style={{
            padding: '3px 11px', borderRadius: 6, fontSize: 11,
            fontFamily: 'var(--fm)', fontWeight: 600,
            background: chartTab === t.id ? 'var(--gold)' : 'var(--c2)',
            color: chartTab === t.id ? 'white' : 'var(--ink-light)',
            border: `1px solid ${chartTab === t.id ? 'var(--gold-l)' : 'var(--cborder)'}`,
            transition: 'all 0.12s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
