import { Button, Card, Checkbox, Group, Pagination, Select, Stack, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import { appendRegisterStages, moveRegisterItem } from '../query'
import { registerPaginationControlProps } from '../pagination'
import { REGISTER_STAGES, REGISTER_STAGE_LABELS } from '../validation'
import type { RegisterField, RegisterSelection } from '../types'

type Props = { resources: readonly RegisterField[]; value: readonly RegisterSelection[]; disabled: boolean; onChange: (value: RegisterSelection[]) => void }
const PAGE_SIZE = 20

export function RegisterSelectionEditor({ resources, value, disabled, onChange }: Props) {
  const [resource, setResource] = useState<string | null>(null), [search, setSearch] = useState(''), [page, setPage] = useState(1)
  const byId = new Map(resources.map(item => [item.uuid, item])), selected = new Set(value.map(item => `${item.resourceUuid}:${item.stage}`))
  const captions = new Map<string, number>()
  for (const item of resources) captions.set(item.caption, (captions.get(item.caption) ?? 0) + 1)
  const activeResource = resource && byId.has(resource) ? resource : null
  const indexed = value.map((item, index) => ({ item, index, caption: byId.get(item.resourceUuid)?.caption ?? 'Невідомий ресурс' }))
  const filtered = indexed.filter(({ caption, item }) => `${caption} ${REGISTER_STAGE_LABELS[item.stage]}`.toLocaleLowerCase('uk').includes(search.toLocaleLowerCase('uk')))
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), visiblePage = Math.min(page, pages)
  return <Card withBorder><Stack gap="sm"><Text fw={600}>Показники ({value.length})</Text>
    <Text size="sm">Порядок у списку визначає порядок значень у звіті. Кожна стадія належить конкретному ресурсу.</Text>
    <Select label="Ресурс для показників" searchable clearable value={activeResource} disabled={disabled} onChange={setResource}
      data={resources.map(item => ({ value: item.uuid, label: captions.get(item.caption)! > 1 ? `${item.caption} [${item.uuid}]` : item.caption }))} nothingFoundMessage="Ресурсів не знайдено" />
    {activeResource ? <Group align="start">{REGISTER_STAGES.map(stage => <Checkbox key={stage} label={REGISTER_STAGE_LABELS[stage]} disabled={disabled}
      checked={selected.has(`${activeResource}:${stage}`)} onChange={event => onChange(event.currentTarget.checked
        ? [...value, { resourceUuid: activeResource, stage }]
        : value.filter(item => item.resourceUuid !== activeResource || item.stage !== stage))} />)}</Group> : null}
    <Group>
      <Button variant="light" disabled={disabled || !activeResource} onClick={() => { if (activeResource) onChange(appendRegisterStages(value, activeResource)) }}>Додати всі стадії ресурсу</Button>
      <Button variant="subtle" disabled={disabled || value.length === resources.length * REGISTER_STAGES.length} onClick={() => {
        const additions: RegisterSelection[] = []
        for (const item of resources) for (const stage of REGISTER_STAGES) if (!selected.has(`${item.uuid}:${stage}`)) additions.push({ resourceUuid: item.uuid, stage })
        onChange([...value, ...additions])
      }}>Додати всі ресурси та стадії</Button>
    </Group>
    <TextInput label="Пошук вибраних показників" value={search} onChange={event => { setSearch(event.currentTarget.value); setPage(1) }} />
    <Text size="sm" c="dimmed">Знайдено: {filtered.length}. Сторінка змінює лише перегляд списку.</Text>
    <ol className="source-register-ordered-list source-register-measure-list" start={(visiblePage - 1) * PAGE_SIZE + 1}>{filtered.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE).map(({ item, index, caption }) => <li key={`${item.resourceUuid}:${item.stage}`}>
      <Text size="sm">{index + 1}. {caption} — {REGISTER_STAGE_LABELS[item.stage]}</Text>
      <Group gap="xs">
        <Button size="compact-xs" variant="subtle" aria-label={`Показник ${index + 1}: підняти`} disabled={disabled || index === 0} onClick={() => onChange(moveRegisterItem(value, index, -1))}>Вище</Button>
        <Button size="compact-xs" variant="subtle" aria-label={`Показник ${index + 1}: опустити`} disabled={disabled || index === value.length - 1} onClick={() => onChange(moveRegisterItem(value, index, 1))}>Нижче</Button>
        <Button size="compact-xs" variant="subtle" color="red" aria-label={`Показник ${index + 1}: видалити`} disabled={disabled} onClick={() => onChange(value.filter((_, position) => position !== index))}>Видалити</Button>
      </Group><details><summary>Ідентифікатор ресурсу</summary><code>{item.resourceUuid}</code></details>
    </li>)}</ol>
    {pages > 1 ? <Pagination role="navigation" aria-label="Сторінки вибраних показників" getControlProps={registerPaginationControlProps} value={visiblePage} onChange={setPage} total={pages} /> : null}
  </Stack></Card>
}
