import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Divider,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconDownload,
  IconEye,
  IconFileTypePdf,
  IconFileTypeXls,
  IconRefresh,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { exportAccountingCashFlowDocument } from '../../accounting-cash-flow/api/accountingCashFlowApi'
import type {
  AccountingCashFlow,
  AccountingCashFlowDocument,
  AccountingCashFlowHeadItem,
} from '../../accounting-cash-flow/types'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  getSupplierOrganizationCashFlow,
  getSupplyOrganization,
} from '../api/supplierOrganizationsApi'
import type { SupplyOrganization } from '../types'

const ACCOUNTING_TYPES = [
  { label: 'Усі', value: '2' },
  { label: 'Управлінський', value: '0' },
  { label: 'Бухгалтерський', value: '1' },
]

const CASH_FLOW_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['date', 'name'],
    right: ['actions'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const TYPE_LABELS: Record<number, string> = {
  0: 'Протокол оплати постачання',
  2: 'Контейнерний сервіс',
  3: 'Митний сервіс',
  4: 'Портові роботи',
  5: 'Транспортний сервіс',
  6: 'Портово-митний сервіс',
  7: 'Митне агентство',
  8: 'Авіадоставка',
  9: 'Автодоставка',
  10: 'Витратний ордер',
  11: 'Видатковий платіж',
  12: 'Вхідний платіж',
  13: 'Продаж',
  14: 'Платіжне завдання постачання',
  15: 'Повернення продажу',
  16: 'Постачання Україна',
  17: 'Обʼєднаний сервіс',
  18: 'Протокол оплати постачання Україна',
  20: 'Оприбуткування Україна',
  22: 'Контейнерне платіжне завдання',
  33: 'Коносамент',
  34: 'Бухгалтерський коносамент',
  35: 'Акт надання послуг',
  36: 'Бухгалтерський акт надання послуг',
  37: 'Перепродаж',
}

const DETAIL_SOURCE_FIELDS: (keyof AccountingCashFlowHeadItem)[] = [
  'OutcomePaymentOrder',
  'IncomePaymentOrder',
  'Sale',
  'SaleReturn',
  'ConsumablesOrder',
  'SupplyOrderPaymentDeliveryProtocol',
  'SupplyOrderUkrainePaymentDeliveryProtocol',
  'SupplyPaymentTask',
  'AccountingContainerPaymentTask',
  'ContainerService',
  'CustomService',
  'PortWorkService',
  'TransportationService',
  'PortCustomAgencyService',
  'CustomAgencyService',
  'PlaneDeliveryService',
  'VehicleDeliveryService',
  'VehicleService',
  'MergedService',
  'BillOfLadingService',
  'ProductIncome',
  'UpdatedReSaleModel',
]

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function SupplierOrganizationCashFlowPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { id } = useParams()
  const [organization, setOrganization] = useValueState<SupplyOrganization | null>(null)
  const [cashFlow, setCashFlow] = useValueState<AccountingCashFlow | null>(null)
  const [selectedAgreementNetUid, setSelectedAgreementNetUid] = useValueState('')
  const [fromDate, setFromDate] = useValueState(() => shiftDate(-30))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [typePaymentTask, setTypePaymentTask] = useValueState('2')
  const [selectedRow, setSelectedRow] = useValueState<AccountingCashFlowHeadItem | null>(null)
  const [downloadDocument, setDownloadDocument] = useValueState<AccountingCashFlowDocument | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoadingOrganization, setLoadingOrganization] = useValueState(false)
  const [isLoadingCashFlow, setLoadingCashFlow] = useValueState(false)
  const [isExporting, setExporting] = useValueState(false)
  const organizationRequestRef = useRef(0)
  const cashFlowRequestRef = useRef(0)

  const loadOrganization = useCallback(async () => {
    if (!id) {
      return
    }

    const requestId = organizationRequestRef.current + 1
    organizationRequestRef.current = requestId
    setLoadingOrganization(true)
    setError(null)

    try {
      const nextOrganization = await getSupplyOrganization(id)

      if (organizationRequestRef.current === requestId) {
        setOrganization(nextOrganization)
      }
    } catch (loadError) {
      if (organizationRequestRef.current === requestId) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити постачальника послуг'))
      }
    } finally {
      if (organizationRequestRef.current === requestId) {
        setLoadingOrganization(false)
      }
    }
  }, [id, setError, setLoadingOrganization, setOrganization, t])

  useEffect(() => {
    void loadOrganization()
  }, [loadOrganization])

  const netId = selectedAgreementNetUid || id || ''

  const loadCashFlow = useCallback(async () => {
    if (!netId) {
      return
    }

    const requestId = cashFlowRequestRef.current + 1
    cashFlowRequestRef.current = requestId
    setLoadingCashFlow(true)
    setError(null)

    try {
      const nextCashFlow = await getSupplierOrganizationCashFlow({
        from: fromDate,
        netId,
        to: toDate,
        typePaymentTask: Number(typePaymentTask),
      })

      if (cashFlowRequestRef.current === requestId) {
        setCashFlow(nextCashFlow)
      }
    } catch (loadError) {
      if (cashFlowRequestRef.current === requestId) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити взаєморозрахунки'))
      }
    } finally {
      if (cashFlowRequestRef.current === requestId) {
        setLoadingCashFlow(false)
      }
    }
  }, [fromDate, netId, setCashFlow, setError, setLoadingCashFlow, t, toDate, typePaymentTask])

  useEffect(() => {
    void loadCashFlow()
  }, [loadCashFlow])

  async function exportDocument() {
    if (!netId) {
      return
    }

    setExporting(true)
    setError(null)

    try {
      const document = await exportAccountingCashFlowDocument({
        from: fromDate,
        netId,
        to: toDate,
      })
      setDownloadDocument(document)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ'))
    } finally {
      setExporting(false)
    }
  }

  const agreements = organization?.SupplyOrganizationAgreements || []
  const rows = cashFlow?.AccountingCashFlowHeadItems || []
  const columns = useCashFlowColumns(setSelectedRow)

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" gap="sm">
        <Group gap="xs">
          <Tooltip label={t('Назад')}>
            <ActionIcon aria-label={t('Назад')} color="gray" size={38} variant="light" onClick={() => navigate('/accounting/supplier-organizations')}>
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <Stack gap={0}>
            <Text fw={700} size="lg">
              {t('Взаєморозрахунки')}
            </Text>
            <Text c="dimmed" size="sm">
              {displayValue(organization?.Name)}
            </Text>
          </Stack>
        </Group>
        <Group gap="xs">
          <Tooltip label={t('Друк')}>
            <ActionIcon aria-label={t('Друк')} color="gray" loading={isExporting} size={38} variant="light" onClick={exportDocument}>
              <IconDownload size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={isLoadingOrganization || isLoadingCashFlow}
              size={38}
              variant="light"
              onClick={() => {
                void loadOrganization()
                void loadCashFlow()
              }}
            >
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

      <Group align="end" gap="sm">
        <TextInput label={t('Від')} type="date" value={fromDate} onChange={(event) => setFromDate(event.currentTarget.value)} />
        <TextInput label={t('До')} type="date" value={toDate} onChange={(event) => setToDate(event.currentTarget.value)} />
        <Select
          data={ACCOUNTING_TYPES.map((item) => ({ ...item, label: t(item.label) }))}
          label={t('Тип')}
          value={typePaymentTask}
          w={210}
          onChange={(value) => setTypePaymentTask(value || '2')}
        />
      </Group>

      <Group gap="xs">
        <Button
          size="xs"
          variant={!selectedAgreementNetUid ? 'filled' : 'light'}
          onClick={() => setSelectedAgreementNetUid('')}
        >
          {t('Усі договори')}
        </Button>
        {agreements.map((agreement) => (
          <Button
            key={agreement.NetUid || agreement.Id || agreement.Name}
            size="xs"
            variant={selectedAgreementNetUid === agreement.NetUid ? 'filled' : 'light'}
            onClick={() => setSelectedAgreementNetUid(agreement.NetUid || '')}
          >
            {displayValue(agreement.Name)}
          </Button>
        ))}
      </Group>

      <Group gap="xs">
        <Badge color="blue" variant="light">
          {t('Рядків')}: {rows.length}
        </Badge>
        <Badge color="gray" variant="light">
          {t('Баланс до')}: {formatMoney(cashFlow?.BeforeRangeBalance)}
        </Badge>
        <Badge color="gray" variant="light">
          {t('Баланс після')}: {formatMoney(cashFlow?.AfterRangeInAmount)}
        </Badge>
      </Group>

      <DataTable
        columns={columns}
        data={rows}
        defaultLayout={CASH_FLOW_TABLE_DEFAULT_LAYOUT}
        emptyText={t('Взаєморозрахунків не знайдено')}
        getRowId={(row, index) => String(row.NetUid || row.Number || `${row.Type || 'row'}-${index}`)}
        isLoading={isLoadingCashFlow}
        layoutVersion="supplier-organization-cash-flow-1"
        maxHeight="calc(100vh - 340px)"
        minWidth={1120}
        tableId={`supplier-organization-cash-flow-${netId || 'empty'}`}
        onRowClick={setSelectedRow}
      />

      <CashFlowDetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
      <DocumentModal document={downloadDocument} onClose={() => setDownloadDocument(null)} />
    </Stack>
  )
}

