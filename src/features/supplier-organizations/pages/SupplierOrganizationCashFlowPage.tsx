import {
  ActionIcon,
  Alert,
  Select,
  SimpleGrid,
  Stack,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { CircleAlert, FileDown, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { exportAccountingCashFlowDocument } from '../../accounting-cash-flow/api/accountingCashFlowApi'
import { getAccountingCashFlowClosingBalance } from '../../accounting-cash-flow/cashFlowTotals'
import { CashFlowDetailContent } from '../../accounting-cash-flow/components/CashFlowDetailContent'
import {
  DocumentExportModal,
  type DocumentExportFormat,
} from '../../../shared/ui/document-export-modal/DocumentExportModal'
import type {
  AccountingCashFlow,
  AccountingCashFlowDocument,
  AccountingCashFlowHeadItem,
} from '../../accounting-cash-flow/types'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  closePendingExportDocumentWindow,
  openExportDocumentInWindow,
  openPendingExportDocumentWindow,
} from '../../../shared/documents/openExportDocument'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import {
  getSupplierOrganizationCashFlow,
  getSupplyOrganization,
} from '../api/supplierOrganizationsApi'
import type { SupplyOrganization } from '../types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import './supplier-organization-cash-flow-page.css'

const ACCOUNTING_TYPES = [
  { label: 'Усі', value: '2' },
  { label: 'Управлінський', value: '0' },
  { label: 'Бухгалтерський', value: '1' },
]

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
  const [isExportModalOpen, setExportModalOpen] = useValueState(false)
  const [exportingFormat, setExportingFormat] = useValueState<DocumentExportFormat | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoadingOrganization, setLoadingOrganization] = useValueState(false)
  const [isLoadingCashFlow, setLoadingCashFlow] = useValueState(false)
  const [isExporting, setExporting] = useValueState(false)
  const organizationRequestRef = useRef(0)
  const cashFlowRequestRef = useRef(0)
  const filterError = getDateRangeError(fromDate, toDate)

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

    if (filterError) {
      cashFlowRequestRef.current += 1
      setCashFlow(null)
      setError(null)
      setLoadingCashFlow(false)
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
  }, [filterError, fromDate, netId, setCashFlow, setError, setLoadingCashFlow, t, toDate, typePaymentTask])

  useEffect(() => {
    void loadCashFlow()
  }, [loadCashFlow])

  async function exportDocument(format: DocumentExportFormat) {
    if (!netId || filterError || isExporting) {
      return
    }

    setExporting(true)
    setExportingFormat(format)
    setError(null)

    const pendingWindow = openPendingExportDocumentWindow(
      format === 'pdf' ? t('Друк PDF') : t('Завантаження Excel'),
    )

    try {
      const document = await exportAccountingCashFlowDocument({
        from: fromDate,
        netId,
        to: toDate,
      })

      const documentUrl = format === 'pdf' ? document.PdfDocumentURL : document.DocumentURL

      if (documentUrl && openExportDocumentInWindow(pendingWindow, documentUrl)) {
        setDownloadDocument(null)
        setExportModalOpen(false)
        return
      }

      closePendingExportDocumentWindow(pendingWindow)
      setDownloadDocument(document)
    } catch (exportError) {
      closePendingExportDocumentWindow(pendingWindow)
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ'))
    } finally {
      setExporting(false)
      setExportingFormat(null)
    }
  }

  const agreements = organization?.SupplyOrganizationAgreements || []
  const rows = cashFlow?.AccountingCashFlowHeadItems || []
  const lastItem = rows.at(-1)
  const columns = useMemo<DataTableColumn<AccountingCashFlowHeadItem>[]>(
    () => [
      {
        id: 'name',
        header: t('Назва'),
        fill: true,
        minWidth: 300,
        width: 380,
        accessor: (row) => `${row.Name || ''} ${row.OrganizationName || ''}`,
        cell: (row) => (
          <span className="supplier-cash-flow-document">
            <strong>{displayValue(row.Name)}</strong>
            {row.OrganizationName ? <small>{row.OrganizationName}</small> : null}
          </span>
        ),
      },
      {
        id: 'date',
        header: t('Дата'),
        minWidth: 115,
        width: 125,
        accessor: (row) => row.FromDate,
        cell: (row) => formatDateTime(row.FromDate),
      },
      {
        id: 'number',
        header: t('Номер'),
        minWidth: 120,
        width: 130,
        accessor: (row) => row.Number,
        cell: (row) => displayValue(row.Number),
      },
      {
        id: 'debit',
        header: t('Дебет'),
        align: 'right',
        minWidth: 110,
        width: 120,
        accessor: (row) => (row.IsCreditValue ? undefined : row.CurrentValue),
        cell: (row) =>
          row.IsCreditValue ? null : (
            <SupplierCashFlowMoney value={row.CurrentValue} localValue={row.CurrentValueLocal} />
          ),
      },
      {
        id: 'credit',
        header: t('Кредит'),
        align: 'right',
        minWidth: 110,
        width: 120,
        accessor: (row) => (row.IsCreditValue ? row.CurrentValue : undefined),
        cell: (row) =>
          row.IsCreditValue ? (
            <SupplierCashFlowMoney value={row.CurrentValue} localValue={row.CurrentValueLocal} />
          ) : null,
      },
      {
        id: 'balance',
        header: t('Баланс'),
        align: 'right',
        minWidth: 110,
        width: 120,
        accessor: (row) => row.CurrentBalance,
        cell: (row) => <SupplierCashFlowMoney value={row.CurrentBalance} tone />,
      },
    ],
    [t],
  )
  const summary = useMemo(
    () => ({
      afterInAmount: cashFlow?.AfterRangeInAmount,
      afterOutAmount: cashFlow?.AfterRangeOutAmount,
      beforeBalance: cashFlow?.BeforeRangeBalance,
      beforeInAmount: cashFlow?.BeforeRangeInAmount,
      beforeOutAmount: cashFlow?.BeforeRangeOutAmount,
      closingBalance: getAccountingCashFlowClosingBalance(cashFlow, lastItem),
    }),
    [cashFlow, lastItem],
  )

  return (
    <AppDrawer
      opened
      keepMounted={false}
      position="right"
      size="wide"
      title={t('Взаєморозрахунки')}
      onClose={() => navigate('/accounting/supplier-organizations')}
    >
    <Stack className="supplier-cash-flow-page" gap="sm">
      <div className="app-filter-bar supplier-cash-flow-filter-bar">
        <div className="app-filter-date-range">
          <TextInput
            label={t('Від')}
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.currentTarget.value)}
          />
          <TextInput
            label={t('До')}
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.currentTarget.value)}
          />
        </div>
        <Select
          className="supplier-cash-flow-type-filter"
          data={ACCOUNTING_TYPES.map((item) => ({ ...item, label: t(item.label) }))}
          label={t('Тип')}
          value={typePaymentTask}
          onChange={(value) => setTypePaymentTask(value || '2')}
        />
        <Select
          className="supplier-cash-flow-agreement-filter"
          data={[
            { label: t('Усі договори'), value: '__all__' },
            ...agreements
              .filter((agreement) => Boolean(agreement.NetUid))
              .map((agreement) => ({
                label: displayValue(agreement.Name),
                value: agreement.NetUid as string,
              })),
          ]}
          label={t('Договір')}
          value={selectedAgreementNetUid || '__all__'}
          onChange={(value) => setSelectedAgreementNetUid(value === '__all__' ? '' : value || '')}
        />
        <div className="app-filter-actions">
          <Tooltip label={t('Друк PDF')}>
            <ActionIcon
              aria-label={t('Друк PDF')}
              color={CREATE_ACTION_COLOR}
              disabled={Boolean(filterError)}
              size={36}
              variant="light"
              onClick={() => {
                setDownloadDocument(null)
                setExportModalOpen(true)
              }}
            >
              <FileDown size={17} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={isLoadingOrganization || isLoadingCashFlow}
              size={36}
              variant="light"
              onClick={() => {
                void loadOrganization()
                void loadCashFlow()
              }}
            >
              <RefreshCw size={17} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {filterError && (
        <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
          {filterError}
        </Alert>
      )}

      <SupplierCashFlowOverview
        agreementName={
          agreements.find((agreement) => agreement.NetUid === selectedAgreementNetUid)?.Name ||
          t('Усі договори')
        }
        organizationName={organization?.Name}
        summary={summary}
      />

      <DataTable
        columns={columns}
        data={rows}
        distributeAvailableWidth
        emptyText={t('Взаєморозрахунків не знайдено')}
        footer={
          <SupplierCashFlowFooter
            balance={summary.closingBalance}
            credit={summary.afterOutAmount}
            debit={summary.afterInAmount}
            rows={rows.length}
          />
        }
        getRowId={(row, index) => `${row.Id || row.Number || row.Name || 'row'}-${index}`}
        height={rows.length > 0 ? 'min(56vh, 560px)' : 230}
        isLoading={isLoadingCashFlow}
        loadingText={t('Завантаження взаєморозрахунків')}
        minWidth={920}
        rowClassName={(row) => (row === selectedRow ? 'is-selected' : undefined)}
        tableId="supplier-organization-cash-flow"
        onRowClick={(row) => setSelectedRow(row)}
      />

      <CashFlowDetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
      <DocumentExportModal
        document={downloadDocument}
        loadingFormat={exportingFormat}
        opened={isExportModalOpen}
        title={t('Експорт взаєморозрахунків')}
        onClose={() => {
          if (!isExporting) {
            setExportModalOpen(false)
            setDownloadDocument(null)
          }
        }}
        onSelectFormat={(format) => void exportDocument(format)}
      />
    </Stack>
    </AppDrawer>
  )
}

