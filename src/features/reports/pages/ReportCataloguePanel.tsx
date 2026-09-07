import { Alert, Badge, Button, Card, Group, Loader, Pagination, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useAuth } from '../../auth/useAuth'
import { getReportCatalogue, getReportDatasets } from '../api/reportWorkspaceApi'
import { CAPTURE_STATUS_LABELS, DEPENDENCY_STATUS_LABELS, filterMigrationCatalogue, inspectCatalogueMigration, MIGRATION_STATUS_LABELS, sourceIdentity, type MigrationDisplayStatus } from '../data/reportMigration'
import type { ReportCatalogue, ReportCatalogueEntry, ReportDataset, ReportSourceMigration } from '../types'

const kindLabels: Record<string, string> = {
  builtin: 'Вбудовані', regulated: 'Регламентовані', external: 'Зовнішні',
  processing: 'Звітні обробки', custom: 'Довільні', indicator: 'Показники', builder: 'Конструктори',
}
const statusColors: Record<MigrationDisplayStatus, string> = { unassessed: 'gray', captured: 'gray', native_partial: 'yellow', parity_verified: 'green' }
const pageSize = 20
const worldLabel = (world: string) => world === 'fenix' ? 'Fenix' : world === 'amg' ? 'AMG' : world

export function ReportCataloguePanel() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const canGenerate = hasPermission(PermissionKeys.ReportsStocks.Report.Generate)
  const [catalogue, setCatalogue] = useState<ReportCatalogue | null>(null)
  const [datasets, setDatasets] = useState<ReportDataset[] | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<string | null>(null)
  const [world, setWorld] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [dependency, setDependency] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    const controller = new AbortController()
    Promise.allSettled([getReportCatalogue(controller.signal), canGenerate ? getReportDatasets(controller.signal) : Promise.resolve(null)])
      .then(([inventory, capabilities]) => {
        if (controller.signal.aborted) return
        if (inventory.status === 'fulfilled') setCatalogue(inventory.value)
        else setError(true)
        setDatasets(capabilities.status === 'fulfilled' ? capabilities.value : null)
      })
    return () => controller.abort()
  }, [attempt, canGenerate])

  const inspection = useMemo(() => catalogue ? inspectCatalogueMigration(catalogue) : null, [catalogue])
  const filtered = useMemo(() => catalogue && inspection ? filterMigrationCatalogue(catalogue, inspection, { kind, world, status, dependency, search }) : [],
    [catalogue, inspection, kind, world, status, dependency, search])
  const availableDatasets = canGenerate ? datasets : null
  const visibleSourceCount = filtered.reduce((sum, item) => sum + item.matchingSources.length, 0)

  if (error) return <Alert color="red" title={t('Не вдалося завантажити каталог')}>
    <Button onClick={() => { setError(false); setCatalogue(null); setDatasets(null); setAttempt(value => value + 1) }}>{t('Повторити')}</Button>
  </Alert>
  if (!catalogue || !inspection) return <Group><Loader size="sm" /><Text>{t('Завантаження каталогу звітів')}</Text></Group>
  const { summary } = inspection
  return <Card withBorder padding="sm" style={{ flexShrink: 0 }}>
    <Stack gap="sm">
      <Group justify="space-between"><Text fw={600}>{t('Каталог звітів 1С')}</Text><Badge>{summary.CatalogueEntries}</Badge></Group>
      <Text size="sm" c="dimmed">{t('Перелік для перенесення з Fenix та AMG. Наявність у каталозі ще не означає, що розрахунок доступний у GBA. Готові налаштування доступних звітів розташовані в конструкторі.')}</Text>
      <Stack gap={2} aria-label={t('Загальний стан каталогу')}>
        <Text size="sm">{t('{entries} позицій · {implementations} джерельних реалізацій · {builtin} вбудованих і регламентованих реалізацій', {
          entries: summary.CatalogueEntries, implementations: summary.SourceImplementations, builtin: summary.BuiltinImplementations })}</Text>
        <Text size="sm">{t('Реалізації: зафіксовано {captured} · частково доступно {partial} · відповідність підтверджено {verified} · не оцінено {unknown}', {
          captured: summary.ByStatus.Captured, partial: summary.ByStatus.NativePartial, verified: summary.ByStatus.ParityVerified, unknown: summary.ByStatus.Unassessed })}</Text>
        <Text size="sm">{t('Повністю перевірені позиції в усіх базах: {count}', { count: summary.FullyVerifiedEntries })}</Text>
        <Text size="sm">{availableDatasets ? t('У GBA доступно {count} наборів даних. Це окремий показник від перенесених звітів.', { count: availableDatasets.length })
          : canGenerate ? t('Доступність наборів GBA не підтверджена: не вдалося завантажити можливості сервера.') : t('Перевірка доступних наборів GBA потребує права формування звітів.')}</Text>
        <Text size="xs" c="dimmed">{t('Джерела зафіксовано: {date}', { date: catalogue.CapturedOn })}</Text>
        {inspection.valid && catalogue.Migration && <Text size="xs" c="dimmed">{t('Версія стану перенесення: {version} · {date}', { version: catalogue.Migration.Version, date: catalogue.Migration.GeneratedAtUtc })}</Text>}
      </Stack>
      {!inspection.valid && <Alert color="yellow">{t(inspection.supplied ? 'Дані стану перенесення не узгоджені з каталогом. Завершеність не підтверджена; усі позиції каталогу збережені.'
        : 'Стан перенесення ще не надано сервером. Наявність джерела не підтверджує готовність розрахунку.')}</Alert>}
      <Text size="xs" c="dimmed">{t('Типи подання у вихідних конфігураціях 1С; це не перелік готових подань GBA.')}</Text>
      <Group aria-label={t('Типи подання 1С')}>{catalogue.Presentations.map(item => <Badge key={item.Id} color="gray" variant="light">{t(item.Title)}</Badge>)}</Group>
      <Group align="end">
        <TextInput label={t('Пошук звіту')} value={search} onChange={event => { setSearch(event.currentTarget.value); setPage(1) }} />
        <Select label={t('Тип звіту')} clearable value={kind} data={Object.entries(kindLabels).map(([value, label]) => ({ value, label: t(label) }))} onChange={value => { setKind(value); setPage(1) }} />
        <Select label={t('База')} clearable value={world} data={[...new Set(catalogue.Reports.flatMap(report => report.Sources.map(source => source.World)))].map(value => ({ value, label: worldLabel(value) }))} onChange={value => { setWorld(value); setPage(1) }} />
        <Select label={t('Стан перенесення')} clearable value={status} data={Object.entries(MIGRATION_STATUS_LABELS).map(([value, label]) => ({ value, label: t(label) }))} onChange={value => { setStatus(value); setPage(1) }} />
        <Select label={t('Стан залежностей')} clearable value={dependency} data={Object.entries(DEPENDENCY_STATUS_LABELS).map(([value, label]) => ({ value, label: t(label) }))} onChange={value => { setDependency(value); setPage(1) }} />
      </Group>
      <Text size="sm">{t('У вибірці: {entries} позицій · {implementations} реалізацій. Загальні показники вище охоплюють усі бази.', { entries: filtered.length, implementations: visibleSourceCount })}</Text>
      <Table.ScrollContainer minWidth={650}>
        <Table striped>
          <Table.Thead><Table.Tr><Table.Th>{t('Звіт')}</Table.Th><Table.Th>{t('Тип')}</Table.Th><Table.Th>{t('Стан за базами')}</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{filtered.slice((page - 1) * pageSize, page * pageSize).map(({ report }) => <Fragment key={report.Id}>
            <Table.Tr>
              <Table.Td><Button variant="subtle" size="compact-sm" aria-expanded={expanded.has(report.Id)} aria-label={t('Покриття звіту: {name}', { name: report.Title })}
                onClick={() => setExpanded(current => { const next = new Set(current); if (next.has(report.Id)) next.delete(report.Id); else next.add(report.Id); return next })}>{report.Title}</Button></Table.Td>
              <Table.Td>{t(kindLabels[report.Kind] ?? report.Kind)}</Table.Td>
              <Table.Td><Group gap={4}>{report.Sources.map(source => {
                const state = inspection.statuses.get(sourceIdentity(source)) ?? 'unassessed'
                return <Badge key={sourceIdentity(source)} color={statusColors[state]} variant="light">{worldLabel(source.World)}: {t(MIGRATION_STATUS_LABELS[state])}</Badge>
              })}</Group></Table.Td>
            </Table.Tr>
            {expanded.has(report.Id) && <Table.Tr><Table.Td colSpan={3}><ReportMigrationDetails report={report} migrations={inspection.migrations} datasets={availableDatasets} canGenerate={canGenerate} /></Table.Td></Table.Tr>}
          </Fragment>)}</Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {!filtered.length && <Text c="dimmed">{t('Звітів за цими умовами не знайдено')}</Text>}
      <Pagination total={Math.max(1, Math.ceil(filtered.length / pageSize))} value={page} onChange={setPage} />
    </Stack>
  </Card>
}

