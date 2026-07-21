import {
  ActionIcon,
  Badge,
  Alert,
  Anchor,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { CircleAlert, Download, ExternalLink, FileText, Plus, RotateCcw, Search, Wallet } from 'lucide-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import {
  exportSupplyOrganizations,
  getSupplyOrganizations,
  searchSupplyOrganizations,
} from '../api/supplierOrganizationsApi'
import type { SupplyOrganization, SupplyOrganizationDocumentExport } from '../types'
import './supplier-organizations-page.css'
import '../../../shared/ui/console-table-page.css'

const SEARCH_STORAGE_KEY = 'searchSupplyOrganization'
const SUPPLIER_ORGANIZATIONS_PAGE_SIZE = DEFAULT_PAGINATOR_PAGE_SIZE

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const SUPPLIER_ORGANIZATIONS_TABLE_MIN_WIDTH = 1320
const SUPPLIER_ORGANIZATIONS_TABLE_DEFAULT_LAYOUT = {
  columnOrder: ['name', 'identifiers', 'organization', 'contact', 'bank', 'balance', 'created'],
  columnPinning: {
    left: ['name'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

export function SupplierOrganizationsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()

  function openOrganizationSheet(path: string) {
    navigate(path, {
      state: {
        backgroundLocation: location,
        returnPath: `${location.pathname}${location.search}`,
      },
    })
  }

  const [organizations, setOrganizations] = useValueState<SupplyOrganization[]>([])
  const [searchValue, setSearchValue] = useValueState(() => readStoredSearch())
  const [dateFrom, setDateFrom] = useValueState('')
  const [dateTo, setDateTo] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [hasMore, setHasMore] = useValueState(false)
  const [isExporting, setExporting] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<SupplyOrganizationDocumentExport | null>(null)
  const [selectedOrganization, setSelectedOrganization] = useValueState<SupplyOrganization | null>(null)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(SUPPLIER_ORGANIZATIONS_PAGE_SIZE)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const requestRef = useRef(0)
  const filterError = getDateFilterError(dateFrom, dateTo)
  const dateFilters = useMemo(() => ({ from: dateFrom || undefined, to: dateTo || undefined }), [dateFrom, dateTo])
  const columns = useSupplierOrganizationColumns()

  const loadOrganizationsPage = useCallback(async () => {
    const requestId = requestRef.current + 1
    requestRef.current = requestId

    if (filterError) {
      setLoading(false)
      setError(null)
      setOrganizations([])
      setHasMore(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const trimmedSearchValue = searchValue.trim()
      const paginationParams = {
        ...dateFilters,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }
      const nextOrganizations = trimmedSearchValue
        ? await searchSupplyOrganizations(trimmedSearchValue, '', paginationParams)
        : await getSupplyOrganizations(paginationParams)

      if (requestRef.current === requestId) {
        setOrganizations(nextOrganizations)
        setHasMore(nextOrganizations.length === pageSize)
      }
    } catch (loadError) {
      if (requestRef.current === requestId) {
        setOrganizations([])
        setHasMore(false)
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити постачальників послуг'))
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [dateFilters, filterError, page, pageSize, searchValue, setError, setHasMore, setLoading, setOrganizations, t])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOrganizationsPage()
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [loadOrganizationsPage])

  async function reloadOrganizations() {
    await loadOrganizationsPage()
  }

  async function exportList() {
    if (isExporting) {
      return
    }

    setExporting(true)
    setError(null)

    try {
      const document = await exportSupplyOrganizations(searchValue, dateFilters)
      setDownloadDocument(document)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ'))
    } finally {
      setExporting(false)
    }
  }

  function changePageSize(nextPageSize: number) {
    setPage(1)
    setPageSize(nextPageSize)
  }

  function updateSearchValue(value: string) {
    setSearchValue(value)
    setPage(1)
    setOrganizations([])
    setHasMore(false)

    if (value) {
      window.localStorage.setItem(SEARCH_STORAGE_KEY, value)
    } else {
      window.localStorage.removeItem(SEARCH_STORAGE_KEY)
    }
  }

  function resetFilters() {
    setSearchValue('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
    setHasMore(false)
    window.localStorage.removeItem(SEARCH_STORAGE_KEY)
  }

  function updateDateFrom(value: string) {
    setDateFrom(value)
    setPage(1)
    setHasMore(false)
  }

  function updateDateTo(value: string) {
    setDateTo(value)
    setPage(1)
    setHasMore(false)
  }

  const hasActiveFilters = Boolean(searchValue.trim() || dateFrom || dateTo)

  return (
    <Stack className="supplier-organizations-page console-table-page" gap={6}>
      <div className="console-table-shell">
        <div className="app-filter-bar supplier-organizations-command-bar">
          <div className="app-filter-date-range">
            <TextInput
              className="supplier-organizations-date-input"
              label={t('Від')}
              type="date"
              value={dateFrom}
              onChange={(event) => updateDateFrom(event.currentTarget.value)}
            />
            <TextInput
              className="supplier-organizations-date-input"
              label={t('До')}
              type="date"
              value={dateTo}
              onChange={(event) => updateDateTo(event.currentTarget.value)}
            />
          </div>

          <TextInput
            className="supplier-organizations-search-input"
            leftSection={<Search size={16} />}
            label={t('Пошук')}
            placeholder={t('Назва, код, телефон або email')}
            value={searchValue}
            onChange={(event) => updateSearchValue(event.currentTarget.value)}
          />
          <div className="app-filter-actions supplier-organizations-command-actions">
            <Tooltip label={t('Скинути')}>
              <ActionIcon
                aria-label={t('Скинути')}
                color="gray"
                disabled={!hasActiveFilters}
                size={34}
                variant="light"
                onClick={resetFilters}
              >
                <RotateCcw size={17} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Друк')}>
              <ActionIcon
                aria-label={t('Друк')}
                color="gray"
                disabled={isExporting}
                loading={isExporting}
                size={34}
                variant="light"
                onClick={exportList}
              >
                <Download size={18} />
              </ActionIcon>
            </Tooltip>
            <Paginator
              isLoading={isLoading}
              page={page}
              pageSize={pageSize}
              hasNext={hasMore}
              onPageChange={setPage}
              onPageSizeChange={changePageSize}
              onRefresh={() => void reloadOrganizations()}
            />
          </div>
          <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
          <div className="supplier-organizations-create-actions">
            <PermissionGate permissionKey="SERVICE_Accounting_Supplier_Organizations_AddBtn_PKEY">
              <Button
                color={CREATE_ACTION_COLOR}
                leftSection={<Plus size={16} />}
                size="sm"
                type="button"
                onClick={() => openOrganizationSheet('/accounting/supplier-organizations/new')}
              >
                {t('Додати')}
              </Button>
            </PermissionGate>
          </div>
        </div>

        {error && (
          <Alert className="console-table-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {filterError && (
          <Alert className="console-table-alert" color="yellow" icon={<CircleAlert size={18} />} variant="light">
            {filterError}
          </Alert>
        )}

        <div className="supplier-organizations-page__table console-table-body">
          <DataTable
            columns={columns}
            data={organizations}
            defaultLayout={SUPPLIER_ORGANIZATIONS_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Постачальників послуг не знайдено')}
            getRowId={(organization, index) => String(organization.NetUid || organization.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="supplier-organizations-table-2"
            minWidth={SUPPLIER_ORGANIZATIONS_TABLE_MIN_WIDTH}
            showLayoutControls
            tableId="supplier-organizations"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={setSelectedOrganization}
          />
        </div>
      </div>

      <SupplierOrganizationActionModal
        organization={selectedOrganization}
        onClose={() => setSelectedOrganization(null)}
        onOpenCashFlow={(organization) => {
          setSelectedOrganization(null)
          navigate(`/accounting/supplier-organizations/cash-flow/${organization.NetUid}`)
        }}
        onOpenEdit={(organization) => {
          setSelectedOrganization(null)
          openOrganizationSheet(`/accounting/supplier-organizations/edit/${organization.NetUid}`)
        }}
      />

      <DocumentModal document={downloadDocument} onClose={() => setDownloadDocument(null)} />
    </Stack>
  )
}

function useSupplierOrganizationColumns(): DataTableColumn<SupplyOrganization>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SupplyOrganization>[]>(
    () => [
      {
        id: 'name',
        header: t('Назва'),
        width: 300,
        minWidth: 250,
        accessor: (organization) => compactStrings([organization.Name, organization.ContactPersonName, getAgreementOrganizations(organization), organization.Address]).join(' '),
        cell: (organization) => <SupplierOrganizationNameCell organization={organization} />,
      },
      {
        id: 'identifiers',
        header: t('Коди'),
        width: 220,
        minWidth: 188,
        accessor: (organization) => compactStrings([organization.TIN, organization.USREOU, organization.SROI]).join(' '),
        cell: (organization) => <SupplierOrganizationIdentifiersCell organization={organization} />,
      },
      {
        id: 'organization',
        header: t('Організація / договори'),
        width: 292,
        minWidth: 238,
        fill: true,
        accessor: (organization) => compactStrings([getAgreementOrganizations(organization), getAgreementNames(organization), getAgreementCurrencies(organization)]).join(' '),
        cell: (organization) => <SupplierOrganizationAgreementCell organization={organization} />,
      },
      {
        id: 'contact',
        header: t('Контакти'),
        width: 210,
        minWidth: 176,
        accessor: (organization) =>
          compactStrings([
            organization.ContactPersonName,
            organization.ContactPersonEmail,
            organization.EmailAddress,
            organization.PhoneNumber,
            organization.ContactPersonPhone,
          ]).join(' '),
        cell: (organization) => <SupplierOrganizationContactCell organization={organization} />,
      },
      {
        id: 'bank',
        header: t('Реквізити'),
        width: 238,
        minWidth: 198,
        accessor: (organization) =>
          compactStrings([
            organization.Bank,
            organization.Requisites,
            organization.BankAccount,
            organization.BankAccountEUR,
            organization.SwiftBic,
            organization.Swift,
          ]).join(' '),
        cell: (organization) => <SupplierOrganizationBankCell organization={organization} />,
      },
      {
        id: 'balance',
        header: t('Баланс'),
        width: 126,
        minWidth: 112,
        align: 'right',
        accessor: (organization) => organization.TotalAgreementsCurrentEuroAmount ?? Number.NEGATIVE_INFINITY,
        cell: (organization) => <SupplierOrganizationBalanceCell organization={organization} />,
      },
      {
        id: 'created',
        header: t('Створено'),
        width: 138,
        minWidth: 124,
        accessor: (organization) => organization.Created || '',
        cell: (organization) => <SupplierOrganizationDateCell organization={organization} value={formatDateTime(organization.Created)} />,
      },
    ],
    [t],
  )
}

function SupplierOrganizationNameCell({ organization }: { organization: SupplyOrganization }) {
  const title = displayValue(organization.Name)
  const subtitle = compactStrings([organization.ContactPersonName, getAgreementOrganizations(organization), organization.Address])[0] || ''
  const tooltip = compactStrings([title, subtitle, organization.Address]).join('\n')

  return (
    <span className="supplier-organizations-name-cell" title={nativeTitle(tooltip)}>
      <span className="supplier-organizations-name-copy">
        <span className="supplier-organizations-name-title">{title}</span>
        <span className="supplier-organizations-name-subtitle">{subtitle}</span>
      </span>
    </span>
  )
}

function SupplierOrganizationIdentifiersCell({ organization }: { organization: SupplyOrganization }) {
  const { t } = useI18n()
  const identifiers = [
    { label: t('ІПН'), value: organization.TIN },
    { label: t('ЄДРПОУ'), value: organization.USREOU },
    { label: t('СВ'), value: organization.SROI },
  ].filter((item) => item.value)

  if (identifiers.length === 0) {
    return null
  }

  return (
    <span className="supplier-organizations-tags-cell">
      {identifiers.slice(0, 3).map((item) => (
        <span key={item.label} className="supplier-organizations-id-tag" title={nativeTitle(`${item.label}: ${item.value}`)}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </span>
      ))}
    </span>
  )
}

function SupplierOrganizationAgreementCell({ organization }: { organization: SupplyOrganization }) {
  const organizations = displayValue(getAgreementOrganizations(organization))
  const agreements = displayValue(getAgreementNames(organization))
  const currencies = getAgreementCurrencies(organization)
  const tooltip = compactStrings([organizations, agreements, currencies]).join('\n')

  return (
    <span className="supplier-organizations-two-line-cell is-separated" title={nativeTitle(tooltip)}>
      <span>{organizations}</span>
      <span className="supplier-organizations-agreement-pills">
        {agreements ? (
          <Badge className="app-role-pill supplier-organizations-agreement-pill" variant="light">
            {agreements}
          </Badge>
        ) : null}
        {currencies ? (
          <Badge className="app-role-pill is-gray supplier-organizations-agreement-pill" variant="light">
            {currencies}
          </Badge>
        ) : null}
      </span>
    </span>
  )
}

function SupplierOrganizationContactCell({ organization }: { organization: SupplyOrganization }) {
  const primary = displayValue(organization.ContactPersonName || organization.PhoneNumber || organization.ContactPersonPhone)
  const secondary = displayValue(organization.ContactPersonEmail || organization.EmailAddress || organization.ContactPersonPhone || organization.PhoneNumber)
  const tooltip = compactStrings([primary, secondary, organization.ContactPersonComment]).join('\n')

  return (
    <span className="supplier-organizations-two-line-cell" title={nativeTitle(tooltip)}>
      <span>{primary}</span>
      <small>{secondary}</small>
    </span>
  )
}

function SupplierOrganizationBankCell({ organization }: { organization: SupplyOrganization }) {
  const primary = displayValue(organization.Bank || organization.Requisites || organization.BankAccount)
  const secondary = displayValue(organization.BankAccount || organization.BankAccountEUR || organization.SwiftBic || organization.Swift)
  const tooltip = compactStrings([primary, secondary, organization.Beneficiary, organization.BeneficiaryBank]).join('\n')

  return (
    <span className="supplier-organizations-bank-cell" title={nativeTitle(tooltip)}>
      <span className="supplier-organizations-two-line-cell">
        <span>{primary}</span>
        <small>{secondary}</small>
      </span>
    </span>
  )
}

function SupplierOrganizationBalanceCell({ organization }: { organization: SupplyOrganization }) {
  const rawAmount = organization.TotalAgreementsCurrentEuroAmount
  const amount = formatMoney(rawAmount)
  const currency = amount ? getAgreementCurrencies(organization) || 'EUR' : ''
  const isNegative = typeof rawAmount === 'number' && rawAmount < 0

  return (
    <span className={`supplier-organizations-balance-cell${isNegative ? ' is-negative' : ''}`} title={nativeTitle(compactStrings([amount, currency]).join(' '))}>
      <strong>{amount}</strong>
      <small>{currency}</small>
    </span>
  )
}

function SupplierOrganizationDateCell({ organization, value }: { organization: SupplyOrganization; value: string }) {
  const { t } = useI18n()
  const residency = organization.IsNotResident ? t('Нерезидент') : null

  return (
    <span className="supplier-organizations-date-cell" title={nativeTitle(compactStrings([value, residency]).join('\n'))}>
      <span>{value}</span>
      {residency ? <small className="is-foreign">{residency}</small> : null}
    </span>
  )
}

function SupplierOrganizationActionModal({
  organization,
  onClose,
  onOpenCashFlow,
  onOpenEdit,
}: {
  organization: SupplyOrganization | null
  onClose: () => void
  onOpenCashFlow: (organization: SupplyOrganization) => void
  onOpenEdit: (organization: SupplyOrganization) => void
}) {
  const { t } = useI18n()
  const isActive = organization?.Deleted !== true

  return (
    <AppModal
      centered
      opened={Boolean(organization)}
      size={496}
      title={
        <span className="supplier-organizations-action-title">
          <span className={`supplier-organizations-action-status-dot${isActive ? ' is-active' : ''}`} />
          {organization ? displayValue(organization.Name) || t('Постачальник послуг') : t('Постачальник послуг')}
        </span>
      }
      onClose={onClose}
    >
      {organization && (
        <Stack className="app-modal-actions" gap="xs">
          <PermissionGate permissionKey="SERVICE_Accounting_Supplier_Organizations_SettlementsBtn_PKEY">
            <Button
              fullWidth
              color="dark"
              justify="flex-start"
              leftSection={
                <span className="app-action-icon">
                  <Wallet size={20} color="var(--mantine-color-gray-7)" />
                </span>
              }
              size="md"
              variant="subtle"
              onClick={() => onOpenCashFlow(organization)}
            >
              {t('Взаєморозрахунки')}
            </Button>
          </PermissionGate>
          <PermissionGate permissionKey="SERVICE_Accounting_Supplier_Organizations_OverviewBtn_PKEY">
            <Button
              fullWidth
              color="dark"
              justify="flex-start"
              leftSection={
                <span className="app-action-icon">
                  <ExternalLink size={20} color="var(--mantine-color-gray-7)" />
                </span>
              }
              size="md"
              variant="subtle"
              onClick={() => onOpenEdit(organization)}
            >
              {t('Перегляд')}
            </Button>
          </PermissionGate>
        </Stack>
      )}
    </AppModal>
  )
}

function DocumentModal({ document, onClose }: { document: SupplyOrganizationDocumentExport | null; onClose: () => void }) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(document)} title={t('Документ')} onClose={onClose}>
      <Stack gap="sm">
        {document?.DocumentURL && (
          <Anchor href={upgradeHttpToHttps(document.DocumentURL)} target="_blank" rel="noreferrer" className="document-link">
            <Group gap="xs">
              <ExcelIcon size={22} />
              <span>{t('Завантажити Excel')}</span>
            </Group>
          </Anchor>
        )}
        {document?.PdfDocumentURL && (
          <Anchor href={upgradeHttpToHttps(document.PdfDocumentURL)} target="_blank" rel="noreferrer" className="document-link">
            <Group gap="xs">
              <FileText size={22} strokeWidth={1.8} />
              <span>{t('Завантажити PDF')}</span>
            </Group>
          </Anchor>
        )}
        {!document?.DocumentURL && !document?.PdfDocumentURL && <Text c="dimmed">{t('Документ не повернув посилання')}</Text>}
      </Stack>
    </AppModal>
  )
}

function getDateFilterError(dateFrom: string, dateTo: string): string | null {
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return 'Дата початку не може бути пізніше дати завершення'
  }

  return null
}

function getAgreementOrganizations(organization: SupplyOrganization): string {
  return uniqueStrings((organization.SupplyOrganizationAgreements || []).map((agreement) => agreement.Organization?.Name)).join(' · ')
}

function getAgreementNames(organization: SupplyOrganization): string {
  return uniqueStrings((organization.SupplyOrganizationAgreements || []).map((agreement) => agreement.Name || agreement.Number)).join(' · ')
}

function getAgreementCurrencies(organization: SupplyOrganization): string {
  return uniqueStrings((organization.SupplyOrganizationAgreements || []).map((agreement) => agreement.Currency?.Code || agreement.Currency?.Name)).join(' · ')
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(compactStrings(values))]
}

function compactStrings(values: Array<string | null | undefined>): string[] {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))
}

function readStoredSearch(): string {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(SEARCH_STORAGE_KEY) || ''
}

function formatDateTime(value?: string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateFormatter.format(date)
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : ''
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }

  return typeof value === 'string' ? value.trim() : ''
}

function nativeTitle(value: string): string | undefined {
  const title = value.trim()

  return title ? title : undefined
}
