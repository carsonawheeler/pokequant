'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, SetData, DemandSignal, ModelPrediction } from '@/lib/types'
import Logo from '@/components/Logo'
import CardGrid from '@/components/CardGrid'
import SetsTab from '@/components/SetsTab'
import LeaderboardTab from '@/components/LeaderboardTab'
import SealedTab from '@/components/SealedTab'

type TabId = 'cards' | 'sets' | 'sealed' | 'leaderboard'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'cards',       label: 'Cards',       icon: '⊞' },
  { id: 'sets',        label: 'Sets',        icon: '◫' },
  { id: 'sealed',      label: 'Sealed',      icon: '⬡' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '↑↓' },
]

const TITLES: Record<TabId, string> = {
  cards:       'SV Special Illustration Rares',
  sets:        'Sets',
  sealed:      'Sealed Products',
  leaderboard: 'Leaderboard',
}

const SUBTITLES: Record<TabId, string> = {
  cards:       'Live TCGPlayer prices · AI-powered demand signals',
  sets:        'Scarlet & Violet sets · browse by release or rank by median SIR price',
  sealed:      'Booster box, ETB, and pack prices with 30-day change · click a set for price history',
  leaderboard: 'Rank cards by price momentum, PSA 10 ROI, eBay sales, TCGPlayer sales, or combined',
}