function ReportMigrationDetails({ report, migrations, datasets, canGenerate }: {
  report: ReportCatalogueEntry; migrations: ReadonlyMap<string, ReportSourceMigration>; datasets: ReportDataset[] | null; canGenerate: boolean
}) {
  const { t } = useI18n()
  return <Stack gap="md" aria-label={t('Покриття звіту: {name}', { name: report.Title })}>{report.Sources.map(source => {
    const migration = migrations.get(sourceIdentity(source))
    return <Stack key={sourceIdentity(source)} gap={4}>
      <Text fw={600}>{worldLabel(source.World)} · {source.SourceId}</Text>
      {migration ? <>
        <Text size="sm">{t(CAPTURE_STATUS_LABELS[migration.CaptureStatus])}</Text>
        <ScopeLines title="Доступний обсяг" lines={migration.CoveredScope} fallback="Нативне покриття цієї реалізації не підтверджене." />
        <ScopeLines title="Що залишається перенести" lines={migration.MissingScope} fallback="Заявлений обсяг перевірено повністю." />
        <Text size="sm" fw={600}>{t('Залежності')}</Text>
        {migration.Dependencies.length ? migration.Dependencies.map(item => <Text size="sm" key={item.Key}>{item.Title}: {t(DEPENDENCY_STATUS_LABELS[item.Status])}{item.Note ? ` · ${item.Note}` : ''}</Text>)
          : <Text size="sm" c="dimmed">{t('У маніфесті не зазначені окремі залежності.')}</Text>}
        {migration.Validation && <Stack gap={2}>
          <Text size="sm">{t(migration.Validation.Kind === 'source_parity' ? 'Доказ відповідності джерельній реалізації' : 'Перевірка нативного обсягу; повну відповідність 1С не підтверджено')}</Text>
          <Text size="xs">{migration.Validation.EvidenceId} · {migration.Validation.VerifiedAtUtc}</Text>
          <Text size="xs">{t('Версія розрахунку: {revision}', { revision: migration.Validation.NativeRevision })}</Text>
        </Stack>}
        <MappedDatasets migration={migration} datasets={datasets} canGenerate={canGenerate} />
      </> : <Text size="sm" c="dimmed">{t('Стан перенесення не оцінено. Дані покриття та перевірки не підтверджені.')}</Text>}
    </Stack>
  })}</Stack>
}

