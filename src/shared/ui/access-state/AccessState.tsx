import { Lock, TriangleAlert } from 'lucide-react'
import './access-state.css'

/** Quiet, centred page state for "no access" / "menu unavailable": a small
 *  muted icon, one title and one line of text instead of a full-width banner. */
export function AccessState({
  description,
  title,
  tone = 'neutral',
}: {
  description: string
  title: string
  tone?: 'neutral' | 'danger'
}) {
  const Icon = tone === 'danger' ? TriangleAlert : Lock

  return (
    <div className={`app-access-state is-${tone}`} role="alert">
      <span aria-hidden="true" className="app-access-state-icon">
        <Icon size={20} strokeWidth={1.8} />
      </span>
      <div className="app-access-state-title">{title}</div>
      <div className="app-access-state-text">{description}</div>
    </div>
  )
}
