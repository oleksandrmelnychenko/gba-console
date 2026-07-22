import type { CSSProperties, ReactNode } from 'react'
import './orb.css'

export type OrbVariant = 'whirling' | 'thinking'

type OrbProps = {
  /** whirling — звичайні завантаження; thinking — АІ-екрани. */
  variant?: OrbVariant
  /** Diameter in px. */
  size?: number
  className?: string
}

export function Orb({ variant = 'whirling', size = 28, className }: OrbProps) {
  return (
    <span
      aria-hidden="true"
      className={`app-orb app-orb--${variant}${className ? ` ${className}` : ''}`}
      style={{ '--orb-size': `${size}px`, width: size, height: size } as CSSProperties}
    />
  )
}

type OrbSplashProps = {
  variant?: OrbVariant
  size?: number
  label?: ReactNode
  className?: string
}

/** Centered full-area loading state: the orb sits in the middle of whatever
    shell region hosts it (route outlet, panel, sheet body). */
export function OrbSplash({ variant = 'whirling', size = 32, label, className }: OrbSplashProps) {
  return (
    <div className={`app-orb-splash${className ? ` ${className}` : ''}`} role="status">
      <Orb size={size} variant={variant} />
      {label ? <span className="app-orb-splash__label">{label}</span> : null}
    </div>
  )
}
