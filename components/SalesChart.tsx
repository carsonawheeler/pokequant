'use client'

import { useRef, useState } from 'react'
import { fmt } from '@/lib/utils'

export interface SalesPoint {
  sale_date: string
  volume: number | null
  market_price: number | null
}

const W = 480, H = 140, PX = 4, PY = 8

export default function SalesChart({ data }: { data: SalesPoint[] | null }) {
  const [hover, setHover] = useState<{
    i: number
    x: number
    date: string
    volume: number | null
    price: number | null
  } | null>(null)
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

  // ── Derived geometry ──────────────────────────────────────────────────────

  const n    = data.length
  const barW = (W - PX * 2) / n

  const volumes     = data.map(d => d.volume ?? 0)
  const validPrices = data.map(d => d.market_price).filter((p): p is number => p != null)

  const maxVol = Math.max(...volumes, 1)
  const mnP    = validPrices.length ? Math.min(...validPrices) : 0
  const mxP    = validPrices.length ? Math.max(...validPrices) : 1
  const rngP   = mxP - mnP || 1

  const tx       = (i: number) => PX + barW * i + barW / 2
  const tyPrice  = (p: number) => H - PY - ((p - mnP) / rngP) * (H - PY * 2)
  const barH     = (v: number) => (v / maxVol) * (H - PY * 2)

  // ── Price line path ───────────────────────────────────────────────────────

  const pricePts = data
    .map((d, i): [number, number] | null =>
      d.market_price != null ? [tx(i), tyPrice(d.market_price)] : null
    )
    .filter((pt): pt is [number, number] => pt !== null)

  let lineD = '', areaD = ''
  if (pricePts.length > 1) {
    lineD = pricePts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
    areaD = lineD
      + ` L${pricePts[pricePts.length - 1][0].toFixed(1)} ${H}`
      + ` L${pricePts[0][0].toFixed(1)} ${H}Z`
  }

  const trend   = validPrices.length >= 2 && validPrices[validPrices.length - 1] >= validPrices[0]
  const lineCol = trend ? 'var(--green)' : 'var(--red)'
  // Stable gradient id — based on first date so it won't change on hover rerender
  const uid = `sc-${data[0].sale_date.replace(/\W/g, '')}`

  // ── Month axis labels ─────────────────────────────────────────────────────

  const months: { i: number; label: string }[] = []
  let lastM = ''
  data.forEach((d, i) => {
    const m = d.sale_date.slice(0, 7)
    if (m !== lastM) {
      months.push({
        i,
        label: new Date(d.sale_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }),
      })
      lastM = m
    }
  })

  // ── Event handlers ────────────────────────────────────────────────────────

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || !data) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width
    const i = Math.min(n - 1, Math.max(0, Math.floor(relX * n)))
    setHover({
      i,
      x: tx(i),
      date: data[i].sale_date,
      volume: data[i].volume,
      price: data[i].market_price,
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
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
          <defs>
            <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={lineCol} stopOpacity="0.15" />
              <stop offset="100%" stopColor={lineCol} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Volume bars (drawn first so price line sits on top) */}
          {data.map((d, i) => {
            const v  = d.volume ?? 0
            const bh = barH(v)
            if (bh <= 0) return null
            return (
              <rect
                key={i}
                x={PX + barW * i + barW * 0.12}
                y={H - PY - bh}
                width={barW * 0.76}
                height={bh}
                fill={hover?.i === i ? 'var(--gold)' : 'var(--gold-l)'}
                fillOpacity={hover?.i === i ? 0.75 : 0.45}
                rx={1.5}
              />
            )
          })}

          {/* Price area gradient fill */}
          {areaD && <path d={areaD} fill={`url(#${uid})`} />}

          {/* Price line */}
          {lineD && (
            <path
              d={lineD} fill="none"
              stroke={lineCol} strokeWidth="1.8"
              strokeLinejoin="round" strokeLinecap="round"
            />
          )}

          {/* Hover hairline */}
          {hover && (
            <line
              x1={hover.x} y1={PY} x2={hover.x} y2={H - PY}
              stroke="var(--ink)" strokeWidth="1"
              strokeOpacity="0.2" strokeDasharray="3 3"
            />
          )}

          {/* Hover dot on price line */}
          {hover?.price != null && (() => {
            const dotY = tyPrice(hover.price)
            return (
              <>
                <circle cx={hover.x} cy={dotY} r="4"   fill={lineCol} />
                <circle cx={hover.x} cy={dotY} r="6.5" fill={lineCol} fillOpacity="0.2" />
              </>
            )
          })()}

          {/* Latest price dot */}
          {pricePts.length > 0 && (
            <circle
              cx={pricePts[pricePts.length - 1][0]}
              cy={pricePts[pricePts.length - 1][1]}
              r="3.5" fill={lineCol}
            />
          )}
          {pricePts.length > 0 && (
            <circle cx={pricePts[0][0]} cy={pricePts[0][1]} r="2.5" fill={lineCol} fillOpacity="0.4" />
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
            {hover.price != null && (
              <div style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>{fmt(hover.price)}</div>
            )}
            <div style={{ opacity: 0.85, fontSize: 10, marginTop: hover.price != null ? 2 : 0 }}>
              {hover.volume ?? 0} sold
            </div>
            <div style={{ opacity: 0.55, fontSize: 10, marginTop: 1 }}>
              {new Date(hover.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom axis: 0 sold · month labels · max sold */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px', marginTop: 4 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--fm)', color: 'var(--ink-light)' }}>0 sold</span>
        <div style={{ display: 'flex', gap: 12 }}>
          {months.slice(0, 8).map((t, i) => (
            <span key={i} style={{ fontSize: 10, color: 'var(--ink-light)' }}>{t.label}</span>
          ))}
        </div>
        <span style={{ fontSize: 10, fontFamily: 'var(--fm)', color: 'var(--ink-light)' }}>{maxVol} sold</span>
      </div>
    </div>
  )
}
