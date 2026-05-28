import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Code,
  Divider,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconDownload,
  IconEye,
  IconFileTypePdf,
  IconFileTypeXls,
  IconRefresh,
  IconRestore,
} from '@tabler/icons-react'
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  exportAccountingCashFlowDocument,
  getAccountingCashFlow,
  getAccountingCashFlowCounterparty,
} from '../api/accountingCashFlowApi'
import type {
  AccountingCashFlow,
  AccountingCashFlowClientAgreement,
  AccountingCashFlowCounterparty,
  AccountingCashFlowDocument,
  AccountingCashFlowHeadItem,
  AccountingCashFlowMode,
} from '../types'

type FilterDraft = {
  from: string
  to: string
}

type CashFlowDetailRow = {
  Currency?: string
  GrossPrice?: number
  Name?: string
  NetPrice?: number
  Number?: string
  ServiceNumber?: string
  Symbol?: string
  Vat?: number
  VatPercent?: number
}

type DetailField = {
  label: string
  value: ReactNode
}

type DocumentLink = {
  name: string
  url: string
}

const ACCOUNTING_CASH_FLOW_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['date', 'name'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const CASH_FLOW_DETAIL_ROWS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['name'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const DETAIL_FIELD_BY_TYPE: Partial<Record<number, keyof AccountingCashFlowHeadItem>> = {
  0: 'SupplyOrderPaymentDeliveryProtocol',
  2: 'ContainerService',
  3: 'CustomService',
  4: 'PortWorkService',
  5: 'TransportationService',
  6: 'PortCustomAgencyService',
  7: 'CustomAgencyService',
  8: 'PlaneDeliveryService',
  9: 'VehicleDeliveryService',
  10: 'ConsumablesOrder',
  11: 'OutcomePaymentOrder',
  12: 'IncomePaymentOrder',
  13: 'Sale',
  14: 'SupplyPaymentTask',
  15: 'SaleReturn',
  16: 'SupplyOrderUkraine',
  17: 'MergedService',
  18: 'SupplyOrderUkrainePaymentDeliveryProtocol',
  20: 'ProductIncome',
  21: 'VehicleService',
  22: 'AccountingContainerPaymentTask',
  23: 'VehicleService',
  24: 'CustomService',
  25: 'TransportationService',
  26: 'PortCustomAgencyService',
  27: 'CustomAgencyService',
  28: 'PlaneDeliveryService',
  29: 'VehicleDeliveryService',
  30: 'MergedService',
  31: 'ContainerService',
  32: 'PortWorkService',
  33: 'BillOfLadingService',
  34: 'BillOfLadingService',
  36: 'UpdatedReSaleModel',
}

const DETAIL_SOURCE_FIELDS: (keyof AccountingCashFlowHeadItem)[] = [
  'OutcomePaymentOrder',
  'IncomePaymentOrder',
  'Sale',
  'SaleReturn',
  'UpdatedReSaleModel',
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
  21: 'Транспортний засіб',
  22: 'Контейнерне платіжне завдання',
  23: 'Бухгалтерський транспортний засіб',
  24: 'Бухгалтерський митний сервіс',
  25: 'Бухгалтерський транспортний сервіс',
  26: 'Бухгалтерський портово-митний сервіс',
  27: 'Бухгалтерське митне агентство',
  28: 'Бухгалтерська авіадоставка',
  29: 'Бухгалтерська автодоставка',
  30: 'Бухгалтерський обʼєднаний сервіс',
  31: 'Бухгалтерський контейнерний сервіс',
  32: 'Бухгалтерські портові роботи',
  33: 'Коносамент',
  34: 'Бухгалтерський коносамент',
  35: 'Акт надання послуг',
  36: 'Перепродаж',
}

const DETAIL_FIELD_SPECS = [
  { label: 'Сервісний номер', path: ['ServiceNumber'] },
  { label: 'Номер', path: ['Number'] },
  { label: 'Назва', path: ['Name'] },
  { label: 'Дата', path: ['FromDate'], type: 'date' },
  { label: 'Дата створення', path: ['Created'], type: 'date' },
  { label: 'Дата документа', path: ['DateFrom'], type: 'date' },
  { label: 'Валюта', path: ['SupplyOrganizationAgreement', 'Currency', 'Code'] },
  { label: 'Нетто', path: ['NetPrice'], type: 'money' },
  { label: 'ПДВ %', path: ['VatPercent'], type: 'amount' },
  { label: 'ПДВ', path: ['Vat'], type: 'money' },
  { label: 'Брутто', path: ['GrossPrice'], type: 'money' },
  { label: 'Бух. нетто', path: ['AccountingNetPrice'], type: 'money' },
  { label: 'Бух. ПДВ', path: ['AccountingVat'], type: 'money' },
  { label: 'Бух. брутто', path: ['AccountingGrossPrice'], type: 'money' },
  { label: 'Сума', path: ['TotalAmount'], type: 'money' },
]

export function ClientAccountingCashFlowPage() {
  return <AccountingCashFlowRoute mode="client" />
}

export function SupplierAccountingCashFlowPage() {
  return <AccountingCashFlowRoute mode="supplier" />
}

function AccountingCashFlowRoute({ mode }: { mode: AccountingCashFlowMode }) {
  const { id } = useParams()

  if (!id) {
    return <Navigate to={mode === 'supplier' ? '/suppliers' : '/clients'} replace />
  }

  return <AccountingCashFlowPage mode={mode} routeNetId={id} />
}

function AccountingCashFlowPage({ mode, routeNetId }: { mode: AccountingCashFlowMode; routeNetId: string }) {
  const model = useAccountingCashFlowPageModel(mode, routeNetId)

  return <AccountingCashFlowPageView model={model} />
}

function useAccountingCashFlowPageModel(mode: AccountingCashFlowMode, routeNetId: string) {
  const { t } = useI18n()
  const location = useLocation()
  const initialFilters = useMemo<FilterDraft>(
    () => ({
      from: getDateShiftedByDays(-30),
      to: formatLocalDate(new Date()),
    }),
    [],
  )
  const [filterDraft, setFilterDraft] = useState<FilterDraft>(initialFilters)
  const [activeFilters, setActiveFilters] = useState<FilterDraft>(initialFilters)
  const [counterparty, setCounterparty] = useState<AccountingCashFlowCounterparty | null>(null)
  const [cashFlow, setCashFlow] = useState<AccountingCashFlow | null>(null)
  const [selectedAgreementNetUid, setSelectedAgreementNetUid] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<AccountingCashFlowHeadItem | null>(null)
  const [document, setDocument] = useState<AccountingCashFlowDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useState(false)
  const [counterpartyError, setCounterpartyError] = useState<string | null>(null)
  const [cashFlowError, setCashFlowError] = useState<string | null>(null)
  const [isCounterpartyLoading, setCounterpartyLoading] = useState(true)
  const [isCashFlowLoading, setCashFlowLoading] = useState(true)
  const [isExporting, setExporting] = useState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const agreements = useMemo(() => counterparty?.ClientAgreements || [], [counterparty?.ClientAgreements])
  const selectedAgreement = useMemo(
    () => agreements.find((agreement) => agreement.NetUid === selectedAgreementNetUid) || null,
    [agreements, selectedAgreementNetUid],
  )
  const effectiveNetId = selectedAgreement?.NetUid || routeNetId
  const filterError = getFilterError(filterDraft.from, filterDraft.to)
  const locationNodeTitle = getLocationNodeTitle(location.state)
  const counterpartyName = getCounterpartyDisplayName(counterparty) || locationNodeTitle
  const columns = useAccountingCashFlowColumns(setSelectedItem)
  const detailRowsColumns = useCashFlowDetailRowsColumns()
  const items = cashFlow?.AccountingCashFlowHeadItems || []
  const lastItem = items.at(-1)
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {items.length}
      </Text>
    ),
    [items.length, t],
  )

  useEffect(() => {
    let cancelled = false

    async function loadCounterparty() {
      setCounterpartyLoading(true)
      setCounterpartyError(null)

      try {
        const loadedCounterparty = await getAccountingCashFlowCounterparty(routeNetId)

        if (!cancelled) {
          const loadedAgreements = loadedCounterparty?.ClientAgreements || []

          setCounterparty(loadedCounterparty)
          setSelectedAgreementNetUid(loadedAgreements.length === 1 ? loadedAgreements[0]?.NetUid || null : null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setCounterparty(null)
          setSelectedAgreementNetUid(null)
          setCounterpartyError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити контрагента'))
        }
      } finally {
        if (!cancelled) {
          setCounterpartyLoading(false)
        }
      }
    }

    void loadCounterparty()

    return () => {
      cancelled = true
    }
  }, [reloadKey, routeNetId, t])

  useEffect(() => {
    let cancelled = false

    async function loadCashFlow() {
      setCashFlowLoading(true)
      setCashFlowError(null)

      try {
        const loadedCashFlow = await getAccountingCashFlow({
          from: activeFilters.from,
          mode,
          netId: effectiveNetId,
          to: activeFilters.to,
        })

        if (!cancelled) {
          setCashFlow(loadedCashFlow)
        }
      } catch (loadError) {
        if (!cancelled) {
          setCashFlow(null)
          setCashFlowError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити рух коштів'))
        }
      } finally {
        if (!cancelled) {
          setCashFlowLoading(false)
        }
      }
    }

    void loadCashFlow()

    return () => {
      cancelled = true
    }
  }, [activeFilters.from, activeFilters.to, effectiveNetId, mode, reloadKey, t])

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (filterError) {
      notifications.show({ color: 'red', message: filterError })
      return
    }

    setActiveFilters(filterDraft)
  }

  function resetFilters() {
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
  }

  const handleExport = useCallback(async () => {
    if (!selectedAgreement?.NetUid) {
      notifications.show({ color: 'red', message: t('Оберіть договір для експорту') })
      return
    }

    setExporting(true)
    setCashFlowError(null)

    try {
      const exportedDocument = await exportAccountingCashFlowDocument({
        from: activeFilters.from,
        netId: selectedAgreement.NetUid,
        to: activeFilters.to,
      })

      setDocument(exportedDocument)
      setDownloadModalOpened(true)
    } catch (exportError) {
      setCashFlowError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ руху коштів'))
    } finally {
      setExporting(false)
    }
  }, [activeFilters.from, activeFilters.to, selectedAgreement, t])

  return {
    activeFilters,
    agreements,
    cashFlow,
    cashFlowError,
    columns,
    counterparty,
    counterpartyError,
    counterpartyName,
    detailRowsColumns,
    document,
    downloadModalOpened,
    filterDraft,
    filterError,
    isCashFlowLoading,
    isCounterpartyLoading,
    isExporting,
    items,
    lastItem,
    mode,
    selectedAgreement,
    selectedAgreementNetUid,
    selectedItem,
    toolbarLeft,
    handleExport,
    reload,
    resetFilters,
    setDownloadModalOpened,
    setFilterDraft,
    setSelectedAgreementNetUid,
    setSelectedItem,
    submitFilters,
  }
}

