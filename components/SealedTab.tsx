'use client'

import { useState, useMemo, useEffect } from 'react'
import { SetData, SetPriceSnapshot } from '@/lib/types'
import { fmt } from '@/lib/utils'
import SealedProductModal, {
  ProductTab, ChangeResult, ChangeBadge, computeChange,
} from './SealedProductModal'

// 'all' extends ProductTab for the filter
type ProductFilter = 'all' | ProductTab
type EraFilter     = 'all' | 'sv' | 'swsh'

// One card = one specific product (e.g. "Fusion Strike Booster Box")
interface ProductCard {
  key:          string         // `${setId}_${productType}`
  productType:  ProductTab
  productLabel: string         // "Booster Box" / "Elite Trainer Box" / "Booster Pack"
  setId:        number
  setName:      string
  setCode:      string | null
  era:          string | null
  isSpecialSet: boolean | number | null
  logoUrl:      string
  currentPrice: number
  change30d:    ChangeResult
  snapshots:    SetPriceSnapshot[]   // newest-first, forwarded to modal
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PRICE_KEY: Record<ProductTab, keyof SetPriceSnapshot> = {
  box:  'booster_box_market_price',
  etb:  'etb_market_price',
  pack: 'pack_market_price',
}

const PRODUCT_LABELS: Record<ProductTab, string> = {
  box:  'Booster Box',
  etb:  'Elite Trainer Box',
  pack: 'Booster Pack',
}

const PILL: Record<ProductTab, { bg: string; color: string; label: string }> = {
  box:  { bg: '#2d7dd2',     color: '#fff', label: 'BOX'  },
  etb:  { bg: 'var(--gold)', color: '#fff', label: 'ETB'  },
  pack: { bg: '#2a9d6e',     color: '#fff', label: 'PACK' },
}

const PRODUCT_TYPES: ProductTab[] = ['box', 'etb', 'pack']

const FILTER_TABS: { id: ProductFilter; label: string }[] = [
  { id: 'all',  label: 'All'         },
  { id: 'box',  label: 'Booster Box' },
  { id: 'etb',  label: 'ETB'         },
  { id: 'pack', label: 'Pack'        },
]

const ERA_FILTERS: { id: EraFilter; label: string }[] = [
  { id: 'all',  label: 'All'  },
  { id: 'sv',   label: 'SV'   },
  { id: 'swsh', label: 'SWSH' },
]

// ── Responsive columns ────────────────────────────────────────────────────────

function useCols() {
  const [cols, setCols] = useState(5)
  useEffect(() => {
    function update() {
      const w = window.innerWidth
      setCols(w < 480 ? 2 : w < 640 ? 3 : w < 900 ? 4 : 5)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return cols
}

// ── Product card ──────────────────────────────────────────────────────────────

function SealedCard({ card, cols, onClick }: {
  card:    ProductCard
  cols:    number
  onClick: () => void
}) {
  const imgH = cols <= 2 ? 80 : cols === 3 ? 100 : 110
  const pill = PILL[card.productType]

  return (
    <div
      className="card-item fadeup"
      onClick={onClick}
      style={{
        background: 'var(--c1)', borderRadius: 12,
        border: '1px solid var(--cborder)', overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(26,18,8,0.05)',
        display: 'flex', flexDirection: 'column', cursor: 'pointer',
      }}
    >
      {/* Logo with blurred background */}
      <div style={{
        height: imgH, flexShrink: 0, position: 'relative',
        borderBottom: '1px solid var(--cborder)', overflow: 'hidden',
        background: 'var(--c2)',
      }}>
        {card.logoUrl && (
          <div style={{
            position: 'absolute', inset: -8,
            backgroundImage: `url(${card.logoUrl})`,
            backgroundSize: '130%', backgroundPosition: 'center',
            filter: 'blur(18px) brightness(0.65) saturate(1.5)',
            transform: 'scale(1.15)',
          }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(237,232,216,0.32)' }} />

        {/* Centered logo */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '6px 10px',
        }}>
          <img
            src={card.logoUrl}
            alt={card.setName}
            loading="lazy"
            style={{ maxWidth: '100%', maxHeight: imgH - 18, objectFit: 'contain' }}
            onError={e => { e.currentTarget.style.opacity = '0' }}
          />
        </div>

        {/* Product type pill — top-right */}
        <span style={{
          position: 'absolute', top: 6, right: 7, zIndex: 2,
          fontSize: 9, padding: '2px 6px', borderRadius: 8,
          background: pill.bg, color: pill.color,
          fontWeight: 700, letterSpacing: '0.05em',
        }}>
          {pill.label}
        </span>
      </div>

      {/* Info */}
      <div style={{ padding: '8px 11px 11px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{
          fontWeight: 600, fontSize: 12, color: 'var(--ink)', lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginBottom: 1,
        }}>
          {card.setName}
        </div>
        <div style={{
          fontSize: 10, color: 'var(--ink-light)', marginBottom: 6,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {card.productLabel}
        </div>

        <div style={{
          borderTop: '1px solid var(--cborder)', paddingTop: 6,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 5,
        }}>
          <span style={{
            fontFamily: 'var(--fm)', fontSize: 17, fontWeight: 600,
            color: 'var(--ink)', letterSpacing: '-0.02em',
          }}>
            {fmt(card.currentPrice)}
          </span>
          <ChangeBadge change={card.change30d} />
        </div>

        {/* Era + Special badges */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
          {card.era === 'SV' && (
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: '#fde8e8', color: 'var(--red)', fontWeight: 700 }}>SV</span>
          )}
          {card.era === 'SWSH' && (
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: '#e8f1fb', color: '#2d7dd2', fontWeight: 700 }}>SWSH</span>
          )}
          {!!card.isSpecialSet && (
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: '#fdf4dc', color: 'var(--gold)', fontWeight: 700 }}>Special</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function SealedSkel({ cols }: { cols: number }) {
  const imgH = cols <= 2 ? 80 : cols === 3 ? 100 : 110
  return (
    <div style={{ background: 'var(--c1)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--cborder)' }}>
      <div className="shimmer" style={{ height: imgH }} />
      <div style={{ padding: '10px 12px 14px' }}>
        <div className="shimmer" style={{ height: 13, width: '75%', marginBottom: 4 }} />
        <div className="shimmer" style={{ height: 10, width: '40%', marginBottom: 12 }} />
        <div className="shimmer" style={{ height: 22, width: '55%', marginBottom: 6 }} />
        <div className="shimmer" style={{ height: 10, width: '45%' }} />
      </div>
    </div>
  )
}

// ── Main SealedTab ────────────────────────────────────────────────────────────

interface SealedTabProps {
  setsData: SetData[]
  loading:  boolean
}

export default function SealedTab({ setsData, loading }: SealedTabProps) {
  const [productFilter, setProductFilter] = useState<ProductFilter>('all')
  const [eraFilter,     setEraFilter]     = useState<EraFilter>('all')
  const [query,         setQuery]         = useState('')
  const [selected,      setSelected]      = useState<ProductCard | null>(null)
  const cols = useCols()

  // Explode sets × product types into individual product cards
  const allCards = useMemo<ProductCard[]>(() => {
    const cards: ProductCard[] = []
    for (const s of setsData) {
      const snaps = s.set_price_snapshots ?? []   // newest-first
      if (snaps.length === 0) continue
      const logoUrl = s.logo_url ?? `https://images.pokemontcg.io/${s.set_code}/logo.png`

      for (const pt of PRODUCT_TYPES) {
        const key       = PRICE_KEY[pt]
        const price     = snaps[0]?.[key] as number | null
        if (price == null) continue   // this set has no data for this product type

        const change30d = computeChange(snaps, key)
        cards.push({
          key:          `${s.id}_${pt}`,
          productType:  pt,
          productLabel: PRODUCT_LABELS[pt],
          setId:        s.id,
          setName:      s.set_name,
          setCode:      s.set_code,
          era:          s.era,
          isSpecialSet: s.is_special_set,
          logoUrl,
          currentPrice: price,
          change30d,
          snapshots:    snaps,
        })
      }
    }
    return cards
  }, [setsData])

  const filtered = useMemo(() => {
    let base = [...allCards]

    // Product type filter
    if (productFilter !== 'all') base = base.filter(c => c.productType === productFilter)

    // Era filter
    if (eraFilter === 'sv')   base = base.filter(c => c.era === 'SV')
    if (eraFilter === 'swsh') base = base.filter(c => c.era === 'SWSH')

    // Search
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      base = base.filter(c =>
        c.setName.toLowerCase().includes(q) ||
        (c.setCode ?? '').toLowerCase().includes(q) ||
        c.productLabel.toLowerCase().includes(q)
      )
    }

    // Sort by price descending
    return base.sort((a, b) => b.currentPrice - a.currentPrice)
  }, [allCards, productFilter, eraFilter, query])

  if (loading) {
    return (
      <div>
        {/* Tab shimmer */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {FILTER_TABS.map(t => (
            <div key={t.id} className="shimmer" style={{ height: 36, width: 110, borderRadius: 20 }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 13 }}>
          {Array.from({ length: cols * 3 }).map((_, i) => <SealedSkel key={i} cols={cols} />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Product filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTER_TABS.map(t => {
          const active = productFilter === t.id
          return (
            <button
              key={t.id}
              onClick={() => setProductFilter(t.id)}
              style={{
                padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                background: active ? 'var(--ink)' : 'var(--c1)',
                color:      active ? 'var(--c1)'  : 'var(--ink-mid)',
                border:     `1px solid ${active ? 'var(--ink)' : 'var(--cborder)'}`,
                transition: 'all 0.15s',
              }}
            >{t.label}</button>
          )
        })}
      </div>

      {/* Era filter + search */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {ERA_FILTERS.map(f => {
            const active = eraFilter === f.id
            return (
              <button
                key={f.id}
                onClick={() => setEraFilter(f.id)}
                style={{
                  padding: '5px 12px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                  background: active ? 'var(--gold)' : 'var(--c1)',
                  color:      active ? '#fff' : 'var(--ink-mid)',
                  border:     `1px solid ${active ? 'var(--gold)' : 'var(--cborder)'}`,
                  transition: 'all 0.15s',
                }}
              >{f.label}</button>
            )
          })}
        </div>

        <div style={{ flex: '1 1 200px', position: 'relative' }}>
          <svg
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.4 }}
            width="14" height="14" viewBox="0 0 14 14" fill="none"
          >
            <circle cx="6" cy="6" r="4.5" stroke="var(--ink)" strokeWidth="1.5" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search sets or products…"
            style={{
              width: '100%', padding: '7px 12px 7px 32px',
              background: 'var(--c1)', border: '1px solid var(--cborder)',
              borderRadius: 8, fontSize: 13, color: 'var(--ink)', outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--cborder)')}
          />
        </div>

        <span style={{ fontSize: 11, color: 'var(--ink-light)', whiteSpace: 'nowrap' }}>
          {filtered.length} product{filtered.length !== 1 ? 's' : ''} · by price
        </span>
      </div>

      {/* Product grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 13 }}>
        {filtered.map(card => (
          <SealedCard
            key={card.key}
            card={card}
            cols={cols}
            onClick={() => setSelected(card)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--ink-light)' }}>
          <div style={{ fontFamily: 'var(--fd)', fontSize: 28, marginBottom: 10, opacity: 0.35, fontStyle: 'italic' }}>
            No results
          </div>
          <div style={{ fontSize: 14 }}>
            Try a different product type or era filter
          </div>
        </div>
      )}

      {selected && (
        <SealedProductModal
          setName={selected.setName}
          setCode={selected.setCode}
          era={selected.era}
          isSpecialSet={selected.isSpecialSet}
          logoUrl={selected.logoUrl}
          snapshots={selected.snapshots}
          focusProduct={selected.productType}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
