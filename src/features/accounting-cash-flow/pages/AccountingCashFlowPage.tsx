import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconDownload,
  IconFileTypePdf,
  IconHelpCircle,
  IconPencil,
  IconRefresh,
  IconRestore,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import { CashFlowGrid } from '../../../shared/ui/cash-flow-grid/CashFlowGrid'
import type { CashFlowGridLeadColumn } from '../../../shared/ui/cash-flow-grid/types'
import {
  exportAccountingCashFlowDocument,
  getAccountingCashFlow,
  getAccountingCashFlowCounterparty,
} from '../api/accountingCashFlowApi'
import { CashFlowDetailContent } from '../components/CashFlowDetailContent'
import { CashFlowSummary } from '../components/CashFlowSummary'
import { getAccountingCashFlowPaymentStatus } from '../accountingCashFlowPaymentStatus'
import { getAccountingCashFlowDrilldownRoute } from '../cashFlowDrilldown'
import type {
  AccountingCashFlow,
  AccountingCashFlowAgreement,
  AccountingCashFlowAgreementDebtSummary,
  AccountingCashFlowClientAgreement,
  AccountingCashFlowClientInDebt,
  AccountingCashFlowCounterparty,
  AccountingCashFlowDocument,
  AccountingCashFlowHeadItem,
  AccountingCashFlowMode,
  AccountingCashFlowSaleReturn,
  AccountingCashFlowSaleReturnItem,
} from '../types'

type FilterDraft = {
  from: string
  to: string
}

type DetailField = {
  label: string
  value: ReactNode
}

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

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
  36: 'Бухгалтерський акт надання послуг',
  37: 'Перепродаж',
}

const JOIN_SERVICE_TYPE = {
  ConsumablesOrder: 10,
  IncomePaymentOrder: 12,
  OutcomePaymentOrder: 11,
  ReSale: 37,
  Sale: 13,
  SaleReturn: 15,
} as const

const SALE_RETURN_ITEM_STATUS_LABELS: Record<number, string> = {
  0: 'Товар прибув пізніше заявленого терміну',
  1: 'Доставка не в повному обсязі',
  2: 'Помилка підбору',
  3: 'Неправильний крос-код',
  4: 'Відмова від товару кінцевим покупцем',
  5: 'Невідповідність очікуваній якості',
  6: 'Брак',
  7: 'Клієнт не забрав товар',
  8: 'Відкликання виробником',
}

