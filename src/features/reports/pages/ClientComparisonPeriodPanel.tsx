import { Group, TextInput } from '@mantine/core'
import { CLIENT_COMPARISON_MAX_DATE, CLIENT_COMPARISON_MIN_DATE } from '../data/clientPeriodComparison'

type Props = { value: unknown; disabled: boolean; onChange: (value: unknown) => void }

export function ClientComparisonPeriodPanel({ value, disabled, onChange }: Props) {
  const window = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const from = typeof window.From === 'string' ? window.From : '', to = typeof window.To === 'string' ? window.To : ''
  return <Group gap="sm" align="end" aria-label="Період порівняння">
    <TextInput label="Період порівняння: від" type="date" value={from} disabled={disabled}
      min={CLIENT_COMPARISON_MIN_DATE} max={to || CLIENT_COMPARISON_MAX_DATE}
      onChange={event => onChange({ ...window, Version: 1, From: event.currentTarget.value, To: to })} />
    <TextInput label="Період порівняння: до" type="date" value={to} disabled={disabled}
      min={from || CLIENT_COMPARISON_MIN_DATE} max={CLIENT_COMPARISON_MAX_DATE}
      onChange={event => onChange({ ...window, Version: 1, From: from, To: event.currentTarget.value })} />
  </Group>
}
