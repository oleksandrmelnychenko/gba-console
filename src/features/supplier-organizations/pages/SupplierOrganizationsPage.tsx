import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconBuilding,
  IconBuildingBank,
  IconChevronLeft,
  IconCash,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconDownload,
  IconDots,
  IconEye,
  IconFileTypePdf,
  IconPlus,
  IconRefresh,
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
const SUPPLIER_ORGANIZATIONS_PAGE_SIZE = 40
const pageSizeOptions = ['20', '40', '60', '100']

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

type SupplierOrganizationSortId = 'balance' | 'bank' | 'contact' | 'created' | 'identifiers' | 'name' | 'organization'

type SupplierOrganizationSortState = {
  direction: 'asc' | 'desc'
  id: SupplierOrganizationSortId
} | null

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
  const [sortState, setSortState] = useValueState<SupplierOrganizationSortState>(null)
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

  const sortedOrganizations = useMemo(() => sortSupplierOrganizations(organizations, sortState), [organizations, sortState])
  const hasActiveFilters = Boolean(searchValue.trim() || dateFrom || dateTo)
  const canMoveBackward = page > 1
  const canMoveForward = hasMore

  function toggleSort(id: SupplierOrganizationSortId) {
    setSortState((current) => {
      if (current?.id !== id) {
        return { direction: 'asc', id }
      }

      return { direction: current.direction === 'asc' ? 'desc' : 'asc', id }
    })
  }

  return (
    <Stack className="supplier-organizations-page console-table-page" gap="md">
      <PermissionGate permissionKey="SERVICE_Accounting_Supplier_Organizations_AddBtn_PKEY">
        <PageHeaderActions>
          <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<IconPlus size={16} />} onClick={() => openOrganizationSheet('/accounting/supplier-organizations/new')}>
            {t('Додати')}
          </Button>
        </PageHeaderActions>
      </PermissionGate>

      <div className="console-table-shell">
        <div className="supplier-organizations-command-bar">
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
          <div className="supplier-organizations-command-actions">
            <Tooltip label={t('Скинути')}>
              <ActionIcon
                aria-label={t('Скинути')}
                color="gray"
                disabled={!hasActiveFilters}
                size={38}
                variant="light"
                onClick={resetFilters}
              >
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Друк')}>
              <ActionIcon
                aria-label={t('Друк')}
                color="gray"
                disabled={isExporting}
                loading={isExporting}
                size={38}
                variant="light"
                onClick={exportList}
              >
                <IconDownload size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Оновити')}>
              <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={38} variant="light" onClick={() => void reloadOrganizations()}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Select
              aria-label={t('Розмір сторінки')}
              className="supplier-organizations-page-size"
              data={pageSizeOptions}
              value={String(pageSize)}
              onChange={(value) => {
                setPage(1)
                setPageSize(Number(value || SUPPLIER_ORGANIZATIONS_PAGE_SIZE))
              }}
            />
            <ActionIcon
              aria-label={t('Попередня сторінка')}
              color="gray"
              disabled={!canMoveBackward || isLoading}
              size={38}
              variant="light"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            >
              <IconChevronLeft size={18} />
            </ActionIcon>
            <span className="supplier-organizations-current-page">{page}</span>
            <ActionIcon
              aria-label={t('Наступна сторінка')}
              color="gray"
              disabled={!canMoveForward || isLoading}
              size={38}
              variant="light"
              onClick={() => setPage((currentPage) => currentPage + 1)}
            >
              <IconChevronRight size={18} />
            </ActionIcon>
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
          <SupplierOrganizationsList
            isLoading={isLoading}
            organizations={sortedOrganizations}
            sortState={sortState}
            onOpenActions={setSelectedOrganization}
            onOpenCashFlow={(organization) => navigate(`/accounting/supplier-organizations/cash-flow/${organization.NetUid}`)}
            onOpenEdit={(organization) => openOrganizationSheet(`/accounting/supplier-organizations/edit/${organization.NetUid}`)}
            onSort={toggleSort}
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

