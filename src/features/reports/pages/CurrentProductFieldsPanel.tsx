import { Alert, Button, Card, Checkbox, Group, Stack, Text } from '@mantine/core'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { hasProductRow, isSalesProductProfile, readWorkbookSelection, workbookConfigurationError,
  type WorkbookCapability, type WorkbookSelection } from '../data/workbookPresentation'
import type { ReportRequestBody } from '../types'

export function CurrentProductFieldsPanel({ capability, request, value, disabled, onChange }: {
  capability: WorkbookCapability | null; request: ReportRequestBody; value: unknown; disabled: boolean
  onChange: (value: WorkbookSelection | undefined) => void
}) {
  const selection = readWorkbookSelection(value)
  const supported = capability?.version === 2 && isSalesProductProfile(request)
  if (!supported && value == null) return null
  const error = value == null ? null : workbookConfigurationError({ ...request, workbookPresentation: value })
  const selected = selection?.version === 2 ? selection.additionalFields : []
  const canAdd = supported && hasProductRow(request) && !error
  const selectedRank = new Map(selected.map((type, index) => [type, index]))
  const fieldsByType = new Map(capability?.additionalFields.map(field => [field.type, field]))
  const fields = capability?.version === 2 ? [...selected.flatMap(type => { const field = fieldsByType.get(type); return field ? [field] : [] }),
    ...capability.additionalFields.filter(field => !selectedRank.has(field.type))] : []
  function change(next: number[]) { onChange(next.length ? { version: 2, additionalFields: next, ordering: null } : undefined) }
  function move(index: number, delta: number) {
    const next = [...selected]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; change(next)
  }
  return <Card withBorder radius="md" padding="md"><Stack gap="xs">
    <Text component="h4">Поточні поля товару</Text>
    <Text size="sm">Значення з довідника товарів на час формування звіту. Це не історичні реквізити документа.</Text>
    {error ? <Alert color="yellow">{error} Збережені налаштування не змінено.</Alert> : null}
    {!supported ? <Alert color="yellow">Поточний сервер або профіль не підтримує ці поля. Збережені налаштування не змінено.</Alert> : null}
    {supported && !hasProductRow(request) && !error ? <Text size="sm">Додайте «Товар» або «Назва товару» до групування рядків.</Text> : null}
    <section aria-label="Поточні поля товару"><Stack gap="xs">
      {fields.map(field => { const index = selectedRank.get(field.type) ?? -1; return <Group key={field.type} gap="xs">
        <Checkbox label={field.caption} checked={index >= 0} disabled={disabled || index < 0 && !canAdd}
          onChange={event => change(event.currentTarget.checked ? [...selected, field.type] : selected.filter(type => type !== field.type))} />
        {index >= 0 ? <Group gap={2}>
          <Button type="button" size="compact-xs" variant="subtle" aria-label={`Перемістити поле ${field.caption} вище`}
            disabled={disabled || index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} aria-hidden="true" /></Button>
          <Button type="button" size="compact-xs" variant="subtle" aria-label={`Перемістити поле ${field.caption} нижче`}
            disabled={disabled || index === selected.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} aria-hidden="true" /></Button>
        </Group> : null}
      </Group> })}
    </Stack></section>
    <Text size="xs" c="dimmed">Незаповнене поле позначено ∅; недоступне значення — тире. Грошові показники не змінюються.</Text>
    {value != null ? <Button type="button" variant="default" size="xs" disabled={disabled} onClick={() => onChange(undefined)}>Прибрати поточні поля товару</Button> : null}
  </Stack></Card>
}
