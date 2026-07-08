import { Tooltip } from '@mantine/core'
import { Sparkles } from 'lucide-react'
import type { HTMLAttributes } from 'react'
import { useI18n } from '../i18n/useI18n'
import './aiFeature.css'

type AiFeatureBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  compact?: boolean
  size?: 'xs' | 'sm'
  tooltip?: string
}

export function AiFeatureBadge({
  className,
  compact = false,
  size = 'xs',
  tooltip,
  ...props
}: AiFeatureBadgeProps) {
  const { t } = useI18n()
  const label = tooltip || t('AI-функція')

  return (
    <Tooltip label={label} openDelay={250}>
      <span
        {...props}
        aria-label={label}
        className={[
          'ai-feature-badge',
          `ai-feature-badge--${size}`,
          compact ? 'ai-feature-badge--compact' : '',
          className || '',
        ].filter(Boolean).join(' ')}
        role="img"
      >
        <Sparkles size={size === 'sm' ? 16 : 14} fill="currentColor" strokeWidth={0} />
        {!compact && <span className="ai-feature-badge__text">AI</span>}
      </span>
    </Tooltip>
  )
}