function SupplierCashFlowOverview({
  agreementName,
  organizationName,
  summary,
}: {
  agreementName?: string
  organizationName?: string
  summary: {
    afterInAmount?: number
    afterOutAmount?: number
    beforeBalance?: number
    beforeInAmount?: number
    beforeOutAmount?: number
    closingBalance?: number
  }
}) {
  const { t } = useI18n()
  const periodDifference = (summary.closingBalance || 0) - (summary.beforeBalance || 0)

  return (
    <section className="supplier-cash-flow-overview">
      <div className="supplier-cash-flow-overview__identity">
        <span>{t('Постачальник послуг')}</span>
        <strong>{displayValue(organizationName)}</strong>
        <small>{displayValue(agreementName)}</small>
      </div>
      <SupplierCashFlowMetric
        label={t('Вхідний баланс')}
        meta={(
          <>
            {t('Дебет')}: <span className="app-money">{formatMoney(summary.beforeInAmount)}</span>
            {' · '}
            {t('Кредит')}: <span className="app-money">{formatMoney(summary.beforeOutAmount)}</span>
          </>
        )}
        value={summary.beforeBalance}
      />
      <SupplierCashFlowMetric
        label={t('Рух за період')}
        meta={(
          <>
            {t('Дебет')}: <span className="app-money">{formatMoney(summary.afterInAmount)}</span>
            {' · '}
            {t('Кредит')}: <span className="app-money">{formatMoney(summary.afterOutAmount)}</span>
          </>
        )}
        value={periodDifference}
      />
      <SupplierCashFlowMetric
        emphasized
        label={t('Кінцевий баланс')}
        meta={(
          <>
            <span className="app-money">{periodDifference >= 0 ? '+' : ''}{formatMoney(periodDifference)}</span>
            {' '}{t('за період')}
          </>
        )}
        value={summary.closingBalance}
      />
    </section>
  )
}