function SupplierOrganizationsList({
  isLoading,
  organizations,
  sortState,
  onOpenActions,
  onOpenCashFlow,
  onOpenEdit,
  onSort,
}: {
  isLoading: boolean
  organizations: SupplyOrganization[]
  sortState: SupplierOrganizationSortState
  onOpenActions: (organization: SupplyOrganization) => void
  onOpenCashFlow: (organization: SupplyOrganization) => void
  onOpenEdit: (organization: SupplyOrganization) => void
  onSort: (id: SupplierOrganizationSortId) => void
}) {
  const { t } = useI18n()

  return (
    <div className="supplier-organizations-list">
      <div className="supplier-organizations-list-head">
        <SupplierOrganizationSortHeader id="name" label={t('Назва')} sortState={sortState} onSort={onSort} />
        <SupplierOrganizationSortHeader id="identifiers" label={t('Коди')} sortState={sortState} onSort={onSort} />
        <SupplierOrganizationSortHeader id="organization" label={t('Організація / договори')} sortState={sortState} onSort={onSort} />
        <SupplierOrganizationSortHeader id="contact" label={t('Контакти')} sortState={sortState} onSort={onSort} />
        <SupplierOrganizationSortHeader id="bank" label={t('Реквізити')} sortState={sortState} onSort={onSort} />
        <SupplierOrganizationSortHeader id="balance" label={t('Баланс')} sortState={sortState} align="right" onSort={onSort} />
        <SupplierOrganizationSortHeader id="created" label={t('Створено')} sortState={sortState} onSort={onSort} />
        <span aria-hidden />
      </div>

      <div className="supplier-organizations-list-body">
        {isLoading ? (
          <div className="supplier-organizations-list-state">{t('Завантаження постачальників послуг')}</div>
        ) : organizations.length === 0 ? (
          <div className="supplier-organizations-list-state">{t('Постачальників послуг не знайдено')}</div>
        ) : (
          organizations.map((organization, index) => (
            <SupplierOrganizationRow
              key={String(organization.NetUid || organization.Id || index)}
              organization={organization}
              onOpenActions={onOpenActions}
              onOpenCashFlow={onOpenCashFlow}
              onOpenEdit={onOpenEdit}
            />
          ))
        )}
      </div>
    </div>
  )
}

function SupplierOrganizationSortHeader({
  align,
  id,
  label,
  sortState,
  onSort,
}: {
  align?: 'right'
  id: SupplierOrganizationSortId
  label: string
  sortState: SupplierOrganizationSortState
  onSort: (id: SupplierOrganizationSortId) => void
}) {
  const isActive = sortState?.id === id

  return (
    <button
      className={`supplier-organizations-sort-header${isActive ? ' is-active' : ''}${align === 'right' ? ' is-right' : ''}`}
      type="button"
      onClick={() => onSort(id)}
    >
      <span>{label}</span>
      {isActive && sortState?.direction === 'desc' ? <IconChevronDown size={13} /> : <IconChevronUp size={13} />}
    </button>
  )
}

function SupplierOrganizationRow({
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
  return (
    <div
      className="supplier-organizations-row"
      role="button"
      tabIndex={0}
      onClick={() => onOpenActions(organization)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpenActions(organization)
        }
      }}
    >
      <SupplierOrganizationNameCell organization={organization} />
      <SupplierOrganizationIdentifiersCell organization={organization} />
      <SupplierOrganizationAgreementCell organization={organization} />
      <SupplierOrganizationContactCell organization={organization} />
      <SupplierOrganizationBankCell organization={organization} />
      <SupplierOrganizationBalanceCell organization={organization} />
      <SupplierOrganizationDateCell organization={organization} value={formatDateTime(organization.Created)} />
      <SupplierOrganizationActions organization={organization} onOpenActions={onOpenActions} onOpenCashFlow={onOpenCashFlow} onOpenEdit={onOpenEdit} />
    </div>
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

function sortSupplierOrganizations(
  organizations: SupplyOrganization[],
  sortState: SupplierOrganizationSortState,
): SupplyOrganization[] {
  if (!sortState) {
    return organizations
  }

  const direction = sortState.direction === 'asc' ? 1 : -1

  return organizations.toSorted(
    (firstOrganization, secondOrganization) =>
      compareSupplierSortValues(
        getSupplierOrganizationSortValue(firstOrganization, sortState.id),
        getSupplierOrganizationSortValue(secondOrganization, sortState.id),
      ) * direction,
  )
}

function getSupplierOrganizationSortValue(organization: SupplyOrganization, id: SupplierOrganizationSortId): number | string {
  switch (id) {
    case 'balance':
      return organization.TotalAgreementsCurrentEuroAmount ?? Number.NEGATIVE_INFINITY
    case 'bank':
      return compactStrings([organization.Bank, organization.Requisites, organization.BankAccount, organization.BankAccountEUR]).join(' ')
    case 'contact':
      return compactStrings([
        organization.ContactPersonName,
        organization.ContactPersonEmail,
        organization.EmailAddress,
        organization.PhoneNumber,
        organization.ContactPersonPhone,
      ]).join(' ')
    case 'created':
      return organization.Created || ''
    case 'identifiers':
      return compactStrings([organization.TIN, organization.USREOU, organization.SROI]).join(' ')
    case 'name':
      return organization.Name || ''
    case 'organization':
      return compactStrings([getAgreementOrganizations(organization), getAgreementNames(organization), getAgreementCurrencies(organization)]).join(' ')
  }
}

function compareSupplierSortValues(firstValue: number | string, secondValue: number | string): number {
  if (typeof firstValue === 'number' && typeof secondValue === 'number') {
    return firstValue - secondValue
  }

  return String(firstValue).localeCompare(String(secondValue), 'uk', {
    numeric: true,
    sensitivity: 'base',
  })
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
