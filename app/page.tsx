'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, SetData, DemandSignal, ModelPrediction } from '@/lib/types'
import SiteNav from '@/components/SiteNav'
import CardGrid from '@/components/CardGrid'
import SetsTab from '@/components/SetsTab'
import LeaderboardTab from '@/components/LeaderboardTab'
import SealedTab from '@/components/SealedTab'
import NewHomeTab from '@/components/NewHomeTab'

type TabId = 'home' | 'cards' | 'sets' | 'sealed' | 'leaderboard'

const TITLES: Record<Exclude<TabId, 'home'>, string> = {
  cards:       'SV Special Illustration Rares',
  sets:        'Sets',
  sealed:      'Sealed Products',
  leaderboard: 'Leaderboard',
}

const SUBTITLES: Record<Exclude<TabId, 'home'>, string> = {
  cards:       'Search and filter 168 tracked SV era Special Illustration Rares. Each card shows an ML-generated fair value prediction, demand score, PSA 10 grading ROI, and 6-month price history from TCGPlayer and eBay.',
  sets:        'Browse all 16 SV era sets. Click any set to see its top cards by value, pull rates for SIRs and Illustration Rares, and individual card price data.',
  sealed:      'Track booster box, ETB, and pack prices for every SV set updated nightly. Compare 30-day price movement across sealed products.',
  leaderboard: 'Rank all tracked SV SIRs by price momentum, PSA 10 grading ROI, or sales volume across TCGPlayer and eBay.',
}

export default function Home() {
  const [tab,             setTab]             = useState<TabId>('home')
  const [cards,           setCards]           = useState<Card[]>([])
  const [setsData,        setSetsData]        = useState<SetData[]>([])
  const [sealedData,      setSealedData]      = useState<SetData[]>([])
  const [sealedImageMap,  setSealedImageMap]  = useState<Record<string, string>>({})
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        // Parallel: cards + SV sets + all-era sealed sets + sealed product images
        const [cardsRes, setsRes, sealedRes, sealedImgRes] = await Promise.all([
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

          supabase
            .from('sets')
            .select(`
              id, set_name, set_code, era, sir_count, is_special_set,
              release_date, set_premium_score, logo_url,
              set_price_snapshots(pack_market_price, booster_box_market_price, etb_market_price, bundle_price, build_and_battle_price, snapshot_date)
            `)
            .order('id'),

          supabase
            .from('sealed_products')
            .select('set_id, product_type, image_url')
            .not('image_url', 'is', null),
        ])

        if (cardsRes.error)    throw new Error(cardsRes.error.message)
        if (setsRes.error)     throw new Error(setsRes.error.message)
        if (sealedRes.error)   throw new Error(sealedRes.error.message)

        // Build sealed product image map: `${set_id}_${productTab}` → image_url
        const DB_TYPE_TO_TAB: Record<string, string> = {
          booster_box:      'box',
          etb:              'etb',
          pack:             'pack',
          bundle:           'bundle',
          build_and_battle: 'bnb',
        }
        const imgMap: Record<string, string> = {}
        ;(sealedImgRes.data ?? []).forEach((row: { set_id: number; product_type: string; image_url: string | null }) => {
          const tab = DB_TYPE_TO_TAB[row.product_type]
          if (tab && row.image_url) {
            imgMap[`${row.set_id}_${tab}`] = row.image_url
          }
        })
        setSealedImageMap(imgMap)

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

        // Shape all-era sealed sets (includes SWSH, SV, ME, etc.)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shapedSealed: SetData[] = (sealedRes.data ?? []).map((s: any) => ({
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
        setSealedData(shapedSealed)

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

  // ── Full-screen home page (has its own nav / ticker / footer) ──────────
  if (tab === 'home') {
    return <NewHomeTab onNavigate={t => setTab(t)} />
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c2)' }}>

      {/* ── Nav — shared SiteNav component ── */}
      <SiteNav
        activeTab={tab}
        onNavigate={t => setTab(t)}
        onHome={() => setTab('home')}
        liveCount={!loading && !error ? cards.length : null}
      />

      {/* ── Main ── */}
      <main className="main-pad" style={{ maxWidth: 1320, margin: '0 auto', padding: '34px 28px 80px' }}>

        {/* Tab pages */}
        <div style={{ marginBottom: 26 }}>
          <h1 className="page-h1" style={{ fontFamily: 'var(--fd)', fontSize: 32, color: 'var(--ink)', marginBottom: 5, letterSpacing: '-0.01em' }}>
            {TITLES[tab as Exclude<TabId, 'home'>]}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-light)' }}>{SUBTITLES[tab as Exclude<TabId, 'home'>]}</p>
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
            {tab === 'sealed'      && <SealedTab      setsData={sealedData} loading={loading} imageMap={sealedImageMap} />}
            {tab === 'leaderboard' && <LeaderboardTab cards={cards}  loading={loading} setsMap={setsMap} setsData={setsData} />}
          </>
        )}
      </main>
    </div>
  )
}
