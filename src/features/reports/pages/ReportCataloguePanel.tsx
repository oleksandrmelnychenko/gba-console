import { ActionIcon, Alert, Badge, Button, Group, Loader, Pagination, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { ArrowRight, ChevronRight, RotateCcw, Search } from 'lucide-react'
import { DocumentDetailMetric, DocumentDetailSummary } from '../../../shared/ui/document-detail/DocumentDetail'
import './report-catalogue.css'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useAuth } from '../../auth/useAuth'
import { getReportCatalogue, getReportDatasets } from '../api/reportWorkspaceApi'
import { catalogueLaunchOptions, type CatalogueLaunchChoice } from '../data/reportCatalogueLaunch'
import { CAPTURE_STATUS_LABELS, DEPENDENCY_STATUS_LABELS, filterMigrationCatalogue, inspectCatalogueMigration, MIGRATION_STATUS_LABELS, sourceIdentity, type MigrationDisplayStatus } from '../data/reportMigration'
import type { ReportCatalogue, ReportCatalogueEntry, ReportDataset, ReportSourceMigration } from '../types'
import { isDebtToSalesRatioCatalogueEntry, type DebtToSalesRatioCapabilities } from '../data/debtToSalesRatio'
import { DebtToSalesRatioCatalogueLaunch } from './DebtToSalesRatioCatalogueLaunch'
import { isCollectionCoefficientCatalogueEntry, type CollectionCoefficientCapabilities } from '../data/collectionCoefficient'
import { CollectionCoefficientCatalogueLaunch } from './CollectionCoefficientCatalogueLaunch'
import { isSalesMarginCatalogueEntry, type SalesMarginCapabilities } from '../data/salesMargin'
import { SalesMarginCatalogueLaunch } from './SalesMarginCatalogueLaunch'
import { cashMovementCatalogueKind, type CashMovementCapabilities } from '../data/cashMovement'
import { CashMovementCatalogueLaunch } from './CashMovementCatalogueLaunch'
import { isSupplierDebtCatalogueEntry, type SupplierDebtCapabilities } from '../data/supplierDebt'
import { SupplierDebtCatalogueLaunch } from './SupplierDebtCatalogueLaunch'
import { isEmployeeGrossProfitCatalogueEntry, type EmployeeGrossProfitCapabilities } from '../data/employeeGrossProfit'
import { EmployeeGrossProfitCatalogueLaunch } from './EmployeeGrossProfitCatalogueLaunch'
import { isOverdueReceivablesCatalogueEntry, type OverdueReceivablesCapabilities } from '../data/overdueReceivables'
import { OverdueReceivablesCatalogueLaunch } from './OverdueReceivablesCatalogueLaunch'
import { isManagementReturnsCatalogueEntry, type ManagementReturnsCapabilities } from '../data/managementReturns'
import { ManagementReturnsCatalogueLaunch } from './ManagementReturnsCatalogueLaunch'
import { managementBalanceCatalogueKind, type ManagementBalanceCapabilities } from '../data/managementBalance'
import { ManagementBalanceCatalogueLaunch } from './ManagementBalanceCatalogueLaunch'
import type { ManagementOrdersCapabilities } from '../data/managementOrders'
import { ManagementOrdersCatalogueLaunch } from './ManagementOrdersCatalogueLaunch'
import type { DefectProductionCapabilities } from '../data/defectProduction'
import { DefectProductionCatalogueLaunch } from './DefectProductionCatalogueLaunch'
import type { InventoryTurnoverCapabilities } from '../data/inventoryTurnover'
import { InventoryTurnoverCatalogueLaunch } from './InventoryTurnoverCatalogueLaunch'
import type { CurrentLiquidityCapabilities } from '../data/currentLiquidity'
import { CurrentLiquidityCatalogueLaunch } from './CurrentLiquidityCatalogueLaunch'
import type { PlannedCashCapabilities } from '../data/plannedCash'
import { PlannedCashCatalogueLaunch } from './PlannedCashCatalogueLaunch'
import { isActiveClientsCatalogueEntry, type ActiveClientsCapabilities } from '../data/activeClients'
import { ActiveClientsCatalogueLaunch } from './ActiveClientsCatalogueLaunch'
import { isCurrencyRateDynamicsCatalogueEntry, type CurrencyRateDynamicsCapabilities } from '../data/currencyRateDynamics'
import { CurrencyRateDynamicsCatalogueLaunch } from './CurrencyRateDynamicsCatalogueLaunch'
import { isCashAggregateBalanceCatalogueEntry, type CashAggregateBalanceCapabilities } from '../data/cashAggregateBalance'
import { CashAggregateBalanceCatalogueLaunch } from './CashAggregateBalanceCatalogueLaunch'
import { isOriginalRevenueCatalogueEntry, type OriginalRevenueCapabilities } from '../data/originalRevenue'
import { OriginalRevenueCatalogueLaunch } from './OriginalRevenueCatalogueLaunch'
import { OriginalWarehouseQuantityCatalogueLaunch } from './OriginalWarehouseQuantityCatalogueLaunch'
import { OriginalWarehouseMonetaryCatalogueLaunch } from './OriginalWarehouseMonetaryCatalogueLaunch'
import { OriginalTransferredGoodsCatalogueLaunch } from './OriginalTransferredGoodsCatalogueLaunch'
import { OriginalCounterpartyDebtCatalogueLaunch } from './OriginalCounterpartyDebtCatalogueLaunch'
import { OriginalCounterpartyStatementCatalogueLaunch } from './OriginalCounterpartyStatementCatalogueLaunch'
import { OriginalPriceTypeSalesCatalogueLaunch } from './OriginalPriceTypeSalesCatalogueLaunch'
import { OriginalSalesCatalogueLaunch } from './OriginalSalesCatalogueLaunch'
import { OriginalLotBalanceAnalysisCatalogueLaunch } from './OriginalLotBalanceAnalysisCatalogueLaunch'
import { OriginalWorkInProgressCatalogueLaunch } from './OriginalWorkInProgressCatalogueLaunch'
import { OriginalBuyerOrdersCatalogueLaunch } from './OriginalBuyerOrdersCatalogueLaunch'
import { OriginalPlannedCashCatalogueLaunch } from './OriginalPlannedCashCatalogueLaunch'
import { OriginalCashStatementCatalogueLaunch } from './OriginalCashStatementCatalogueLaunch'
import { OriginalCashMovementsCatalogueLaunch } from './OriginalCashMovementsCatalogueLaunch'
import { OriginalGoodsStockAnalysisCatalogueLaunch } from './OriginalGoodsStockAnalysisCatalogueLaunch'
import { OriginalDefectCostCatalogueLaunch } from './OriginalDefectCostCatalogueLaunch'
import { originalBuyerSalesShareCatalogueVariant, type OriginalBuyerSalesShareCapabilities } from '../data/originalBuyerSalesShare'
import { OriginalBuyerSalesShareCatalogueLaunch } from './OriginalBuyerSalesShareCatalogueLaunch'

