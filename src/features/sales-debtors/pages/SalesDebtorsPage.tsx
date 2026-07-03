import { ActionIcon, Alert, Avatar, Badge, Select, Stack, Text, Tooltip } from '@mantine/core'
import {
  IconAlertCircle,
  IconBuildingBank,
  IconCalendar,
  IconChevronDown,
  IconChevronUp,
  IconFileDownload,
  IconFileInvoice,
  IconReceipt,
  IconUserDollar,
} from '@tabler/icons-react'
import { useEffect, useMemo, useReducer, type KeyboardEvent } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import {
  exportDebtorsDocument,
  getDebtorDebtTotal,
  getDebtorGroupedDebts,
  getDebtorsManagers,
  getDebtorsOrganizations,
  getFilteredDebtors,
} from '../api/salesDebtorsApi'
import { DownloadDocumentModal } from '../components/DownloadDocumentModal'
import { TypeOfClientAgreement, TypeOfCurrencyOfAgreement } from '../types'
import type {
  ClientDebtors,
  DebtorDebtItem,
  DebtorDebtSale,
  DebtorDebtTotal,
  ClientInDebt,
  DebtorsDocumentResult,
  DebtorsManagerOption,
  DebtorsOrganizationOption,
  TypeOfClientAgreement as TypeOfClientAgreementValue,
  TypeOfCurrencyOfAgreement as TypeOfCurrencyOfAgreementValue,
} from '../types'
import '../../../shared/ui/console-table-page.css'
import './sales-debtors-page.css'

const daysOptions = ['3', '5', '7', '10']

const currencyCodeByType: Record<TypeOfCurrencyOfAgreementValue, string> = {
  [TypeOfCurrencyOfAgreement.None]: 'EUR',
  [TypeOfCurrencyOfAgreement.UAH]: 'UAH',
  [TypeOfCurrencyOfAgreement.PLN]: 'PLN',
  [TypeOfCurrencyOfAgreement.EUR]: 'EUR',
  [TypeOfCurrencyOfAgreement.USD]: 'USD',
}

type DebtorsTableDensity = 'compact' | 'normal'
type DebtorsSortId = 'clientName' | 'missedDays' | 'overdueDebt' | 'regionCode' | 'remainderDebt' | 'totalDebtInDays' | 'userName'
type DebtorsSortState = {
  direction: 'asc' | 'desc'
  id: DebtorsSortId
} | null

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const emptyDebtors: ClientDebtors = {
  ClientInDebtors: [],
  TotalMissedDays: 0,
  TotalOverdueDebtorsValue: 0,
  TotalQtyClients: 0,
  TotalRemainderDebtorsValue: 0,
}