function SupplierCashFlowMetric({
  emphasized,
  label,
  meta,
  value,
}: {
  emphasized?: boolean
  label: string
  meta: ReactNode
  value?: number
}) {
  const tone =
    typeof value === 'number' && value < 0 ? ' is-negative' : emphasized ? ' is-positive' : ''

  return (
    <div className={`supplier-cash-flow-overview__metric${emphasized ? ' is-emphasized' : ''}`}>
      <span>{label}</span>
      <strong className={tone}>{formatMoney(value)}</strong>
      <small>{meta}</small>
    </div>
  )
}

function SupplierCashFlowMoney({
  localValue,
  tone,
  value,
}: {
  localValue?: number
  tone?: boolean
  value?: number
}) {
  const valueTone = tone
    ? typeof value === 'number' && value < 0
      ? ' is-negative'
      : ' is-positive'
    : ''
  const showLocal =
    typeof localValue === 'number' &&
    Number.isFinite(localValue) &&
    (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(localValue - value) >= 0.005)

  return (
    <span className={`supplier-cash-flow-money${valueTone}`}>
      <strong>{formatMoney(value)}</strong>
      {showLocal ? <small>UAH {formatMoney(localValue)}</small> : null}
    </span>
  )
}

function SupplierCashFlowFooter({
  balance,
  credit,
  debit,
  rows,
}: {
  balance?: number
  credit?: number
  debit?: number
  rows: number
}) {
  const { t } = useI18n()

  return (
    <div className="supplier-cash-flow-footer">
      <span>{t('Рядків')}: <strong>{rows}</strong></span>
      <span>{t('Дебет')}: <strong className="supplier-cash-flow-footer__money">{formatMoney(debit)}</strong></span>
      <span>{t('Кредит')}: <strong className="supplier-cash-flow-footer__money">{formatMoney(credit)}</strong></span>
      <span className={typeof balance === 'number' && balance < 0 ? 'is-negative' : 'is-positive'}>
        {t('Баланс')}: <strong className="supplier-cash-flow-footer__money">{formatMoney(balance)}</strong>
      </span>
    </div>
  )
}

function CashFlowDetailDrawer({ row, onClose }: { row: AccountingCashFlowHeadItem | null; onClose: () => void }) {
  const { t } = useI18n()

  return (
    <AppDrawer
      opened={Boolean(row)}
      padding="lg"
      position="right"
      size="min(980px, 100vw)"
      title={row?.Name || t('Деталі взаєморозрахунку')}
      onClose={onClose}
    >
      {row && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DetailItem label={t('Дата')} value={formatDateTime(row.FromDate)} />
            <DetailItem label={t('Тип')} value={getTypeLabel(row.Type)} />
            <DetailItem label={t('Назва')} value={displayValue(row.Name)} />
            <DetailItem label={t('Номер')} value={displayValue(row.Number)} />
            <DetailItem label={t('Організація')} value={displayValue(row.OrganizationName)} />
            <DetailItem label={t('Сума')} mono value={formatMoney(row.CurrentValue)} />
            <DetailItem label={t('Сальдо')} mono value={formatMoney(row.CurrentBalance)} />
          </SimpleGrid>
          <CashFlowDetailContent item={row} />
        </Stack>
      )}
    </AppDrawer>
  )
}

function DetailItem({ label, mono = false, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <div className={`app-detail-field${mono ? ' is-mono' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
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

function getDateRangeError(fromDate: string, toDate: string): string | null {
  if (!fromDate || !toDate) {
    return 'Вкажіть період'
  }

  if (fromDate > toDate) {
    return 'Дата початку не може бути пізніше дати завершення'
  }

  return null
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
