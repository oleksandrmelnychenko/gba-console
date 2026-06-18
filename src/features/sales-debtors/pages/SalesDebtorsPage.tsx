import { ActionIcon, Alert, Avatar, Button, Select, Stack, Text, Tooltip } from '@mantine/core'
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconFileDownload,
  IconUserDollar,
} from '@tabler/icons-react'
import { useEffect, useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  exportDebtorsDocument,
  getDebtorsManagers,
  getDebtorsOrganizations,
  getFilteredDebtors,
} from '../api/salesDebtorsApi'
import { DownloadDocumentModal } from '../components/DownloadDocumentModal'
import { TypeOfClientAgreement, TypeOfCurrencyOfAgreement } from '../types'
import type {
  ClientDebtors,
  ClientInDebt,
  DebtorsDocumentResult,
  DebtorsManagerOption,
  DebtorsOrganizationOption,
  TypeOfClientAgreement as TypeOfClientAgreementValue,
  TypeOfCurrencyOfAgreement as TypeOfCurrencyOfAgreementValue,
} from '../types'
import '../../../shared/ui/console-table-page.css'
import './sales-debtors-page.css'

const PAGE_SIZE = 20
const pageSizeOptions = ['20', '40', '60', '100']
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
  const [pageSize, setPageSize] = useValueState(PAGE_SIZE)
  const [managers, setManagers] = useValueState<DebtorsManagerOption[]>([])
  const [organizations, setOrganizations] = useValueState<DebtorsOrganizationOption[]>([])
  const [debtors, setDebtors] = useValueState<ClientDebtors>(emptyDebtors)
  const [isLoading, setLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [isExporting, setExporting] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<DebtorsDocumentResult | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [sortState, setSortState] = useValueState<DebtorsSortState>(null)
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
  }, [days, offset, organizationNetId, pageSize, setDebtors, setError, setLoading, t, typeAgreement, typeCurrency, userNetId])

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
    <Stack className="sales-debtors-page console-table-page" gap="md">
      <PageHeaderActions>
        <Button
          color={CREATE_ACTION_COLOR}
          leftSection={<IconFileDownload size={16} />}
          loading={isExporting}
          size="sm"
          onClick={handleExport}
        >
          {t('Сформувати звіт')}
        </Button>
      </PageHeaderActions>

      <div className="console-table-shell">
        <div className="sales-debtors-command-bar">
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
          <div className="sales-debtors-command-actions">
            <Select
              aria-label={t('Розмір сторінки')}
              className="sales-debtors-page-size"
              data={pageSizeOptions}
              disabled={isLoading}
              value={String(pageSize)}
              onChange={(value) => {
                setPage(1)
                setPageSize(Number(value) || PAGE_SIZE)
              }}
            />
            <ActionIcon
              aria-label={t('Попередня сторінка')}
              color="gray"
              disabled={page <= 1 || isLoading}
              size={34}
              variant="light"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <IconChevronLeft size={17} />
            </ActionIcon>
            <span className="sales-debtors-current-page">{page}</span>
            <ActionIcon
              aria-label={t('Наступна сторінка')}
              color="gray"
              disabled={page >= totalPages || isLoading}
              size={34}
              variant="light"
              onClick={() => setPage((current) => current + 1)}
            >
              <IconChevronRight size={17} />
            </ActionIcon>
            <DataTableDensityToggle density={density} onToggle={toggleDensity} size="sm" />
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
  onSort,
}: {
  currencyCode: string
  days: number
  density: DebtorsTableDensity
  isLoading: boolean
  rows: ClientInDebt[]
  sortState: DebtorsSortState
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

function DebtorRow({ currencyCode, row }: { currencyCode: string; row: ClientInDebt }) {
  return (
    <div className="sales-debtors-row">
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

function displayValue(value: number | string | undefined | null): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return String(value)
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

function splitProfileName(value: string): [string, string] {
  const normalized = value.trim()

  if (!normalized || normalized === '—') {
    return ['—', '—']
  }

  const [firstPart, ...rest] = normalized.split(/\s+/)

  return [firstPart || normalized, rest.join(' ') || '—']
}

function getProfileInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter((part) => part && part !== '—')

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
