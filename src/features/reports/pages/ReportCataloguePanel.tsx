import { Alert, Badge, Button, Card, Group, Loader, Pagination, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getReportCatalogue } from '../api/reportWorkspaceApi'
import type { ReportCatalogue } from '../types'

const kindLabels: Record<string, string> = {
  builtin: 'Вбудовані', regulated: 'Регламентовані', external: 'Зовнішні',
  processing: 'Звітні обробки', custom: 'Довільні', indicator: 'Показники', builder: 'Конструктори',
}
const pageSize = 20

export function ReportCataloguePanel() {
  const { t } = useI18n()
  const [catalogue, setCatalogue] = useState<ReportCatalogue | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<string | null>(null)
  const [world, setWorld] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const controller = new AbortController()
    getReportCatalogue(controller.signal).then(value => {
      if (!controller.signal.aborted) setCatalogue(value)
    }).catch(() => {
      if (!controller.signal.aborted) setError(true)
    })
    return () => controller.abort()
  }, [attempt])

  const filtered = useMemo(() => (catalogue?.Reports ?? []).filter(report =>
    (!kind || report.Kind === kind)
    && (!world || report.Sources.some(source => source.World === world))
    && `${report.Title} ${report.Name}`.toLocaleLowerCase('uk').includes(search.trim().toLocaleLowerCase('uk')),
  ), [catalogue, kind, search, world])

  if (error) return <Alert color="red" title={t('Не вдалося завантажити каталог')}>
    <Button onClick={() => { setError(false); setAttempt(value => value + 1) }}>{t('Повторити')}</Button>
  </Alert>
  if (!catalogue) return <Group><Loader size="sm" /><Text>{t('Завантаження каталогу звітів')}</Text></Group>

  return <Card withBorder padding="sm">
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fw={600}>{t('Каталог звітів 1С')}</Text>
        <Badge>{catalogue.Reports.length}</Badge>
      </Group>
      <Text size="sm" c="dimmed">{t('Перелік для перенесення з Fenix та AMG. Наявність у каталозі ще не означає, що розрахунок доступний у GBA. Готові налаштування доступних звітів розташовані в конструкторі.')}</Text>
      <Text size="xs" c="dimmed">{t('Типи подання у вихідних конфігураціях 1С; це не перелік готових подань GBA.')}</Text>
      <Group aria-label={t('Типи подання 1С')}>
        {catalogue.Presentations.map(item => <Badge key={item.Id} color="gray" variant="light">{t(item.Title)}</Badge>)}
      </Group>
      <Group align="end">
        <TextInput label={t('Пошук звіту')} value={search} onChange={event => { setSearch(event.currentTarget.value); setPage(1) }} />
        <Select label={t('Тип звіту')} clearable value={kind} data={Object.entries(kindLabels).map(([value, label]) => ({ value, label: t(label) }))}
          onChange={value => { setKind(value); setPage(1) }} />
        <Select label={t('База')} clearable value={world} data={[{ value: 'fenix', label: 'Fenix' }, { value: 'amg', label: 'AMG' }]}
          onChange={value => { setWorld(value); setPage(1) }} />
      </Group>
      <Text size="sm">{t('Знайдено: {count}', { count: filtered.length })}</Text>
      <Table.ScrollContainer minWidth={600}>
        <Table striped>
          <Table.Thead><Table.Tr><Table.Th>{t('Звіт')}</Table.Th><Table.Th>{t('Тип')}</Table.Th><Table.Th>{t('База')}</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{filtered.slice((page - 1) * pageSize, page * pageSize).map(report =>
            <Table.Tr key={report.Id}>
              <Table.Td>{report.Title}</Table.Td>
              <Table.Td>{t(kindLabels[report.Kind] ?? report.Kind)}</Table.Td>
              <Table.Td>{report.Sources.map(source => source.World === 'fenix' ? 'Fenix' : 'AMG').join(', ')}</Table.Td>
            </Table.Tr>,
          )}</Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {!filtered.length && <Text c="dimmed">{t('Звітів за цими умовами не знайдено')}</Text>}
      <Pagination total={Math.max(1, Math.ceil(filtered.length / pageSize))} value={page} onChange={setPage} />
    </Stack>
  </Card>
}