function AccountingCashFlowPageView({ model }: { model: ReturnType<typeof useAccountingCashFlowPageModel> }) {
  const { t } = useI18n()
  const {
    agreements,
    cashFlow,
    cashFlowError,
    columns,
    counterpartyError,
    counterpartyName,
    detailRowsColumns,
    document,
    downloadModalOpened,
    filterDraft,
    filterError,
    isCashFlowLoading,
    isCounterpartyLoading,
    isExporting,
    items,
    lastItem,
    mode,
    selectedAgreement,
    selectedAgreementNetUid,
    selectedItem,
    toolbarLeft,
    handleExport,
    reload,
    resetFilters,
    setDownloadModalOpened,
    setFilterDraft,
    setSelectedAgreementNetUid,
    setSelectedItem,
    submitFilters,
  } = model
  const canExport = Boolean(selectedAgreement?.NetUid)

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="end" gap="sm">
        <Text c="dimmed" size="sm">
          {counterpartyName || t('Завантаження контрагента')}
        </Text>
        <Group gap="xs">
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={isCashFlowLoading || isCounterpartyLoading}
              size={38}
              variant="light"
              onClick={() => reload()}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip disabled={canExport} label={t('Експорт доступний після вибору договору')}>
            <Box>
              <Button
                color="gray"
                disabled={!canExport}
                leftSection={<IconDownload size={16} />}
                loading={isExporting}
                variant="light"
                onClick={handleExport}
              >
                {t('Експорт / друк')}
              </Button>
            </Box>
          </Tooltip>
        </Group>
      </Group>

      {(counterpartyError || cashFlowError) && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {counterpartyError || cashFlowError}
        </Alert>
      )}

      <AccountingCashFlowSummary cashFlow={cashFlow} lastItem={lastItem} />

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <form onSubmit={submitFilters}>
            <Group align="end" gap="sm" wrap="wrap">
              <TextInput
                label={t('З')}
                type="date"
                value={filterDraft.from}
                w={150}
                onChange={(event) => setFilterDraft((current) => ({ ...current, from: event.currentTarget.value }))}
              />
              <TextInput
                label={t('По')}
                type="date"
                value={filterDraft.to}
                w={150}
                onChange={(event) => setFilterDraft((current) => ({ ...current, to: event.currentTarget.value }))}
              />
              <Button color="blue" type="submit">
                {t('Застосувати')}
              </Button>
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
                  <IconRestore size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </form>

          {filterError && (
            <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
              {filterError}
            </Alert>
          )}

          <Divider />

          <AgreementScopePicker
            agreements={agreements}
            isLoading={isCounterpartyLoading}
            selectedAgreementNetUid={selectedAgreementNetUid}
            onSelectAgreement={setSelectedAgreementNetUid}
          />
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <DataTable
          columns={columns}
          data={items}
          defaultLayout={ACCOUNTING_CASH_FLOW_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Рухів коштів не знайдено')}
          getRowId={(item, index) => String(item.Number || item.Name || item.FromDate || index)}
          isLoading={isCashFlowLoading}
          layoutVersion="accounting-cash-flow-table-1"
          loadingText={t('Завантаження руху коштів')}
          maxHeight="calc(100vh - 430px)"
          minWidth={1180}
          tableId={`accounting-cash-flow-${mode}`}
          toolbarLeft={toolbarLeft}
          onRowClick={setSelectedItem}
        />
      </Card>

      <AccountingCashFlowDetailDrawer
        detailRowsColumns={detailRowsColumns}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />

      <DownloadDocumentModal
        document={document}
        opened={downloadModalOpened}
        title={t('Експорт руху коштів')}
        onClose={() => setDownloadModalOpened(false)}
      />
    </Stack>
  )
}