export function SalesDebtorsPage() {
  const { t } = useI18n()
  const [userNetId, setUserNetId] = useValueState<string | null>(null)
  const [organizationNetId, setOrganizationNetId] = useValueState<string | null>(null)
  const [typeAgreement, setTypeAgreement] = useValueState<TypeOfClientAgreementValue>(TypeOfClientAgreement.All)
  const [typeCurrency, setTypeCurrency] = useValueState<TypeOfCurrencyOfAgreementValue>(TypeOfCurrencyOfAgreement.None)
  const [days, setDays] = useValueState(3)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGINATOR_PAGE_SIZE)
  const [managers, setManagers] = useValueState<DebtorsManagerOption[]>([])
  const [organizations, setOrganizations] = useValueState<DebtorsOrganizationOption[]>([])
  const [debtors, setDebtors] = useValueState<ClientDebtors>(emptyDebtors)
  const [isLoading, setLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [isExporting, setExporting] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<DebtorsDocumentResult | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [sortState, setSortState] = useValueState<DebtorsSortState>(null)
  const [selectedDebtor, setSelectedDebtor] = useValueState<ClientInDebt | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { density, toggleDensity } = useDataTableDensity('sales-debtors', 'compact')

  const offset = (page - 1) * pageSize
  const currencyCode = currencyCodeByType[typeCurrency]
  const totalPages = Math.max(1, Math.ceil(debtors.TotalQtyClients / pageSize))
  const sortedDebtors = useMemo(() => sortDebtors(debtors.ClientInDebtors, sortState), [debtors.ClientInDebtors, sortState])

  const managerOptions = useMemo(
    () =>
      managers.reduce<{ label: string; value: string }[]>((acc, manager) => {
        if (manager.NetUid) {
          acc.push({ label: getManagerLabel(manager), value: String(manager.NetUid) })
        }

        return acc
      }, []),
    [managers],
  )
  const organizationSelectOptions = useMemo(
    () =>
      organizations.reduce<{ label: string; value: string }[]>((acc, organization) => {
        if (organization.NetUid && organization.Name) {
          acc.push({ label: organization.Name, value: String(organization.NetUid) })
        }

        return acc
      }, []),
    [organizations],
  )

  useEffect(() => {
    let cancelled = false

    async function loadOptions() {
      try {
        const [managerList, organizationList] = await Promise.all([getDebtorsManagers(), getDebtorsOrganizations()])

        if (!cancelled) {
          setManagers(managerList)
          setOrganizations(organizationList)
        }
      } catch {
        if (!cancelled) {
          setManagers([])
          setOrganizations([])
        }
      }
    }

    void loadOptions()

    return () => {
      cancelled = true
    }
  }, [setManagers, setOrganizations])

  useEffect(() => {
    let cancelled = false

    async function loadDebtors() {
      setLoading(true)
      setError(null)

      try {
        const result = await getFilteredDebtors({
          days,
          limit: pageSize,
          offset,
          organizationNetId,
          typeAgreement,
          typeCurrency,
          userNetId,
        })

        if (!cancelled) {
          setDebtors(result)
          setLoading(false)
        }
      } catch (loadError) {
        if (!cancelled) {
          setDebtors(emptyDebtors)
          setLoading(false)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити боржників'))
        }
      }
    }

    void loadDebtors()

    return () => {
      cancelled = true
    }
  }, [days, offset, organizationNetId, pageSize, reloadKey, setDebtors, setError, setLoading, t, typeAgreement, typeCurrency, userNetId])

  async function handleExport() {
    setExporting(true)
    setError(null)

    try {
      const result = await exportDebtorsDocument({
        organizationNetId,
        typeAgreement,
        typeCurrency,
        userNetId,
      })

      setDownloadDocument(result)
      setDownloadModalOpened(true)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати звіт'))
    } finally {
      setExporting(false)
    }
  }

  function toggleSort(id: DebtorsSortId) {
    setSortState((current) => {
      if (current?.id !== id) {
        return { direction: 'asc', id }
      }

      return { direction: current.direction === 'asc' ? 'desc' : 'asc', id }
    })
  }

  return (
    <Stack className="sales-debtors-page console-table-page" gap={6}>
      <div className="console-table-shell">
        <div className="sales-debtors-command-bar app-filter-bar">
          <Select
            clearable
            searchable
            className="sales-debtors-filter is-manager"
            data={managerOptions}
            label={t('Менеджер')}
            nothingFoundMessage={t('Нічого не знайдено')}
            placeholder={t('Усі')}
            value={userNetId}
            onChange={(value) => {
              setPage(1)
              setUserNetId(value)
            }}
          />
          <Select
            clearable
            searchable
            className="sales-debtors-filter is-organization"
            data={organizationSelectOptions}
            label={t('Організація')}
            placeholder={t('Усі')}
            value={organizationNetId}
            onChange={(value) => {
              setPage(1)
              setOrganizationNetId(value)
            }}
          />
          <Select
            allowDeselect={false}
            className="sales-debtors-filter is-type"
            data={[
              { label: t('Всі'), value: String(TypeOfClientAgreement.All) },
              { label: t('Готівкові'), value: String(TypeOfClientAgreement.VAT) },
              { label: t('Безготівкові'), value: String(TypeOfClientAgreement.WithoutVAT) },
            ]}
            label={t('Тип')}
            value={String(typeAgreement)}
            onChange={(value) => {
              setPage(1)
              setTypeAgreement((Number(value) as TypeOfClientAgreementValue) || TypeOfClientAgreement.All)
            }}
          />
          <Select
            allowDeselect={false}
            className="sales-debtors-filter is-currency"
            data={[
              { label: t('Всі'), value: String(TypeOfCurrencyOfAgreement.None) },
              { label: 'EUR', value: String(TypeOfCurrencyOfAgreement.EUR) },
              { label: 'UAH', value: String(TypeOfCurrencyOfAgreement.UAH) },
              { label: 'PLN', value: String(TypeOfCurrencyOfAgreement.PLN) },
              { label: 'USD', value: String(TypeOfCurrencyOfAgreement.USD) },
            ]}
            label={t('Валюта')}
            value={String(typeCurrency)}
            onChange={(value) => {
              setPage(1)
              setTypeCurrency((Number(value) as TypeOfCurrencyOfAgreementValue) || TypeOfCurrencyOfAgreement.None)
            }}
          />
          <Select
            allowDeselect={false}
            className="sales-debtors-filter is-days"
            data={daysOptions}
            label={t('Борг через днів')}
            value={String(days)}
            onChange={(value) => {
              setPage(1)
              setDays(Number(value) || 3)
            }}
          />
          <div className="app-filter-actions sales-debtors-command-actions">
            <Tooltip label={t('Сформувати звіт')}>
              <ActionIcon
                aria-label={t('Сформувати звіт')}
                color="gray"
                loading={isExporting}
                size={34}
                variant="light"
                onClick={handleExport}
              >
                <IconFileDownload size={17} />
              </ActionIcon>
            </Tooltip>
            <DataTableDensityToggle density={density} onToggle={toggleDensity} size="sm" />
            <Paginator
              isLoading={isLoading}
              page={page}
              pageSize={pageSize}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPage(1)
                setPageSize(nextPageSize)
              }}
              onRefresh={reload}
            />
          </div>
        </div>

        {error && (
          <Alert className="console-table-alert" color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="sales-debtors-page__table console-table-body">
          <DebtorsList
            currencyCode={currencyCode}
            days={days}
            density={density as DebtorsTableDensity}
            isLoading={isLoading}
            rows={sortedDebtors}
            sortState={sortState}
            onOpen={setSelectedDebtor}
            onSort={toggleSort}
          />
        </div>

        <SalesDebtorsSummary debtors={debtors} currencyCode={currencyCode} />
      </div>

      <DownloadDocumentModal
        document={downloadDocument}
        opened={downloadModalOpened}
        onClose={() => setDownloadModalOpened(false)}
      />
      <DebtorDetailDrawer currencyCode={currencyCode} debtor={selectedDebtor} onClose={() => setSelectedDebtor(null)} />
    </Stack>
  )
}