export default function Home() {
  const [tab,      setTab]      = useState<TabId>('cards')
  const [cards,    setCards]    = useState<Card[]>([])
  const [setsData, setSetsData] = useState<SetData[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        // Parallel: cards + sets
        const [cardsRes, setsRes] = await Promise.all([
          supabase
            .from('cards')
            .select(`
              id, tcg_id, card_name, character_name, image_url,
              nostalgia_score, character_premium_score, aesthetic_score,
              pull_cost_score, gradability_score, google_trends_score,
              is_competitive, set_median_sir_price, generation,
              pull_cost, specific_card_odds,
              sets(id, set_name, set_code, era),
              card_demand_signals(demand_score, price_momentum_14d, price_momentum_30d, signal_date),
              model_predictions(predicted_price, ci_lower_90, ci_upper_90, signal, ratio, prediction_confidence, predicted_date)
            `)
            .eq('rarity_group', 'SIR')
            .order('card_name')
            .limit(600),

          supabase
            .from('sets')
            .select(`
              id, set_name, set_code, era, sir_count, is_special_set,
              release_date, set_premium_score, logo_url,
              set_price_snapshots(pack_market_price, booster_box_market_price, etb_market_price, snapshot_date)
            `)
            .eq('era', 'SV')
            .order('id'),
        ])

        if (cardsRes.error) throw new Error(cardsRes.error.message)
        if (setsRes.error)  throw new Error(setsRes.error.message)

        // Filter SV era cards, build card ID list
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const svRaw = (cardsRes.data ?? []).filter((c: any) => c.sets?.era === 'SV')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const svIds = svRaw.map((c: any) => c.id as number)

        // Fetch latest prices separately (avoids nested filter complexity)
        const { data: priceData } = await supabase
          .from('card_price_snapshots')
          .select('card_id, tcgplayer_market_price, snapshot_date, price_source')
          .in('card_id', svIds)
          .not('tcgplayer_market_price', 'is', null)
          .order('snapshot_date', { ascending: false })
          .limit(svIds.length * 4)

        // Build price map: latest per card
        const priceMap: Record<number, number> = {}
        ;(priceData ?? []).forEach((p: { card_id: number; tcgplayer_market_price: number | null }) => {
          if (!(p.card_id in priceMap) && p.tcgplayer_market_price != null) {
            priceMap[p.card_id] = p.tcgplayer_market_price
          }
        })

        // Merge and shape cards
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const merged: Card[] = svRaw.map((c: any) => {
          const demands = (c.card_demand_signals ?? []) as (DemandSignal & { signal_date?: string })[]
          const demand = demands.sort((a, b) =>
            (b.signal_date ?? '').localeCompare(a.signal_date ?? '')
          )[0] ?? null

          const preds = (c.model_predictions ?? []) as ModelPrediction[]
          const prediction = preds.sort((a, b) =>
            (b.predicted_date ?? '').localeCompare(a.predicted_date ?? '')
          )[0] ?? null

          return {
            id:                       c.id,
            card_name:                c.card_name,
            character_name:           c.character_name ?? null,
            image_url:                c.image_url ?? null,
            nostalgia_score:          c.nostalgia_score ?? null,
            character_premium_score:  c.character_premium_score ?? null,
            aesthetic_score:          c.aesthetic_score ?? null,
            pull_cost_score:          c.pull_cost_score ?? null,
            gradability_score:        c.gradability_score ?? null,
            google_trends_score:      c.google_trends_score ?? null,
            is_competitive:           c.is_competitive ?? null,
            set_median_sir_price:     c.set_median_sir_price ?? null,
            generation:               c.generation ?? null,
            pull_cost:                c.pull_cost ?? null,
            specific_card_odds:       c.specific_card_odds ?? null,
            set:                      c.sets ?? null,
            price:                    priceMap[c.id] ?? null,
            demand,
            prediction,
            tcg_id: c.tcg_id ?? null,
          } satisfies Card
        }).filter((c: Card) => c.price != null)

        setCards(merged)

        // Shape sets — sort price snapshots newest-first
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shapedSets: SetData[] = (setsRes.data ?? []).map((s: any) => ({
          id:                s.id,
          set_name:          s.set_name,
          set_code:          s.set_code,
          era:               s.era,
          sir_count:         s.sir_count ?? null,
          is_special_set:    s.is_special_set ?? null,
          release_date:      s.release_date ?? null,
          set_premium_score: s.set_premium_score ?? null,
          logo_url:          s.logo_url ?? null,
          set_price_snapshots: [...(s.set_price_snapshots ?? [])].sort(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (a: any, b: any) => b.snapshot_date.localeCompare(a.snapshot_date)
          ),
        }))
        setSetsData(shapedSets)

      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const setsMap = useMemo(() => {
    const m = new Map<number, SetData>()
    setsData.forEach(s => m.set(s.id, s))
    return m
  }, [setsData])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c2)' }}>

      {/* ── Nav ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(247,242,232,0.93)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--cborder)',
        boxShadow: '0 1px 16px rgba(26,18,8,0.06)',
      }}>
        <div style={{
          maxWidth: 1320, margin: '0 auto', padding: '0 28px',
          display: 'flex', alignItems: 'center', height: 58, gap: 24,
        }}>
          <Logo />

          <div style={{ width: 1, height: 22, background: 'var(--cborder)', flexShrink: 0 }} />

          {/* Tab nav */}
          <nav style={{ display: 'flex', gap: 2 }}>
            {TABS.map(t => (
              <button
                key={t.id}
                className="tab-btn"
                onClick={() => setTab(t.id)}
                style={{
                  padding: '6px 18px', borderRadius: 7, fontSize: 13, fontWeight: 500,
                  background: tab === t.id ? 'var(--ink)' : 'transparent',
                  color: tab === t.id ? 'var(--c1)' : 'var(--ink-mid)',
                }}
              >
                <span className="tab-label">{t.label}</span>
                <span className="tab-icon">{t.icon}</span>
              </button>
            ))}
          </nav>

          {/* Live status */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {!loading && !error && (
              <>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
                <span className="nav-live-text" style={{ fontSize: 11, color: 'var(--ink-light)', fontFamily: 'var(--fm)' }}>
                  Live · {cards.length} SIRs
                </span>
              </>
            )}
            {loading && <span className="nav-live-text" style={{ fontSize: 11, color: 'var(--ink-light)' }}>Loading…</span>}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="main-pad" style={{ maxWidth: 1320, margin: '0 auto', padding: '34px 28px 80px' }}>
        <div style={{ marginBottom: 26 }}>
          <h1 className="page-h1" style={{ fontFamily: 'var(--fd)', fontSize: 32, color: 'var(--ink)', marginBottom: 5, letterSpacing: '-0.01em' }}>
            {TITLES[tab]}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-light)' }}>{SUBTITLES[tab]}</p>
        </div>

        {error && (
          <div style={{ padding: '20px', background: 'var(--red-bg)', borderRadius: 10, color: 'var(--red)', fontSize: 13, border: `1px solid var(--red)` }}>
            Could not load data: {error}
          </div>
        )}

        {!error && (
          <>
            {tab === 'cards'       && <CardGrid      cards={cards}  loading={loading} setsMap={setsMap} />}
            {tab === 'sets'        && <SetsTab        cards={cards}  setsData={setsData} loading={loading} setsMap={setsMap} />}
            {tab === 'sealed'      && <SealedTab      setsData={setsData} loading={loading} />}
            {tab === 'leaderboard' && <LeaderboardTab cards={cards}  loading={loading} setsMap={setsMap} setsData={setsData} />}
          </>
        )}
      </main>
    </div>
  )
}