function AccountingCashFlowSummary({
  cashFlow,
  lastItem,
}: {
  cashFlow: AccountingCashFlow | null
  lastItem?: AccountingCashFlowHeadItem
}) {
  const { t } = useI18n()
  const closingBalance = typeof lastItem?.CurrentBalance === 'number' ? lastItem.CurrentBalance : 0

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 6 }} spacing="sm">
      <SummaryValue label={t('Вхідний дебет')} value={cashFlow?.BeforeRangeInAmount} />
      <SummaryValue label={t('Вхідний кредит')} value={cashFlow?.BeforeRangeOutAmount} />
      <SummaryValue label={t('Вхідний баланс')} value={cashFlow?.BeforeRangeBalance} />
      <SummaryValue label={t('Дебет за період')} value={cashFlow?.AfterRangeInAmount} />
      <SummaryValue label={t('Кредит за період')} value={cashFlow?.AfterRangeOutAmount} />
      <SummaryValue label={t('Баланс після періоду')} value={closingBalance} />
    </SimpleGrid>
  )
}

function SummaryValue({ label, value }: { label: string; value?: number }) {
  const isNegative = typeof value === 'number' && value < 0

  return (
    <Card withBorder radius="md" padding="sm">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="lg" fw={700} c={isNegative ? 'red' : undefined}>
        {formatMoney(value)}
      </Text>
    </Card>
  )
}