const kindLabels: Record<string, string> = {
  builtin: 'Вбудовані', regulated: 'Регламентовані', external: 'Зовнішні',
  processing: 'Звітні обробки', custom: 'Довільні', indicator: 'Показники', builder: 'Конструктори',
}
const statusColors: Record<MigrationDisplayStatus, string> = { unassessed: 'gray', captured: 'gray', native_partial: 'yellow', parity_verified: 'green' }
const pageSize = 20
const worldLabel = (world: string) => world === 'fenix' ? 'Fenix' : world === 'amg' ? 'AMG' : world
type LaunchOption = ReturnType<typeof catalogueLaunchOptions>[number]
type OpenReport = (choice: CatalogueLaunchChoice, catalogue: ReportCatalogue) => boolean
type OpenDebtToSalesRatio = (capability: DebtToSalesRatioCapabilities) => boolean
type OpenCollectionCoefficient = (capability: CollectionCoefficientCapabilities) => boolean
type OpenSalesMargin = (capability: SalesMarginCapabilities) => boolean
type OpenCashMovement = (capability: CashMovementCapabilities) => boolean
type OpenSupplierDebt = (capability: SupplierDebtCapabilities) => boolean
type OpenEmployeeGrossProfit = (capability: EmployeeGrossProfitCapabilities) => boolean
type OpenOverdueReceivables = (capability: OverdueReceivablesCapabilities) => boolean
type OpenManagementReturns = (capability: ManagementReturnsCapabilities) => boolean
type OpenManagementBalance = (capability: ManagementBalanceCapabilities) => boolean
type OpenManagementOrders = (capability: ManagementOrdersCapabilities) => boolean
type OpenDefectProduction = (capability: DefectProductionCapabilities) => boolean
type OpenInventoryTurnover = (capability: InventoryTurnoverCapabilities) => boolean
type OpenPlannedCash = (capability: PlannedCashCapabilities) => boolean
type OpenCurrentLiquidity = (capability: CurrentLiquidityCapabilities) => boolean
type OpenActiveClients = (capability: ActiveClientsCapabilities) => boolean
type OpenCurrencyRateDynamics = (capability: CurrencyRateDynamicsCapabilities) => boolean
type OpenCashAggregateBalance = (capability: CashAggregateBalanceCapabilities) => boolean
type OpenOriginalRevenue = (capability: OriginalRevenueCapabilities) => boolean
type OpenOriginalBuyerSalesShare = (capability: OriginalBuyerSalesShareCapabilities) => boolean
type LoadScope = { attempt: number; canGenerate: boolean }
type CatalogueLoad = { scope: LoadScope; catalogue: ReportCatalogue | null; datasets: ReportDataset[] | null; error: boolean }