const SALE_RETURN_ITEM_STATUS_NAME_BY_KEY: Record<string, number> = {
  ClientNotTookProduct: 7,
  Defect: 6,
  IncorrectAssortment: 2,
  IncorrectCrossCode: 3,
  IncorrectQuality: 5,
  NotFullDelivery: 1,
  ProductAbandon: 4,
  ProductArrivedNotAtTime: 0,
  SupplierWithdrawal: 8,
}

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
  const items = cashFlow?.AccountingCashFlowHeadItems || []
  const lastItem = items.at(-1)

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
    counterparty,
    counterpartyError,
    counterpartyName,
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
  const navigate = useNavigate()
  const {
    agreements,
    cashFlow,
    cashFlowError,
    counterpartyError,
    counterpartyName,
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
  const handleCashFlowRowClick = useCallback(
    (item: AccountingCashFlowHeadItem) => {
      const route = getAccountingCashFlowDrilldownRoute(item)

      if (route) {
        navigate(route)
        return
      }

      setSelectedItem(item)
    },
    [navigate, setSelectedItem],
  )
  const leadColumns = useMemo<CashFlowGridLeadColumn<AccountingCashFlowHeadItem>[]>(
    () => [
      {
        id: 'name',
        isLabel: true,
        header: t('Документ'),
        cell: (item) => (
          <Text fw={600} lineClamp={1}>
            {displayValue(item.Name)}
          </Text>
        ),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 220,
        cell: (item) => displayValue(item.OrganizationName),
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
      closingBalance: lastItem?.CurrentBalance,
    }),
    [cashFlow, lastItem],
  )
  const renderRowBadge = useMemo(
    () =>
      mode === 'client'
        ? (item: AccountingCashFlowHeadItem) =>
            (item.Sale?.HistoryInvoiceEdit?.length ?? 0) > 0 ? (
              <Tooltip label={t('Накладна була редагована')} position="right">
                <ThemeIcon color="orange" radius="xl" size="xs" variant="filled">
                  <IconPencil size={12} />
                </ThemeIcon>
              </Tooltip>
            ) : null
        : undefined,
    [mode, t],
  )

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

      <CashFlowSummary cashFlow={cashFlow} lastItem={lastItem} />

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <form onSubmit={submitFilters}>
            <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
              <TextInput
                label={t('З')}
                type="date"
                value={filterDraft.from}
                w={150}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setFilterDraft((current) => ({ ...current, from: value }))
                }}
              />
              <TextInput
                label={t('По')}
                type="date"
                value={filterDraft.to}
                w={150}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setFilterDraft((current) => ({ ...current, to: value }))
                }}
              />
              <Button color="violet" type="submit">
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
        <CashFlowGrid
          items={items}
          leadColumns={leadColumns}
          summary={summary}
          emptyText={t('Рухів коштів не знайдено')}
          formatMoney={formatMoney}
          getRowKey={(item, index) => `${item.Number || item.Name || 'row'}-${index}`}
          isLoading={isCashFlowLoading}
          isRowActive={(item) => item === selectedItem}
          loadingText={t('Завантаження руху коштів')}
          maxHeight="calc(100vh - 430px)"
          renderRowBadge={renderRowBadge}
          onRowClick={handleCashFlowRowClick}
        />
      </Card>

      <AccountingCashFlowDetailDrawer
        item={selectedItem}
        mode={mode}
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
            color="violet"
            size="xs"
            style={{ flex: '0 0 auto' }}
            variant={!selectedAgreementNetUid ? 'filled' : 'light'}
            onClick={() => onSelectAgreement(null)}
          >
            {t('Загальні взаєморозрахунки')}
          </Button>
          {agreements.map((agreement, index) => (
            <AgreementDebtTile
              key={agreement.NetUid || index}
              agreement={agreement}
              isSelected={agreement.NetUid === selectedAgreementNetUid}
              onSelect={() => onSelectAgreement(agreement.NetUid || null)}
            />
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

function AgreementDebtTile({
  agreement,
  isSelected,
  onSelect,
}: {
  agreement: AccountingCashFlowClientAgreement
  isSelected: boolean
  onSelect: () => void
}) {
  const { t } = useI18n()
  const debt = useMemo(() => getAgreementDebtSummary(agreement), [agreement])
  const currency = getAgreementCurrency(agreement)
  const tooltip = getAgreementTooltip(agreement)

  return (
    <Tooltip label={tooltip} disabled={!tooltip}>
      <Card
        withBorder
        padding="xs"
        radius="md"
        style={{
          cursor: 'pointer',
          flex: '0 0 auto',
          minWidth: 220,
          borderColor: debt.isOverdue
            ? 'var(--mantine-color-red-5)'
            : isSelected
              ? 'var(--mantine-color-violet-5)'
              : undefined,
          backgroundColor: debt.isOverdue
            ? 'var(--mantine-color-red-0)'
            : isSelected
              ? 'var(--mantine-color-violet-0)'
              : undefined,
        }}
        onClick={onSelect}
      >
        <Stack gap={4}>
          <Group justify="space-between" gap="xs" wrap="nowrap" align="flex-start">
            <Stack gap={0}>
              <Text c="dimmed" size="xs">
                {stringValue(agreement.Agreement?.Organization?.Name)}
              </Text>
              <Text fw={600} size="sm" lineClamp={1} maw={200}>
                {stringValue(agreement.Agreement?.Name) || stringValue(agreement.NetUid) || '-'}
              </Text>
            </Stack>
            {currency && (
              <Badge size="xs" variant="light">
                {currency}
              </Badge>
            )}
          </Group>

          {stringValue(agreement.OriginalClientName) && (
            <Group gap={4} align="center" wrap="nowrap">
              <IconHelpCircle size={12} />
              <Text c="dimmed" size="xs" lineClamp={1} maw={200}>
                {stringValue(agreement.OriginalClientName)}
              </Text>
            </Group>
          )}

          <Group gap="md" wrap="nowrap">
            {debt.isControlAmountDebt && (
              <Group gap={4} align="baseline" wrap="nowrap">
                <Text c={debt.totalOverdueDebt > 0 ? 'red' : undefined} fw={600} size="sm">
                  {formatMoney(debt.totalOverdueDebt)}
                </Text>
                <Text c="dimmed" size="xs">
                  / {formatMoney(debt.accountBalance)}
                </Text>
              </Group>
            )}
            {debt.isControlNumberDaysDebt && (
              <Group gap={4} align="baseline" wrap="nowrap">
                <Text c={debt.overdueDays > 0 ? 'red' : undefined} fw={600} size="sm">
                  {debt.overdueDays}
                </Text>
                <Text c="dimmed" size="xs">
                  / {debt.allowedDays} {t('днів')}
                </Text>
              </Group>
            )}
          </Group>

          {debt.isOverdue && (
            <Badge color="red" size="xs" variant="filled">
              {t('Прострочено')}
            </Badge>
          )}
        </Stack>
      </Card>
    </Tooltip>
  )
}

function AccountingCashFlowDetailDrawer({
  item,
  mode,
  onClose,
}: {
  item: AccountingCashFlowHeadItem | null
  mode: AccountingCashFlowMode
  onClose: () => void
}) {
  const { t } = useI18n()
  const isSaleReturn = mode === 'client' && !item?.IsCreditValue && item?.Type === JOIN_SERVICE_TYPE.SaleReturn
  const saleReturn = useMemo(
    () => (isSaleReturn ? (toRecord(item?.SaleReturn) as AccountingCashFlowSaleReturn | null) : null),
    [isSaleReturn, item?.SaleReturn],
  )
  const detailFields = useMemo(() => (item ? buildHeadItemFields(item, t) : []), [item, t])

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
          {saleReturn && <SaleReturnOverviewPanel saleReturn={saleReturn} />}

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
            {detailFields.map((field) => (
              <DetailValue key={field.label} label={field.label} value={field.value} />
            ))}
          </SimpleGrid>

          <CashFlowDetailContent item={item} />
        </Stack>
      )}
    </AppDrawer>
  )
}