function AgreementScopePicker({
  agreements,
  isLoading,
  selectedAgreementNetUid,
  onSelectAgreement,
}: {
  agreements: AccountingCashFlowClientAgreement[]
  isLoading: boolean
  selectedAgreementNetUid: string | null
  onSelectAgreement: (netUid: string | null) => void
}) {
  const { t } = useI18n()

  return (
    <Stack gap={6}>
      <Group justify="space-between" gap="sm">
        <Text size="sm" fw={600}>
          {t('Договори')}
        </Text>
        {isLoading && (
          <Text size="xs" c="dimmed">
            {t('Завантаження')}
          </Text>
        )}
      </Group>
      <ScrollArea type="auto" offsetScrollbars>
        <Group gap="xs" wrap="nowrap" pb={4}>
          <Button
            color="blue"
            size="xs"
            style={{ flex: '0 0 auto' }}
            variant={!selectedAgreementNetUid ? 'filled' : 'light'}
            onClick={() => onSelectAgreement(null)}
          >
            {t('Загальні взаєморозрахунки')}
          </Button>
          {agreements.map((agreement, index) => (
            <Tooltip key={agreement.NetUid || index} label={getAgreementTooltip(agreement)} disabled={!getAgreementTooltip(agreement)}>
              <Button
                color="blue"
                rightSection={getAgreementCurrency(agreement) ? <Badge size="xs">{getAgreementCurrency(agreement)}</Badge> : undefined}
                size="xs"
                style={{ flex: '0 0 auto' }}
                variant={agreement.NetUid === selectedAgreementNetUid ? 'filled' : 'light'}
                onClick={() => onSelectAgreement(agreement.NetUid || null)}
              >
                <Text span truncate maw={260}>
                  {getAgreementLabel(agreement)}
                </Text>
              </Button>
            </Tooltip>
          ))}
        </Group>
      </ScrollArea>
      {!isLoading && agreements.length === 0 && (
        <Text size="sm" c="dimmed">
          {t('Договори не знайдено')}
        </Text>
      )}
    </Stack>
  )
}