function useCatalogueLoad(canGenerate: boolean) {
  const [load, setLoad] = useState<CatalogueLoad | null>(null)
  const [attempt, setAttempt] = useState(0)
  const loadScope = useMemo(() => ({ attempt, canGenerate }), [attempt, canGenerate])
  useEffect(() => {
    const controller = new AbortController()
    Promise.allSettled([getReportCatalogue(controller.signal), loadScope.canGenerate ? getReportDatasets(controller.signal) : Promise.resolve(null)])
      .then(([inventory, capabilities]) => {
        if (controller.signal.aborted) return
        setLoad({ scope: loadScope, catalogue: inventory.status === 'fulfilled' ? inventory.value : null,
          datasets: capabilities.status === 'fulfilled' ? capabilities.value : null, error: inventory.status === 'rejected' })
      })
    return () => controller.abort()
  }, [loadScope])
  const currentLoad = load?.scope === loadScope ? load : null
  return { catalogue: currentLoad?.catalogue ?? null, datasets: currentLoad?.datasets ?? null,
    error: currentLoad?.error ?? false, retry: () => setAttempt(value => value + 1) }
}

export function ReportCataloguePanel({ onOpen, onOpenDebtToSalesRatio, onOpenCollectionCoefficient, onOpenSalesMargin, onOpenCashMovement, onOpenSupplierDebt, onOpenEmployeeGrossProfit, onOpenOverdueReceivables, onOpenManagementReturns, onOpenManagementBalance, onOpenManagementOrders, onOpenDefectProduction, onOpenInventoryTurnover, onOpenCurrentLiquidity, onOpenPlannedCash, callerKey = null, onOpenActiveClients, onOpenCurrencyRateDynamics, onOpenCashAggregateBalance, onOpenOriginalRevenue, onOpenOriginalBuyerSalesShare, disabled = false }: {
  onOpen?: OpenReport; onOpenDebtToSalesRatio?: OpenDebtToSalesRatio; onOpenCollectionCoefficient?: OpenCollectionCoefficient; onOpenSalesMargin?: OpenSalesMargin; onOpenCashMovement?: OpenCashMovement; onOpenSupplierDebt?: OpenSupplierDebt; onOpenEmployeeGrossProfit?: OpenEmployeeGrossProfit; onOpenOverdueReceivables?: OpenOverdueReceivables; onOpenManagementReturns?: OpenManagementReturns; onOpenManagementBalance?: OpenManagementBalance; onOpenManagementOrders?: OpenManagementOrders; onOpenDefectProduction?: OpenDefectProduction; onOpenInventoryTurnover?: OpenInventoryTurnover; onOpenCurrentLiquidity?: OpenCurrentLiquidity; onOpenPlannedCash?: OpenPlannedCash; callerKey?: string | null; onOpenActiveClients?: OpenActiveClients; onOpenCurrencyRateDynamics?: OpenCurrencyRateDynamics; onOpenCashAggregateBalance?: OpenCashAggregateBalance; onOpenOriginalRevenue?: OpenOriginalRevenue; onOpenOriginalBuyerSalesShare?: OpenOriginalBuyerSalesShare; disabled?: boolean
}) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const canGenerate = hasPermission(PermissionKeys.ReportsStocks.Report.Generate)
  const { catalogue, datasets, error, retry } = useCatalogueLoad(canGenerate)
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<string | null>(null)
  const [world, setWorld] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [dependency, setDependency] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const inspection = useMemo(() => catalogue ? inspectCatalogueMigration(catalogue) : null, [catalogue])
  const filtered = useMemo(() => catalogue && inspection ? filterMigrationCatalogue(catalogue, inspection, { kind, world, status, dependency, search }) : [],
    [catalogue, inspection, kind, world, status, dependency, search])
  const availableDatasets = canGenerate ? datasets : null
  const supportsLaunch = Boolean(onOpen)
  const visibleSourceCount = filtered.reduce((sum, item) => sum + item.matchingSources.length, 0)
  const visibleRows = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize).map(item => ({ ...item,
    options: supportsLaunch && catalogue && inspection?.valid && availableDatasets
      ? catalogueLaunchOptions(catalogue, item.report.Id, availableDatasets).filter(option => item.matchingSources.some(source =>
        source.World === option.choice.world && source.SourceId === option.choice.sourceId)) : [],
  })), [filtered, page, supportsLaunch, catalogue, inspection, availableDatasets])

  if (error) return <Alert color="red" title={t('Не вдалося завантажити каталог')}>
    <Button type="button" onClick={retry}>{t('Повторити')}</Button>
  </Alert>
  if (!catalogue || !inspection) return <Group><Loader size="sm" /><Text>{t('Завантаження каталогу звітів')}</Text></Group>
  const { summary } = inspection
  return <div className="report-catalogue">
    <Stack gap="md">
      <DocumentDetailSummary eyebrow={t('Звіти · Fenix / AMG')} title={t('Каталог звітів')}
        meta={t('Оберіть звіт, щоб переглянути покриття та доступні налаштування.')}
        metrics={<>
          <DocumentDetailMetric label={t('Звітів у каталозі')} value={String(summary.CatalogueEntries)} />
          <DocumentDetailMetric label={t('Джерельних реалізацій')} value={String(summary.SourceImplementations)} />
          <DocumentDetailMetric label={t('Перевірених позицій')} value={String(summary.FullyVerifiedEntries)} />
        </>} />
      {onOpen && <Text size="sm" c="dimmed" className="report-catalogue__intro">{t('Оберіть доступний варіант. Звіти конструктора формуються кнопкою «Сформувати»; Fenix «Валовая прибыль» відкривається в окремій панелі.')}</Text>}
      <details className="report-catalogue__overview">
        <summary><ChevronRight size={15} aria-hidden="true" />{t('Стан перенесення та джерела')}</summary>
        <Stack gap="sm" className="report-catalogue__overview-body">
      <Text size="sm" c="dimmed">{t(onOpen
        ? 'Оберіть звіт і доступний варіант розрахунку GBA. Відкриття перенесе готові налаштування в конструктор; звіт сформується лише після натискання «Сформувати». Межі покриття наведено у картці звіту.'
        : 'Перелік для перенесення з Fenix та AMG. Наявність у каталозі ще не означає, що розрахунок доступний у GBA. Готові налаштування доступних звітів розташовані в конструкторі.')}</Text>
      {onOpen ? <Text size="sm" c="dimmed">{t('Варіанти Fenix/AMG позначають походження звіту; розрахунок використовує доступні дані GBA.')}</Text> : null}
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
      <Text size="xs" c="dimmed">{t('Типи подання у вихідних конфігураціях; це не перелік готових подань GBA.')}</Text>
      <Group aria-label={t('Типи подання 1С')}>{catalogue.Presentations.map(item => <Badge key={item.Id} color="gray" variant="light">{t(item.Title)}</Badge>)}</Group>
        </Stack>
      </details>
      {!inspection.valid && <Alert color="yellow">{t(inspection.supplied ? 'Дані стану перенесення не узгоджені з каталогом. Завершеність не підтверджена; усі позиції каталогу збережені.'
        : 'Стан перенесення ще не надано сервером. Наявність джерела не підтверджує готовність розрахунку.')}</Alert>}
      <div className="report-catalogue__list">
      <div className="report-catalogue__filters">
        <TextInput label={t('Пошук звіту')} placeholder={t('Назва звіту')} leftSection={<Search size={16} />} value={search} onChange={event => { setSearch(event.currentTarget.value); setPage(1) }} />
        <Select label={t('Тип звіту')} placeholder={t('Усі типи')} clearable value={kind} data={Object.entries(kindLabels).map(([value, label]) => ({ value, label: t(label) }))} onChange={value => { setKind(value); setPage(1) }} />
        <Select label={t('База')} placeholder={t('Усі бази')} clearable value={world} data={[...new Set(catalogue.Reports.flatMap(report => report.Sources.map(source => source.World)))].map(value => ({ value, label: worldLabel(value) }))} onChange={value => { setWorld(value); setPage(1) }} />
        <Select label={t('Стан перенесення')} placeholder={t('Усі стани')} clearable value={status} data={Object.entries(MIGRATION_STATUS_LABELS).map(([value, label]) => ({ value, label: t(label) }))} onChange={value => { setStatus(value); setPage(1) }} />
        <Select label={t('Стан залежностей')} placeholder={t('Усі залежності')} clearable value={dependency} data={Object.entries(DEPENDENCY_STATUS_LABELS).map(([value, label]) => ({ value, label: t(label) }))} onChange={value => { setDependency(value); setPage(1) }} />
        <ActionIcon size={36} variant="light" color="gray" aria-label={t('Скинути фільтри')} title={t('Скинути фільтри')}
          onClick={() => { setSearch(''); setKind(null); setWorld(null); setStatus(null); setDependency(null); setPage(1) }}><RotateCcw size={16} /></ActionIcon>
      </div>
      <div className="report-catalogue__results">
      <Text size="xs" c="dimmed">{t('У вибірці: {entries} позицій · {implementations} реалізацій. Загальні показники вище охоплюють усі бази.', { entries: filtered.length, implementations: visibleSourceCount })}</Text>
      <Pagination size="sm" total={Math.max(1, Math.ceil(filtered.length / pageSize))} value={page} onChange={setPage} />
      </div>
      <CatalogueTable visibleRows={visibleRows} catalogue={catalogue} inspection={inspection} availableDatasets={availableDatasets}
        canGenerate={canGenerate} disabled={disabled} onOpen={onOpen} onOpenDebtToSalesRatio={onOpenDebtToSalesRatio} onOpenCollectionCoefficient={onOpenCollectionCoefficient} onOpenSalesMargin={onOpenSalesMargin} onOpenCashMovement={onOpenCashMovement} onOpenSupplierDebt={onOpenSupplierDebt} onOpenEmployeeGrossProfit={onOpenEmployeeGrossProfit} onOpenOverdueReceivables={onOpenOverdueReceivables} onOpenManagementReturns={onOpenManagementReturns} onOpenManagementBalance={onOpenManagementBalance} onOpenManagementOrders={onOpenManagementOrders} onOpenDefectProduction={onOpenDefectProduction} onOpenInventoryTurnover={onOpenInventoryTurnover} onOpenCurrentLiquidity={onOpenCurrentLiquidity} onOpenPlannedCash={onOpenPlannedCash} callerKey={callerKey}
        onOpenActiveClients={onOpenActiveClients} onOpenCurrencyRateDynamics={onOpenCurrencyRateDynamics} onOpenCashAggregateBalance={onOpenCashAggregateBalance} onOpenOriginalRevenue={onOpenOriginalRevenue} onOpenOriginalBuyerSalesShare={onOpenOriginalBuyerSalesShare} expanded={expanded}
        onToggle={id => setExpanded(current => toggleExpanded(current, id))} />
      {!filtered.length && <Text c="dimmed" ta="center" py="xl">{t('Звітів за цими умовами не знайдено')}</Text>}
      </div>
    </Stack>
  </div>
}


