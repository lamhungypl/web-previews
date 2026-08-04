const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60_000],
  ['month', 30 * 24 * 60 * 60_000],
  ['day', 24 * 60 * 60_000],
  ['hour', 60 * 60_000],
  ['minute', 60_000],
]

/** "3 minutes ago", "yesterday" — for history timestamps. */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const elapsed = timestamp - now
  for (const [unit, ms] of UNITS) {
    if (Math.abs(elapsed) >= ms) return rtf.format(Math.round(elapsed / ms), unit)
  }
  return 'just now'
}
