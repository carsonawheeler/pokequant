export default function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-label="PokeQuant mark">
        <path
          d="M15 2 L26.5 8.5 V21.5 L15 28 L3.5 21.5 V8.5 Z"
          fill="var(--gold)" fillOpacity="0.12"
          stroke="var(--gold)" strokeWidth="1.4" strokeLinejoin="round"
        />
        <line x1="3.5" y1="8.5" x2="26.5" y2="8.5"
          stroke="var(--gold)" strokeWidth="0.8" strokeOpacity="0.45" />
        <polyline points="7,22 10.5,16.5 15,18.5 22,11"
          stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="22" cy="11" r="2.2" fill="var(--gold)" />
      </svg>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <span style={{ fontFamily: 'var(--fd)', fontSize: 21, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
          Poke
        </span>
        <span style={{ fontFamily: 'var(--fd)', fontSize: 21, color: 'var(--gold)', letterSpacing: '-0.01em', fontStyle: 'italic' }}>
          Quant
        </span>
      </div>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        padding: '2px 6px', borderRadius: 4,
        background: 'var(--c3)', color: 'var(--ink-light)', border: '1px solid var(--cborder)',
        fontFamily: 'var(--fm)',
      }}>
        BETA
      </span>
    </div>
  )
}