function AccountingCashFlowDetailDrawer({
  detailRowsColumns,
  item,
  onClose,
}: {
  detailRowsColumns: DataTableColumn<CashFlowDetailRow>[]
  item: AccountingCashFlowHeadItem | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const detailData = useMemo(() => (item ? getHeadItemDetailData(item) : null), [item])
  const detailFields = useMemo(() => (item ? buildDetailFields(item, detailData) : []), [detailData, item])
  const detailRows = useMemo(() => getServiceDetailRows(detailData), [detailData])
  const documents = useMemo(() => collectDocumentLinks(detailData), [detailData])
  const rawPayload = useMemo(() => stringifyPayload(detailData || item), [detailData, item])

  return (
    <AppDrawer
      opened={Boolean(item)}
      padding="lg"
      position="right"
      size="min(980px, 100vw)"
      title={item?.Name || t('Деталі руху коштів')}
      onClose={onClose}
    >
      {item && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
            {detailFields.map((field) => (
              <DetailValue key={field.label} label={field.label} value={field.value} />
            ))}
          </SimpleGrid>

          {documents.length > 0 && (
            <>
              <Divider />
              <Group gap="xs">
                {documents.map((document) => (
                  <Anchor key={document.url} href={document.url} target="_blank" rel="noreferrer" className="document-link">
                    <span className="document-link-badge document-link-badge-pdf">
                      <IconFileTypePdf size={18} stroke={1.8} />
                    </span>
                    <span>{document.name}</span>
                  </Anchor>
                ))}
              </Group>
            </>
          )}

          {detailRows.length > 0 && (
            <>
              <Divider />
              <DataTable
                columns={detailRowsColumns}
                data={detailRows}
                defaultLayout={CASH_FLOW_DETAIL_ROWS_TABLE_DEFAULT_LAYOUT}
                emptyText={t('Позицій не знайдено')}
                getRowId={(row, index) => String(row.ServiceNumber || row.Number || row.Name || index)}
                layoutVersion="accounting-cash-flow-detail-rows-1"
                maxHeight={320}
                minWidth={860}
                tableId="accounting-cash-flow-detail-rows"
              />
            </>
          )}

          {rawPayload && (
            <>
              <Divider />
              <Box>
                <Text size="sm" fw={600} mb="xs">
                  {t('Технічні дані')}
                </Text>
                <ScrollArea h={260} type="auto" offsetScrollbars>
                  <Code block>{rawPayload}</Code>
                </ScrollArea>
              </Box>
            </>
          )}
        </Stack>
      )}
    </AppDrawer>
  )
}

function DetailValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600} lineClamp={2}>
        {value || '-'}
      </Text>
    </Box>
  )
}

