'use client'

import { useState, useMemo } from 'react'
import { SetData } from '@/lib/types'
import { fmt } from '@/lib/utils'
import SealedProductModal, {
  ProductTab, ChangeResult, ChangeBadge, computeChange,
} from './SealedProductModal'

type EraFilter = 'all' | 'sv' | 'swsh'

interface SealedRow extends SetData {
  latestBox:  number | null
  latestEtb:  number | null
  latestPack: number | null
  boxChange:  ChangeResult
  etbChange:  ChangeResult
  packChange: ChangeResult
  logoUrl:    string
  etbOnly:    boolean
}

function getPrice(row: SealedRow, tab: ProductTab): number | null {
  return tab === 'box' ? row.latestBox : tab === 'etb' ? row.latestEtb : row.latestPack
}

function getChange(row: SealedRow, tab: ProductTab): ChangeResult {
  return tab === 'box' ? row.boxChange : tab === 'etb' ? row.etbChange : row.packChange
}

// ── Ranked list row ───────────────────────────────────────────────────────────

function RankedRow({ row, rank, productTab, onClick }: {
  row: SealedRow
  rank: number
  productTab: ProductTab
  onClick: () => void
}) {
  const price  = getPrice(row, productTab)
  const change = getChange(row, productTab)

  return (
    <div
      className="card-item"
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 52px 1fr auto auto',
        alignItems: 'center', gap: 12,
        padding: '11px 16px',
        background: 'var(--c1)', borderRadius: 10,
        border: '1px solid var(--cborder)',
        cursor: 'pointer', transition: 'background 0.12s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--c2)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--c1)' }}
    >
      {/* Rank */}
      <span style={{
        fontFamily: 'var(--fm)', fontSize: 12, textAlign: 'center',
        color: rank <= 3 ? 'var(--gold)' : 'var(--ink-light)',
        fontWeight: rank <= 3 ? 700 : 400,
      }}>
        #{rank}
      </span>

      {/* Logo thumbnail */}
      <div style={{ width: 52, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={row.logoUrl}
          alt={row.set_name}
          loading="lazy"
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          onError={e => { e.currentTarget.style.opacity = '0' }}
        />
      </div>

      {/* Name + meta */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontWeight: 600, fontSize: 13, color: 'var(--ink)', lineHeight: 1.25,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {row.set_name}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 9.5, color: 'var(--ink-light)', fontFamily: 'var(--fm)' }}>
            {row.set_code?.toUpperCase()}
          </span>
          {row.era === 'SV' && (
            <span style={{ fontSize: 9, padding: '0px 5px', borderRadius: 8, background: '#fde8e8', color: 'var(--red)', fontWeight: 700 }}>SV</span>
          )}
          {row.era === 'SWSH' && (
            <span style={{ fontSize: 9, padding: '0px 5px', borderRadius: 8, background: '#e8f1fb', color: '#2d7dd2', fontWeight: 700 }}>SWSH</span>
          )}
          {!!row.is_special_set && (
            <span style={{ fontSize: 9, padding: '0px 5px', borderRadius: 8, background: '#fdf4dc', color: 'var(--gold)', fontWeight: 700 }}>Special</span>
          )}
          {row.etbOnly && productTab !== 'etb' && (
            <span style={{
              fontSize: 9, padding: '0px 5px', borderRadius: 8,
              background: 'var(--c2)', color: 'var(--ink-light)', fontWeight: 600,
              border: '1px solid var(--cborder)',
            }}>ETB Only</span>
          )}
        </div>
      </div>

      {/* 30d change */}
      <ChangeBadge change={change} />

      {/* Price */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontFamily: 'var(--fm)', fontSize: 17, fontWeight: 600,
          color: 'var(--ink)', letterSpacing: '-0.02em',
        }}>
          {fmt(price)}
        </div>
      </div>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function ListSkel() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '36px 52px 1fr auto auto',
      alignItems: 'center', gap: 12, padding: '11px 16px',
      background: 'var(--c1)', borderRadius: 10, border: '1px solid var(--cborder)',
    }}>
      <div className="shimmer" style={{ height: 14, width: 28, borderRadius: 4 }} />
      <div className="shimmer" style={{ height: 38, width: 52, borderRadius: 4 }} />
      <div>
        <div className="shimmer" style={{ height: 13, width: '60%', marginBottom: 6 }} />
        <div className="shimmer" style={{ height: 10, width: '30%' }} />
      </div>
      <div className="shimmer" style={{ height: 16, width: 50, borderRadius: 10 }} />
      <div className="shimmer" style={{ height: 18, width: 60, borderRadius: 4 }} />
    </div>
  )
}