function toggleExpanded(current: ReadonlySet<string>, id: string) {
  const next = new Set(current)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

function CatalogueTable({ visibleRows, catalogue, inspection, availableDatasets, canGenerate, disabled, onOpen, onOpenDebtToSalesRatio, onOpenCollectionCoefficient, onOpenSalesMargin, onOpenCashMovement, onOpenSupplierDebt, onOpenEmployeeGrossProfit, onOpenOverdueReceivables, onOpenManagementReturns, onOpenManagementBalance, onOpenManagementOrders, onOpenDefectProduction, onOpenInventoryTurnover, onOpenCurrentLiquidity, onOpenPlannedCash, callerKey = null, onOpenActiveClients, onOpenCurrencyRateDynamics, onOpenCashAggregateBalance, onOpenOriginalRevenue, onOpenOriginalBuyerSalesShare, expanded, onToggle }: {
  visibleRows: Array<{ report: ReportCatalogueEntry; options: LaunchOption[]; matchingSources: ReportCatalogueEntry['Sources'] }>; catalogue: ReportCatalogue
  inspection: ReturnType<typeof inspectCatalogueMigration>; availableDatasets: ReportDataset[] | null
  canGenerate: boolean; disabled: boolean; onOpen?: OpenReport; onOpenDebtToSalesRatio?: OpenDebtToSalesRatio; onOpenCollectionCoefficient?: OpenCollectionCoefficient; onOpenSalesMargin?: OpenSalesMargin; onOpenCashMovement?: OpenCashMovement; onOpenSupplierDebt?: OpenSupplierDebt; onOpenEmployeeGrossProfit?: OpenEmployeeGrossProfit; onOpenOverdueReceivables?: OpenOverdueReceivables; onOpenManagementReturns?: OpenManagementReturns; onOpenManagementBalance?: OpenManagementBalance; onOpenManagementOrders?: OpenManagementOrders; onOpenDefectProduction?: OpenDefectProduction; onOpenInventoryTurnover?: OpenInventoryTurnover; onOpenCurrentLiquidity?: OpenCurrentLiquidity; onOpenPlannedCash?: OpenPlannedCash; callerKey?: string | null; onOpenActiveClients?: OpenActiveClients; onOpenCurrencyRateDynamics?: OpenCurrencyRateDynamics; onOpenCashAggregateBalance?: OpenCashAggregateBalance; onOpenOriginalRevenue?: OpenOriginalRevenue; onOpenOriginalBuyerSalesShare?: OpenOriginalBuyerSalesShare
  expanded: ReadonlySet<string>; onToggle: (id: string) => void
}) {
  const { t } = useI18n()
  return (
      <Table.ScrollContainer minWidth={720}>
        <Table className="report-catalogue__table" highlightOnHover>
          <colgroup><col style={{ width: '46%' }} /><col style={{ width: '15%' }} /><col style={{ width: '39%' }} /></colgroup>
          <Table.Thead><Table.Tr><Table.Th>{t('Звіт')}</Table.Th><Table.Th>{t('Тип')}</Table.Th><Table.Th>{t('Стан за базами')}</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{visibleRows.map(({ report, options, matchingSources }) => <Fragment key={report.Id}>
            <Table.Tr>
              <Table.Td><Stack gap={8} align="flex-start"><Button className="report-catalogue__report-title" leftSection={<ChevronRight size={14} aria-hidden="true" />} type="button" variant="subtle" size="compact-sm" aria-expanded={expanded.has(report.Id)} aria-label={t('Покриття звіту: {name}', { name: report.Title })}
                styles={{ root: { height: 'auto', maxWidth: '100%' }, label: { whiteSpace: 'normal', textAlign: 'left' } }}
                onClick={() => onToggle(report.Id)}>{report.Title}</Button>
                {onOpenSalesMargin && isSalesMarginCatalogueEntry(report)
                  ? <SalesMarginCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} callerKey={callerKey} onOpen={onOpenSalesMargin} /> : null}
                {onOpenCashMovement && cashMovementCatalogueKind(report) !== null
                  ? <CashMovementCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} callerKey={callerKey} onOpen={onOpenCashMovement} /> : null}
                {onOpenSupplierDebt && isSupplierDebtCatalogueEntry(report)
                  ? <SupplierDebtCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} callerKey={callerKey} onOpen={onOpenSupplierDebt} /> : null}
                {onOpenEmployeeGrossProfit && isEmployeeGrossProfitCatalogueEntry(report)
                  ? <EmployeeGrossProfitCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} callerKey={callerKey} onOpen={onOpenEmployeeGrossProfit} /> : null}
                {onOpenOverdueReceivables && isOverdueReceivablesCatalogueEntry(report)
                  ? <OverdueReceivablesCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} callerKey={callerKey} onOpen={onOpenOverdueReceivables} /> : null}
                {onOpenManagementReturns && isManagementReturnsCatalogueEntry(report)
                  ? <ManagementReturnsCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} callerKey={callerKey} onOpen={onOpenManagementReturns} /> : null}
                {onOpenManagementBalance && managementBalanceCatalogueKind(report)
                  ? <ManagementBalanceCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} callerKey={callerKey} onOpen={onOpenManagementBalance} /> : null}
                <OriginalWarehouseQuantityCatalogueLaunch report={report} worlds={matchingSources.map(s => s.World)} enabled={canGenerate} disabled={disabled} callerKey={callerKey} />
                <OriginalWarehouseMonetaryCatalogueLaunch report={report} worlds={matchingSources.map(s => s.World)} enabled={canGenerate} disabled={disabled} callerKey={callerKey} />
                <OriginalTransferredGoodsCatalogueLaunch report={report} worlds={matchingSources.map(s => s.World)} enabled={canGenerate} disabled={disabled} callerKey={callerKey} />
                <OriginalCounterpartyDebtCatalogueLaunch report={report} worlds={matchingSources.map(s => s.World)} enabled={canGenerate} disabled={disabled} callerKey={callerKey} />
                <OriginalCounterpartyStatementCatalogueLaunch report={report} worlds={matchingSources.map(s => s.World)} enabled={canGenerate} disabled={disabled} callerKey={callerKey} />
                <OriginalPriceTypeSalesCatalogueLaunch report={report} worlds={matchingSources.map(s => s.World)} enabled={canGenerate} disabled={disabled} callerKey={callerKey} />
                <OriginalSalesCatalogueLaunch report={report} worlds={matchingSources.map(s => s.World)} enabled={canGenerate} disabled={disabled} callerKey={callerKey} />
                <OriginalLotBalanceAnalysisCatalogueLaunch report={report} worlds={matchingSources.map(s => s.World)} enabled={canGenerate} disabled={disabled} callerKey={callerKey} />
                <OriginalWorkInProgressCatalogueLaunch report={report} worlds={matchingSources.map(s => s.World)} enabled={canGenerate} disabled={disabled} callerKey={callerKey} />
                <OriginalBuyerOrdersCatalogueLaunch report={report} worlds={matchingSources.map(s => s.World)} enabled={canGenerate} disabled={disabled} callerKey={callerKey} />
                <OriginalPlannedCashCatalogueLaunch report={report} worlds={matchingSources.map(s => s.World)} enabled={canGenerate} disabled={disabled} callerKey={callerKey} />
                <OriginalCashStatementCatalogueLaunch report={report} worlds={matchingSources.map(s => s.World)} enabled={canGenerate} disabled={disabled} callerKey={callerKey} />
                <OriginalCashMovementsCatalogueLaunch report={report} worlds={matchingSources.map(s => s.World)} enabled={canGenerate} disabled={disabled} callerKey={callerKey} />
                <OriginalGoodsStockAnalysisCatalogueLaunch report={report} worlds={matchingSources.map(s => s.World)} enabled={canGenerate} disabled={disabled} callerKey={callerKey} />
                <OriginalDefectCostCatalogueLaunch report={report} worlds={matchingSources.map(s => s.World)} enabled={canGenerate} disabled={disabled} callerKey={callerKey} />
                <ManagementOrdersCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} callerKey={callerKey} onOpen={onOpenManagementOrders} />
                <DefectProductionCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} callerKey={callerKey} onOpen={onOpenDefectProduction} />
                <InventoryTurnoverCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} callerKey={callerKey} onOpen={onOpenInventoryTurnover} />
                <CurrentLiquidityCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} callerKey={callerKey} onOpen={onOpenCurrentLiquidity} />
                <PlannedCashCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} callerKey={callerKey} onOpen={onOpenPlannedCash} />
                {onOpenOriginalBuyerSalesShare && originalBuyerSalesShareCatalogueVariant(report) !== null
                  ? <OriginalBuyerSalesShareCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} onOpen={onOpenOriginalBuyerSalesShare} />
                  : onOpenOriginalRevenue && isOriginalRevenueCatalogueEntry(report)
                  ? <OriginalRevenueCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} onOpen={onOpenOriginalRevenue} />
                  : onOpenCashAggregateBalance && isCashAggregateBalanceCatalogueEntry(report)
                  ? <CashAggregateBalanceCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} onOpen={onOpenCashAggregateBalance} />
                  : onOpenCurrencyRateDynamics && isCurrencyRateDynamicsCatalogueEntry(report)
                  ? <CurrencyRateDynamicsCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} onOpen={onOpenCurrencyRateDynamics} />
                  : onOpenActiveClients && isActiveClientsCatalogueEntry(report)
                  ? <ActiveClientsCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} onOpen={onOpenActiveClients} />
                  : onOpenCollectionCoefficient && isCollectionCoefficientCatalogueEntry(report)
                  ? <CollectionCoefficientCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} onOpen={onOpenCollectionCoefficient} />
                  : onOpenDebtToSalesRatio && isDebtToSalesRatioCatalogueEntry(report)
                  ? <DebtToSalesRatioCatalogueLaunch report={report} enabled={canGenerate} disabled={disabled} onOpen={onOpenDebtToSalesRatio} />
                  : onOpen ? <ReportLaunchActions report={report} catalogue={catalogue} options={options}
                  disabled={disabled || !canGenerate} onOpen={onOpen}
                  unavailable={!canGenerate ? 'Для роботи з наборами GBA потрібне право формування звітів.'
                    : !availableDatasets ? 'Доступність конструктора не підтверджена. Спробуйте відкрити каталог ще раз.'
                      : !inspection.valid ? 'Готові налаштування не підтверджені: стан перенесення не узгоджений з каталогом.'
                        : 'Для цього звіту ще немає готових налаштувань конструктора.'} /> : null}
              </Stack></Table.Td>
              <Table.Td>{t(kindLabels[report.Kind] ?? report.Kind)}</Table.Td>
              <Table.Td><Group gap={6} className="report-catalogue__statuses">{report.Sources.map(source => {
                const state = inspection.statuses.get(sourceIdentity(source)) ?? 'unassessed'
                return <Badge key={sourceIdentity(source)} color={statusColors[state]} variant="light">{worldLabel(source.World)}: {t(MIGRATION_STATUS_LABELS[state])}</Badge>
              })}</Group></Table.Td>
            </Table.Tr>
            {expanded.has(report.Id) && <Table.Tr><Table.Td colSpan={3}><ReportMigrationDetails report={report} migrations={inspection.migrations} datasets={availableDatasets} canGenerate={canGenerate} launchEnabled={Boolean(onOpen)} /></Table.Td></Table.Tr>}
          </Fragment>)}</Table.Tbody>
        </Table>
      </Table.ScrollContainer>
  )
}