function DownloadDocumentModal({
  document,
  opened,
  title,
  onClose,
}: {
  document: AccountingCashFlowDocument | null
  opened: boolean
  title: string
  onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} title={title} onClose={onClose}>
      <Stack gap="sm">
        {document?.DocumentURL || document?.PdfDocumentURL ? (
          <>
            {document.DocumentURL && (
              <Anchor href={document.DocumentURL} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-excel">
                  <IconFileTypeXls size={22} stroke={1.8} />
                </span>
                <span>{t('Excel документ')}</span>
              </Anchor>
            )}
            {document.PdfDocumentURL && (
              <Anchor href={document.PdfDocumentURL} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-pdf">
                  <IconFileTypePdf size={22} stroke={1.8} />
                </span>
                <span>{t('PDF документ')}</span>
              </Anchor>
            )}
          </>
        ) : (
          <Text c="dimmed" size="sm">
            {t('Документ недоступний для завантаження')}
          </Text>
        )}
      </Stack>
    </AppModal>
  )
}

function useAccountingCashFlowColumns(
  onOpenDetail: (item: AccountingCashFlowHeadItem) => void,
): DataTableColumn<AccountingCashFlowHeadItem>[] {
  return useMemo<DataTableColumn<AccountingCashFlowHeadItem>[]>(
    () => [
      {
        id: 'date',
        header: 'Дата',
        width: 142,
        minWidth: 124,
        accessor: (item) => item.FromDate,
        cell: (item) => formatDateTime(item.FromDate),
      },
      {
        id: 'name',
        header: 'Документ',
        width: 300,
        minWidth: 220,
        accessor: (item) => item.Name,
        cell: (item) => (
          <Text fw={700} lineClamp={2}>
            {displayValue(item.Name)}
          </Text>
        ),
      },
      {
        id: 'number',
        header: 'Номер',
        width: 150,
        minWidth: 120,
        accessor: (item) => item.Number,
        cell: (item) => displayValue(item.Number),
      },
      {
        id: 'type',
        header: 'Тип',
        width: 220,
        minWidth: 170,
        accessor: (item) => getCashFlowTypeLabel(item.Type),
        cell: (item) => getCashFlowTypeLabel(item.Type),
      },
      {
        id: 'organization',
        header: 'Організація',
        width: 260,
        minWidth: 180,
        accessor: (item) => item.OrganizationName,
        cell: (item) => displayValue(item.OrganizationName),
      },
      {
        id: 'operation',
        header: 'Операція',
        width: 110,
        minWidth: 94,
        align: 'center',
        accessor: (item) => (item.IsCreditValue ? 'credit' : 'debit'),
        cell: (item) => (
          <Badge color={item.IsCreditValue ? 'red' : 'green'} variant="light">
            {item.IsCreditValue ? 'Кредит' : 'Дебет'}
          </Badge>
        ),
      },
      {
        id: 'debit',
        header: 'Дебет',
        width: 128,
        minWidth: 112,
        align: 'right',
        accessor: (item) => (item.IsCreditValue ? undefined : item.CurrentValue),
        cell: (item) => (item.IsCreditValue ? '-' : formatMoney(item.CurrentValue)),
      },
      {
        id: 'credit',
        header: 'Кредит',
        width: 128,
        minWidth: 112,
        align: 'right',
        accessor: (item) => (item.IsCreditValue ? item.CurrentValue : undefined),
        cell: (item) => (item.IsCreditValue ? formatMoney(item.CurrentValue) : '-'),
      },
      {
        id: 'balance',
        header: 'Баланс',
        width: 128,
        minWidth: 112,
        align: 'right',
        accessor: (item) => item.CurrentBalance,
        cell: (item) => (
          <Text fw={700} c={typeof item.CurrentBalance === 'number' && item.CurrentBalance < 0 ? 'red' : undefined}>
            {formatMoney(item.CurrentBalance)}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 64,
        minWidth: 58,
        align: 'center',
        enableHiding: false,
        enableSorting: false,
        cell: (item) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Tooltip label="Деталі">
              <ActionIcon aria-label="Деталі" color="gray" size="sm" variant="subtle" onClick={() => onOpenDetail(item)}>
                <IconEye size={16} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [onOpenDetail],
  )
}

function useCashFlowDetailRowsColumns(): DataTableColumn<CashFlowDetailRow>[] {
  return useMemo<DataTableColumn<CashFlowDetailRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Назва',
        width: 260,
        minWidth: 200,
        accessor: (row) => row.Name,
        cell: (row) => (
          <Text fw={600} lineClamp={2}>
            {displayValue(row.Name)}
          </Text>
        ),
      },
      {
        id: 'serviceNumber',
        header: 'Сервісний номер',
        width: 150,
        minWidth: 124,
        accessor: (row) => row.ServiceNumber,
        cell: (row) => displayValue(row.ServiceNumber),
      },
      {
        id: 'number',
        header: 'Номер',
        width: 130,
        minWidth: 110,
        accessor: (row) => row.Number,
        cell: (row) => displayValue(row.Number),
      },
      {
        id: 'symbol',
        header: 'Символ',
        width: 110,
        minWidth: 92,
        accessor: (row) => row.Symbol,
        cell: (row) => displayValue(row.Symbol),
      },
      {
        id: 'currency',
        header: 'Валюта',
        width: 94,
        minWidth: 84,
        accessor: (row) => row.Currency,
        cell: (row) => displayValue(row.Currency),
      },
      {
        id: 'netPrice',
        header: 'Нетто',
        width: 116,
        minWidth: 102,
        align: 'right',
        accessor: (row) => row.NetPrice,
        cell: (row) => formatMoney(row.NetPrice),
      },
      {
        id: 'vatPercent',
        header: 'ПДВ %',
        width: 92,
        minWidth: 82,
        align: 'right',
        accessor: (row) => row.VatPercent,
        cell: (row) => formatAmount(row.VatPercent),
      },
      {
        id: 'vat',
        header: 'ПДВ',
        width: 104,
        minWidth: 92,
        align: 'right',
        accessor: (row) => row.Vat,
        cell: (row) => formatMoney(row.Vat),
      },
      {
        id: 'grossPrice',
        header: 'Брутто',
        width: 116,
        minWidth: 102,
        align: 'right',
        accessor: (row) => row.GrossPrice,
        cell: (row) => formatMoney(row.GrossPrice),
      },
    ],
    [],
  )
}

