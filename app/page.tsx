'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────
interface Card {
  id: number
  card_name: string
  tcg_id: string
  rarity_group: string
  character_name: string
  nostalgia_score: number
  character_premium_score: number
  aesthetic_score: number
  gradability_score: number
  pull_cost_score: number
  set_median_sir_price: number
  image_url: string
  set_name: string
  set_code: string
  tcgplayer_market_price: number
  demand_score: number
  price_momentum_30d: number
}

interface SetData {
  id: number
  set_code: string
  set_name: string
  sir_count: number
  pack_price: number | null
  median_price: number | null
}

// ── Signal helpers ──────────────────────────────────────────────────
function getSignal(price: number, model: number | null) {
  if (!model) return null
  const ratio = price / model
  if (ratio < 0.667) return 'UNDERVALUED'
  if (ratio > 1.52) return 'OVERVALUED'
  return 'FAIR VALUE'
}

function SignalBadge({ price, model }: { price: number, model?: number | null }) {
  const signal = getSignal(price, model ?? null)
  if (!signal) return null
  const styles: Record<string, string> = {
    'UNDERVALUED': 'bg-green-950 text-green-400 border border-green-800',
    'OVERVALUED': 'bg-red-950 text-red-400 border border-red-800',
    'FAIR VALUE': 'bg-slate-800 text-slate-400 border border-slate-700',
  }
  return (
    <span className={`text-[10px] font-bold tracking-widest px-2 py-0.5 rounded ${styles[signal]}`}>
      {signal}
    </span>
  )
}