const launchIdentity = (choice: CatalogueLaunchChoice) => JSON.stringify([choice.reportId, choice.world, choice.sourceId, choice.dataSource])

function ReportLaunchActions({ report, catalogue, options, disabled, unavailable, onOpen }: {
  report: ReportCatalogueEntry; catalogue: ReportCatalogue; options: LaunchOption[]; disabled: boolean; unavailable: string; onOpen: OpenReport
}) {
  const { t } = useI18n()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [rejectedKey, setRejectedKey] = useState<string | null>(null)
  const selected = options.length === 1 ? options[0] : options.find(option => launchIdentity(option.choice) === selectedKey)
  const label = (option: LaunchOption) => `${worldLabel(option.choice.world)} · ${t(option.label)}`
  if (!options.length) return <Text size="xs" c="dimmed">{t(unavailable)}</Text>
  return <Stack className="report-catalogue__launch" gap={6} role="group" aria-label={t('Відкрити звіт: {name}', { name: report.Title })} style={{ width: '100%', maxWidth: 440 }}>
    {options.length > 1 ? <Select label={t('Варіант для конструктора')} aria-label={t('Варіант звіту: {name}', { name: report.Title })}
      placeholder={t('Оберіть базу та варіант')} disabled={disabled} value={selected ? launchIdentity(selected.choice) : null}
      data={options.map(option => ({ value: launchIdentity(option.choice), label: label(option) }))}
      onChange={value => { setSelectedKey(value); setRejectedKey(null) }} /> : <Text size="sm">{label(options[0])}</Text>}
    {selected ? <Text size="xs" c="dimmed">{t(selected.notice)}</Text> : <Text size="xs" c="dimmed">{t('Виберіть один із доступних варіантів розрахунку GBA.')}</Text>}
    <Button type="button" variant="filled" rightSection={<ArrowRight size={15} />} disabled={disabled || !selected} styles={{ root: { height: 'auto', minHeight: 36, paddingBlock: 8 }, label: { whiteSpace: 'normal' } }}
      onClick={() => { if (!disabled && selected) setRejectedKey(onOpen(selected.choice, catalogue) ? null : launchIdentity(selected.choice)) }}>{t(selected?.choice.dataSource === 1 ? 'Відкрити звіт 1С' : 'Відкрити в конструкторі')}</Button>
    {selected && rejectedKey === launchIdentity(selected.choice) ? <Text size="sm" c="orange" role="alert">{t('Не вдалося відкрити цей варіант. Поточні налаштування збережено; перевірте доступність звіту й повторіть вибір.')}</Text> : null}
  </Stack>
}