function buildDetailFields(item: AccountingCashFlowHeadItem, detailData: unknown): DetailField[] {
  const fields: DetailField[] = [
    { label: 'Дата', value: formatDateTime(item.FromDate) },
    { label: 'Документ', value: displayValue(item.Name) },
    { label: 'Номер', value: displayValue(item.Number) },
    { label: 'Організація', value: displayValue(item.OrganizationName) },
    { label: 'Тип', value: getCashFlowTypeLabel(item.Type) },
    { label: 'Операція', value: item.IsCreditValue ? 'Кредит' : 'Дебет' },
    { label: 'Сума', value: formatMoney(item.CurrentValue) },
    { label: 'Поточний баланс', value: formatMoney(item.CurrentBalance) },
  ]
  const dataRecord = toRecord(detailData)

  if (!dataRecord) {
    return fields
  }

  DETAIL_FIELD_SPECS.forEach((spec) => {
    const value = readPath(dataRecord, spec.path)

    if (isEmptyValue(value)) {
      return
    }

    fields.push({
      label: spec.label,
      value: formatSpecValue(value, spec.type),
    })
  })

  return fields
}

function getServiceDetailRows(detailData: unknown): CashFlowDetailRow[] {
  const dataRecord = toRecord(detailData)
  const detailItems = readArray(dataRecord, 'ServiceDetailItems')
  const currency = stringValue(readPath(dataRecord, ['SupplyOrganizationAgreement', 'Currency', 'Code']))
  const serviceNumber = stringValue(dataRecord?.ServiceNumber)
  const number = stringValue(dataRecord?.Number)

  return detailItems.map((item) => {
    const itemRecord = toRecord(item)
    const keyRecord = toRecord(itemRecord?.ServiceDetailItemKey)

    return {
      Currency: currency,
      GrossPrice: numberValue(itemRecord?.GrossPrice),
      Name: stringValue(keyRecord?.Name) || stringValue(itemRecord?.Name),
      NetPrice: numberValue(itemRecord?.NetPrice),
      Number: number,
      ServiceNumber: serviceNumber,
      Symbol: stringValue(keyRecord?.Symbol) || stringValue(itemRecord?.Symbol),
      Vat: numberValue(itemRecord?.Vat),
      VatPercent: numberValue(itemRecord?.VatPercent),
    }
  })
}

function getHeadItemDetailData(item: AccountingCashFlowHeadItem): unknown {
  const field = typeof item.Type === 'number' ? DETAIL_FIELD_BY_TYPE[item.Type] : undefined

  if (field && !isEmptyValue(item[field])) {
    return item[field]
  }

  for (const sourceField of DETAIL_SOURCE_FIELDS) {
    if (!isEmptyValue(item[sourceField])) {
      return item[sourceField]
    }
  }

  return null
}

