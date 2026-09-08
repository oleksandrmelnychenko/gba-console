import { Button, Card, Group, Select, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { moveRegisterItem } from '../query'
import type { RegisterField } from '../types'

type Props = { label: string; fields: readonly RegisterField[]; value: readonly string[]; otherAxis: readonly string[]; disabled: boolean; onChange: (value: string[]) => void }

export function RegisterFieldEditor({ label, fields, value, otherAxis, disabled, onChange }: Props) {
  const [choice, setChoice] = useState<string | null>(null)
  const occupied = new Set([...value, ...otherAxis]), fieldById = new Map(fields.map(field => [field.uuid, field]))
  const captions = new Map<string, number>()
  for (const field of fields) captions.set(field.caption, (captions.get(field.caption) ?? 0) + 1)
  const choices: { value: string; label: string }[] = []
  for (const field of fields) if (!occupied.has(field.uuid)) choices.push({ value: field.uuid, label: captions.get(field.caption)! > 1 ? `${field.caption} [${field.uuid}]` : field.caption })
  const selected = choices.some(item => item.value === choice) ? choice : null
  return <Card withBorder><Stack gap="sm"><Text fw={600}>{label} ({value.length})</Text>
    <Select label={`Додати вимір: ${label.toLowerCase()}`} searchable clearable data={choices} value={selected} onChange={setChoice} disabled={disabled || !choices.length} nothingFoundMessage="Вимірів не знайдено" />
    <Button variant="light" disabled={disabled || !selected} onClick={() => { if (selected) { onChange([...value, selected]); setChoice(null) } }}>Додати до {label === 'Рядки' ? 'рядків' : 'колонок'}</Button>
    {!value.length ? <Text size="sm" c="dimmed">Групування на цій осі не задано.</Text> : null}
    <ol className="source-register-ordered-list">{value.map((id, index) => <li key={id}>
      <Text size="sm">{fieldById.get(id)?.caption ?? 'Невідомий вимір'}</Text>
      <Group gap="xs" wrap="wrap">
        <Button size="compact-xs" variant="subtle" aria-label={`${label}: підняти ${index + 1}`} disabled={disabled || index === 0} onClick={() => onChange(moveRegisterItem(value, index, -1))}>Вище</Button>
        <Button size="compact-xs" variant="subtle" aria-label={`${label}: опустити ${index + 1}`} disabled={disabled || index === value.length - 1} onClick={() => onChange(moveRegisterItem(value, index, 1))}>Нижче</Button>
        <Button size="compact-xs" variant="subtle" color="red" aria-label={`${label}: видалити ${index + 1}`} disabled={disabled} onClick={() => onChange(value.filter((_, position) => position !== index))}>Видалити</Button>
      </Group><details><summary>Ідентифікатор виміру</summary><code>{id}</code></details>
    </li>)}</ol>
  </Stack></Card>
}