function ReportMigrationDetails({ report, migrations, datasets, canGenerate, launchEnabled }: {
  report: ReportCatalogueEntry; migrations: ReadonlyMap<string, ReportSourceMigration>; datasets: ReportDataset[] | null; canGenerate: boolean; launchEnabled: boolean
}) {
  const { t } = useI18n()
  return <Stack className="report-catalogue__coverage" gap="md" aria-label={t('Покриття звіту: {name}', { name: report.Title })}>{report.Sources.map(source => {
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
          <Text size="sm">{t(migration.Validation.Kind === 'source_parity' ? 'Доказ відповідності джерельній реалізації' : 'Перевірка локального обсягу; повну відповідність первинному звіту не підтверджено')}</Text>
          <Text size="xs">{migration.Validation.EvidenceId} · {migration.Validation.VerifiedAtUtc}</Text>
          <Text size="xs">{t('Версія розрахунку: {revision}', { revision: migration.Validation.NativeRevision })}</Text>
        </Stack>}
        <MappedDatasets migration={migration} datasets={datasets} canGenerate={canGenerate} launchEnabled={launchEnabled} />
      </> : <Text size="sm" c="dimmed">{t('Стан перенесення не оцінено. Дані покриття та перевірки не підтверджені.')}</Text>}
    </Stack>
  })}</Stack>
}