function collectDocumentLinks(detailData: unknown): DocumentLink[] {
  const dataRecord = toRecord(detailData)
  const documents: DocumentLink[] = []

  if (!dataRecord) {
    return documents
  }

  addDirectDocument(documents, dataRecord)

  ;['InvoiceDocuments', 'BillOfLadingDocuments', 'Documents', 'Files'].forEach((key) => {
    readArray(dataRecord, key).forEach((document) => addDirectDocument(documents, toRecord(document)))
  })

  return documents.filter((document, index, allDocuments) => allDocuments.findIndex((item) => item.url === document.url) === index)
}

function addDirectDocument(documents: DocumentLink[], documentRecord: Record<string, unknown> | null) {
  if (!documentRecord) {
    return
  }

  const url = stringValue(documentRecord.DocumentUrl)
    || stringValue(documentRecord.DocumentURL)
    || stringValue(documentRecord.Url)
    || stringValue(documentRecord.URL)

  if (!url) {
    return
  }

  documents.push({
    name: stringValue(documentRecord.FileName) || stringValue(documentRecord.Name) || stringValue(documentRecord.Number) || 'Документ',
    url,
  })
}

function getAgreementLabel(agreement: AccountingCashFlowClientAgreement): string {
  return [
    stringValue(agreement.Agreement?.Organization?.Name),
    stringValue(agreement.Agreement?.Name),
  ].filter(Boolean).join(' / ') || agreement.NetUid || '-'
}

function getAgreementCurrency(agreement: AccountingCashFlowClientAgreement): string {
  return stringValue(agreement.Agreement?.Currency?.Code)
}

function getAgreementTooltip(agreement: AccountingCashFlowClientAgreement): string {
  return stringValue(agreement.OriginalClientName)
}

function getCounterpartyDisplayName(counterparty: AccountingCashFlowCounterparty | null): string {
  return stringValue(counterparty?.FullName)
    || stringValue(counterparty?.SupplierName)
    || stringValue(counterparty?.Name)
    || stringValue(counterparty?.NetUid)
}

function getLocationNodeTitle(locationState: unknown): string {
  const stateRecord = toRecord(locationState)

  return stringValue(stateRecord?.nodeTitle)
}

function getCashFlowTypeLabel(type: unknown): string {
  if (typeof type !== 'number') {
    return '-'
  }

  return TYPE_LABELS[type] || `Тип ${type}`
}

function getDateShiftedByDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function getFilterError(from: string, to: string): string | null {
  if (!from || !to) {
    return 'Заповніть період'
  }

  if (from > to) {
    return 'Дата початку не може бути пізніше дати завершення'
  }

  return null
}

function readArray(record: Record<string, unknown> | null, key: string): unknown[] {
  const value = record?.[key]

  return Array.isArray(value) ? value : []
}

function readPath(record: Record<string, unknown> | null, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    const currentRecord = toRecord(current)

    return currentRecord?.[key]
  }, record)
}

function formatSpecValue(value: unknown, type?: string): string {
  if (type === 'date') {
    return formatDateTime(value)
  }

  if (type === 'money') {
    return formatMoney(numberValue(value))
  }

  if (type === 'amount') {
    return formatAmount(numberValue(value))
  }

  return displayValue(value)
}

function formatDateTime(value: unknown): string {
  if (!value) {
    return '-'
  }

  if (value instanceof Date) {
    return dateTimeFormatter.format(value)
  }

  if (typeof value !== 'string') {
    return displayValue(value)
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateTimeFormatter.format(date)
}

function formatMoney(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  return moneyFormatter.format(value)
}

function formatAmount(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  return amountFormatter.format(value)
}

function displayValue(value: unknown): string {
  if (isEmptyValue(value)) {
    return '-'
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  const record = toRecord(value)
  const display = stringValue(record?.Name)
    || stringValue(record?.FullName)
    || stringValue(record?.Number)
    || stringValue(record?.Value)
    || stringValue(record?.Code)

  return display || '-'
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return undefined
}

function isEmptyValue(value: unknown): boolean {
  return value === null || typeof value === 'undefined' || value === ''
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function stringifyPayload(payload: unknown): string {
  if (!payload) {
    return ''
  }

  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return ''
  }
}