function DebtorsList({
  currencyCode,
  days,
  density,
  isLoading,
  rows,
  sortState,
  onOpen,
  onSort,
}: {
  currencyCode: string
  days: number
  density: DebtorsTableDensity
  isLoading: boolean
  rows: ClientInDebt[]
  sortState: DebtorsSortState
  onOpen: (row: ClientInDebt) => void
  onSort: (id: DebtorsSortId) => void
}) {
  const { t } = useI18n()

  return (
    <div className={`sales-debtors-list is-${density}`}>
      <div className="sales-debtors-list-head">
        <DebtorsSortHeader id="regionCode" label={t('Регіон')} sortState={sortState} onSort={onSort} />
        <DebtorsSortHeader id="clientName" label={t('Клієнт')} sortState={sortState} onSort={onSort} />
        <DebtorsSortHeader id="userName" label={t('Відповідальний')} sortState={sortState} onSort={onSort} />
        <DebtorsSortHeader id="totalDebtInDays" label={`${t('Борг через')} ${days} ${t('днів')}`} sortState={sortState} onSort={onSort} align="right" />
        <DebtorsSortHeader id="missedDays" label={t('Дні')} sortState={sortState} onSort={onSort} />
        <DebtorsSortHeader id="remainderDebt" label={t('Залишок')} sortState={sortState} onSort={onSort} align="right" />
        <DebtorsSortHeader id="overdueDebt" label={t('Прострочено')} sortState={sortState} onSort={onSort} align="right" />
      </div>

      <div className="sales-debtors-list-body">
        {isLoading ? (
          <div className="sales-debtors-list-state">{t('Завантаження боржників')}</div>
        ) : rows.length === 0 ? (
          <div className="sales-debtors-list-state">{t('Боржників не знайдено')}</div>
        ) : (
          rows.map((row, index) => (
            <DebtorRow
              key={row.ClientNetId || `${row.ClientName || 'debtor'}-${index}`}
              currencyCode={currencyCode}
              row={row}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </div>
  )
}

function DebtorsSortHeader({
  align,
  id,
  label,
  sortState,
  onSort,
}: {
  align?: 'center' | 'right'
  id: DebtorsSortId
  label: string
  sortState: DebtorsSortState
  onSort: (id: DebtorsSortId) => void
}) {
  const isActive = sortState?.id === id
  const SortIcon = isActive && sortState.direction === 'desc' ? IconChevronDown : IconChevronUp

  return (
    <button
      className={`sales-debtors-sort-header${isActive ? ' is-active' : ''}${align ? ` is-${align}` : ''}`}
      type="button"
      onClick={() => onSort(id)}
    >
      <span>{label}</span>
      <SortIcon size={12} />
    </button>
  )
}

function DebtorRow({ currencyCode, row, onOpen }: { currencyCode: string; row: ClientInDebt; onOpen: (row: ClientInDebt) => void }) {
  function openRow() {
    onOpen(row)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openRow()
    }
  }

  return (
    <div className="sales-debtors-row" role="button" tabIndex={0} onClick={openRow} onKeyDown={handleKeyDown}>
      <DebtorRegionCell value={displayValue(row.RegionCode)} />
      <DebtorClientCell debtor={row} />
      <DebtorManagerCell value={displayValue(row.UserName)} />
      <DebtorAmountCell amount={row.TotalDebtInDays} currencyCode={currencyCode} />
      <DebtorDaysCell value={row.MissedDays ?? 0} />
      <DebtorAmountCell amount={row.RemainderDebt} currencyCode={currencyCode} />
      <DebtorAmountCell amount={row.OverdueDebt} currencyCode={currencyCode} tone={(row.OverdueDebt ?? 0) > 0 ? 'danger' : undefined} />
    </div>
  )
}

function DebtorRegionCell({ value }: { value: string }) {
  return (
    <Tooltip label={value}>
      <span className="sales-debtors-region-cell">{value}</span>
    </Tooltip>
  )
}

function DebtorClientCell({ debtor }: { debtor: ClientInDebt }) {
  const title = displayValue(debtor.ClientName)
  const subtitle = debtor.CreatedDebt ? formatDateTime(debtor.CreatedDebt) : displayValue(debtor.ClientNetId)

  return (
    <div className="console-table-entity-cell sales-debtors-client-cell">
      <span className="console-table-entity-marker sales-debtors-client-marker" aria-hidden>
        <IconUserDollar size={17} stroke={1.8} />
      </span>
      <span className="console-table-entity-copy">
        <Tooltip label={title}>
          <span className="console-table-entity-title">{title}</span>
        </Tooltip>
        <Tooltip label={subtitle}>
          <span className="console-table-entity-subtitle">{subtitle}</span>
        </Tooltip>
      </span>
    </div>
  )
}

function DebtorManagerCell({ value }: { value: string }) {
  const [lastName, givenName] = splitProfileName(value)

  return (
    <div className="sales-debtors-manager-cell">
      <Avatar className="sales-debtors-manager-avatar" radius="xl" size={34}>
        {getProfileInitials(value)}
      </Avatar>
      <div className="sales-debtors-manager-copy">
        <Tooltip label={value}>
          <Text className="sales-debtors-manager-last-name">{lastName}</Text>
        </Tooltip>
        <Tooltip label={value}>
          <Text className="sales-debtors-manager-first-name">{givenName}</Text>
        </Tooltip>
      </div>
    </div>
  )
}

function DebtorAmountCell({
  amount,
  currencyCode,
  tone,
}: {
  amount: number | undefined
  currencyCode: string
  tone?: 'danger'
}) {
  const value = moneyFormatter.format(amount ?? 0)

  return (
    <span className={`sales-debtors-amount-cell${tone === 'danger' ? ' is-danger' : ''}`}>
      <strong>{value}</strong>
      <small>{currencyCode}</small>
    </span>
  )
}

function DebtorDaysCell({ value }: { value: number }) {
  return (
    <span className={`sales-debtors-days-cell${value < 0 ? ' is-danger' : value > 0 ? ' is-warning' : ''}`}>
      <span aria-hidden>#</span>
      <strong>{value}</strong>
    </span>
  )
}

function SalesDebtorsSummary({ currencyCode, debtors }: { currencyCode: string; debtors: ClientDebtors }) {
  const { t } = useI18n()

  return (
    <div className="sales-debtors-summary">
      <span className="sales-debtors-summary-item">
        <span>{t('Клієнтів')}</span>
        <strong>{debtors.TotalQtyClients}</strong>
      </span>
      <span className={`sales-debtors-summary-item${debtors.TotalMissedDays < 0 ? ' is-danger' : ''}`}>
        <span>{t('Днів')}</span>
        <strong>{debtors.TotalMissedDays}</strong>
      </span>
      <span className="sales-debtors-summary-item">
        <span>{t('Залишок')}</span>
        <strong>
          {moneyFormatter.format(debtors.TotalRemainderDebtorsValue)} {currencyCode}
        </strong>
      </span>
      <span className={`sales-debtors-summary-item${debtors.TotalOverdueDebtorsValue > 0 ? ' is-danger' : ''}`}>
        <span>{t('Прострочено')}</span>
        <strong>
          {moneyFormatter.format(debtors.TotalOverdueDebtorsValue)} {currencyCode}
        </strong>
      </span>
    </div>
  )
}

function DebtorDetailDrawer({
  currencyCode,
  debtor,
  onClose,
}: {
  currencyCode: string
  debtor: ClientInDebt | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const [items, setItems] = useValueState<DebtorDebtItem[]>([])
  const [total, setTotal] = useValueState<DebtorDebtTotal | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)

  useEffect(() => {
    const clientNetId = debtor?.ClientNetId

    if (!clientNetId) {
      setItems([])
      setTotal(null)
      setLoading(false)
      setError(null)

      return
    }

    const controller = new AbortController()
    const debtorClientNetId = clientNetId

    async function loadDetails() {
      setLoading(true)
      setError(null)

      try {
        const [nextItems, nextTotal] = await Promise.all([
          getDebtorGroupedDebts(debtorClientNetId, controller.signal),
          getDebtorDebtTotal(debtorClientNetId, controller.signal),
        ])

        setItems(nextItems)
        setTotal(nextTotal)
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setItems([])
          setTotal(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити деталі боржника'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadDetails()

    return () => {
      controller.abort()
    }
  }, [debtor?.ClientNetId, setError, setItems, setLoading, setTotal, t])

  return (
    <AppDrawer opened={Boolean(debtor)} position="right" size="standard" title={t('Деталі боржника')} onClose={onClose}>
      {debtor ? (
        <div className="sales-debtor-detail">
          <section className="sales-debtor-detail-hero">
            <div className="sales-debtor-detail-hero__main">
              <span className="sales-debtor-detail-hero__icon" aria-hidden>
                <IconUserDollar size={20} stroke={1.8} />
              </span>
              <div className="sales-debtor-detail-hero__copy">
                <span className="sales-debtor-detail-eyebrow">{t('Клієнт')}</span>
                <strong>{displayValue(debtor.ClientName)}</strong>
                <span>
                  {displayValue(debtor.RegionCode)} · {displayValue(debtor.UserName)}
                </span>
              </div>
            </div>
            <div className="sales-debtor-detail-metrics">
              <DebtorDetailMetric label={t('Залишок')} tone="neutral" unit={currencyCode} value={debtor.RemainderDebt} />
              <DebtorDetailMetric label={t('Прострочено')} tone="danger" unit={currencyCode} value={debtor.OverdueDebt} />
              <DebtorDetailMetric format="integer" label={t('Днів')} tone={(debtor.MissedDays ?? 0) < 0 ? 'danger' : 'neutral'} value={debtor.MissedDays} />
            </div>
          </section>

          <section className="sales-debtor-detail-section">
            <div className="sales-debtor-detail-section__head">
              <span className="sales-debtor-detail-section__icon" aria-hidden>
                <IconReceipt size={16} />
              </span>
              <div>
                <span className="sales-debtor-detail-eyebrow">{t('Підсумок')}</span>
                <strong>{t('Загальна заборгованість')}</strong>
              </div>
            </div>
            <div className="sales-debtor-detail-total-grid">
              <DebtorDetailMetric label="EUR" unit="EUR" value={total?.TotalEuro} />
              <DebtorDetailMetric label="UAH" unit="UAH" value={total?.TotalLocal} />
              <DebtorDetailMetric label={t('По структурі')} unit="UAH" value={total?.TotalSubClientDebt} />
            </div>
          </section>

          <section className="sales-debtor-detail-section">
            <div className="sales-debtor-detail-section__head">
              <span className="sales-debtor-detail-section__icon" aria-hidden>
                <IconFileInvoice size={16} />
              </span>
              <div>
                <span className="sales-debtor-detail-eyebrow">{t('Документи')}</span>
                <strong>{t('Борги по клієнту')}</strong>
              </div>
              <Badge className="sales-debtor-detail-count" variant="light">
                {items.length}
              </Badge>
            </div>

            {isLoading ? (
              <div className="sales-debtor-detail-state">{t('Завантаження деталей')}</div>
            ) : error ? (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {error}
              </Alert>
            ) : items.length === 0 ? (
              <div className="sales-debtor-detail-state">{t('Боргових документів не знайдено')}</div>
            ) : (
              <div className="sales-debtor-detail-debts">
                {items.map((item, index) => (
                  <DebtorDebtCard key={item.NetUid || `${item.Id || 'debt'}-${index}`} currencyCode={currencyCode} item={item} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </AppDrawer>
  )
}

function DebtorDetailMetric({
  label,
  format = 'money',
  tone,
  unit,
  value,
}: {
  format?: 'integer' | 'money'
  label: string
  tone?: 'danger' | 'neutral'
  unit?: string
  value: number | undefined
}) {
  const formattedValue = format === 'integer' ? String(value ?? 0) : moneyFormatter.format(value ?? 0)

  return (
    <span className={`sales-debtor-detail-metric${tone === 'danger' ? ' is-danger' : ''}`}>
      <span>{label}</span>
      <strong>{formattedValue}</strong>
      {unit ? <small>{unit}</small> : null}
    </span>
  )
}

function DebtorDebtCard({ currencyCode: fallbackCurrencyCode, item }: { currencyCode: string; item: DebtorDebtItem }) {
  const sale = item.Sale || item.ReSale || null
  const documentNumber = getDebtDocumentNumber(item, sale)
  const documentDate = getDebtDocumentDate(item, sale)
  const agreement = getDebtAgreementLabel(item)
  const status = getDebtStatusLabel(sale)
  const currencyCode = item.Agreement?.Currency?.Code || fallbackCurrencyCode
  const amount = item.Debt?.Total ?? sale?.TotalAmount ?? sale?.TotalAmountLocal ?? 0
  const days = item.Debt?.Days ?? 0

  return (
    <article className="sales-debtor-detail-debt">
      <span className="sales-debtor-detail-debt__icon" aria-hidden>
        <IconFileInvoice size={16} />
      </span>
      <div className="sales-debtor-detail-debt__main">
        <Tooltip label={documentNumber}>
          <strong>{documentNumber}</strong>
        </Tooltip>
        <div className="sales-debtor-detail-debt__meta">
          <span>
            <IconCalendar size={13} />
            {documentDate}
          </span>
          <span>
            <IconBuildingBank size={13} />
            {agreement}
          </span>
        </div>
        {status ? <span className="sales-debtor-detail-debt__status">{status}</span> : null}
      </div>
      <div className="sales-debtor-detail-debt__amount">
        <strong>{moneyFormatter.format(amount)}</strong>
        {currencyCode ? <small>{currencyCode}</small> : null}
      </div>
      <DebtorDaysCell value={days} />
    </article>
  )
}

function sortDebtors(rows: ClientInDebt[], sortState: DebtorsSortState): ClientInDebt[] {
  if (!sortState) {
    return rows
  }

  const direction = sortState.direction === 'asc' ? 1 : -1

  return [...rows].sort((a, b) => {
    const firstValue = getDebtorSortValue(a, sortState.id)
    const secondValue = getDebtorSortValue(b, sortState.id)

    if (typeof firstValue === 'number' && typeof secondValue === 'number') {
      return (firstValue - secondValue) * direction
    }

    return String(firstValue).localeCompare(String(secondValue), 'uk', { numeric: true, sensitivity: 'base' }) * direction
  })
}

function getDebtorSortValue(row: ClientInDebt, id: DebtorsSortId): number | string {
  switch (id) {
    case 'clientName':
      return row.ClientName || ''
    case 'missedDays':
      return row.MissedDays ?? 0
    case 'overdueDebt':
      return row.OverdueDebt ?? 0
    case 'regionCode':
      return row.RegionCode || ''
    case 'remainderDebt':
      return row.RemainderDebt ?? 0
    case 'totalDebtInDays':
      return row.TotalDebtInDays ?? 0
    case 'userName':
      return row.UserName || ''
    default:
      return ''
  }
}

function getDebtDocumentNumber(item: DebtorDebtItem, sale: DebtorDebtSale | null): string {
  return displayValue(
    sale?.SaleNumber?.Value ||
    sale?.SaleNumber?.Name ||
    sale?.SaleNumber?.Number ||
    sale?.Number ||
    sale?.Name ||
    item.Debt?.Name,
  )
}

function getDebtDocumentDate(item: DebtorDebtItem, sale: DebtorDebtSale | null): string {
  return formatDateTime(sale?.ChangedToInvoice || sale?.Created || item.Created)
}

function getDebtAgreementLabel(item: DebtorDebtItem): string {
  const agreement = item.Agreement
  const organization = agreement?.Organization?.Name
  const agreementName = agreement?.Name || agreement?.Number

  if (organization && agreementName) {
    return `${organization} · ${agreementName}`
  }

  return displayValue(agreementName || organization)
}

function getDebtStatusLabel(sale: DebtorDebtSale | null): string {
  return displayValue(
    sale?.BaseSalePaymentStatus?.Name ||
    sale?.BaseSalePaymentStatus?.Value ||
    sale?.BaseLifeCycleStatus?.Name ||
    sale?.BaseLifeCycleStatus?.Value,
  )
}

function displayValue(value: number | string | undefined | null): string {
  if (value === null || value === undefined || value === '' || isUuidLike(value)) {
    return ''
  }

  return String(value)
}

function isUuidLike(value: number | string): boolean {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
}

function formatDateTime(value?: string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

function splitProfileName(value: string): [string, string] {
  const normalized = value.trim()

  if (!normalized) {
    return ['', '']
  }

  const [firstPart, ...rest] = normalized.split(/\s+/)

  return [firstPart || normalized, rest.join(' ')]
}

function getProfileInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  return (
    parts
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toLocaleUpperCase('uk') || '?'
  )
}

function getManagerLabel(manager: DebtorsManagerOption): string {
  return (
    manager.FullName ||
    manager.Name ||
    [manager.LastName, manager.FirstName, manager.MiddleName].filter(Boolean).join(' ') ||
    manager.Abbreviation ||
    String(manager.NetUid || '')
  )
}
