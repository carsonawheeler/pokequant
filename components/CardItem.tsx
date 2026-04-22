import { Card } from '@/lib/types'
import { fmt } from '@/lib/utils'

function MomBadge({ value, lg }: { value: number | null | undefined, lg?: boolean }) {
  if (value == null || Math.abs(value) < 0.4) return null
  const up = value > 0
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: lg ? '4px 10px' : '2px 8px', borderRadius: 20,
      fontFamily: 'var(--fm)', fontWeight: 600, fontSize: lg ? 13 : 11,
      background: up ? 'var(--green-bg)' : 'var(--red-bg)',
      color: up ? 'var(--green)' : 'var(--red)',
      whiteSpace: 'nowrap',
    }}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

function SignalTag({ card }: { card: Card }) {
  const mom = card.demand?.price_momentum_30d
  const dem = card.demand?.demand_score
  if (dem != null && dem >= 7.5 && mom != null && mom > 8)
    return (
      <span style={{
        fontSize: 10, padding: '2px 8px', borderRadius: 20,
        background: 'var(--gold)', color: 'white',
        fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const,
      }}>🔥 Hot</span>
    )
  if (mom != null && mom > 18)
    return (
      <span style={{
        fontSize: 10, padding: '2px 8px', borderRadius: 20,
        background: 'var(--green-bg)', color: 'var(--green)',
        fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const,
      }}>Rising</span>
    )
  if (mom != null && mom < -18)
    return (
      <span style={{
        fontSize: 10, padding: '2px 8px', borderRadius: 20,
        background: 'var(--red-bg)', color: 'var(--red)',
        fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const,
      }}>Cooling</span>
    )
  return null
}

function DemBar({ score, noLabel }: { score: number | null, noLabel?: boolean }) {
  if (score == null) return null
  const col = score >= 7.5 ? 'var(--gold)' : score >= 5 ? 'var(--ink-mid)' : 'var(--cborder)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--cborder)' }}>
        <div style={{
          width: `${(score / 10) * 100}%`, height: '100%', borderRadius: 2,
          background: col, transition: 'width 0.5s ease',
        }} />
      </div>
      {!noLabel && (
        <span style={{ fontSize: 10, fontFamily: 'var(--fm)', color: 'var(--ink-light)', minWidth: 24, textAlign: 'right' as const }}>
          {score.toFixed(1)}
        </span>
      )}
    </div>
  )
}

interface CardItemProps {
  card: Card
  onClick: (c: Card) => void
  cols: number
  showImg?: boolean
}

export default function CardItem({ card, onClick, cols, showImg = true }: CardItemProps) {
  const d = card.demand
  const imgH = cols === 5 ? 210 : cols === 4 ? 240 : 280

  return (
    <div
      className="card-item fadeup"
      onClick={() => onClick(card)}
      style={{
        background: 'var(--c1)', borderRadius: 12,
        border: '1px solid var(--cborder)', overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(26,18,8,0.05)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {showImg && (
        <div style={{
          height: imgH, flexShrink: 0, position: 'relative',
          borderBottom: '1px solid var(--cborder)', overflow: 'hidden',
          background: 'var(--c2)',
        }}>
          {/* Blurred art background */}
          {card.image_url && (
            <div style={{
              position: 'absolute', inset: -8,
              backgroundImage: `url(${card.image_url})`,
              backgroundSize: 'cover', backgroundPosition: 'center top',
              filter: 'blur(14px) brightness(0.7) saturate(1.4)',
              transform: 'scale(1.12)',
            }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(237,232,216,0.28)' }} />
          {card.image_url
            ? (
              <img
                src={card.image_url}
                alt={card.card_name}
                loading="lazy"
                style={{
                  position: 'absolute', inset: 0, zIndex: 1,
                  height: '100%', width: '100%',
                  objectFit: 'contain', padding: '6px 4px',
                }}
              />
            )
            : (
              <span style={{
                position: 'absolute', inset: 0, zIndex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: 'var(--ink-light)',
              }}>
                {card.character_name}
              </span>
            )
          }
        </div>
      )}

      <div style={{ padding: '8px 11px 11px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 5, marginBottom: 2 }}>
          <span style={{
            fontWeight: 600, fontSize: 12, color: 'var(--ink)', lineHeight: 1.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
          }}>
            {card.card_name}
          </span>
          <SignalTag card={card} />
        </div>

        <div style={{
          fontSize: 10.5, color: 'var(--ink-light)', marginBottom: 7,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {card.set?.set_name}
        </div>

        <div style={{
          borderTop: '1px solid var(--cborder)', paddingTop: 7,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: d?.demand_score != null ? 6 : 0,
        }}>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 17, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            {fmt(card.price)}
          </span>
          <MomBadge value={d?.price_momentum_30d} />
        </div>

        {d?.demand_score != null && <DemBar score={d.demand_score} />}
      </div>
    </div>
  )
}

export { MomBadge, DemBar }
