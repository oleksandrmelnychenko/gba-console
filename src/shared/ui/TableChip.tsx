export type TableChipTone = 'neutral' | 'document' | 'product' | 'source' | 'storage' | 'success' | 'warning' | 'danger'

type TableChipProps = {
  value: string | number | null | undefined
  tone?: TableChipTone
  size?: 'md' | 'lg'
  showEmpty?: boolean
  title?: string
}

/** A short table value, including values inside expanded rows. */
export function TableChip({ value, tone = 'neutral', showEmpty = false, title, size }: TableChipProps) {
  const text = (value == null ? '' : String(value).trim()) || (showEmpty ? '-' : '')

  // Preserve existing empty-value notation without creating an empty capsule.
  if (!showEmpty && (!text || text === '-' || text === '—')) {
    return <span>{text}</span>
  }

  const color = tone === 'storage' && /БРАК|ДЕФЕКТ/iu.test(text)
    ? 'danger'
    : tone === 'storage' && /УЦІН/iu.test(text)
      ? 'warning'
      : tone

  return (
    <span className={`app-table-chip is-${color}${size ? ` is-size-${size}` : ''}`} title={title ?? text}>
      <span className="app-table-chip-label">{text}</span>
    </span>
  )
}