function useCashFlowColumns(onOpen: (row: AccountingCashFlowHeadItem) => void): DataTableColumn<AccountingCashFlowHeadItem>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<AccountingCashFlowHeadItem>[]>(
    () => [
      {
        id: 'date',
        header: t('Дата'),
        width: 145,
        minWidth: 130,
        accessor: (row) => row.FromDate,
        cell: (row) => formatDateTime(row.FromDate),
      },
      {
        id: 'name',
        header: t('Назва'),
        width: 260,
        minWidth: 220,
        accessor: (row) => row.Name,
        cell: (row) => <Text fw={600}>{displayValue(row.Name)}</Text>,
      },
      {
        id: 'type',
        header: t('Тип'),
        width: 180,
        minWidth: 145,
        accessor: (row) => getTypeLabel(row.Type),
        cell: (row) => getTypeLabel(row.Type),
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 150,
        minWidth: 120,
        accessor: (row) => row.Number,
        cell: (row) => displayValue(row.Number),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 180,
        minWidth: 145,
        accessor: (row) => row.OrganizationName,
        cell: (row) => displayValue(row.OrganizationName),
      },
      {
        id: 'debit',
        header: t('Дебет'),
        width: 125,
        minWidth: 110,
        align: 'right',
        accessor: (row) => (!row.IsCreditValue ? row.CurrentValue : undefined),
        cell: (row) => (!row.IsCreditValue ? formatMoney(row.CurrentValue) : '—'),
      },
      {
        id: 'credit',
        header: t('Кредит'),
        width: 125,
        minWidth: 110,
        align: 'right',
        accessor: (row) => (row.IsCreditValue ? row.CurrentValue : undefined),
        cell: (row) => (row.IsCreditValue ? formatMoney(row.CurrentValue) : '—'),
      },
      {
        id: 'balance',
        header: t('Баланс'),
        width: 125,
        minWidth: 110,
        align: 'right',
        accessor: (row) => row.CurrentBalance,
        cell: (row) => formatMoney(row.CurrentBalance),
      },
      {
        id: 'actions',
        header: '',
        width: 62,
        minWidth: 58,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (row) => (
          <Tooltip label={t('Деталі')}>
            <ActionIcon
              aria-label={t('Деталі')}
              color="gray"
              size="sm"
              variant="subtle"
              onClick={(event) => {
                event.stopPropagation()
                onOpen(row)
              }}
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
        ),
      },
    ],
    [onOpen, t],
  )
}