// ── Main SealedTab ────────────────────────────────────────────────────────────

const PRODUCT_TABS: { id: ProductTab; label: string }[] = [
  { id: 'box',  label: 'Booster Box' },
  { id: 'etb',  label: 'ETB' },
  { id: 'pack', label: 'Pack' },
]

const ERA_FILTERS: { id: EraFilter; label: string }[] = [
  { id: 'all',  label: 'All' },
  { id: 'sv',   label: 'SV' },
  { id: 'swsh', label: 'SWSH' },
]

interface SealedTabProps {
  setsData: SetData[]
  loading:  boolean
}

export default function SealedTab({ setsData, loading }: SealedTabProps) {
  const [productTab, setProductTab] = useState<ProductTab>('box')
  const [eraFilter,  setEraFilter]  = useState<EraFilter>('all')
  const [query,      setQuery]      = useState('')
  const [selected,   setSelected]   = useState<{ row: SealedRow; tab: ProductTab } | null>(null)

  const rows = useMemo<SealedRow[]>(() =>
    setsData
      .filter(s => (s.set_price_snapshots?.length ?? 0) > 0)
      .map(s => {
        const snaps = s.set_price_snapshots ?? []  // newest-first
        return {
          ...s,
          latestBox:  snaps[0]?.booster_box_market_price ?? null,
          latestEtb:  snaps[0]?.etb_market_price ?? null,
          latestPack: snaps[0]?.pack_market_price ?? null,
          boxChange:  computeChange(snaps, 'booster_box_market_price'),
          etbChange:  computeChange(snaps, 'etb_market_price'),
          packChange: computeChange(snaps, 'pack_market_price'),
          logoUrl:    s.logo_url ?? `https://images.pokemontcg.io/${s.set_code}/logo.png`,
          etbOnly:    (snaps[0]?.booster_box_market_price ?? null) === null,
        }
      }),
    [setsData]
  )

  const filtered = useMemo(() => {
    let base = rows.filter(r => getPrice(r, productTab) != null)

    if (eraFilter === 'sv')   base = base.filter(r => r.era === 'SV')
    if (eraFilter === 'swsh') base = base.filter(r => r.era === 'SWSH')

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      base = base.filter(r =>
        r.set_name.toLowerCase().includes(q) ||
        (r.set_code ?? '').toLowerCase().includes(q)
      )
    }

    return base.sort((a, b) => (getPrice(b, productTab) ?? 0) - (getPrice(a, productTab) ?? 0))
  }, [rows, productTab, eraFilter, query])

  if (loading) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {PRODUCT_TABS.map(t => (
            <div key={t.id} className="shimmer" style={{ height: 36, width: 110, borderRadius: 20 }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 12 }).map((_, i) => <ListSkel key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Product type tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {PRODUCT_TABS.map(t => {
          const active = productTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setProductTab(t.id)}
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
            placeholder="Search sets…"
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
          {filtered.length} set{filtered.length !== 1 ? 's' : ''} · sorted by price
        </span>
      </div>

      {/* Ranked list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {filtered.map((row, i) => (
          <RankedRow
            key={row.id}
            row={row}
            rank={i + 1}
            productTab={productTab}
            onClick={() => setSelected({ row, tab: productTab })}
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
          setName={selected.row.set_name}
          setCode={selected.row.set_code}
          era={selected.row.era}
          isSpecialSet={selected.row.is_special_set}
          logoUrl={selected.row.logoUrl}
          snapshots={selected.row.set_price_snapshots ?? []}
          focusProduct={selected.tab}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
