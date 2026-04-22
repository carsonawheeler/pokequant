'use client'

import { useState, useMemo } from 'react'
import { PricePoint } from '@/lib/types'
import { fmt } from '@/lib/utils'

const RANGE_OPTS = [
  { id: '1m',  label: '1M' },
  { id: '3m',  label: '3M' },
  { id: '6m',  label: '6M' },
  { id: 'all', label: 'All' },
]

export default function PriceChart({ data }: { data: PricePoint[] | null }) {
  const [range, setRange] = useState('all')

  const filtered = useMemo(() => {
    if (!data || range === 'all') return data
    const days = ({ '1m': 30, '3m': 90, '6m': 180 } as Record<string, number>)[range]
    const cutoff = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10)
    return data.filter(d => d.snapshot_date >= cutoff)
  }, [data, range])

  if (!data) {
    return <div className="shimmer" style={{ height: 110, borderRadius: 8 }} />
  }

  if ((filtered?.length ?? 0) < 3) {
    return (
      <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-light)', fontSize: 12 }}>
        Not enough data for selected range
      </div>
    )
  }

  const prices = filtered!.map(d => d.tcgplayer_market_price)
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGE_OPTS.map(o => (
            <button
              key={o.id}
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

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={col} stopOpacity="0.18" />
            <stop offset="100%" stopColor={col} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${uid})`} />
        <path d={lineD} fill="none" stroke={col} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill={col} />
        <circle cx={pts[0][0]} cy={pts[0][1]} r="2.5" fill={col} fillOpacity="0.4" />
      </svg>

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
