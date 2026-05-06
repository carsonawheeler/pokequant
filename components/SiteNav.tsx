'use client'

import styles from './SiteNav.module.css'

type NavTab = 'cards' | 'sets' | 'sealed' | 'leaderboard'

interface SiteNavProps {
  activeTab?:  NavTab | 'home'
  onNavigate:  (tab: NavTab) => void
  onHome:      () => void
  liveCount?:  number | null
}

const NAV_TABS: { id: NavTab; label: string }[] = [
  { id: 'sets',        label: 'Sets'        },
  { id: 'cards',       label: 'Cards'       },
  { id: 'sealed',      label: 'Sealed'      },
  { id: 'leaderboard', label: 'Leaderboard' },
]

export default function SiteNav({ activeTab, onNavigate, onHome, liveCount }: SiteNavProps) {
  return (
    <header className={styles.nav}>
      <div className={styles.left}>
        {/* Logo — always navigates home */}
        <button className={styles.logoBtn} onClick={onHome} aria-label="Go to home">
          <svg
            className={styles.logoMark}
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 8 A9 9 0 1 0 22 24"/>
            <circle cx="20" cy="16" r="4" strokeWidth="2.6"/>
            <line x1="23" y1="19" x2="28" y2="24" strokeWidth="2.8"/>
          </svg>
          <span className={styles.logoText}>CardQuant</span>
          <span className={styles.betaBadge}>BETA</span>
        </button>

        {/* Tab navigation */}
        <nav className={styles.navLinks}>
          {NAV_TABS.map(t => (
            <button
              key={t.id}
              className={`${styles.navLink}${activeTab === t.id ? ` ${styles.navLinkActive}` : ''}`}
              onClick={() => onNavigate(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Live indicator */}
      <div className={styles.liveIndicator}>
        <div className={styles.liveDot} />
        {liveCount != null ? `Live · ${liveCount} SIRs` : 'Live Data'}
      </div>
    </header>
  )
}