function ScopeLines({ title, lines, fallback }: { title: string; lines: string[]; fallback: string }) {
  const { t } = useI18n()
  return <Stack gap={2}><Text size="sm" fw={600}>{t(title)}</Text>{lines.length ? <ul>{lines.map(line => <li key={line}><Text size="sm">{line}</Text></li>)}</ul> : <Text size="sm" c="dimmed">{t(fallback)}</Text>}</Stack>
}

function MappedDatasets({ migration, datasets, canGenerate, launchEnabled }: { migration: ReportSourceMigration; datasets: ReportDataset[] | null; canGenerate: boolean; launchEnabled: boolean }) {
  const { t } = useI18n()
  if (!migration.NativeDataSources.length) return null
  if (!canGenerate) return <Text size="sm" c="dimmed">{t('Для роботи з наборами GBA потрібне право формування звітів.')}</Text>
  return <Stack gap={2}><Text size="sm" fw={600}>{t('Пов’язані набори GBA')}</Text>{migration.NativeDataSources.map(id => {
    const dataset = datasets?.find(item => item.DataSource === id)
    return <Text size="sm" key={id}>{dataset ? `${dataset.Name} [${id}]` : t('Набір [{id}] зараз недоступний або його доступність не підтверджена.', { id })}</Text>
  })}<Text size="xs" c="dimmed">{t(launchEnabled ? 'Готові варіанти відкриваються кнопкою в рядку звіту. Пов’язані набори самі по собі не підтверджують перенесення всього звіту.'
    : 'Доступний набір можна вибрати у конструкторі вручну. Каталог не застосовує налаштування й не змінює поточний звіт.')}</Text></Stack>
}
