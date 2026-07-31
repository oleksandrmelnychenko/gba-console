import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  FileButton,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  CircleAlert,
  History,
  Link2,
  RotateCcw,
  Search,
  UserRoundSearch,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import {
  getVehicleRegistryFilters,
  getVehicleRegistryImportTotal,
  getVehicleRegistryImportIssues,
  getVehicleRegistryImports,
  getVehicleRegistrySummary,
  getVehicleRegistryVehicle,
  getVehicleRegistryVehicles,
  importVehicleRegistryFile,
  updateVehicleRegistryWorkflow,
} from '../api/vehicleRegistryApi'
import type {
  VehicleRegistryDataQualityStatus,
  VehicleRegistryClientMatch,
  VehicleRegistryClientMatchState,
  VehicleRegistryFilters,
  VehicleRegistryImport,
  VehicleRegistryIssue,
  VehicleRegistryProcessingState,
  VehicleRegistrySummary,
  VehicleRegistryVehicle,
  VehicleRegistryVehicleDetail,
  VehicleRegistryWorkflowStatus,
} from '../types'
import './vehicle-registry-page.css'
import '../../../shared/ui/console-table-page.css'

const PAGE_SIZE = 50
const SEARCH_DEBOUNCE_MS = 300
const EMPTY_FILTERS: VehicleRegistryFilters = {
  Brands: [],
  MaximumYear: null,
  MinimumYear: null,
  Models: [],
  Regions: [],
}
const EMPTY_SUMMARY: VehicleRegistrySummary = {
  Brands: 0,
  DataQualityCounts: {},
  Pending: 0,
  Processed: 0,
  Total: 0,
  WorkflowCounts: {},
}
const VEHICLE_TABLE_LAYOUT = {
  columnOrder: ['vehicle', 'owner', 'client', 'year', 'region', 'workflow', 'quality', 'source', 'actions'],
  columnPinning: { left: ['vehicle'], right: ['actions'] },
  density: 'normal',
} satisfies DataTableDefaultLayout
const IMPORT_TABLE_LAYOUT = {
  columnOrder: ['file', 'status', 'rows', 'quality', 'changes', 'date', 'actions'],
  columnPinning: { left: ['file'], right: ['actions'] },
  density: 'normal',
} satisfies DataTableDefaultLayout
const ISSUE_TABLE_LAYOUT = {
  columnOrder: ['row', 'severity', 'vehicle', 'field', 'message'],
  columnPinning: { left: ['row', 'severity'] },
  density: 'compact',
} satisfies DataTableDefaultLayout

type RegistryView = 'vehicles' | 'imports'

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const numberFormatter = new Intl.NumberFormat('uk-UA')

