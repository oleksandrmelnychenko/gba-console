import type { ReactNode } from 'react'

/* §7.2 leader row: «label ——— value». Pass mono for numbers/codes/dates. */
export function LabelValueRow({ label, mono, children }: { label: string; mono?: boolean; children?: ReactNode }) {
  return (
    <span className="app-leader-row">
      <span className="app-leader-row-label">{label}</span>
      <span className={`app-leader-row-value${mono ? ' is-mono' : ''}`}>{children}</span>
    </span>
  )
}
