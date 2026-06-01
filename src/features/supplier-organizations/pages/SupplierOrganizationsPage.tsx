import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconCash,
  IconDownload,
  IconEye,
  IconFileTypePdf,
  IconPlus,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  exportSupplyOrganizations,
  getSupplyOrganizations,
  searchSupplyOrganizations,
} from '../api/supplierOrganizationsApi'
import type { SupplyOrganization, SupplyOrganizationDocumentExport } from '../types'

const SEARCH_STORAGE_KEY = 'searchSupplyOrganization'

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['created', 'name'],
    right: ['actions'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function SupplierOrganizationsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()

  function openOrganizationSheet(path: string) {
    navigate(path, { state: { backgroundLocation: location } })
  }

  const [organizations, setOrganizations] = useValueState<SupplyOrganization[]>([])
  const [searchValue, setSearchValue] = useValueState(() => readStoredSearch())
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isExporting, setExporting] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<SupplyOrganizationDocumentExport | null>(null)
  const [selectedOrganization, setSelectedOrganization] = useValueState<SupplyOrganization | null>(null)
  const requestRef = useRef(0)

  useEffect(() => {
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    const timeoutId = window.setTimeout(() => {
      setLoading(true)
      setError(null)

      async function loadOrganizations() {
        try {
          const nextOrganizations = searchValue ? await searchSupplyOrganizations(searchValue) : await getSupplyOrganizations()

          if (requestRef.current === requestId) {
            setOrganizations(nextOrganizations)
          }
        } catch (loadError) {
          if (requestRef.current === requestId) {
            setOrganizations([])
            setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити постачальників послуг'))
          }
        } finally {
          if (requestRef.current === requestId) {
            setLoading(false)
          }
        }
      }

      void loadOrganizations()
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [searchValue, setError, setLoading, setOrganizations, t])

  async function reloadOrganizations() {
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setLoading(true)
    setError(null)

    try {
      const nextOrganizations = searchValue ? await searchSupplyOrganizations(searchValue) : await getSupplyOrganizations()

      if (requestRef.current === requestId) {
        setOrganizations(nextOrganizations)
      }
    } catch (loadError) {
      if (requestRef.current === requestId) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося оновити постачальників послуг'))
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false)
      }
    }
  }

  async function exportList() {
    setExporting(true)
    setError(null)

    try {
      const document = await exportSupplyOrganizations(searchValue)
      setDownloadDocument(document)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ'))
    } finally {
      setExporting(false)
    }
  }

  function updateSearchValue(value: string) {
    setSearchValue(value)
    setOrganizations([])

    if (value) {
      window.localStorage.setItem(SEARCH_STORAGE_KEY, value)
    } else {
      window.localStorage.removeItem(SEARCH_STORAGE_KEY)
    }
  }

  const columns = useSupplierOrganizationColumns({
    onOpenActions: setSelectedOrganization,
    onOpenCashFlow: (organization) => navigate(`/accounting/supplier-organizations/cash-flow/${organization.NetUid}`),
    onOpenEdit: (organization) => openOrganizationSheet(`/accounting/supplier-organizations/edit/${organization.NetUid}`),
  })

  return (
    <Stack gap="md">
      <Group justify="space-between" align="end" gap="sm">
        <TextInput
          leftSection={<IconSearch size={16} />}
          label={t('Пошук')}
          placeholder={t('Назва, код, телефон або email')}
          value={searchValue}
          style={{ flex: '1 1 320px' }}
          onChange={(event) => updateSearchValue(event.currentTarget.value)}
        />
        <Group gap="xs">
          <PermissionGate permissionKey="SERVICE_Accounting_Supplier_Organizations_AddBtn_PKEY">
            <Button leftSection={<IconPlus size={16} />} onClick={() => openOrganizationSheet('/accounting/supplier-organizations/new')}>
              {t('Додати')}
            </Button>
          </PermissionGate>
          <Tooltip label={t('Друк')}>
            <ActionIcon aria-label={t('Друк')} color="gray" loading={isExporting} size={38} variant="light" onClick={exportList}>
              <IconDownload size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Оновити')}>
            <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={38} variant="light" onClick={() => void reloadOrganizations()}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Group gap="xs">
        <Badge color="violet" variant="light">
          {t('Постачальників')}: {organizations.length}
        </Badge>
      </Group>

      <DataTable
        columns={columns}
        data={organizations}
        defaultLayout={TABLE_DEFAULT_LAYOUT}
        emptyText={t('Постачальників послуг не знайдено')}
        getRowId={(organization, index) => String(organization.NetUid || organization.Id || index)}
        isLoading={isLoading}
        layoutVersion="supplier-organizations-1"
        maxHeight="calc(100vh - 260px)"
        minWidth={1450}
        tableId="supplier-organizations"
        onRowClick={setSelectedOrganization}
      />

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

function useSupplierOrganizationColumns({
  onOpenActions,
  onOpenCashFlow,
  onOpenEdit,
}: {
  onOpenActions: (organization: SupplyOrganization) => void
  onOpenCashFlow: (organization: SupplyOrganization) => void
  onOpenEdit: (organization: SupplyOrganization) => void
}): DataTableColumn<SupplyOrganization>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SupplyOrganization>[]>(
    () => [
      {
        id: 'created',
        header: t('Створено'),
        width: 145,
        minWidth: 130,
        accessor: (organization) => organization.Created,
        cell: (organization) => formatDateTime(organization.Created),
      },
      {
        id: 'name',
        header: t('Назва'),
        width: 260,
        minWidth: 220,
        accessor: (organization) => organization.Name,
        cell: (organization) => <Text fw={600}>{displayValue(organization.Name)}</Text>,
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 180,
        minWidth: 150,
        accessor: (organization) => getPrimaryAgreement(organization)?.Organization?.Name,
        cell: (organization) => displayValue(getPrimaryAgreement(organization)?.Organization?.Name),
      },
      {
        id: 'tin',
        header: t('ІПН'),
        width: 120,
        minWidth: 100,
        accessor: (organization) => organization.TIN,
        cell: (organization) => displayValue(organization.TIN),
      },
      {
        id: 'vat',
        header: t('ПДВ'),
        width: 120,
        minWidth: 100,
        accessor: (organization) => organization.SROI,
        cell: (organization) => displayValue(organization.SROI),
      },
      {
        id: 'usreou',
        header: t('ЄДРПОУ'),
        width: 120,
        minWidth: 100,
        accessor: (organization) => organization.USREOU,
        cell: (organization) => displayValue(organization.USREOU),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 110,
        minWidth: 90,
        accessor: (organization) => getPrimaryAgreement(organization)?.Currency?.Code,
        cell: (organization) => displayValue(getPrimaryAgreement(organization)?.Currency?.Code || getPrimaryAgreement(organization)?.Currency?.Name),
      },
      {
        id: 'balance',
        header: t('Баланс EUR'),
        width: 130,
        minWidth: 110,
        align: 'right',
        accessor: (organization) => organization.TotalAgreementsCurrentEuroAmount,
        cell: (organization) => formatMoney(organization.TotalAgreementsCurrentEuroAmount),
      },
      {
        id: 'contact',
        header: t('Контакт'),
        width: 170,
        minWidth: 130,
        accessor: (organization) => organization.ContactPersonName,
        cell: (organization) => displayValue(organization.ContactPersonName),
      },
      {
        id: 'phone',
        header: t('Телефон'),
        width: 150,
        minWidth: 120,
        accessor: (organization) => organization.PhoneNumber || organization.ContactPersonPhone,
        cell: (organization) => displayValue(organization.PhoneNumber || organization.ContactPersonPhone),
      },
      {
        id: 'address',
        header: t('Адреса'),
        width: 260,
        minWidth: 180,
        accessor: (organization) => organization.Address,
        cell: (organization) => displayValue(organization.Address),
      },
      {
        id: 'resident',
        header: t('Нерезидент'),
        width: 120,
        minWidth: 105,
        accessor: (organization) => organization.IsNotResident,
        cell: (organization) => (organization.IsNotResident ? t('Так') : t('Ні')),
      },
      {
        id: 'bankDetails',
        header: t('Банк'),
        width: 170,
        minWidth: 130,
        accessor: (organization) => organization.Requisites || organization.Bank,
        cell: (organization) => displayValue(organization.Requisites || organization.Bank),
      },
      {
        id: 'actions',
        header: '',
        width: 112,
        minWidth: 100,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (organization) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <PermissionGate permissionKey="SERVICE_Accounting_Supplier_Organizations_SettlementsBtn_PKEY">
              <Tooltip label={t('Взаєморозрахунки')}>
                <ActionIcon
                  aria-label={t('Взаєморозрахунки')}
                  color="gray"
                  size="sm"
                  variant="subtle"
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpenCashFlow(organization)
                  }}
                >
                  <IconCash size={16} />
                </ActionIcon>
              </Tooltip>
            </PermissionGate>
            <PermissionGate permissionKey="SERVICE_Accounting_Supplier_Organizations_OverviewBtn_PKEY">
              <Tooltip label={t('Перегляд')}>
                <ActionIcon
                  aria-label={t('Перегляд')}
                  color="gray"
                  size="sm"
                  variant="subtle"
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpenEdit(organization)
                  }}
                >
                  <IconEye size={16} />
                </ActionIcon>
              </Tooltip>
            </PermissionGate>
            <Tooltip label={t('Дії')}>
              <ActionIcon
                aria-label={t('Дії')}
                color="gray"
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenActions(organization)
                }}
              >
                <IconSearch size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
      },
    ],
    [onOpenActions, onOpenCashFlow, onOpenEdit, t],
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
          <Anchor href={document.DocumentURL} target="_blank" rel="noreferrer" className="document-link">
            <Group gap="xs">
              <ExcelIcon size={22} />
              <span>{t('Excel')}</span>
            </Group>
          </Anchor>
        )}
        {document?.PdfDocumentURL && (
          <Anchor href={document.PdfDocumentURL} target="_blank" rel="noreferrer" className="document-link">
            <Group gap="xs">
              <IconFileTypePdf size={22} stroke={1.8} />
              <span>{t('PDF')}</span>
            </Group>
          </Anchor>
        )}
        {!document?.DocumentURL && !document?.PdfDocumentURL && <Text c="dimmed">{t('Документ не повернув посилання')}</Text>}
      </Stack>
    </AppModal>
  )
}

function getPrimaryAgreement(organization: SupplyOrganization) {
  return organization.SupplyOrganizationAgreements?.[0] || null
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