function MomentumBadge({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-slate-600">—</span>
  const color = value > 5 ? 'text-green-400' : value < -5 ? 'text-red-400' : 'text-slate-400'
  const arrow = value > 5 ? '▲' : value < -5 ? '▼' : '●'
  return (
    <span className={`mono font-bold text-sm ${color}`}>
      {arrow} {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  )
}

// ── Card tile ───────────────────────────────────────────────────────
function CardTile({ card, onClick }: { card: Card, onClick: (c: Card) => void }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      onClick={() => onClick(card)}
      className="group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #0a0f1e 100%)',
        border: '1px solid var(--border)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent)'
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(245,158,11,0.12)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Card image */}
      <div className="relative bg-slate-950" style={{paddingTop: '140%'}}>
        {card.image_url && (
          <img
            src={card.image_url}
            alt={card.card_name}
            onLoad={() => setLoaded(true)}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
            style={{ opacity: loaded ? 1 : 0 }}
          />
        )}
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-700 text-4xl">◆</div>
        )}
        <div className="absolute top-2 right-2">
          <SignalBadge price={card.tcgplayer_market_price} />
        </div>
      </div>

      {/* Card info */}
      <div className="p-3">
        <div className="font-bold text-sm text-slate-100 truncate">{card.card_name}</div>
        <div className="text-xs text-slate-500 mt-0.5 truncate">{card.set_name}</div>
        <div className="flex items-end justify-between mt-2">
          <div>
            <div className="text-[10px] text-slate-600 mb-0.5">MARKET</div>
            <div className="mono font-bold text-lg" style={{color: 'var(--accent)'}}>
              ${card.tcgplayer_market_price?.toFixed(0) ?? '—'}
            </div>
          </div>
          {card.price_momentum_30d !== null && (
            <div className="text-right">
              <div className="text-[10px] text-slate-600 mb-0.5">30D</div>
              <MomentumBadge value={card.price_momentum_30d} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Card modal ──────────────────────────────────────────────────────
function CardModal({ card, onClose }: { card: Card, onClose: () => void }) {
  const features = [
    { label: 'Nostalgia', value: card.nostalgia_score },
    { label: 'Character Premium', value: card.character_premium_score },
    { label: 'Aesthetic', value: card.aesthetic_score },
    { label: 'Gradability', value: card.gradability_score },
    { label: 'Pull Cost', value: card.pull_cost_score },
    { label: 'Demand', value: card.demand_score },
  ].filter(f => f.value != null)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)'}}
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl overflow-hidden w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{background: 'var(--bg-card)', border: '1px solid var(--border)'}}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex">
          {/* Image */}
          <div className="w-56 flex-shrink-0 flex items-center justify-center p-5"
               style={{background: 'var(--bg-secondary)'}}>
            {card.image_url && (
              <img src={card.image_url} alt={card.card_name}
                   className="w-full rounded-lg shadow-2xl" />
            )}
          </div>

          {/* Details */}
          <div className="flex-1 p-6">
            <div className="flex justify-between items-start mb-1">
              <div>
                <h2 className="text-xl font-bold text-slate-100">{card.card_name}</h2>
                <p className="text-sm text-slate-500 mt-1">{card.set_name} · {card.rarity_group}</p>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-2xl leading-none">×</button>
            </div>

            {/* Price */}
            <div className="mt-4 p-4 rounded-xl" style={{background: 'var(--bg-elevated)'}}>
              <div className="text-xs text-slate-500 mb-1 tracking-widest">MARKET PRICE</div>
              <div className="mono text-3xl font-bold" style={{color: 'var(--accent)'}}>
                ${card.tcgplayer_market_price?.toFixed(2)}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <SignalBadge price={card.tcgplayer_market_price} />
                <MomentumBadge value={card.price_momentum_30d} />
                <span className="text-xs text-slate-600">30-day momentum</span>
              </div>
            </div>

            {/* Features */}
            <div className="mt-4">
              <div className="text-xs text-slate-500 tracking-widest mb-3">MODEL FEATURES</div>
              {features.map(f => (
                <div key={f.label} className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{f.label}</span>
                    <span className="mono text-slate-200 font-semibold">{f.value?.toFixed(1)} / 10</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{background: 'var(--bg-primary)'}}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${((f.value ?? 0) / 10) * 100}%`,
                        background: 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Demand */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg text-center" style={{background: 'var(--bg-elevated)'}}>
                <div className="text-[10px] text-slate-500 mb-1 tracking-widest">DEMAND SCORE</div>
                <div className="mono font-bold text-slate-200">{card.demand_score?.toFixed(1) ?? '—'} / 10</div>
              </div>
              <div className="p-3 rounded-lg text-center" style={{background: 'var(--bg-elevated)'}}>
                <div className="text-[10px] text-slate-500 mb-1 tracking-widest">CHARACTER</div>
                <div className="font-bold text-slate-200 text-sm truncate">{card.character_name ?? '—'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────
export default function Home() {
  const [tab, setTab] = useState<'cards' | 'sets' | 'movers'>('cards')
  const [cards, setCards] = useState<Card[]>([])
  const [sets, setSets] = useState<SetData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [setFilter, setSetFilter] = useState('all')
  const [sortBy, setSortBy] = useState('price_desc')
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // Load cards
        const { data: cardData } = await supabase
          .from('cards')
          .select('id,card_name,tcg_id,rarity_group,character_name,nostalgia_score,character_premium_score,aesthetic_score,gradability_score,pull_cost_score,set_median_sir_price,image_url,set_id,sets(set_name,set_code)')
          .eq('rarity_group', 'SIR')
          .limit(300)

        // Load latest prices
        const { data: priceData } = await supabase
          .from('card_price_snapshots')
          .select('card_id,tcgplayer_market_price,snapshot_date')
          .neq('price_source', 'ppt_historical')
          .order('snapshot_date', { ascending: false })
          .limit(1000)

        // Load demand signals
        const { data: demandData } = await supabase
          .from('card_demand_signals')
          .select('card_id,demand_score,price_momentum_30d')
          .order('signal_date', { ascending: false })
          .limit(500)

        // Build lookup maps
        const priceMap: Record<number, number> = {}
        priceData?.forEach(p => {
          if (!priceMap[p.card_id]) priceMap[p.card_id] = p.tcgplayer_market_price
        })

        const demandMap: Record<number, { demand_score: number, price_momentum_30d: number }> = {}
        demandData?.forEach(d => {
          if (!demandMap[d.card_id]) demandMap[d.card_id] = d
        })

        // Merge and filter
        const merged = (cardData ?? [])
          .filter((c: any) => c.sets?.set_code?.startsWith('sv'))
          .map((c: any) => ({
            ...c,
            set_name: c.sets?.set_name ?? '',
            set_code: c.sets?.set_code ?? '',
            tcgplayer_market_price: priceMap[c.id] ?? null,
            demand_score: demandMap[c.id]?.demand_score ?? null,
            price_momentum_30d: demandMap[c.id]?.price_momentum_30d ?? null,
          }))
          .filter((c: any) => c.tcgplayer_market_price !== null) as Card[]

        setCards(merged)

        // Load sets
        const { data: setData } = await supabase
          .from('sets')
          .select('id,set_code,set_name,sir_count')
          .like('set_code', 'sv%')

        const { data: packData } = await supabase
          .from('set_price_snapshots')
          .select('set_id,pack_market_price')
          .order('snapshot_date', { ascending: false })
          .limit(100)

        const packMap: Record<number, number> = {}
        packData?.forEach(p => { if (!packMap[p.set_id]) packMap[p.set_id] = p.pack_market_price })

        const setsWithData = (setData ?? []).map((s: any) => {
          const setCards = merged.filter(c => c.set_code === s.set_code)
          const prices = setCards.map(c => c.tcgplayer_market_price).sort((a, b) => a - b)
          const mid = Math.floor(prices.length / 2)
          const median = prices.length > 0
            ? prices.length % 2 === 0 ? (prices[mid-1] + prices[mid]) / 2 : prices[mid]
            : null
          return { ...s, pack_price: packMap[s.id] ?? null, median_price: median }
        })

        setSets(setsWithData)
      } catch (e) {
        console.error(e)
      }
      setLoading(false)
    }
    load()
  }, [])

  const allSets = useMemo(() => [...new Set(cards.map(c => c.set_code))].sort(), [cards])

  const filtered = useMemo(() => {
    let d = cards.filter(c => {
      if (search && !c.card_name.toLowerCase().includes(search.toLowerCase()) &&
          !(c.character_name ?? '').toLowerCase().includes(search.toLowerCase())) return false
      if (setFilter !== 'all' && c.set_code !== setFilter) return false
      return true
    })
    if (sortBy === 'price_desc') d.sort((a, b) => (b.tcgplayer_market_price ?? 0) - (a.tcgplayer_market_price ?? 0))
    if (sortBy === 'price_asc') d.sort((a, b) => (a.tcgplayer_market_price ?? 0) - (b.tcgplayer_market_price ?? 0))
    if (sortBy === 'momentum') d.sort((a, b) => (b.price_momentum_30d ?? -999) - (a.price_momentum_30d ?? -999))
    if (sortBy === 'demand') d.sort((a, b) => (b.demand_score ?? 0) - (a.demand_score ?? 0))
    return d
  }, [cards, search, setFilter, sortBy])

  const sortedSets = useMemo(() =>
    [...sets].sort((a, b) => (b.median_price ?? 0) - (a.median_price ?? 0)), [sets])

  const movers = useMemo(() =>
    [...cards]
      .filter(c => c.price_momentum_30d !== null)
      .sort((a, b) => Math.abs(b.price_momentum_30d ?? 0) - Math.abs(a.price_momentum_30d ?? 0))
      .slice(0, 30), [cards])

  const stats = useMemo(() => ({
    total: cards.length,
    avgPrice: cards.length
      ? (cards.reduce((s, c) => s + (c.tcgplayer_market_price ?? 0), 0) / cards.length).toFixed(0)
      : '0',
    rising: cards.filter(c => (c.price_momentum_30d ?? 0) > 10).length,
    topCard: [...cards].sort((a, b) => (b.tcgplayer_market_price ?? 0) - (a.tcgplayer_market_price ?? 0))[0],
  }), [cards])

  return (
    <div className="min-h-screen" style={{background: 'var(--bg-primary)'}}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b"
        style={{background: 'rgba(3,7,17,0.95)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)'}}>
        <div className="max-w-7xl mx-auto px-6 flex items-center h-14 gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-black font-black text-sm"
                 style={{background: 'var(--accent)'}}>◆</div>
            <span className="font-bold text-lg tracking-tight" style={{color: 'var(--text-primary)'}}>PokeQuant</span>
            <span className="text-[10px] tracking-widest px-1.5 py-0.5 rounded mono"
                  style={{background: 'var(--bg-elevated)', color: 'var(--text-muted)'}}>BETA</span>
          </div>

          {/* Nav */}
          <nav className="flex h-full">
            {(['cards', 'sets', 'movers'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-4 h-full text-sm font-semibold capitalize transition-all"
                style={{
                  color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                }}>
                {t}
              </button>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">⌕</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cards..."
              className="pl-8 pr-4 py-1.5 rounded-lg text-sm outline-none w-48"
              style={{background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)'}}
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="text-4xl animate-spin" style={{color: 'var(--accent)'}}>◆</div>
            <p style={{color: 'var(--text-muted)'}}>Loading live data...</p>
          </div>
        ) : (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: 'CARDS TRACKED', value: stats.total, color: 'var(--accent)' },
                { label: 'AVG SIR PRICE', value: `$${stats.avgPrice}`, color: 'var(--blue)' },
                { label: 'RISING 30D', value: stats.rising, color: 'var(--green)' },
                { label: 'TOP CARD', value: stats.topCard?.card_name ?? '—', color: 'var(--text-primary)', small: true },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4"
                     style={{background: 'var(--bg-card)', border: '1px solid var(--border)'}}>
                  <div className="text-[10px] tracking-widest mb-2" style={{color: 'var(--text-muted)'}}>{s.label}</div>
                  <div className={`font-bold ${s.small ? 'text-sm' : 'text-2xl mono'} leading-tight`}
                       style={{color: s.color}}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* CARDS TAB */}
            {tab === 'cards' && (
              <>
                <div className="flex gap-3 mb-5 flex-wrap">
                  <select value={setFilter} onChange={e => setSetFilter(e.target.value)}
                    className="rounded-lg px-3 py-1.5 text-xs outline-none"
                    style={{background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)'}}>
                    <option value="all">All Sets</option>
                    {allSets.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    className="rounded-lg px-3 py-1.5 text-xs outline-none"
                    style={{background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)'}}>
                    <option value="price_desc">Price ↓</option>
                    <option value="price_asc">Price ↑</option>
                    <option value="momentum">Momentum</option>
                    <option value="demand">Demand</option>
                  </select>
                  <span className="text-xs self-center" style={{color: 'var(--text-muted)'}}>{filtered.length} cards</span>
                </div>
                <div className="grid gap-4" style={{gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))'}}>
                  {filtered.map(card => (
                    <CardTile key={card.id} card={card} onClick={setSelectedCard} />
                  ))}
                </div>
              </>
            )}

            {/* SETS TAB */}
            {tab === 'sets' && (
              <div className="rounded-xl overflow-hidden"
                   style={{background: 'var(--bg-card)', border: '1px solid var(--border)'}}>
                <div className="grid px-5 py-3 text-[10px] tracking-widest border-b"
                     style={{gridTemplateColumns: '2rem 1fr 8rem 8rem', borderColor: 'var(--border)', color: 'var(--text-muted)'}}>
                  <div>#</div><div>SET</div>
                  <div className="text-right">MEDIAN SIR</div>
                  <div className="text-right">PACK PRICE</div>
                </div>
                {sortedSets.map((set, i) => (
                  <div key={set.id} className="grid px-5 py-4 border-b transition-colors"
                       style={{gridTemplateColumns: '2rem 1fr 8rem 8rem', borderColor: 'var(--bg-primary)'}}
                       onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                       onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div className="font-bold" style={{color: i < 3 ? 'var(--accent)' : 'var(--text-muted)'}}>{i + 1}</div>
                    <div>
                      <div className="font-semibold" style={{color: 'var(--text-primary)'}}>{set.set_name}</div>
                      <div className="text-xs mt-0.5" style={{color: 'var(--text-muted)'}}>{set.set_code} · {set.sir_count} SIRs</div>
                    </div>
                    <div className="text-right mono font-bold text-lg" style={{color: 'var(--accent)'}}>
                      {set.median_price ? `$${set.median_price.toFixed(0)}` : '—'}
                    </div>
                    <div className="text-right mono" style={{color: 'var(--text-secondary)'}}>
                      {set.pack_price ? `$${set.pack_price.toFixed(2)}` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* MOVERS TAB */}
            {tab === 'movers' && (
              <>
                <p className="text-sm mb-4" style={{color: 'var(--text-muted)'}}>
                  Cards with the strongest 30-day price momentum.
                </p>
                <div className="rounded-xl overflow-hidden"
                     style={{background: 'var(--bg-card)', border: '1px solid var(--border)'}}>
                  <div className="grid px-5 py-3 text-[10px] tracking-widest border-b"
                       style={{gridTemplateColumns: '2rem 3rem 1fr 8rem 8rem 6rem', borderColor: 'var(--border)', color: 'var(--text-muted)'}}>
                    <div>#</div><div></div><div>CARD</div>
                    <div className="text-right">MARKET</div>
                    <div className="text-right">30D MOM</div>
                    <div className="text-right">SET</div>
                  </div>
                  {movers.map((card, i) => (
                    <div key={card.id}
                      className="grid px-5 py-3 border-b cursor-pointer transition-colors items-center"
                      style={{gridTemplateColumns: '2rem 3rem 1fr 8rem 8rem 6rem', borderColor: 'var(--bg-primary)'}}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => setSelectedCard(card)}>
                      <div className="font-bold text-sm" style={{color: i < 3 ? 'var(--accent)' : 'var(--text-muted)'}}>{i + 1}</div>
                      <div>
                        {card.image_url && (
                          <img src={card.image_url} alt="" className="w-8 h-11 object-cover rounded" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-sm" style={{color: 'var(--text-primary)'}}>{card.card_name}</div>
                        <div className="text-xs mt-0.5" style={{color: 'var(--text-muted)'}}>{card.character_name}</div>
                      </div>
                      <div className="text-right mono font-bold" style={{color: 'var(--accent)'}}>
                        ${card.tcgplayer_market_price?.toFixed(0)}
                      </div>
                      <div className="text-right">
                        <MomentumBadge value={card.price_momentum_30d} />
                      </div>
                      <div className="text-right text-xs" style={{color: 'var(--text-muted)'}}>{card.set_code}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Modal */}
      {selectedCard && <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />}
    </div>
  )
}