export function VehicleRegistryPage() {
  const { t } = useI18n()
  const [view, setView] = useState<RegistryView>('vehicles')
  const [searchDraft, setSearchDraft] = useState('')
  const [debouncedSearch] = useDebouncedValue(searchDraft, SEARCH_DEBOUNCE_MS)
  const [brand, setBrand] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [clientMatchState, setClientMatchState] = useState<VehicleRegistryClientMatchState | null>(null)
  const [processingState, setProcessingState] = useState<VehicleRegistryProcessingState | null>(null)
  const [workflowStatus, setWorkflowStatus] = useState<VehicleRegistryWorkflowStatus | null>(null)
  const [qualityStatus, setQualityStatus] = useState<VehicleRegistryDataQualityStatus | null>(null)
  const [filters, setFilters] = useState<VehicleRegistryFilters>(EMPTY_FILTERS)
  const [summary, setSummary] = useState<VehicleRegistrySummary>(EMPTY_SUMMARY)
  const [vehicles, setVehicles] = useState<VehicleRegistryVehicle[]>([])
  const [vehicleTotal, setVehicleTotal] = useState(0)
  const [imports, setImports] = useState<VehicleRegistryImport[]>([])
  const [importTotal, setImportTotal] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [isLoading, setLoading] = useState(true)
  const [isUploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [selectedImport, setSelectedImport] = useState<VehicleRegistryImport | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)

  const activeFilterCount = [brand, model, clientMatchState, processingState, workflowStatus, qualityStatus].filter(Boolean).length
  const totalPages = Math.max(
    1,
    Math.ceil((view === 'vehicles' ? vehicleTotal : (importTotal ?? 0)) / PAGE_SIZE),
  )
  const vehicleColumns = useMemo(
    () => createVehicleColumns(t, setSelectedVehicleId),
    [t],
  )
  const importColumns = useMemo(
    () => createImportColumns(t, setSelectedImport),
    [t],
  )

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      getVehicleRegistrySummary(controller.signal),
      getVehicleRegistryFilters(brand, controller.signal),
      getVehicleRegistryImportTotal(controller.signal),
    ])
      .then(([nextSummary, nextFilters, nextImportTotal]) => {
        if (controller.signal.aborted) {
          return
        }
        setSummary(nextSummary || EMPTY_SUMMARY)
        setFilters(nextFilters || EMPTY_FILTERS)
        setImportTotal(nextImportTotal)
      })
      .catch((loadError) => {
        if (!isAbortError(loadError)) {
          setError(errorMessage(loadError, t('Не вдалося завантажити довідники реєстру')))
        }
      })

    return () => controller.abort()
  }, [brand, reloadKey, t])

  useEffect(() => {
    const controller = new AbortController()

    async function loadRegistry() {
      setLoading(true)
      setError(null)

      try {
        if (view === 'vehicles') {
          const response = await getVehicleRegistryVehicles(
            {
              brand,
              clientMatchState,
              dataQualityStatus: qualityStatus,
              limit: PAGE_SIZE,
              model,
              offset: (page - 1) * PAGE_SIZE,
              processingState,
              prioritizeClientMatches: true,
              search: debouncedSearch.trim(),
              workflowStatus,
            },
            controller.signal,
          )
          setVehicles(response?.Items || [])
          setVehicleTotal(response?.Total || 0)
        } else {
          const response = await getVehicleRegistryImports(
            PAGE_SIZE,
            (page - 1) * PAGE_SIZE,
            controller.signal,
          )
          setImports(response?.Items || [])
          setImportTotal(response?.Total || 0)
        }
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError(errorMessage(loadError, t('Не вдалося завантажити реєстр автомобілів')))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadRegistry()

    return () => controller.abort()
  }, [
    brand,
    clientMatchState,
    debouncedSearch,
    model,
    page,
    processingState,
    qualityStatus,
    reloadKey,
    t,
    view,
    workflowStatus,
  ])

  const changeView = useCallback((nextView: RegistryView) => {
    setPage(1)
    setView(nextView)
    setTableToolbarSlot(null)
  }, [])

  function resetFilters() {
    setPage(1)
    setSearchDraft('')
    setBrand(null)
    setModel(null)
    setClientMatchState(null)
    setProcessingState(null)
    setWorkflowStatus(null)
    setQualityStatus(null)
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) {
      return
    }

    setUploading(true)
    let completed = 0

    try {
      for (const file of files) {
        const result = await importVehicleRegistryFile(file)
        completed += 1
        notifications.show({
          color: result.AlreadyImported ? 'gray' : 'green',
          message: result.AlreadyImported
            ? t('Файл уже було імпортовано: {file}').replace('{file}', file.name)
            : t('Імпортовано {count} автомобілів із {file}')
                .replace('{count}', numberFormatter.format(result.AddedVehicles + result.UpdatedVehicles))
                .replace('{file}', file.name),
        })
      }
      setView('imports')
      setPage(1)
      reload()
    } catch (uploadError) {
      notifications.show({
        color: 'red',
        message: `${t('Не вдалося імпортувати файли')} (${completed}/${files.length}): ${errorMessage(uploadError, '')}`,
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Stack className="vehicle-registry-page console-table-page" gap={6}>
      <div className="console-table-shell vehicle-registry-shell">
        <div className="pill-tabs vehicle-registry-tabs" role="tablist" aria-label={t('Розділи реєстру')}>
          <button
            className={`pill-tab${view === 'vehicles' ? ' is-active' : ''}`}
            role="tab"
            type="button"
            onClick={() => changeView('vehicles')}
          >
            {t('Автомобілі')} · {numberFormatter.format(summary.Total)}
          </button>
          <button
            className={`pill-tab${view === 'imports' ? ' is-active' : ''}`}
            role="tab"
            type="button"
            onClick={() => changeView('imports')}
          >
            {t('Імпорти')} · {importTotal === null ? '…' : numberFormatter.format(importTotal)}
          </button>
        </div>

        <RegistrySummary summary={summary} />

        {view === 'vehicles' ? (
          <div className="app-filter-bar vehicle-registry-filter-bar">
            <TextInput
              className="vehicle-registry-search"
              label={t('Пошук')}
              leftSection={<Search size={15} />}
              placeholder={t('VIN, номер, власник, модель')}
              value={searchDraft}
              onChange={(event) => {
                setPage(1)
                setSearchDraft(event.currentTarget.value)
              }}
            />
            <Select
              searchable
              clearable
              data={filters.Brands}
              label={t('Марка')}
              placeholder={t('Всі')}
              value={brand}
              onChange={(value) => {
                setPage(1)
                setBrand(value)
                setModel(null)
              }}
            />
            <Select
              searchable
              clearable
              data={filters.Models}
              label={t('Модель')}
              placeholder={t('Всі')}
              value={model}
              onChange={(value) => {
                setPage(1)
                setModel(value)
              }}
            />
            <Select
              clearable
              data={clientMatchOptions(t)}
              label={t('Клієнт у GBA')}
              placeholder={t('Усі · збіги зверху')}
              value={clientMatchState}
              onChange={(value) => {
                setPage(1)
                setClientMatchState(value as VehicleRegistryClientMatchState | null)
              }}
            />
            <Select
              clearable
              data={processingOptions(t)}
              label={t('Обробка')}
              placeholder={t('Всі')}
              value={processingState}
              onChange={(value) => {
                setPage(1)
                setProcessingState(value as VehicleRegistryProcessingState | null)
              }}
            />
            <Select
              clearable
              data={workflowOptions(t)}
              label={t('Статус')}
              placeholder={t('Всі')}
              value={workflowStatus}
              onChange={(value) => {
                setPage(1)
                setWorkflowStatus(value as VehicleRegistryWorkflowStatus | null)
              }}
            />
            <Select
              clearable
              data={qualityOptions(t)}
              label={t('Якість')}
              placeholder={t('Всі')}
              value={qualityStatus}
              onChange={(value) => {
                setPage(1)
                setQualityStatus(value as VehicleRegistryDataQualityStatus | null)
              }}
            />
            <div className="app-filter-actions">
              <Tooltip label={t('Скинути фільтри')}>
                <ActionIcon
                  aria-label={t('Скинути фільтри')}
                  color="gray"
                  disabled={!searchDraft.trim() && activeFilterCount === 0}
                  size={34}
                  variant="light"
                  onClick={resetFilters}
                >
                  <RotateCcw size={17} />
                </ActionIcon>
              </Tooltip>
              <Paginator
                isLoading={isLoading}
                page={page}
                pageSize={PAGE_SIZE}
                pageSizeOptions={[String(PAGE_SIZE)]}
                totalPages={totalPages}
                onPageChange={setPage}
                onPageSizeChange={() => undefined}
                onRefresh={reload}
              />
            </div>
            <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
            <RegistryImportButton isUploading={isUploading} onFiles={handleFiles} />
          </div>
        ) : (
          <div className="app-filter-bar vehicle-registry-import-bar">
            <div className="vehicle-registry-import-copy">
              <Text fw={650} size="sm">{t('Історія завантажень')}</Text>
              <Text c="dimmed" size="xs">{t('Відкрийте імпорт, щоб переглянути помилки та попередження')}</Text>
            </div>
            <div className="app-filter-actions">
              <Paginator
                isLoading={isLoading}
                page={page}
                pageSize={PAGE_SIZE}
                pageSizeOptions={[String(PAGE_SIZE)]}
                totalPages={totalPages}
                onPageChange={setPage}
                onPageSizeChange={() => undefined}
                onRefresh={reload}
              />
            </div>
            <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
            <RegistryImportButton isUploading={isUploading} onFiles={handleFiles} />
          </div>
        )}

        {error && (
          <Alert className="console-table-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="console-table-body vehicle-registry-table-body">
          {view === 'vehicles' ? (
            <DataTable
              columns={vehicleColumns}
              data={vehicles}
              defaultLayout={VEHICLE_TABLE_LAYOUT}
              distributeAvailableWidth
              emptyText={t('За цими умовами автомобілів не знайдено')}
              getRowId={(vehicle) => vehicle.NetUid}
              height="100%"
              isLoading={isLoading}
              layoutVersion="vehicle-registry-3"
              loadingText={t('Завантаження автомобілів')}
              minWidth={1500}
              showLayoutControls
              tableId="vehicle-registry"
              toolbarPortalTarget={tableToolbarSlot}
              onRowClick={(vehicle) => setSelectedVehicleId(vehicle.NetUid)}
            />
          ) : (
            <DataTable
              columns={importColumns}
              data={imports}
              defaultLayout={IMPORT_TABLE_LAYOUT}
              distributeAvailableWidth
              emptyText={t('Імпортів ще немає')}
              getRowId={(item) => item.NetUid}
              height="100%"
              isLoading={isLoading}
              layoutVersion="vehicle-registry-imports-1"
              loadingText={t('Завантаження імпортів')}
              minWidth={1120}
              showLayoutControls
              tableId="vehicle-registry-imports"
              toolbarPortalTarget={tableToolbarSlot}
              onRowClick={setSelectedImport}
            />
          )}
        </div>
      </div>

      <VehicleDetailDrawer
        netUid={selectedVehicleId}
        onClose={() => setSelectedVehicleId(null)}
        onUpdated={() => {
          reload()
          setSelectedVehicleId(null)
        }}
      />
      <ImportIssuesDrawer item={selectedImport} onClose={() => setSelectedImport(null)} />
    </Stack>
  )
}

function RegistrySummary({ summary }: { summary: VehicleRegistrySummary }) {
  const { t } = useI18n()
  const problemCount =
    (summary.DataQualityCounts.invalid || 0) +
    (summary.DataQualityCounts.warning || 0) +
    (summary.DataQualityCounts.duplicate || 0)

  return (
    <div className="vehicle-registry-summary">
      <SummaryMetric label={t('У реєстрі')} value={summary.Total} />
      <SummaryMetric label={t('Очікують обробки')} value={summary.Pending} tone="orange" />
      <SummaryMetric label={t('Оброблено')} value={summary.Processed} tone="green" />
      <SummaryMetric
        label={t('З попередженнями в даних')}
        value={problemCount}
        tone={problemCount ? 'red' : undefined}
      />
      <SummaryMetric label={t('Марок')} value={summary.Brands} />
      <div className="vehicle-registry-summary__latest">
        <span>{t('Останнє оновлення')}</span>
        <strong>{summary.LatestImport ? formatDate(summary.LatestImport.CompletedAtUtc || summary.LatestImport.CreatedAtUtc) : '—'}</strong>
        <small>{summary.LatestImport?.OriginalFileName || t('Даних ще немає')}</small>
      </div>
    </div>
  )
}

function SummaryMetric({
  label,
  tone,
  value,
}: {
  label: string
  tone?: 'green' | 'orange' | 'red'
  value: number
}) {
  return (
    <div className={`vehicle-registry-summary__metric${tone ? ` is-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{numberFormatter.format(value)}</strong>
    </div>
  )
}

function RegistryImportButton({
  isUploading,
  onFiles,
}: {
  isUploading: boolean
  onFiles: (files: File[]) => void
}) {
  const { t } = useI18n()

  return (
    <FileButton accept=".xlsx,.xls" multiple onChange={(files) => void onFiles(files)}>
      {(props) => (
        <Button
          {...props}
          color={CREATE_ACTION_COLOR}
          leftSection={<ExcelIcon size={18} />}
          loading={isUploading}
          size="sm"
        >
          {t('Імпортувати')}
        </Button>
      )}
    </FileButton>
  )
}

function VehicleDetailDrawer({
  netUid,
  onClose,
  onUpdated,
}: {
  netUid: string | null
  onClose: () => void
  onUpdated: () => void
}) {
  const { t } = useI18n()
  const [detail, setDetail] = useState<VehicleRegistryVehicleDetail | null>(null)
  const [status, setStatus] = useState<VehicleRegistryWorkflowStatus>('new')
  const [selectedClientNetUid, setSelectedClientNetUid] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [isLoading, setLoading] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!netUid) {
      return
    }

    const controller = new AbortController()

    async function loadDetail() {
      setLoading(true)
      setError(null)
      setDetail(null)

      try {
        const nextDetail = await getVehicleRegistryVehicle(netUid!, controller.signal)
        setDetail(nextDetail)
        setStatus(nextDetail.WorkflowStatus)
        setSelectedClientNetUid(nextDetail.MatchedClientNetUid || null)
        setNote(nextDetail.Note || '')
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError(errorMessage(loadError, t('Не вдалося завантажити автомобіль')))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadDetail()

    return () => controller.abort()
  }, [netUid, t])

  async function saveWorkflow() {
    if (!netUid) {
      return
    }

    setSaving(true)

    try {
      await updateVehicleRegistryWorkflow(netUid, {
        assignedUserNetUid: detail?.AssignedUserNetUid,
        matchedClientNetUid: selectedClientNetUid,
        note,
        status,
      })
      notifications.show({ color: 'green', message: t('Статус автомобіля оновлено') })
      onUpdated()
    } catch (saveError) {
      setError(errorMessage(saveError, t('Не вдалося оновити статус')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppDrawer
      footer={
        detail ? (
          <Group justify="space-between" wrap="nowrap">
            <Button color="gray" variant="subtle" onClick={onClose}>{t('Закрити')}</Button>
            <Button color={CREATE_ACTION_COLOR} loading={isSaving} onClick={() => void saveWorkflow()}>
              {t('Зберегти')}
            </Button>
          </Group>
        ) : undefined
      }
      opened={Boolean(netUid)}
      size="standard"
      title={<span className="vehicle-registry-drawer-title">{t('Картка автомобіля')}</span>}
      onClose={onClose}
    >
      {isLoading && !detail ? (
        <div className="vehicle-registry-drawer-loading"><Loader color="orange" size="sm" /></div>
      ) : (
        <Stack gap="md">
          {error && <Alert color="red" icon={<CircleAlert size={18} />} variant="light">{error}</Alert>}
          {detail && (
            <>
              <div className="app-detail-hero">
                <div>
                  <span className="app-detail-eyebrow">{detail.Brand || t('Автомобіль')}</span>
                  <div className="app-detail-title">
                    <strong>{detail.Model || t('Модель не вказана')}</strong>
                    <span>{[detail.PlateNumber, detail.Vin].filter(Boolean).join(' · ') || '—'}</span>
                  </div>
                  <div className="app-detail-badges">
                    <WorkflowBadge status={detail.WorkflowStatus} />
                    <QualityBadge status={detail.DataQualityStatus} />
                    {!detail.IsCurrent && <Badge className="app-role-pill is-gray">{t('Не в поточному зрізі')}</Badge>}
                  </div>
                </div>
                <div className="app-detail-hero__side">
                  <div className="app-detail-metrics">
                    <div className="app-detail-metric">
                      <span>{t('Рік')}</span>
                      <strong>{detail.ManufactureYear || '—'}</strong>
                    </div>
                    <div className="app-detail-metric">
                      <span>{t('Двигун')}</span>
                      <strong>{formatEngine(detail.EngineVolumeCc)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <section>
                <div className="app-detail-section-head">
                  <Text fw={650}>{t('Дані реєстру')}</Text>
                </div>
                <div className="vehicle-registry-leaders">
                  <LeaderRow label={t('Власник')} value={detail.OwnerName} />
                  <LeaderRow label={t('Адреса')} value={detail.Address} />
                  <LeaderRow label={t('Регіон')} value={detail.Region} />
                  <LeaderRow label={t('Держ. номер')} mono value={detail.PlateNumber} />
                  <LeaderRow label="VIN" mono value={detail.Vin} />
                  <LeaderRow label={t('Джерело')} value={`${detail.ImportFileName} · ${detail.SourceSheet} · ${t('рядок')} ${detail.SourceRow}`} />
                  <LeaderRow label={t('Вперше в реєстрі')} mono value={formatDate(detail.FirstSeenAtUtc)} />
                  <LeaderRow label={t('Остання поява')} mono value={formatDate(detail.LastSeenAtUtc)} />
                </div>
              </section>

              <ClientMatchSection
                matches={detail.ClientMatches || []}
                selectedClientNetUid={selectedClientNetUid}
                onSelect={(clientNetUid) => {
                  setSelectedClientNetUid(clientNetUid)
                  if (clientNetUid) {
                    setStatus('client_matched')
                  } else if (status === 'client_matched') {
                    setStatus('in_progress')
                  }
                }}
              />

              <section className="vehicle-registry-workflow">
                <div className="app-detail-section-head">
                  <Text fw={650}>{t('Обробка')}</Text>
                </div>
                <Select
                  allowDeselect={false}
                  data={workflowOptions(t)}
                  label={t('Статус')}
                  value={status}
                  onChange={(value) => setStatus((value || 'new') as VehicleRegistryWorkflowStatus)}
                />
                <Textarea
                  autosize
                  label={t('Коментар')}
                  maxLength={2000}
                  minRows={3}
                  placeholder={t('Результат перевірки або наступна дія')}
                  value={note}
                  onChange={(event) => setNote(event.currentTarget.value)}
                />
              </section>

              <section>
                <div className="app-detail-section-head">
                  <Group gap={7}>
                    <History size={16} />
                    <Text fw={650}>{t('Історія обробки')}</Text>
                  </Group>
                </div>
                {detail.Events.length ? (
                  <div className="vehicle-registry-history">
                    {detail.Events.map((event) => (
                      <div className="vehicle-registry-history__item" key={event.NetUid}>
                        <span>{formatDate(event.CreatedAtUtc)}</span>
                        <strong>{workflowLabel(event.ToStatus, t)}</strong>
                        {event.Note && <Text c="dimmed" size="xs">{event.Note}</Text>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text c="dimmed" size="sm">{t('Змін статусу ще не було')}</Text>
                )}
              </section>
            </>
          )}
        </Stack>
      )}
    </AppDrawer>
  )
}

function ClientMatchSection({
  matches,
  onSelect,
  selectedClientNetUid,
}: {
  matches: VehicleRegistryClientMatch[]
  onSelect: (clientNetUid: string | null) => void
  selectedClientNetUid: string | null
}) {
  const { t } = useI18n()

  return (
    <section className="vehicle-registry-client-matches">
      <div className="app-detail-section-head">
        <Group gap={7}>
          <UserRoundSearch size={17} />
          <Text fw={650}>{t('Звірка з клієнтами GBA')}</Text>
          {matches.length > 0 && (
            <Badge className="app-role-pill is-gray" size="xs">
              {t('{count} варіантів').replace('{count}', String(matches.length))}
            </Badge>
          )}
        </Group>
      </div>
      <Text c="dimmed" size="xs">
        {t('Система порівнює ПІБ або назву, адресу та регіон. Підказку потрібно перевірити перед прив’язкою.')}
      </Text>

      {matches.length ? (
        <div className="vehicle-registry-client-match-list">
          {matches.map((match) => {
            const isSelected = selectedClientNetUid === match.ClientNetUid

            return (
              <article
                className={`vehicle-registry-client-match${isSelected ? ' is-selected' : ''}`}
                key={match.ClientNetUid}
              >
                <div className="vehicle-registry-client-match__copy">
                  <div className="vehicle-registry-client-match__title">
                    <strong title={match.Name}>{match.Name}</strong>
                    <ClientMatchBadge match={match} />
                  </div>
                  <div className="vehicle-registry-client-match__meta">
                    {match.ClientNumber && (
                      <span className="vehicle-registry-mono">
                        {t('Код клієнта')} · {match.ClientNumber}
                      </span>
                    )}
                    {match.Address && <span title={match.Address}>{match.Address}</span>}
                  </div>
                  {match.Reasons.length > 0 && (
                    <div className="vehicle-registry-client-match__reasons">
                      {match.Reasons.map((reason) => (
                        <Badge className="app-role-pill is-gray" key={reason} size="xs">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  color={isSelected ? 'green' : CREATE_ACTION_COLOR}
                  leftSection={<Link2 size={14} />}
                  size="xs"
                  variant={isSelected ? 'light' : 'outline'}
                  onClick={() => onSelect(isSelected ? null : match.ClientNetUid)}
                >
                  {isSelected ? t('Вибрано') : t('Прив’язати')}
                </Button>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="vehicle-registry-client-match-empty">
          <UserRoundSearch size={20} />
          <span>
            <strong>{t('Надійних збігів не знайдено')}</strong>
            <small>{t('Автомобіль можна обробити без прив’язки до клієнта')}</small>
          </span>
        </div>
      )}
    </section>
  )
}

function ImportIssuesDrawer({
  item,
  onClose,
}: {
  item: VehicleRegistryImport | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const [issues, setIssues] = useState<VehicleRegistryIssue[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const columns = useMemo(() => createIssueColumns(t), [t])

  useEffect(() => {
    if (!item) {
      return
    }

    const controller = new AbortController()

    async function loadIssues() {
      setLoading(true)
      setError(null)
      setIssues([])
      setTotal(0)

      try {
        const response = await getVehicleRegistryImportIssues(item!.NetUid, 200, 0, controller.signal)
        setIssues(response?.Items || [])
        setTotal(response?.Total || 0)
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError(errorMessage(loadError, t('Не вдалося завантажити помилки імпорту')))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadIssues()

    return () => controller.abort()
  }, [item, t])

  return (
    <AppDrawer
      opened={Boolean(item)}
      size="standard"
      title={<span className="vehicle-registry-drawer-title">{t('Перевірка імпорту')}</span>}
      onClose={onClose}
    >
      {item && (
        <Stack gap="md">
          <div className="app-detail-hero">
            <div>
              <span className="app-detail-eyebrow">{item.Brand || t('Імпорт')}</span>
              <div className="app-detail-title">
                <strong>{item.OriginalFileName}</strong>
                <span>{formatDate(item.CompletedAtUtc || item.CreatedAtUtc)}</span>
              </div>
              <div className="app-detail-badges">
                <ImportStatusBadge status={item.Status} />
              </div>
            </div>
            <div className="app-detail-hero__side">
              <div className="app-detail-metrics">
                <div className="app-detail-metric">
                  <span>{t('Рядків')}</span>
                  <strong>{numberFormatter.format(item.TotalRows)}</strong>
                </div>
                <div className="app-detail-metric">
                  <span>{t('Проблем')}</span>
                  <strong>{numberFormatter.format(total)}</strong>
                </div>
              </div>
            </div>
          </div>

          {error && <Alert color="red" icon={<CircleAlert size={18} />} variant="light">{error}</Alert>}
          <div className="vehicle-registry-issue-table">
            <DataTable
              columns={columns}
              data={issues}
              defaultLayout={ISSUE_TABLE_LAYOUT}
              distributeAvailableWidth
              emptyText={t('Помилок і попереджень немає')}
              getRowId={(issue) => issue.NetUid}
              height="100%"
              isLoading={isLoading}
              layoutVersion="vehicle-registry-issues-1"
              minWidth={900}
              showLayoutControls={false}
              tableId="vehicle-registry-issues"
            />
          </div>
          {total > issues.length && (
            <Text c="dimmed" size="xs">
              {t('Показано перші {count} проблем').replace('{count}', String(issues.length))}
            </Text>
          )}
        </Stack>
      )}
    </AppDrawer>
  )
}

function createVehicleColumns(
  t: (value: string) => string,
  open: (netUid: string) => void,
): DataTableColumn<VehicleRegistryVehicle>[] {
  return [
    {
      cell: (item) => (
        <div className="vehicle-registry-vehicle-cell">
          <div className="vehicle-registry-vehicle-main">
            {item.Brand && <Badge className="app-role-pill" size="xs">{item.Brand}</Badge>}
            <strong title={item.Model || undefined}>{item.Model || ''}</strong>
          </div>
          <div className="vehicle-registry-data-pills">
            {item.PlateNumber && (
              <span className="vehicle-registry-data-pill is-plate" title={`${t('Держ. номер')}: ${item.PlateNumber}`}>
                {item.PlateNumber}
              </span>
            )}
            {item.Vin && (
              <span className="vehicle-registry-data-pill is-vin" title={`VIN: ${item.Vin}`}>
                <span>VIN</span>{item.Vin}
              </span>
            )}
          </div>
        </div>
      ),
      fill: true,
      header: t('Автомобіль'),
      id: 'vehicle',
      minWidth: 300,
      width: 360,
    },
    {
      cell: (item) => (
        <span className="vehicle-registry-two-line">
          <strong title={item.OwnerName || undefined}>{item.OwnerName || ''}</strong>
          <small title={item.Address || undefined}>{item.Address || ''}</small>
        </span>
      ),
      fill: true,
      header: t('Власник'),
      id: 'owner',
      minWidth: 280,
      width: 360,
    },
    {
      cell: (item) => {
        const match = item.SuggestedClientMatch
        if (!match) {
          return null
        }

        return (
          <span className="vehicle-registry-client-cell">
            <strong title={match.Name}>{match.Name}</strong>
            <span>
              <ClientMatchBadge match={match} />
              {item.ClientMatchCount > 1 && (
                <small>+{item.ClientMatchCount - 1}</small>
              )}
            </span>
          </span>
        )
      },
      fill: true,
      header: t('Клієнт у GBA'),
      id: 'client',
      minWidth: 220,
      width: 280,
    },
    {
      align: 'right',
      cell: (item) => (
        <span className="vehicle-registry-two-line is-right">
          <strong className="vehicle-registry-mono">
            {item.ManufactureYear ? `${item.ManufactureYear} р.` : ''}
          </strong>
          <small className="vehicle-registry-mono">
            {item.EngineVolumeCc ? formatEngine(item.EngineVolumeCc) : ''}
          </small>
        </span>
      ),
      header: t('Рік / двигун'),
      id: 'year',
      width: 120,
    },
    {
      cell: (item) => item.Region
        ? <Badge className="app-role-pill is-gray" size="xs">{item.Region}</Badge>
        : null,
      header: t('Регіон'),
      id: 'region',
      width: 160,
    },
    {
      cell: (item) => <WorkflowBadge status={item.WorkflowStatus} />,
      header: t('Обробка'),
      id: 'workflow',
      width: 150,
    },
    {
      cell: (item) => <QualityBadge status={item.DataQualityStatus} />,
      header: t('Якість'),
      id: 'quality',
      width: 130,
    },
    {
      cell: (item) => (
        <span className="vehicle-registry-two-line">
          <strong title={item.ImportFileName}>{item.ImportFileName}</strong>
          <small className="vehicle-registry-mono">{formatDate(item.LastSeenAtUtc)}</small>
        </span>
      ),
      header: t('Джерело'),
      id: 'source',
      minWidth: 180,
      width: 220,
    },
    {
      align: 'center',
      cell: (item) => (
        <TableRowAction
          action="view"
          label={t('Відкрити')}
          onClick={() => open(item.NetUid)}
        />
      ),
      enableHiding: false,
      enablePinning: false,
      enableReorder: false,
      enableResizing: false,
      header: '',
      id: 'actions',
      rowActions: true,
      width: 50,
    },
  ]
}

function ClientMatchBadge({
  match,
}: {
  match: VehicleRegistryClientMatch
}) {
  const { t } = useI18n()
  const label = match.IsConfirmed || match.Confidence === 'confirmed'
    ? t('Підтверджено')
    : match.Confidence === 'exact'
      ? t('Сильний збіг')
      : match.Confidence === 'high'
        ? t('Ймовірний збіг')
        : t('Можливий збіг')
  const className = match.IsConfirmed || match.Confidence === 'confirmed'
    ? 'is-green'
    : match.Confidence === 'high' || match.Confidence === 'exact'
      ? 'is-orange'
      : 'is-yellow'

  return (
    <Badge
      className={`app-role-pill ${className}`}
      size="xs"
      title={`${label}: ${match.Score}%`}
    >
      {label} · {match.Score}%
    </Badge>
  )
}

function createImportColumns(
  t: (value: string) => string,
  open: (item: VehicleRegistryImport) => void,
): DataTableColumn<VehicleRegistryImport>[] {
  return [
    {
      cell: (item) => (
        <div className="console-table-entity-cell">
          <span className="console-table-entity-marker"><ExcelIcon size={18} /></span>
          <span className="console-table-entity-copy">
            <span className="console-table-entity-title">{item.OriginalFileName}</span>
            <span className="console-table-entity-subtitle">{item.Brand || '—'}</span>
          </span>
        </div>
      ),
      fill: true,
      header: t('Файл'),
      id: 'file',
      minWidth: 260,
      width: 330,
    },
    {
      cell: (item) => <ImportStatusBadge status={item.Status} />,
      header: t('Статус'),
      id: 'status',
      width: 130,
    },
    {
      align: 'right',
      cell: (item) => <span className="vehicle-registry-mono">{numberFormatter.format(item.TotalRows)}</span>,
      header: t('Рядків'),
      id: 'rows',
      width: 100,
    },
    {
      cell: (item) => (
        <div className="vehicle-registry-stat-pills">
          <RegistryStatPill label={t('Коректні')} tone="green" value={item.ValidRows} />
          <RegistryStatPill label={t('Попередж.')} tone="yellow" value={item.WarningRows} />
          <RegistryStatPill label={t('Помилки')} tone="red" value={item.InvalidRows} />
        </div>
      ),
      header: t('Якість'),
      id: 'quality',
      minWidth: 250,
      width: 290,
    },
    {
      cell: (item) => (
        <div className="vehicle-registry-stat-pills">
          <RegistryStatPill label={t('Додано')} tone="green" value={item.AddedVehicles} />
          <RegistryStatPill label={t('Оновлено')} tone="orange" value={item.UpdatedVehicles} />
          <RegistryStatPill label={t('Без змін')} tone="gray" value={item.UnchangedVehicles} />
          <RegistryStatPill label={t('Дублі')} tone="yellow" value={item.DuplicateRows} />
        </div>
      ),
      header: t('Результат'),
      id: 'changes',
      minWidth: 250,
      width: 290,
    },
    {
      cell: (item) => <span className="vehicle-registry-mono">{formatDate(item.CompletedAtUtc || item.CreatedAtUtc)}</span>,
      header: t('Дата'),
      id: 'date',
      width: 150,
    },
    {
      align: 'center',
      cell: (item) => (
        <TableRowAction
          action="view"
          label={t('Переглянути проблеми')}
          onClick={() => open(item)}
        />
      ),
      enableHiding: false,
      enablePinning: false,
      enableReorder: false,
      enableResizing: false,
      header: '',
      id: 'actions',
      rowActions: true,
      width: 50,
    },
  ]
}

function createIssueColumns(t: (value: string) => string): DataTableColumn<VehicleRegistryIssue>[] {
  return [
    {
      align: 'right',
      cell: (item) => <span className="vehicle-registry-mono">{item.SourceRow}</span>,
      header: t('Рядок'),
      id: 'row',
      width: 80,
    },
    {
      cell: (item) => (
        <Badge className={`app-role-pill ${item.Severity === 'error' ? 'is-red' : 'is-yellow'}`}>
          {item.Severity === 'error' ? t('Помилка') : t('Попередження')}
        </Badge>
      ),
      header: t('Рівень'),
      id: 'severity',
      width: 130,
    },
    {
      cell: (item) => (
        <span className="vehicle-registry-two-line">
          <strong>{[item.Brand, item.Model].filter(Boolean).join(' ') || '—'}</strong>
          <small className="vehicle-registry-mono">{item.PlateNumber || item.Vin || '—'}</small>
        </span>
      ),
      header: t('Автомобіль'),
      id: 'vehicle',
      minWidth: 200,
      width: 230,
    },
    {
      cell: (item) => <span className="vehicle-registry-mono">{item.Field || item.Code}</span>,
      header: t('Поле'),
      id: 'field',
      width: 150,
    },
    {
      cell: (item) => item.Message,
      fill: true,
      header: t('Опис'),
      id: 'message',
      minWidth: 320,
      width: 420,
    },
  ]
}

function WorkflowBadge({ status }: { status: VehicleRegistryWorkflowStatus }) {
  const { t } = useI18n()
  const className = status === 'new'
    ? 'is-gray'
    : status === 'in_progress'
      ? 'is-orange'
      : status === 'ignored'
        ? 'is-red'
        : 'is-green'

  return <Badge className={`app-role-pill ${className}`}>{workflowLabel(status, t)}</Badge>
}

function QualityBadge({ status }: { status: VehicleRegistryDataQualityStatus }) {
  const { t } = useI18n()
  const labels: Record<VehicleRegistryDataQualityStatus, string> = {
    duplicate: t('Дублікат'),
    invalid: t('Помилка'),
    valid: t('Коректно'),
    warning: t('Попередження'),
  }
  const className = status === 'valid'
    ? 'is-green'
    : status === 'invalid'
      ? 'is-red'
      : 'is-yellow'

  return <Badge className={`app-role-pill ${className}`}>{labels[status] || status}</Badge>
}

function RegistryStatPill({
  label,
  tone,
  value,
}: {
  label: string
  tone: 'gray' | 'green' | 'orange' | 'red' | 'yellow'
  value: number
}) {
  if (!value) {
    return null
  }

  return (
    <Badge className={`app-role-pill is-${tone}`} size="xs" title={`${label}: ${numberFormatter.format(value)}`}>
      {label} · {numberFormatter.format(value)}
    </Badge>
  )
}

function ImportStatusBadge({ status }: { status: VehicleRegistryImport['Status'] }) {
  const { t } = useI18n()
  const label = status === 'completed' ? t('Завершено') : status === 'failed' ? t('Помилка') : t('Обробка')
  const className = status === 'completed' ? 'is-green' : status === 'failed' ? 'is-red' : 'is-orange'

  return <Badge className={`app-role-pill ${className}`}>{label}</Badge>
}

function LeaderRow({
  label,
  mono = false,
  value,
}: {
  label: string
  mono?: boolean
  value?: string | number | null
}) {
  return (
    <span className="app-leader-row">
      <span className="app-leader-row-label">{label}</span>
      <span className={`app-leader-row-value${mono ? ' is-mono' : ''}`}>{value || '—'}</span>
    </span>
  )
}

function processingOptions(t: (value: string) => string) {
  return [
    { label: t('Необроблені'), value: 'pending' },
    { label: t('Оброблені'), value: 'processed' },
  ]
}

function workflowOptions(t: (value: string) => string) {
  return [
    { label: t('Не оброблено'), value: 'new' },
    { label: t('В роботі'), value: 'in_progress' },
    { label: t('Перевірено'), value: 'verified' },
    { label: t('Клієнта знайдено'), value: 'client_matched' },
    { label: t('Лід'), value: 'lead' },
    { label: t('Неактуально'), value: 'ignored' },
  ]
}

function qualityOptions(t: (value: string) => string) {
  return [
    { label: t('Коректно'), value: 'valid' },
    { label: t('Попередження'), value: 'warning' },
    { label: t('Помилка'), value: 'invalid' },
    { label: t('Дублікат'), value: 'duplicate' },
  ]
}

function clientMatchOptions(t: (value: string) => string) {
  return [
    { label: t('Є збіг'), value: 'matched' },
    { label: t('Без збігу'), value: 'unmatched' },
  ]
}

function workflowLabel(status: VehicleRegistryWorkflowStatus, t: (value: string) => string) {
  return workflowOptions(t).find((option) => option.value === status)?.label || status
}

function formatDate(value?: string | null) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

function formatEngine(value?: number | null) {
  if (!value) {
    return '—'
  }

  return value >= 1000
    ? `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1 }).format(value / 1000)} л`
    : `${numberFormatter.format(value)} см³`
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}
