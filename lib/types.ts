export interface DemandSignal {
  demand_score: number | null
  price_momentum_14d: number | null
  price_momentum_30d: number | null
  signal_date?: string
}

export interface CardSet {
  id: number
  set_name: string
  set_code: string
  era: string
}

export interface ModelPrediction {
  predicted_price: number | null
  ci_lower_90: number | null
  ci_upper_90: number | null
  signal: string | null
  ratio: number | null
  prediction_confidence: string | null
}

export interface Card {
  id: number
  tcg_id: string | null
  card_name: string
  character_name: string | null
  image_url: string | null
  nostalgia_score: number | null
  character_premium_score: number | null
  aesthetic_score: number | null
  pull_cost_score: number | null
  gradability_score: number | null
  google_trends_score: number | null
  is_competitive: number | null
  set_median_sir_price: number | null
  generation: number | null
  set: CardSet | null
  price: number | null
  demand: DemandSignal | null
}

export interface SetPriceSnapshot {
  pack_market_price: number | null
  booster_box_market_price: number | null
  snapshot_date: string
}

export interface SetData {
  id: number
  set_name: string
  set_code: string
  era: string
  sir_count: number | null
  is_special_set: boolean | null
  set_price_snapshots: SetPriceSnapshot[] | null
}

export interface PricePoint {
  snapshot_date: string
  tcgplayer_market_price: number
}
