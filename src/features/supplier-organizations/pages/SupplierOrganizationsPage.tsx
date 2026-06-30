import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconBuilding,
  IconBuildingBank,
  IconCash,
  IconDownload,
  IconDots,
  IconEye,
  IconFileTypePdf,
  IconPlus,
  IconRestore,
  IconSearch,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
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

const SUPPLIER_ORGANIZATIONS_TABLE_DEFAULT_LAYOUT = {
  columnOrder: ['name', 'identifiers', 'organization', 'contact', 'bank', 'balance', 'created', 'actions'],
  columnPinning: {
    left: ['name'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

export function SupplierOrganizationsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()

  const openOrganizationSheet = useCallback(
    (path: string) => {
      navigate(path, {
        state: {
          backgroundLocation: location,
          returnPath: `${location.pathname}${location.search}`,
        },
      })
    },
    [location, navigate],
  )

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
  const requestRef = useRef(0)
  const filterError = getDateFilterError(dateFrom, dateTo)
  const dateFilters = useMemo(() => ({ from: dateFrom || undefined, to: dateTo || undefined }), [dateFrom, dateTo])

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

  const openActions = useCallback(
    (organization: SupplyOrganization) => setSelectedOrganization(organization),
    [setSelectedOrganization],
  )
  const openCashFlow = useCallback(
    (organization: SupplyOrganization) => navigate(`/accounting/supplier-organizations/cash-flow/${organization.NetUid}`),
    [navigate],
  )
  const openEdit = useCallback(
    (organization: SupplyOrganization) => openOrganizationSheet(`/accounting/supplier-organizations/edit/${organization.NetUid}`),
    [openOrganizationSheet],
  )
  const columns = useSupplierOrganizationColumns(openActions, openCashFlow, openEdit)

  return (
    <Stack className="supplier-organizations-page console-table-page" gap="md">
      <PermissionGate permissionKey="SERVICE_Accounting_Supplier_Organizations_AddBtn_PKEY">
        <PageHeaderActions>
          <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<IconPlus size={16} />} onClick={() => openOrganizationSheet('/accounting/supplier-organizations/new')}>
            {t('Додати')}
          </Button>
        </PageHeaderActions>
      </PermissionGate>

      <Card className="app-data-card supplier-organizations-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar supplier-organizations-command-bar">
          <div className="supplier-organizations-period-filter">
            <span className="supplier-organizations-filter-label">{t('Період')}</span>
            <div className="supplier-organizations-period-fields">
              <TextInput
                className="supplier-organizations-date-input"
                aria-label={t('Від')}
                type="date"
                value={dateFrom}
                onChange={(event) => updateDateFrom(event.currentTarget.value)}
              />
              <span className="supplier-organizations-period-separator" />
              <TextInput
                className="supplier-organizations-date-input"
                aria-label={t('До')}
                type="date"
                value={dateTo}
                onChange={(event) => updateDateTo(event.currentTarget.value)}
              />
            </div>
          </div>

          <TextInput
            className="supplier-organizations-search-input"
            leftSection={<IconSearch size={16} />}
            label={t('Пошук')}
            placeholder={t('Назва, код, телефон або email')}
            value={searchValue}
            onChange={(event) => updateSearchValue(event.currentTarget.value)}
          />
          <div className="app-filter-actions">
            <Tooltip label={t('Скинути')}>
              <ActionIcon
                aria-label={t('Скинути')}
                color="gray"
                disabled={!hasActiveFilters}
                size={34}
                variant="light"
                onClick={resetFilters}
              >
                <IconRestore size={17} />
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
                <IconDownload size={18} />
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
        </div>

        {error && (
          <Alert className="console-table-alert" color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {filterError && (
          <Alert className="console-table-alert" color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
            {filterError}
          </Alert>
        )}

        <div className="supplier-organizations-page__table console-table-body">
          <DataTable
            columns={columns}
            data={organizations}
            defaultLayout={SUPPLIER_ORGANIZATIONS_TABLE_DEFAULT_LAYOUT}
            density="normal"
            emptyText={t('Постачальників послуг не знайдено')}
            getRowId={(organization, index) => String(organization.NetUid || organization.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="supplier-organizations-table-1"
            loadingText={t('Завантаження постачальників послуг')}
            minWidth={1350}
            showDensityToggle={false}
            showLayoutControls={false}
            tableId="supplier-organizations"
            onRowClick={openActions}
          />
        </div>
      </Card>

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

function useSupplierOrganizationColumns(
  onOpenActions: (organization: SupplyOrganization) => void,
  onOpenCashFlow: (organization: SupplyOrganization) => void,
  onOpenEdit: (organization: SupplyOrganization) => void,
) {
  return useMemo<DataTableColumn<SupplyOrganization>[]>(
    () => [
      {
        id: 'name',
        header: 'Назва',
        width: 280,
        minWidth: 260,
        fill: true,
        accessor: (organization) => organization.Name ?? '',
        cell: (organization) => <SupplierOrganizationNameCell organization={organization} />,
      },
      {
        id: 'identifiers',
        header: 'Коди',
        width: 230,
        minWidth: 210,
        accessor: (organization) => compactStrings([organization.TIN, organization.USREOU, organization.SROI]).join(' '),
        cell: (organization) => <SupplierOrganizationIdentifiersCell organization={organization} />,
      },
      {
        id: 'organization',
        header: 'Організація / договори',
        width: 270,
        minWidth: 250,
        accessor: (organization) =>
          compactStrings([
            getAgreementOrganizations(organization),
            getAgreementNames(organization),
            getAgreementCurrencies(organization),
          ]).join(' '),
        cell: (organization) => <SupplierOrganizationAgreementCell organization={organization} />,
      },
      {
        id: 'contact',
        header: 'Контакти',
        width: 200,
        minWidth: 180,
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
        header: 'Реквізити',
        width: 220,
        minWidth: 200,
        accessor: (organization) =>
          compactStrings([organization.Bank, organization.Requisites, organization.BankAccount, organization.BankAccountEUR]).join(' '),
        cell: (organization) => <SupplierOrganizationBankCell organization={organization} />,
      },
      {
        id: 'balance',
        header: 'Баланс',
        width: 120,
        minWidth: 110,
        align: 'right',
        accessor: (organization) => organization.TotalAgreementsCurrentEuroAmount ?? Number.NEGATIVE_INFINITY,
        cell: (organization) => <SupplierOrganizationBalanceCell organization={organization} />,
      },
      {
        id: 'created',
        header: 'Створено',
        width: 140,
        minWidth: 124,
        accessor: (organization) => organization.Created ?? '',
        cell: (organization) => (
          <SupplierOrganizationDateCell organization={organization} value={formatDateTime(organization.Created)} />
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 110,
        minWidth: 110,
        maxWidth: 110,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        cell: (organization) => (
          <SupplierOrganizationActions
            organization={organization}
            onOpenActions={onOpenActions}
            onOpenCashFlow={onOpenCashFlow}
            onOpenEdit={onOpenEdit}
          />
        ),
      },
    ],
    [onOpenActions, onOpenCashFlow, onOpenEdit],
  )
}

function SupplierOrganizationNameCell({ organization }: { organization: SupplyOrganization }) {
  const title = displayValue(organization.Name)
  const subtitle = compactStrings([organization.ContactPersonName, getAgreementOrganizations(organization), organization.Address])[0] || '—'
  const tooltip = compactStrings([title, subtitle, organization.Address]).join('\n')

  return (
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <span className="supplier-organizations-name-cell">
        <span className="supplier-organizations-name-icon" aria-hidden>
          <IconBuilding size={16} />
        </span>
        <span className="supplier-organizations-name-copy">
          <span className="supplier-organizations-name-title">{title}</span>
          <span className="supplier-organizations-name-subtitle">{subtitle}</span>
        </span>
      </span>
    </Tooltip>
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
    return <SupplierOrganizationMutedValue value="—" />
  }

  return (
    <span className="supplier-organizations-tags-cell">
      {identifiers.slice(0, 3).map((item) => (
        <Tooltip key={item.label} label={`${item.label}: ${item.value}`} openDelay={350} withArrow>
          <span className="supplier-organizations-id-tag">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </span>
        </Tooltip>
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
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <span className="supplier-organizations-two-line-cell is-separated">
        <span>{organizations}</span>
        <small>{compactStrings([agreements, currencies]).join(' · ') || '—'}</small>
      </span>
    </Tooltip>
  )
}

function SupplierOrganizationContactCell({ organization }: { organization: SupplyOrganization }) {
  const primary = displayValue(organization.ContactPersonName || organization.PhoneNumber || organization.ContactPersonPhone)
  const secondary = displayValue(organization.ContactPersonEmail || organization.EmailAddress || organization.ContactPersonPhone || organization.PhoneNumber)
  const tooltip = compactStrings([primary, secondary, organization.ContactPersonComment]).join('\n')

  return (
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <span className="supplier-organizations-two-line-cell">
        <span>{primary}</span>
        <small>{secondary}</small>
      </span>
    </Tooltip>
  )
}

function SupplierOrganizationBankCell({ organization }: { organization: SupplyOrganization }) {
  const primary = displayValue(organization.Bank || organization.Requisites || organization.BankAccount)
  const secondary = displayValue(organization.BankAccount || organization.BankAccountEUR || organization.SwiftBic || organization.Swift)
  const tooltip = compactStrings([primary, secondary, organization.Beneficiary, organization.BeneficiaryBank]).join('\n')

  return (
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <span className="supplier-organizations-bank-cell">
        <span className="supplier-organizations-bank-icon" aria-hidden>
          <IconBuildingBank size={14} />
        </span>
        <span className="supplier-organizations-two-line-cell">
          <span>{primary}</span>
          <small>{secondary}</small>
        </span>
      </span>
    </Tooltip>
  )
}

function SupplierOrganizationBalanceCell({ organization }: { organization: SupplyOrganization }) {
  const amount = formatMoney(organization.TotalAgreementsCurrentEuroAmount)
  const currency = getAgreementCurrencies(organization) || 'EUR'

  return (
    <span className="supplier-organizations-balance-cell">
      <strong>{amount}</strong>
      <small>{currency}</small>
    </span>
  )
}

function SupplierOrganizationDateCell({ organization, value }: { organization: SupplyOrganization; value: string }) {
  const { t } = useI18n()
  const residency = organization.IsNotResident ? t('Нерезидент') : null

  return (
    <Tooltip label={residency ? `${value}\n${residency}` : value} multiline={Boolean(residency)} openDelay={350} withArrow>
      <span className="supplier-organizations-date-cell">
        <span>{value}</span>
        {residency ? <small className="is-foreign">{residency}</small> : null}
      </span>
    </Tooltip>
  )
}

function SupplierOrganizationMutedValue({ value }: { value: string }) {
  return (
    <Tooltip label={value} openDelay={350} withArrow>
      <span className="supplier-organizations-muted-value">{value}</span>
    </Tooltip>
  )
}

function SupplierOrganizationActions({
  organization,
  onOpenActions,
  onOpenCashFlow,
  onOpenEdit,
}: {
  organization: SupplyOrganization
  onOpenActions: (organization: SupplyOrganization) => void
  onOpenCashFlow: (organization: SupplyOrganization) => void
  onOpenEdit: (organization: SupplyOrganization) => void
}) {
  const { t } = useI18n()

  return (
    <Group className="supplier-organizations-row-actions" gap={4} justify="flex-end" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
      <PermissionGate permissionKey="SERVICE_Accounting_Supplier_Organizations_SettlementsBtn_PKEY">
        <Tooltip label={t('Взаєморозрахунки')}>
          <ActionIcon aria-label={t('Взаєморозрахунки')} color="gray" size="sm" variant="subtle" onClick={() => onOpenCashFlow(organization)}>
            <IconCash size={15} />
          </ActionIcon>
        </Tooltip>
      </PermissionGate>
      <PermissionGate permissionKey="SERVICE_Accounting_Supplier_Organizations_OverviewBtn_PKEY">
        <Tooltip label={t('Перегляд')}>
          <ActionIcon aria-label={t('Перегляд')} color="gray" size="sm" variant="subtle" onClick={() => onOpenEdit(organization)}>
            <IconEye size={15} />
          </ActionIcon>
        </Tooltip>
      </PermissionGate>
      <Tooltip label={t('Дії')}>
        <ActionIcon aria-label={t('Дії')} color="gray" size="sm" variant="subtle" onClick={() => onOpenActions(organization)}>
          <IconDots size={15} />
        </ActionIcon>
      </Tooltip>
    </Group>
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

  return (
    <AppModal centered opened={Boolean(organization)} title={t('Оберіть дію')} onClose={onClose}>
      <Stack gap="sm">
        <Text fw={600}>{displayValue(organization?.Name)}</Text>
        <PermissionGate permissionKey="SERVICE_Accounting_Supplier_Organizations_SettlementsBtn_PKEY">
          <Button
            fullWidth
            justify="flex-start"
            leftSection={<IconCash size={16} />}
            variant="light"
            onClick={() => organization && onOpenCashFlow(organization)}
          >
            {t('Взаєморозрахунки')}
          </Button>
        </PermissionGate>
        <PermissionGate permissionKey="SERVICE_Accounting_Supplier_Organizations_OverviewBtn_PKEY">
          <Button
            fullWidth
            justify="flex-start"
            leftSection={<IconEye size={16} />}
            variant="light"
            onClick={() => organization && onOpenEdit(organization)}
          >
            {t('Перегляд')}
          </Button>
        </PermissionGate>
      </Stack>
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
              <IconFileTypePdf size={22} stroke={1.8} />
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
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateFormatter.format(date)
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '—'
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}