function CashFlowDetailDrawer({ row, onClose }: { row: AccountingCashFlowHeadItem | null; onClose: () => void }) {
  const { t } = useI18n()
  const source = row ? getDetailSource(row) : null

  return (
    <AppDrawer opened={Boolean(row)} padding="md" size="lg" title={t('Деталі взаєморозрахунку')} onClose={onClose}>
      {row && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DetailItem label={t('Дата')} value={formatDateTime(row.FromDate)} />
            <DetailItem label={t('Тип')} value={getTypeLabel(row.Type)} />
            <DetailItem label={t('Назва')} value={displayValue(row.Name)} />
            <DetailItem label={t('Номер')} value={displayValue(row.Number)} />
            <DetailItem label={t('Організація')} value={displayValue(row.OrganizationName)} />
            <DetailItem label={t('Сума')} value={formatMoney(row.CurrentValue)} />
            <DetailItem label={t('Баланс')} value={formatMoney(row.CurrentBalance)} />
            <DetailItem label={t('Баланс EUR')} value={formatMoney(row.CurrentBalanceEuro)} />
          </SimpleGrid>
          {source && (
            <>
              <Divider label={t('Джерело')} />
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <DetailItem label={t('Сервісний номер')} value={displayValue(readString(source, 'ServiceNumber'))} />
                <DetailItem label={t('Валюта')} value={displayValue(readNestedString(source, ['SupplyOrganizationAgreement', 'Currency', 'Code']))} />
                <DetailItem label={t('Нетто')} value={formatMoney(readNumber(source, 'NetPrice'))} />
                <DetailItem label={t('Брутто')} value={formatMoney(readNumber(source, 'GrossPrice'))} />
                <DetailItem label={t('ПДВ')} value={formatMoney(readNumber(source, 'Vat'))} />
                <DetailItem label={t('Коментар')} value={displayValue(readString(source, 'Comment'))} />
              </SimpleGrid>
            </>
          )}
        </Stack>
      )}
    </AppDrawer>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs" tt="uppercase">
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </Stack>
  )
}

function DocumentModal({ document, onClose }: { document: AccountingCashFlowDocument | null; onClose: () => void }) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(document)} title={t('Документ')} onClose={onClose}>
      <Stack gap="sm">
        {document?.DocumentURL && (
          <Anchor href={document.DocumentURL} target="_blank" rel="noreferrer" className="document-link">
            <Group gap="xs">
              <IconFileTypeXls size={22} stroke={1.8} />
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

function getDetailSource(row: AccountingCashFlowHeadItem): Record<string, unknown> | null {
  for (const field of DETAIL_SOURCE_FIELDS) {
    const value = row[field]

    if (value && typeof value === 'object') {
      return value as Record<string, unknown>
    }
  }

  return null
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key]

  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function readNestedString(record: Record<string, unknown>, path: string[]): string {
  let current: unknown = record

  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return ''
    }

    current = (current as Record<string, unknown>)[key]
  }

  return typeof current === 'string' || typeof current === 'number' ? String(current) : ''
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]

  return typeof value === 'number' ? value : undefined
}

function getTypeLabel(type?: number): string {
  if (typeof type !== 'number') {
    return '—'
  }

  return TYPE_LABELS[type] || String(type)
}

function shiftDate(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateTimeFormatter.format(date)
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
