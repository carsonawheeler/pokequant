'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './NewHomeTab.module.css'

// ── Card layout configs (from original design) ─────────────────────────────
const CARD_CONFIGS = [
  { left: '3.3%',  top: '6.0%',  opacity: 0.65, rotate: -18, dur: 68.75,   dir:  1, delay:  -4 },
  { left: '22.7%', top: '21.2%', opacity: 0.58, rotate:  32, dur: 93.75,   dir: -1, delay: -11 },
  { left: '45.5%', top: '10.5%', opacity: 0.62, rotate:   8, dur: 81.25,   dir:  1, delay:  -7 },
  { left: '59.1%', top: '31.1%', opacity: 0.55, rotate: -42, dur: 56.25,   dir: -1, delay:  -2 },
  { left: '72.0%', top: '6.4%',  opacity: 0.65, rotate:  55, dur: 106.25,  dir:  1, delay: -15 },
  { left: '85.2%', top: '55.5%', opacity: 0.52, rotate: -12, dur: 75,      dir: -1, delay:  -6 },
  { left: '96.3%', top: '8.5%',  opacity: 0.62, rotate:  28, dur: 62.5,    dir:  1, delay: -18 },
  { left: '96.8%', top: '33.6%', opacity: 0.55, rotate: -65, dur: 87.5,    dir: -1, delay:  -9 },
  { left: '40.5%', top: '56.9%', opacity: 0.50, rotate:  14, dur: 118.75,  dir:  1, delay: -22 },
  { left: '84.8%', top: '89.0%', opacity: 0.55, rotate:  44, dur: 72.5,    dir: -1, delay: -10 },
  { left: '9.8%',  top: '66.3%', opacity: 0.58, rotate: -30, dur: 90,      dir:  1, delay: -17 },
  { left: '3.1%',  top: '42.6%', opacity: 0.48, rotate:  62, dur: 107.5,   dir: -1, delay:  -3 },
  { left: '10.0%', top: '96.8%', opacity: 0.54, rotate: -50, dur: 77.5,    dir:  1, delay: -14 },
  { left: '31.0%', top: '82.0%', opacity: 0.52, rotate:  25, dur: 96.875,  dir: -1, delay:  -8 },
  { left: '62.4%', top: '66.9%', opacity: 0.48, rotate: -40, dur: 110,     dir:  1, delay: -19 },
  { left: '54.0%', top: '95.8%', opacity: 0.55, rotate:  16, dur: 67.5,    dir: -1, delay:  -1 },
]

// ── Feature card definitions ───────────────────────────────────────────────
type NavTab = 'cards' | 'sets' | 'sealed' | 'leaderboard'