function ScopeLines({ title, lines, fallback }: { title: string; lines: string[]; fallback: string }) {
  const { t } = useI18n()
  return <Stack gap={2}><Text size="sm" fw={600}>{t(title)}</Text>{lines.length ? <ul>{lines.map(line => <li key={line}><Text size="sm">{line}</Text></li>)}</ul> : <Text size="sm" c="dimmed">{t(fallback)}</Text>}</Stack>
}

function MappedDatasets({ migration, datasets, canGenerate }: { migration: ReportSourceMigration; datasets: ReportDataset[] | null; canGenerate: boolean }) {
  const { t } = useI18n()
  if (!migration.NativeDataSources.length) return null
  if (!canGenerate) return <Text size="sm" c="dimmed">{t('Для роботи з наборами GBA потрібне право формування звітів.')}</Text>
  return <Stack gap={2}><Text size="sm" fw={600}>{t('Пов’язані набори GBA')}</Text>{migration.NativeDataSources.map(id => {
    const dataset = datasets?.find(item => item.DataSource === id)
    return <Text size="sm" key={id}>{dataset ? `${dataset.Name} [${id}]` : t('Набір [{id}] зараз недоступний або його доступність не підтверджена.', { id })}</Text>
  })}<Text size="xs" c="dimmed">{t('Доступний набір можна вибрати у конструкторі вручну. Каталог не застосовує налаштування й не змінює поточний звіт.')}</Text></Stack>
}
