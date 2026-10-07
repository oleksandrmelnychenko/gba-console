import { Button, Group, NumberInput, Select, Stack, Text } from '@mantine/core'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useId, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { useServerReportTemplates } from '../hooks/useServerReportTemplates'
import type { ReportTemplateOrderItem } from '../data/reportTemplateOrder'

type Ordering = ReturnType<typeof useServerReportTemplates>['ordering']

function OrderMoveControls({ selected, count, unavailable, change }: {
  selected: ReportTemplateOrderItem | undefined; count: number; unavailable: boolean; change: Ordering['change']
}) {
  const { t } = useI18n()
  const disabled = unavailable || !selected
  return <Group>
    <Button type="button" size="xs" variant="default" leftSection={<ArrowUp size={15} />}
      disabled={disabled || selected?.DisplayOrder === 1}
      onClick={() => selected && void change({ Operation: 'move_up', Id: selected.Id })}>{t('Підняти')}</Button>
    <Button type="button" size="xs" variant="default" leftSection={<ArrowDown size={15} />}
      disabled={disabled || selected?.DisplayOrder === count}
      onClick={() => selected && void change({ Operation: 'move_down', Id: selected.Id })}>{t('Опустити')}</Button>
  </Group>
}

function OrderTransferControls({ selected, count, unavailable, position, onPositionChange, change }: {
  selected: ReportTemplateOrderItem | undefined; count: number; unavailable: boolean; position: string | number
  onPositionChange: (value: string | number) => void; change: Ordering['change']
}) {
  const { t } = useI18n()
  const disabled = unavailable || !selected
  const validPosition = typeof position === 'number' && Number.isSafeInteger(position) && position >= 1 && position <= count
  return <Group align="end">
    <NumberInput label={t('Позиція у повному списку GBA')} min={1} max={count || 1} allowDecimal={false}
      allowNegative={false} value={position} onChange={onPositionChange} disabled={disabled} />
    <Button type="button" size="xs" variant="default" disabled={disabled || !validPosition}
      onClick={() => selected && validPosition && void change({ Operation: 'transfer', Id: selected.Id, Position: Number(position) })}>
      {t('Перемістити на позицію')}</Button>
  </Group>
}

export function ReportTemplateOrderingControls({ ordering, blocked, busy }: {
  ordering: Ordering; blocked: boolean; busy: boolean
}) {
  const { t } = useI18n()
  const titleId = useId()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [position, setPosition] = useState<string | number>('')
  if (!ordering.opened) return <Button type="button" variant="default" size="xs" disabled={blocked}
    onClick={() => void ordering.open()}>{t('Порядок шаблонів')}</Button>
  const items = ordering.state?.Items ?? []
  const selected = items.find(item => item.Id === selectedId)
  const unavailable = blocked || !ordering.state
  return <Stack role="region" aria-labelledby={titleId} gap="xs" p="sm"
    style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
    <Group justify="space-between">
      <Text id={titleId} fw={600} size="sm">{t('Порядок збережених шаблонів')}</Text>
      <Button type="button" variant="subtle" size="xs" disabled={busy} onClick={ordering.close}>{t('Закрити порядок')}</Button>
    </Group>
    <Text size="xs" c="dimmed">{t('Позиції та сортування стосуються повного списку, незалежно від пошуку. Налаштування звітів не змінюються.')}</Text>
    {!ordering.state ? <Text size="sm">{t('Оновіть список, щоб керувати порядком шаблонів.')}</Text> : <>
      <Select label={t('Шаблон у повному списку')} placeholder={t('Оберіть шаблон')}
        data={items.map(item => ({ value: item.Id, label: `${item.DisplayOrder}. ${item.Name}` }))}
        value={selected?.Id ?? null} disabled={unavailable || !items.length} searchable
        onChange={id => { setSelectedId(id); setPosition(items.find(item => item.Id === id)?.DisplayOrder ?? '') }} />
      <OrderMoveControls selected={selected} count={items.length} unavailable={unavailable} change={ordering.change} />
      <OrderTransferControls selected={selected} count={items.length} unavailable={unavailable}
        position={position} onPositionChange={setPosition} change={ordering.change} />
      <Group>
        <Button type="button" size="xs" variant="default" disabled={unavailable}
          onClick={() => void ordering.change({ Operation: 'sort_name_asc' })}>{t('Назви за зростанням')}</Button>
        <Button type="button" size="xs" variant="default" disabled={unavailable}
          onClick={() => void ordering.change({ Operation: 'sort_name_desc' })}>{t('Назви за спаданням')}</Button>
      </Group>
    </>}
  </Stack>
}