const FEATURES: { tab: NavTab; title: string; desc: string; arrow: string; icon: React.ReactNode }[] = [
  {
    tab: 'sets',
    title: 'Sets',
    desc: 'Browse every Pokémon set from Base Set to the latest releases. Track set performance, pull rates, and sealed-to-singles spreads in one place.',
    arrow: 'Explore sets',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 5 L11 3 L11 21 L2 19 Z"/>
        <path d="M13 3 L22 5 L22 19 L13 21 Z"/>
        <line x1="11" y1="3" x2="11" y2="21"/>
        <line x1="13" y1="3" x2="13" y2="21"/>
        <path d="M10 8 Q12 8 14 8" strokeWidth="1.4"/>
        <path d="M10 12 Q12 12 14 12" strokeWidth="1.4"/>
        <path d="M10 16 Q12 16 14 16" strokeWidth="1.4"/>
      </svg>
    ),
  },
  {
    tab: 'cards',
    title: 'Cards',
    desc: 'Real-time prices for individual cards across all grades and printings. Drill into bid/ask spreads, sales history, and volatility metrics.',
    arrow: 'Search cards',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="7" width="8" height="12" rx="1.2" fill="#cec8b4" transform="rotate(24,12,19)"/>
        <rect x="8" y="7" width="8" height="12" rx="1.2" fill="#d8d2be" transform="rotate(8,12,19)"/>
        <rect x="8" y="7" width="8" height="12" rx="1.2" fill="#e2dcc8" transform="rotate(-8,12,19)"/>
        <rect x="8" y="7" width="8" height="12" rx="1.2" fill="#eee8d4" transform="rotate(-24,12,19)"/>
      </svg>
    ),
  },
  {
    tab: 'sealed',
    title: 'Sealed',
    desc: 'Monitor booster box, ETB, and tin prices across the secondary market. Track sealed product as an asset class with historical ROI data.',
    arrow: 'View sealed',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6"  y="2"  width="12" height="3" rx="1.2"/>
        <rect x="10" y="5"  width="4"  height="4" rx="0.8"/>
        <rect x="4"  y="9"  width="16" height="6" rx="1.2"/>
        <rect x="2"  y="18" width="20" height="3" rx="1.5"/>
      </svg>
    ),
  },
  {
    tab: 'leaderboard',
    title: 'Leaderboard',
    desc: "See who's winning the market. Top collectors, best-performing portfolios, and the biggest movers ranked in real time.",
    arrow: 'See rankings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2h12v8a6 6 0 0 1-12 0V2z"/>
        <path d="M6 5H3a2 2 0 0 0 0 4h3"/>
        <path d="M18 5h3a2 2 0 0 1 0 4h-3"/>
        <line x1="12" y1="16" x2="12" y2="20"/>
        <line x1="8"  y1="20" x2="16" y2="20"/>
      </svg>
    ),
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────
function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return Math.round(n).toLocaleString()
  return Math.round(n).toString()
}

// ── Types ──────────────────────────────────────────────────────────────────
interface TickerItem { name: string; price: number | null; momentum: number }
interface Stats {
  cards:        number | null
  sets:         number | null
  ebaySales:    number | null
  dailyUpdates: number | null
}
interface DisplayStats { cards: number; sets: number; ebaySales: number; dailyUpdates: number }

const ZERO_DISPLAY: DisplayStats = { cards: 0, sets: 0, ebaySales: 0, dailyUpdates: 0 }