function buildHeadItemFields(item: AccountingCashFlowHeadItem, t: (key: string) => string): DetailField[] {
  const paymentStatus = getAccountingCashFlowPaymentStatus(item)
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

  if (paymentStatus) {
    fields.splice(5, 0, {
      label: 'Статус накладної',
      value: (
        <Badge color={paymentStatus.color} variant="light">
          {t(paymentStatus.label)}
        </Badge>
      ),
    })
  }

  return fields
}

function DetailValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box style={{ minWidth: 0 }}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600} style={{ overflowWrap: 'anywhere' }}>
        {value || '-'}
      </Text>
    </Box>
  )
}

function SaleReturnOverviewPanel({ saleReturn }: { saleReturn: AccountingCashFlowSaleReturn }) {
  const { t } = useI18n()
  const items = Array.isArray(saleReturn.SaleReturnItems) ? saleReturn.SaleReturnItems : []
  const header = [
    stringValue(saleReturn.Client?.RegionCode?.Value),
    stringValue(saleReturn.Client?.FullName),
    stringValue(saleReturn.ClientAgreement?.Agreement?.Name),
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Text fw={700}>{header || t('Повернення продажу')}</Text>
        {items.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('Позицій не знайдено')}
          </Text>
        ) : (
          <Stack gap="xs">
            {items.map((saleReturnItem) => (
              <SaleReturnOverviewItem key={getSaleReturnItemKey(saleReturnItem)} saleReturnItem={saleReturnItem} />
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  )
}

function SaleReturnOverviewItem({ saleReturnItem }: { saleReturnItem: AccountingCashFlowSaleReturnItem }) {
  const { t } = useI18n()
  const sale = saleReturnItem.OrderItem?.Order?.Sale
  const isVatSale = Boolean(sale?.IsVatSale)
  const currency = getSaleReturnItemCurrency(saleReturnItem)
  const worthPrice = Math.round((numberValue(saleReturnItem.AmountLocal) || 0) * 100) / 100

  return (
    <Card withBorder radius="sm" padding="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
        <Stack gap={2}>
          <Group gap={6} align="baseline" wrap="nowrap">
            <Text c="dimmed" size="xs">
              {stringValue(saleReturnItem.OrderItem?.Product?.VendorCode)}
            </Text>
            <Text fw={600} size="sm">
              {stringValue(saleReturnItem.OrderItem?.Product?.Name)}
            </Text>
          </Group>
          <Text c="dimmed" size="xs">
            {stringValue(sale?.SaleNumber?.Value)} {`(${t('Накладна')})`}
          </Text>
        </Stack>

        <Group gap="lg" align="flex-start" wrap="nowrap">
          <Stack gap={0} align="flex-end">
            <Text fw={600} size="sm">
              {formatMoney(worthPrice)} {currency}
            </Text>
            <Text c="dimmed" size="xs">
              {t('Вартість')}
            </Text>
          </Stack>

          {isVatSale && (
            <Stack gap={0} align="flex-end">
              <Text fw={600} size="sm">
                {formatMoney(numberValue(saleReturnItem.VatAmountLocal))}
              </Text>
              <Text c="dimmed" size="xs">
                {t('ПДВ')}
              </Text>
            </Stack>
          )}

          <Stack gap={0} align="flex-end">
            <Text fw={600} size="sm">
              {formatAmount(numberValue(saleReturnItem.Qty))}
            </Text>
            <Text c="dimmed" size="xs">
              {t('штук')}
            </Text>
          </Stack>

          <Stack gap={0} align="flex-end">
            <Text c="dimmed" size="xs">
              {t('Склад')}
            </Text>
            <Text c="orange" fw={600} size="sm">
              {stringValue(saleReturnItem.Storage?.Name)}
            </Text>
            <Text size="xs">{getSaleReturnItemStatusLabel(saleReturnItem.SaleReturnItemStatus, t)}</Text>
          </Stack>
        </Group>
      </Group>
    </Card>
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
              <Anchor href={getDocumentHref(document.DocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-excel">
                  <ExcelIcon size={22} />
                </span>
                <span>{t('Excel документ')}</span>
              </Anchor>
            )}
            {document.PdfDocumentURL && (
              <Anchor href={getDocumentHref(document.PdfDocumentURL)} target="_blank" rel="noreferrer" className="document-link">
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

function getAgreementCurrency(agreement: AccountingCashFlowClientAgreement): string {
  return stringValue(agreement.Agreement?.Currency?.Code)
}

function getAgreementDebtSummary(clientAgreement: AccountingCashFlowClientAgreement): AccountingCashFlowAgreementDebtSummary {
  const agreement: AccountingCashFlowAgreement = clientAgreement.Agreement || {}
  const accountBalance = numberValue(clientAgreement.AccountBalance) || 0
  const debtLimit = numberValue(agreement.AmountDebt) || 0
  const allowedDays = numberValue(agreement.NumberDaysDebt) || 0
  const isControlAmountDebt = agreement.IsControlAmountDebt !== false
  const isControlNumberDaysDebt = agreement.IsControlNumberDaysDebt !== false
  const totalOverdueDebt = getTotalOverdueDebt(agreement.ClientInDebts, allowedDays)
  const maxDaysOwed = getMaxDaysOwed(agreement.ClientInDebts)
  const overdueDays = maxDaysOwed > allowedDays ? maxDaysOwed - allowedDays : 0
  const isOverdue = totalOverdueDebt > 0 || Math.abs(accountBalance) > debtLimit || maxDaysOwed > allowedDays

  return {
    accountBalance,
    allowedDays,
    debtLimit,
    isControlAmountDebt,
    isControlNumberDaysDebt,
    isOverdue,
    overdueDays,
    totalOverdueDebt,
  }
}

function getTotalOverdueDebt(clientInDebts: AccountingCashFlowClientInDebt[] | undefined, allowedDays: number): number {
  if (!Array.isArray(clientInDebts)) {
    return 0
  }

  const total = clientInDebts.reduce((sum, clientInDebt) => {
    const days = numberValue(clientInDebt?.Debt?.Days) || 0

    if (days - allowedDays <= 0) {
      return sum
    }

    return sum + (numberValue(clientInDebt?.Debt?.Total) || 0)
  }, 0)

  return Math.round(total * 100) / 100
}

function getMaxDaysOwed(clientInDebts: AccountingCashFlowClientInDebt[] | undefined): number {
  if (!Array.isArray(clientInDebts) || clientInDebts.length === 0) {
    return 0
  }

  return clientInDebts.reduce((max, clientInDebt) => {
    const days = numberValue(clientInDebt?.Debt?.Days) || 0

    return days > max ? days : max
  }, 0)
}

function getSaleReturnItemCurrency(saleReturnItem: AccountingCashFlowSaleReturnItem): string {
  const orderRecord = toRecord(saleReturnItem.OrderItem?.Order)
  const saleRecord = toRecord(orderRecord?.Sale)
  const agreementRecord = toRecord(saleRecord?.ClientAgreement)
  const agreement = toRecord(agreementRecord?.Agreement)
  const currency = toRecord(agreement?.Currency)

  return stringValue(currency?.Code)
}

function getSaleReturnItemKey(saleReturnItem: AccountingCashFlowSaleReturnItem): string {
  const itemRecord = toRecord(saleReturnItem)
  const orderItemRecord = toRecord(saleReturnItem.OrderItem)
  const productRecord = toRecord(saleReturnItem.OrderItem?.Product)
  const saleRecord = toRecord(saleReturnItem.OrderItem?.Order?.Sale)
  const saleNumberRecord = toRecord(saleRecord?.SaleNumber)

  const stableId = [
    itemRecord?.Id,
    itemRecord?.NetUid,
    orderItemRecord?.Id,
    orderItemRecord?.NetUid,
  ]
    .map(keyValue)
    .find(Boolean)

  if (stableId) {
    return stableId
  }

  return JSON.stringify({
    amountLocal: saleReturnItem.AmountLocal,
    productName: productRecord?.Name,
    qty: saleReturnItem.Qty,
    saleNumber: saleNumberRecord?.Value,
    status: saleReturnItem.SaleReturnItemStatus,
    storageName: saleReturnItem.Storage?.Name,
    vatAmountLocal: saleReturnItem.VatAmountLocal,
    vendorCode: productRecord?.VendorCode,
  })
}

function getSaleReturnItemStatusLabel(status: number | string | undefined, t: (key: string) => string): string {
  if (typeof status === 'number') {
    const labelKey = SALE_RETURN_ITEM_STATUS_LABELS[status]

    return labelKey ? t(labelKey) : ''
  }

  if (typeof status === 'string') {
    const numericStatus = Number(status)

    if (Number.isFinite(numericStatus) && SALE_RETURN_ITEM_STATUS_LABELS[numericStatus]) {
      return t(SALE_RETURN_ITEM_STATUS_LABELS[numericStatus])
    }

    const mappedStatus = SALE_RETURN_ITEM_STATUS_NAME_BY_KEY[status]

    if (typeof mappedStatus === 'number') {
      return t(SALE_RETURN_ITEM_STATUS_LABELS[mappedStatus])
    }
  }

  return ''
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
  return (typeof value === 'number' && Number.isFinite(value) ? value : 0).toFixed(2)
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

function keyValue(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

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
