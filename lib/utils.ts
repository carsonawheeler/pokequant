export const fmt = (n: number | null | undefined): string =>
  n != null ? (n >= 1000 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`) : '—'

export const fmtP = (n: number | null | undefined): string =>
  n != null ? `${n > 0 ? '+' : ''}${n.toFixed(1)}%` : '—'