// ── Component ──────────────────────────────────────────────────────────────
export default function NewHomeTab({ onNavigate }: { onNavigate: (tab: NavTab) => void }) {
  const canvasRef        = useRef<HTMLCanvasElement>(null)
  const rafRef           = useRef<number>(0)

  const [cardImages,   setCardImages]   = useState<string[]>([])
  const [tickerItems,  setTickerItems]  = useState<TickerItem[]>([])
  const [stats,        setStats]        = useState<Stats>({ cards: null, sets: null, ebaySales: null, dailyUpdates: null })
  const [display,      setDisplay]      = useState<DisplayStats>(ZERO_DISPLAY)

  // ── Canvas animation ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Cast as non-nullable — null check below still guards at runtime
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    if (!ctx) return

    type Orb = { x: number; y: number; r: number; vx: number; vy: number; hue: number; sat: number; lit: number; alpha: number }
    type Line = { x?: number; y?: number; vertical: boolean }

    let W = 0, H = 0
    let orbs: Orb[] = []
    let lines: Line[] = []

    function makeOrb(): Orb {
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        r: 180 + Math.random() * 280,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.18,
        hue: Math.random() < 0.6 ? 40 : 30,
        sat: 55 + Math.random() * 20,
        lit: 62 + Math.random() * 16,
        alpha: 0.06 + Math.random() * 0.07,
      }
    }

    function buildLines() {
      lines = []
      for (let i = 0; i <= Math.ceil(W / 80); i++) lines.push({ x: i * 80, vertical: true })
      for (let i = 0; i <= Math.ceil(H / 80); i++) lines.push({ y: i * 80, vertical: false })
    }

    function resize() {
      // canvas is non-null (checked at top of useEffect)
      W = canvas!.width  = window.innerWidth
      H = canvas!.height = window.innerHeight
    }

    function loop() {
      ctx.clearRect(0, 0, W, H)

      // Grid
      ctx.save()
      ctx.strokeStyle = 'rgba(28,27,24,0.038)'
      ctx.lineWidth = 1
      lines.forEach(l => {
        ctx.beginPath()
        if (l.vertical) { ctx.moveTo(l.x!, 0); ctx.lineTo(l.x!, H) }
        else             { ctx.moveTo(0, l.y!); ctx.lineTo(W, l.y!) }
        ctx.stroke()
      })
      ctx.restore()

      // Orbs
      orbs.forEach(o => {
        o.x += o.vx; o.y += o.vy
        if (o.x < -o.r) o.x = W + o.r
        if (o.x > W + o.r) o.x = -o.r
        if (o.y < -o.r) o.y = H + o.r
        if (o.y > H + o.r) o.y = -o.r
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r)
        g.addColorStop(0, `hsla(${o.hue},${o.sat}%,${o.lit}%,${o.alpha})`)
        g.addColorStop(1, `hsla(${o.hue},${o.sat}%,${o.lit}%,0)`)
        ctx.beginPath()
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
      })

      // Sine curves
      const t = Date.now() / 4000
      for (let c = 0; c < 3; c++) {
        ctx.beginPath()
        ctx.strokeStyle = `rgba(184,146,42,${0.04 + c * 0.015})`
        ctx.lineWidth = 1
        for (let x = 0; x <= W; x += 2) {
          const y = H * (0.3 + c * 0.2)
            + Math.sin(x / W * Math.PI * 3 + t + c) * (30 + c * 18)
            + Math.sin(x / W * Math.PI * 5 + t * 1.7 + c * 2) * 14
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    function onResize() { resize(); buildLines() }

    resize(); buildLines()
    orbs = Array.from({ length: 6 }, makeOrb)
    loop()

    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // ── Fetch stats ────────────────────────────────────────────────────────
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)

    async function loadStats() {
      const [cardsRes, setsRes, maxDateRes, dailyRes] = await Promise.all([
        supabase.from('cards').select('id', { count: 'exact', head: true })
          .in('rarity_group', ['SIR', 'IR', 'Ultra', 'Hyper', 'Double Rare']),
        supabase.from('sets').select('id', { count: 'exact', head: true }),
        supabase.from('card_ebay_snapshots').select('snapshot_date')
          .order('snapshot_date', { ascending: false }).limit(1),
        supabase.from('card_price_snapshots').select('id', { count: 'exact', head: true })
          .eq('snapshot_date', today),
      ])

      const maxDate = (maxDateRes.data as { snapshot_date: string }[] | null)?.[0]?.snapshot_date ?? null
      let ebaySales = 0
      if (maxDate) {
        const { data: ebayRows } = await supabase
          .from('card_ebay_snapshots')
          .select('ebay_psa10_sales_count')
          .eq('snapshot_date', maxDate)
        ebaySales = (ebayRows ?? []).reduce(
          (s: number, r: { ebay_psa10_sales_count: number | null }) => s + (r.ebay_psa10_sales_count ?? 0), 0
        )
      }

      setStats({
        cards:        cardsRes.count  ?? 0,
        sets:         setsRes.count   ?? 0,
        ebaySales,
        dailyUpdates: dailyRes.count  ?? 0,
      })
    }

    loadStats()
  }, [])

  // ── Animate counters when stats arrive ────────────────────────────────
  useEffect(() => {
    if (stats.cards === null) return
    const targets = {
      cards:        stats.cards        ?? 0,
      sets:         stats.sets         ?? 0,
      ebaySales:    stats.ebaySales    ?? 0,
      dailyUpdates: stats.dailyUpdates ?? 0,
    }
    const duration = 1800
    const start = performance.now()
    let raf: number

    function step(now: number) {
      const t    = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplay({
        cards:        Math.round(targets.cards        * ease),
        sets:         Math.round(targets.sets         * ease),
        ebaySales:    Math.round(targets.ebaySales    * ease),
        dailyUpdates: Math.round(targets.dailyUpdates * ease),
      })
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [stats])

  // ── Fetch ticker data ──────────────────────────────────────────────────
  useEffect(() => {
    async function loadTicker() {
      // Get recent demand signals with card names
      const { data: signals } = await supabase
        .from('card_demand_signals')
        .select('card_id, price_momentum_30d, signal_date, cards(card_name)')
        .order('signal_date', { ascending: false })
        .limit(400)

      if (!signals?.length) return

      // Dedupe: latest signal per card
      const seen = new Set<number>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deduped: { card_id: number; price_momentum_30d: number | null; cards: { card_name: string } | null }[] = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const s of signals as unknown as typeof deduped) {
        if (!seen.has(s.card_id)) { seen.add(s.card_id); deduped.push(s) }
      }

      // Sort by momentum; take top 8 + bottom 4 for variety
      const sorted = deduped
        .filter(s => s.price_momentum_30d !== null)
        .sort((a, b) => (b.price_momentum_30d ?? 0) - (a.price_momentum_30d ?? 0))
      const selected = [...sorted.slice(0, 8), ...sorted.slice(-4)]

      // Get latest prices for selected cards
      const cardIds = selected.map(s => s.card_id)
      const { data: prices } = await supabase
        .from('card_price_snapshots')
        .select('card_id, tcgplayer_market_price, snapshot_date')
        .in('card_id', cardIds)
        .order('snapshot_date', { ascending: false })
        .limit(cardIds.length * 4)

      const priceMap: Record<number, number> = {}
      ;(prices ?? []).forEach((p: { card_id: number; tcgplayer_market_price: number | null }) => {
        if (!(p.card_id in priceMap) && p.tcgplayer_market_price != null)
          priceMap[p.card_id] = p.tcgplayer_market_price
      })

      setTickerItems(selected.map(s => ({
        name:     s.cards?.card_name ?? 'Unknown',
        price:    priceMap[s.card_id] ?? null,
        momentum: s.price_momentum_30d ?? 0,
      })))
    }
    loadTicker()
  }, [])

  // ── Fetch card images ──────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('cards')
      .select('image_url')
      .eq('rarity_group', 'SIR')
      .not('image_url', 'is', null)
      .limit(16)
      .then(({ data }) => {
        setCardImages(
          (data as { image_url: string }[] ?? []).map(c => c.image_url)
        )
      })
  }, [])

  // ── Feature card mouse-shine ───────────────────────────────────────────
  const handleFcMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', ((e.clientX - r.left) / r.width  * 100).toFixed(1) + '%')
    e.currentTarget.style.setProperty('--my', ((e.clientY - r.top)  / r.height * 100).toFixed(1) + '%')
  }, [])

  // ── Ticker content (doubled for seamless loop) ─────────────────────────
  const tickerContent: TickerItem[] = tickerItems.length > 0
    ? [...tickerItems, ...tickerItems]
    : Array.from({ length: 24 }, () => ({ name: '· · ·', price: null, momentum: 0 }))

  // ── Stat definitions ───────────────────────────────────────────────────
  const STAT_DEFS: { key: keyof DisplayStats; label: string }[] = [
    { key: 'cards',        label: 'Cards Tracked'     },
    { key: 'sets',         label: 'Sets Covered'      },
    { key: 'ebaySales',    label: 'eBay Sales Recorded' },
    { key: 'dailyUpdates', label: 'Daily Updates'     },
  ]

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.home}>

      {/* Animated background canvas */}
      <canvas ref={canvasRef} className={styles.bgCanvas} />

      {/* 3D spinning card layer */}
      <div className={styles.cardsLayer}>
        {CARD_CONFIGS.map((cfg, i) => (
          <div
            key={i}
            className={styles.cardOuter}
            style={{ left: cfg.left, top: cfg.top, opacity: cfg.opacity, transform: `rotate(${cfg.rotate}deg)` }}
          >
            <div className={styles.cardScene}>
              <div
                className={cfg.dir === 1 ? styles.cardSpinFwd : styles.cardSpinRev}
                style={{ animationDuration: `${cfg.dur}s`, animationDelay: `${cfg.delay}s` }}
              >
                <div className={styles.face}>
                  {cardImages[i] && <img src={cardImages[i]} alt="" />}
                </div>
                <div className={`${styles.face} ${styles.back}`}>
                  <img src="/card-back.jpg" alt="" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live ticker strip */}
      <div className={styles.ticker}>
        <div className={styles.tickerTrack}>
          {tickerContent.map((item, i) => (
            <span key={i} className={styles.tickerItem}>
              <span className={styles.tickerName}>{item.name}</span>
              {item.price != null && (
                <span className={styles.tickerPrice}>${item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              )}
              {item.momentum !== 0 && (
                <span className={item.momentum >= 0 ? styles.tickerUp : styles.tickerDown}>
                  {item.momentum >= 0 ? '▲' : '▼'}{Math.abs(item.momentum).toFixed(1)}%
                </span>
              )}
              <span className={styles.tickerDot}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Logo — clicking returns to home (no-op since we're already here) */}
          <button className={styles.logoBtn} onClick={() => {}}>
            <svg className={styles.logoMark} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 8 A9 9 0 1 0 22 24"/>
              <circle cx="20" cy="16" r="4" strokeWidth="2.6"/>
              <line x1="23" y1="19" x2="28" y2="24" strokeWidth="2.8"/>
            </svg>
            <span className={styles.logoText}>CardQuant</span>
            <span className={styles.betaBadge}>BETA</span>
          </button>

          <div className={styles.navLinks}>
            <button onClick={() => onNavigate('sets')}>Sets</button>
            <button onClick={() => onNavigate('cards')}>Cards</button>
            <button onClick={() => onNavigate('sealed')}>Sealed</button>
            <button onClick={() => onNavigate('leaderboard')}>Leaderboard</button>
          </div>
        </div>

        <div className={styles.liveIndicator}>
          <div className={styles.liveDot} />
          LIVE DATA
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroPlate}>
          <div className={styles.heroEyebrow}>Quantitative Pokémon Markets</div>
          <h1 className={styles.heroTitle}>
            Master the Meta<br />
            <span className={styles.accent}>Own the Metrics</span>
          </h1>
          <p className={styles.heroSub}>
            Real-time price discovery, volatility modeling, and market analytics — built for serious collectors and investors.
          </p>
        </div>

        {/* Stat counters */}
        <div className={styles.statsRow}>
          {STAT_DEFS.map(s => (
            <div key={s.key} className={styles.stat}>
              <span className={styles.statNum}>
                {stats[s.key] === null ? '…' : formatNum(display[s.key])}
              </span>
              <span className={styles.statLbl}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}><span>Platform Features</span></div>
        <div className={styles.featuresGrid}>
          {FEATURES.map(fc => (
            <button
              key={fc.tab}
              className={styles.fc}
              onClick={() => onNavigate(fc.tab)}
              onMouseMove={handleFcMouseMove}
            >
              <div className={styles.fcIcon}>{fc.icon}</div>
              <div className={styles.fcTitle}>{fc.title}</div>
              <div className={styles.fcDesc}>{fc.desc}</div>
              <div className={styles.fcArrow}>
                {fc.arrow}&nbsp;
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerCopy}>© 2026 CardQuant · Not financial advice</div>
        <div className={styles.footerLinks}>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Discord</a>
          <a href="#">Twitter</a>
        </div>
      </footer>

    </div>
  )
}
