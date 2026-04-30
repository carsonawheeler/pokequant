'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface HomeTabProps {
  onNavigate: (tab: 'cards' | 'sets' | 'sealed' | 'leaderboard') => void
}

export default function HomeTab({ onNavigate }: HomeTabProps) {
  const [stats, setStats] = useState<{ cards: number | null; updates: number | null; ebaySales: number | null }>({
    cards: null, updates: null, ebaySales: null,
  })

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    Promise.all([
      supabase.from('cards').select('*', { count: 'exact', head: true }),
      supabase.from('card_price_snapshots').select('*', { count: 'exact', head: true }).eq('snapshot_date', today),
      supabase.from('card_ebay_snapshots').select('ebay_psa10_sales_count, snapshot_date').order('snapshot_date', { ascending: false }).limit(2000),
    ]).then(([cardsRes, updatesRes, ebayRes]) => {
      const maxDate = ebayRes.data?.[0]?.snapshot_date ?? null
      const latestEbay = maxDate ? (ebayRes.data ?? []).filter(r => r.snapshot_date === maxDate) : []
      const ebaySales = latestEbay.reduce((s, r) => s + (r.ebay_psa10_sales_count ?? 0), 0)
      setStats({
        cards: cardsRes.count ?? 0,
        updates: updatesRes.count ?? 0,
        ebaySales,
      })
    })
  }, [])

  const NAV_BUTTONS: { tab: 'cards' | 'sets' | 'sealed' | 'leaderboard'; label: string; icon: string; desc: string }[] = [
    { tab: 'cards',       label: 'Browse Cards',     icon: '♠',  desc: 'All tracked SV SIRs with ML predictions' },
    { tab: 'sets',        label: 'Explore Sets',     icon: '⊟',  desc: '16 SV era sets with pull rates & prices' },
    { tab: 'sealed',      label: 'Sealed Products',  icon: '▢',  desc: 'Box, ETB & pack prices updated nightly' },
    { tab: 'leaderboard', label: 'Leaderboard',      icon: '★',  desc: 'Rank cards by momentum, ROI & sales' },
  ]

  const HOW_IT_WORKS = [
    {
      num: '1',
      title: 'Nightly Data',
      body: 'TCGPlayer and eBay prices update every morning automatically',
    },
    {
      num: '2',
      title: 'ML Predictions',
      body: 'Our model predicts fair value for every SIR using demand signals, character scores, and set premium',
    },
    {
      num: '3',
      title: 'Grading ROI',
      body: 'See exactly how much more a PSA 10 sells for vs raw, based on real eBay sold listings',
    },
  ]

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 0 80px' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1 style={{
          fontFamily: 'var(--fd)', fontSize: 42, fontStyle: 'italic',
          color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 14,
        }}>
          The Bloomberg Terminal<br />for Pokémon Cards
        </h1>
        <p style={{ fontSize: 15, color: 'var(--ink-light)', lineHeight: 1.6 }}>
          Live TCGPlayer & eBay pricing · ML fair value predictions · PSA 10 grading ROI
        </p>
      </div>

      {/* Stats strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        background: 'var(--c1)', border: '1px solid var(--cborder)',
        borderRadius: 12, overflow: 'hidden', marginBottom: 40,
        boxShadow: '0 1px 8px rgba(26,18,8,0.06)',
      }}>
        {[
          { label: 'Cards Tracked',       value: stats.cards,    suffix: '' },
          { label: 'Daily Price Updates',  value: stats.updates,  suffix: '' },
          { label: 'eBay PSA 10 Sales',    value: stats.ebaySales, suffix: '' },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '18px 20px', textAlign: 'center',
            borderRight: i < 2 ? '1px solid var(--cborder)' : 'none',
          }}>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 4 }}>
              {s.value == null ? '…' : s.value.toLocaleString()}{s.suffix}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Nav buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 48 }}>
        {NAV_BUTTONS.map(b => (
          <button
            key={b.tab}
            onClick={() => onNavigate(b.tab)}
            style={{
              padding: '20px 22px', borderRadius: 12, textAlign: 'left',
              background: 'var(--c1)', border: '1px solid var(--cborder)',
              boxShadow: '0 2px 8px rgba(26,18,8,0.05)',
              transition: 'transform 0.15s, box-shadow 0.15s',
              cursor: 'pointer',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.transform = 'translateY(-2px)'
              el.style.boxShadow = '0 8px 24px rgba(26,18,8,0.1)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.transform = ''
              el.style.boxShadow = '0 2px 8px rgba(26,18,8,0.05)'
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 8 }}>{b.icon}</div>
            <div style={{ fontFamily: 'var(--fd)', fontSize: 18, fontStyle: 'italic', color: 'var(--ink)', marginBottom: 4 }}>
              {b.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-light)', lineHeight: 1.4 }}>
              {b.desc}
            </div>
          </button>
        ))}
      </div>

      {/* How it works */}
      <div>
        <h2 style={{ fontFamily: 'var(--fd)', fontSize: 22, fontStyle: 'italic', color: 'var(--ink)', marginBottom: 18 }}>
          How it works
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {HOW_IT_WORKS.map(item => (
            <div key={item.num} style={{
              display: 'flex', gap: 16, alignItems: 'flex-start',
              background: 'var(--c1)', border: '1px solid var(--cborder)',
              borderRadius: 10, padding: '14px 16px',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'var(--c2)', border: '1px solid var(--cborder)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, color: 'var(--gold)',
              }}>
                {item.num}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 3 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-light)', lineHeight: 1.5 }}>{item.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
