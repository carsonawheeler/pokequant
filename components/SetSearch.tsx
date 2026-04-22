'use client'

import { useState, useEffect, useRef } from 'react'
import { CardSet } from '@/lib/types'

interface SetSearchProps {
  sets: CardSet[]
  activeSet: string
  setActiveSet: (id: string) => void
}

export default function SetSearch({ sets, activeSet, setActiveSet }: SetSearchProps) {
  const [query, setQuery] = useState('')
  const [open,  setOpen]  = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const activeSetObj = sets.find(s => String(s.id) === activeSet)

  const filtered = query.trim()
    ? sets.filter(s => s.set_name.toLowerCase().includes(query.trim().toLowerCase()))
    : sets

  const select = (id: string) => { setActiveSet(id); setQuery(''); setOpen(false) }

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 200 }}>
      <div style={{ position: 'relative' }}>
        <input
          value={open ? query : (activeSetObj ? activeSetObj.set_name : '')}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActiveSet('') }}
          onFocus={() => { setOpen(true); setQuery('') }}
          placeholder="All Sets"
          style={{
            width: '100%', padding: '9px 30px 9px 12px',
            background: 'var(--c1)', border: '1px solid var(--cborder)',
            borderRadius: 8, fontSize: 13, color: 'var(--ink)', outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
          onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = 'var(--cborder)' }}
        />
        {activeSet
          ? (
            <button
              onClick={() => select('')}
              style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--ink-light)', lineHeight: 1, padding: 2 }}
            >✕</button>
          )
          : (
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 10, color: 'var(--ink-light)' }}>▾</span>
          )
        }
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: 'var(--c1)', border: '1px solid var(--cborder)', borderRadius: 9,
          boxShadow: '0 8px 28px rgba(26,18,8,0.12)', maxHeight: 260, overflowY: 'auto',
        }}>
          <div
            onMouseDown={() => select('')}
            style={{
              padding: '9px 13px', fontSize: 13, cursor: 'pointer',
              color: !activeSet ? 'var(--gold)' : 'var(--ink-mid)',
              fontWeight: !activeSet ? 600 : 400,
              borderBottom: '1px solid var(--cborder)',
            }}
          >
            All Sets
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: '10px 13px', fontSize: 12, color: 'var(--ink-light)' }}>No sets found</div>
          )}
          {filtered.map(s => (
            <div
              key={s.id}
              onMouseDown={() => select(String(s.id))}
              style={{
                padding: '9px 13px', fontSize: 13, cursor: 'pointer',
                color: String(s.id) === activeSet ? 'var(--gold)' : 'var(--ink)',
                fontWeight: String(s.id) === activeSet ? 600 : 400,
                background: String(s.id) === activeSet ? 'var(--c2)' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--c2)')}
              onMouseLeave={e => (e.currentTarget.style.background = String(s.id) === activeSet ? 'var(--c2)' : 'transparent')}
            >
              {s.set_name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
