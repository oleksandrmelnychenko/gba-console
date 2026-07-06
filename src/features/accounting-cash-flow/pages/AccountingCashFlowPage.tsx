import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Group,
  SegmentedControl,
  Select,
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
  IconArrowDownLeft,
  IconArrowUpRight,
  IconAlertCircle,
  IconDownload,
  IconFileTypePdf,
  IconPencil,
  IconRefresh,
  IconRestore,
  IconScale,
  IconSearch,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { type ReactNode, useCallback, useEffect, useMemo, useReducer, useState } from 'react'
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
import { CashFlowBalanceChart } from '../components/CashFlowBalanceChart'
import { CashFlowDetailContent } from '../components/CashFlowDetailContent'
import { getAccountingCashFlowPaymentStatus } from '../accountingCashFlowPaymentStatus'
import { getAccountingCashFlowClosingBalance } from '../cashFlowTotals'
import { getAccountingCashFlowDrilldownRoute } from '../cashFlowDrilldown'
import './accounting-cash-flow-page.css'
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

type CashFlowViewSummary = {
  afterInAmount?: number
  afterOutAmount?: number
  beforeBalance?: number
  beforeInAmount?: number
  beforeOutAmount?: number
  closingBalance?: number
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
  const items = useMemo(() => cashFlow?.AccountingCashFlowHeadItems || [], [cashFlow])
  const lastItem = items.at(-1)
  const [flowFilter, setFlowFilter] = useState<'all' | 'debit' | 'credit'>('all')
  const [docTypeFilter, setDocTypeFilter] = useState<string | null>(null)
  const [itemSearch, setItemSearch] = useState('')
  const docTypeOptions = useMemo(() => {
    const seen = new Map<string, string>()

    for (const item of items) {
      if (item.Type == null) {
        continue
      }

      const value = String(item.Type)

      if (!seen.has(value)) {
        seen.set(value, getCashFlowTypeLabel(item.Type))
      }
    }

    return Array.from(seen, ([value, label]) => ({ label, value }))
  }, [items])
  const normalizedItemSearch = itemSearch.trim().toLowerCase()
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (flowFilter === 'debit' && item.IsCreditValue) {
          return false
        }

        if (flowFilter === 'credit' && !item.IsCreditValue) {
          return false
        }

        if (docTypeFilter != null && String(item.Type) !== docTypeFilter) {
          return false
        }

        if (normalizedItemSearch) {
          const haystack = `${item.Name ?? ''} ${item.Number ?? ''}`.toLowerCase()

          if (!haystack.includes(normalizedItemSearch)) {
            return false
          }
        }

        return true
      }),
    [items, flowFilter, docTypeFilter, normalizedItemSearch],
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
          setCashFlowError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити взаєморозрахунки'))
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

  function resetFilters() {
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
  }

  function updateFilterDraft(nextFilterDraft: FilterDraft) {
    setFilterDraft(nextFilterDraft)

    if (getFilterError(nextFilterDraft.from, nextFilterDraft.to)) {
      return
    }

    setActiveFilters((current) => (
      current.from === nextFilterDraft.from && current.to === nextFilterDraft.to
        ? current
        : nextFilterDraft
    ))
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
      setCashFlowError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ взаєморозрахунків'))
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
    docTypeFilter,
    docTypeOptions,
    downloadModalOpened,
    filterDraft,
    filterError,
    filteredItems,
    flowFilter,
    isCashFlowLoading,
    isCounterpartyLoading,
    isExporting,
    items,
    itemSearch,
    lastItem,
    mode,
    selectedAgreement,
    selectedAgreementNetUid,
    selectedItem,
    handleExport,
    reload,
    resetFilters,
    setDocTypeFilter,
    setDownloadModalOpened,
    setFlowFilter,
    setItemSearch,
    setSelectedAgreementNetUid,
    setSelectedItem,
    updateFilterDraft,
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
    docTypeFilter,
    docTypeOptions,
    downloadModalOpened,
    filterDraft,
    filterError,
    filteredItems,
    flowFilter,
    isCashFlowLoading,
    isCounterpartyLoading,
    isExporting,
    items,
    itemSearch,
    lastItem,
    mode,
    selectedAgreement,
    selectedAgreementNetUid,
    selectedItem,
    handleExport,
    reload,
    resetFilters,
    setDocTypeFilter,
    setDownloadModalOpened,
    setFlowFilter,
    setItemSearch,
    setSelectedAgreementNetUid,
    setSelectedItem,
    updateFilterDraft,
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
  // Legacy showed a per-row «Курс» (ExchangeRate) column in client mode for non-UAH agreements,
  // populated for UAH income-payment rows. Only render it in that scope.
  const showExchangeRateColumn = useMemo(() => {
    if (mode !== 'client') {
      return false
    }

    const currency = selectedAgreement ? getAgreementCurrency(selectedAgreement) : ''

    return !selectedAgreement || currency.toLowerCase() !== 'uah'
  }, [mode, selectedAgreement])

  const leadColumns = useMemo<CashFlowGridLeadColumn<AccountingCashFlowHeadItem>[]>(() => {
    const columns: CashFlowGridLeadColumn<AccountingCashFlowHeadItem>[] = [
      {
        id: 'name',
        isLabel: true,
        header: t('Документ'),
        cell: (item) => (
          <span className={`accounting-cash-flow-document-cell${item.IsCreditValue ? ' is-credit' : ' is-debit'}`}>
            <span className="accounting-cash-flow-document-cell__icon">
              {item.IsCreditValue ? <IconArrowUpRight size={14} /> : <IconArrowDownLeft size={14} />}
            </span>
            <span className="accounting-cash-flow-document-cell__content">
              <span className="accounting-cash-flow-document-cell__title">{displayValue(item.Name)}</span>
              <span className="accounting-cash-flow-document-cell__meta">
                <span>{formatDateTime(item.FromDate)}</span>
                <span>{getCashFlowTypeLabel(item.Type)}</span>
              </span>
            </span>
          </span>
        ),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 250,
        cell: (item) => (
          <span className="accounting-cash-flow-organization-cell">
            {displayValue(item.OrganizationName)}
          </span>
        ),
      },
    ]

    if (showExchangeRateColumn) {
      columns.splice(1, 0, {
        id: 'exchangeRate',
        header: t('Курс'),
        width: 110,
        cell: (item) => {
          const order = toRecord(item.IncomePaymentOrder)
          const currency = stringValue(toRecord(order?.Currency)?.Code)

          if (!order || currency.toLowerCase() !== 'uah') {
            return null
          }

          const rate = numberValue(order.ExchangeRate)

          return (
            <span className="accounting-cash-flow-organization-cell">
              {rate != null ? formatMoney(rate) : ''}
            </span>
          )
        },
      })
    }

    return columns
  }, [showExchangeRateColumn, t])
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
    <Stack className="cash-flow-page accounting-cash-flow-page" gap={10}>
      {(counterpartyError || cashFlowError) && (
        <Alert className="accounting-cash-flow-alert" color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {counterpartyError || cashFlowError}
        </Alert>
      )}

      <div className="accounting-cash-flow-shell">
        <div className="app-filter-bar accounting-cash-flow-filter-bar">
          <form className="accounting-cash-flow-filter-form" onSubmit={(event) => event.preventDefault()}>
            <div className="accounting-cash-flow-period-filter">
              <span className="accounting-cash-flow-filter-label">{t('Період')}</span>
              <div className="accounting-cash-flow-period-fields">
                <TextInput
                  className="accounting-cash-flow-date-input"
                  aria-label={t('З')}
                  type="date"
                  value={filterDraft.from}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    updateFilterDraft({ ...filterDraft, from: value })
                  }}
                />
                <span className="accounting-cash-flow-period-separator" />
                <TextInput
                  className="accounting-cash-flow-date-input"
                  aria-label={t('По')}
                  type="date"
                  value={filterDraft.to}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    updateFilterDraft({ ...filterDraft, to: value })
                  }}
                />
              </div>
            </div>
            <TextInput
              className="accounting-cash-flow-search"
              label={t('Пошук')}
              leftSection={<IconSearch size={14} />}
              placeholder={t('Номер або документ')}
              value={itemSearch}
              onChange={(event) => setItemSearch(event.currentTarget.value)}
            />
            <Select
              clearable
              searchable
              className="accounting-cash-flow-type-select"
              data={docTypeOptions}
              label={t('Тип документа')}
              placeholder={t('Усі типи')}
              value={docTypeFilter}
              onChange={setDocTypeFilter}
            />
            <SegmentedControl
              className="accounting-cash-flow-kind-toggle"
              data={[
                { label: t('Усі'), value: 'all' },
                { label: t('Дебет'), value: 'debit' },
                { label: t('Кредит'), value: 'credit' },
              ]}
              value={flowFilter}
              onChange={(value) => setFlowFilter(value as 'all' | 'debit' | 'credit')}
            />
            <div className="app-filter-actions accounting-cash-flow-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
                  <IconRestore size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Оновити')}>
                <ActionIcon
                  aria-label={t('Оновити')}
                  className="accounting-cash-flow-icon-action"
                  color="gray"
                  loading={isCashFlowLoading || isCounterpartyLoading}
                  size={36}
                  variant="light"
                  onClick={() => reload()}
                >
                  <IconRefresh size={17} />
                </ActionIcon>
              </Tooltip>
              <Tooltip disabled={canExport} label={t('Експорт доступний після вибору договору')}>
                <Box>
                  <Button
                    className="accounting-cash-flow-export"
                    color={CREATE_ACTION_COLOR}
                    disabled={!canExport}
                    leftSection={<IconDownload size={15} />}
                    loading={isExporting}
                    size="sm"
                    styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
                    variant="light"
                    onClick={handleExport}
                  >
                    {t('Експорт / друк')}
                  </Button>
                </Box>
              </Tooltip>
            </div>
          </form>
        </div>

        {filterError && (
          <Alert className="accounting-cash-flow-filter-alert" color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
            {filterError}
          </Alert>
        )}

        <div className="accounting-cash-flow-command">
          <div className="accounting-cash-flow-stage">
            <div className="accounting-cash-flow-stage-main">
              <CashFlowStatementHero
                counterpartyName={counterpartyName}
                selectedAgreement={selectedAgreement}
                summary={summary}
              />

              <div className="accounting-cash-flow-chart">
                <CashFlowBalanceChart formatMoney={formatMoney} items={items} />
              </div>
            </div>

            <div className="accounting-cash-flow-agreements">
              <AgreementScopePicker
                agreements={agreements}
                isLoading={isCounterpartyLoading}
                selectedAgreementNetUid={selectedAgreementNetUid}
                onSelectAgreement={setSelectedAgreementNetUid}
              />
            </div>
          </div>

          <div className="cash-flow-page__grid-card accounting-cash-flow-grid-card">
            <div className="accounting-cash-flow-ledger-head">
              <div>
                <span>{t('Взаєморозрахунки')}</span>
                <strong>{t('Фінансова стрічка')}</strong>
              </div>
              <small>{filteredItems.length} {t('операцій')}</small>
            </div>
            <CashFlowGrid
              items={filteredItems}
              leadColumns={leadColumns}
              summary={summary}
              emptyText={t('Взаєморозрахунків не знайдено')}
              formatMoney={formatMoney}
              getRowKey={(item, index) => `${item.Type || 'type'}-${item.Id || item.Number || item.Name || 'row'}-${item.FromDate || index}`}
              isLoading={isCashFlowLoading}
              isRowActive={(item) => item === selectedItem}
              loadingText={t('Завантаження взаєморозрахунків')}
              columnWidth={132}
              maxHeight="100%"
              renderRowBadge={renderRowBadge}
              onRowClick={handleCashFlowRowClick}
            />
          </div>
        </div>
      </div>

      <AccountingCashFlowDetailDrawer
        item={selectedItem}
        mode={mode}
        onClose={() => setSelectedItem(null)}
      />

      <DownloadDocumentModal
        document={document}
        opened={downloadModalOpened}
        title={t('Експорт взаєморозрахунків')}
        onClose={() => setDownloadModalOpened(false)}
      />
    </Stack>
  )
}

function CashFlowStatementHero({
  counterpartyName,
  selectedAgreement,
  summary,
}: {
  counterpartyName?: string
  selectedAgreement: AccountingCashFlowClientAgreement | null
  summary: CashFlowViewSummary
}) {
  const { t } = useI18n()
  const debt = useMemo(() => (selectedAgreement ? getAgreementDebtSummary(selectedAgreement) : null), [selectedAgreement])
  const currency = selectedAgreement ? getAgreementCurrency(selectedAgreement) : null
  const title = selectedAgreement
    ? stringValue(selectedAgreement.Agreement?.Name) || t('Договір')
    : t('Усі договори')
  const meta = selectedAgreement
    ? stringValue(selectedAgreement.Agreement?.Organization?.Name) || stringValue(selectedAgreement.OriginalClientName) || counterpartyName || '—'
    : counterpartyName || t('Контрагент')
  const closingBalance = summary.closingBalance ?? 0
  const openingBalance = summary.beforeBalance ?? 0
  const periodDelta = closingBalance - openingBalance
  const debit = summary.afterInAmount ?? 0
  const credit = summary.afterOutAmount ?? 0
  const flowTotal = Math.max(Math.abs(debit) + Math.abs(credit), 1)
  const debitPercent = Math.max(6, Math.min(94, (Math.abs(debit) / flowTotal) * 100))
  const creditPercent = Math.max(6, Math.min(94, (Math.abs(credit) / flowTotal) * 100))
  const balanceClassName = closingBalance < 0 ? ' is-negative' : ' is-positive'

  return (
    <div className="accounting-cash-flow-statement-hero">
      <div className="accounting-cash-flow-statement-hero__identity">
        <ThemeIcon className="accounting-cash-flow-statement-hero__icon" color="gray" radius="xl" size={36} variant="light">
          <IconScale size={18} />
        </ThemeIcon>
        <div className="accounting-cash-flow-statement-hero__title">
          <span>{t('Активний фокус')}</span>
          <strong>{title}</strong>
          <small>{meta}</small>
        </div>
      </div>

      <div className="accounting-cash-flow-statement-hero__balance">
        <span>{t('Кінцевий баланс')}</span>
        <strong className={balanceClassName}>{formatMoney(closingBalance)}</strong>
        <small className={periodDelta < 0 ? 'is-negative' : 'is-positive'}>
          {periodDelta >= 0 ? '+' : ''}{formatMoney(periodDelta)} {t('за період')}
        </small>
      </div>

      <div className="accounting-cash-flow-statement-hero__meter" aria-hidden="true">
        <span style={{ height: `${debitPercent}%` }} />
        <strong style={{ height: `${creditPercent}%` }} />
      </div>

      <div className="accounting-cash-flow-statement-hero__flow">
        <div>
          <IconArrowDownLeft size={15} />
          <span>{t('Дебет')}</span>
          <strong>{formatMoney(summary.afterInAmount)}</strong>
        </div>
        <div>
          <IconArrowUpRight size={15} />
          <span>{t('Кредит')}</span>
          <strong>{formatMoney(summary.afterOutAmount)}</strong>
        </div>
      </div>

      <div className="accounting-cash-flow-statement-hero__chips">
        <span>{currency || t('Всі валюти')}</span>
        {debt?.isOverdue ? <strong>{t('Прострочено')}</strong> : <span>{t('Без прострочки')}</span>}
        <span>{t('Вхідний баланс')}: {formatMoney(openingBalance)}</span>
      </div>
    </div>
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
    <div className="accounting-cash-flow-agreement-picker">
      <div className="accounting-cash-flow-agreement-list">
        <button
          className={`accounting-cash-flow-agreement-card is-general${!selectedAgreementNetUid ? ' is-selected' : ''}`}
          type="button"
          onClick={() => onSelectAgreement(null)}
        >
          <span className="accounting-cash-flow-agreement-card__body">
            <span className="accounting-cash-flow-agreement-card__label">{t('Загальні взаєморозрахунки')}</span>
            <span className="accounting-cash-flow-agreement-card__meta">{t('Всі договори')}</span>
          </span>
        </button>
        {agreements.map((agreement, index) => (
          <AgreementDebtTile
            key={agreement.NetUid || index}
            agreement={agreement}
            isSelected={agreement.NetUid === selectedAgreementNetUid}
            onSelect={() => onSelectAgreement(agreement.NetUid || null)}
          />
        ))}
      </div>
      {!isLoading && agreements.length === 0 && (
        <Text className="accounting-cash-flow-empty-note">
          {t('Договори не знайдено')}
        </Text>
      )}
    </div>
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
      <button
        className={`accounting-cash-flow-agreement-card${isSelected ? ' is-selected' : ''}${debt.isOverdue ? ' is-overdue' : ''}`}
        type="button"
        onClick={onSelect}
      >
        <span className="accounting-cash-flow-agreement-card__body">
          <span className="accounting-cash-flow-agreement-card__top">
            <span className="accounting-cash-flow-agreement-card__label">
              {stringValue(agreement.Agreement?.Name) || '-'}
            </span>
            {currency ? <span className="accounting-cash-flow-currency">{currency}</span> : null}
          </span>
          <span className="accounting-cash-flow-agreement-card__meta">
            {stringValue(agreement.Agreement?.Organization?.Name) || stringValue(agreement.OriginalClientName) || '—'}
          </span>
        </span>
        <span className="accounting-cash-flow-agreement-card__stats">
          {debt.isControlAmountDebt ? (
            <span className={debt.totalOverdueDebt > 0 ? 'is-danger' : undefined}>
              {formatMoney(debt.totalOverdueDebt)}
              <small>/ {formatMoney(debt.accountBalance)}</small>
            </span>
          ) : null}
          {debt.isControlNumberDaysDebt ? (
            <span className={debt.overdueDays > 0 ? 'is-danger' : undefined}>
              {debt.overdueDays}
              <small>/ {debt.allowedDays} {t('днів')}</small>
            </span>
          ) : null}
          {debt.isOverdue ? <strong>{t('Прострочено')}</strong> : null}
        </span>
      </button>
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
      title={item?.Name || t('Деталі взаєморозрахунку')}
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
  const localAmount = getVisibleLocalAmount(item)
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

  if (localAmount !== undefined) {
    fields.splice(8, 0, { label: 'Сума, грн', value: `UAH ${formatMoney(localAmount)}` })
  }

  if (paymentStatus) {
    fields.splice(5, 0, {
      label: 'Статус накладної',
      value: (
        <Badge
          className={`app-role-pill ${
            paymentStatus.kind === 'paid' ? 'is-green'
            : paymentStatus.kind === 'unpaid' ? 'is-red'
            : paymentStatus.kind === 'partial' ? 'is-yellow'
            : 'is-gray'
          }`}
          variant="light"
        >
          {t(paymentStatus.label)}
        </Badge>
      ),
    })
  }

  return fields
}

function getVisibleLocalAmount(item: AccountingCashFlowHeadItem): number | undefined {
  if (typeof item.CurrentValueLocal !== 'number' || !Number.isFinite(item.CurrentValueLocal)) {
    return undefined
  }

  return typeof item.CurrentValue !== 'number' ||
    !Number.isFinite(item.CurrentValue) ||
    Math.abs(item.CurrentValueLocal - item.CurrentValue) >= 0.005
    ? item.CurrentValueLocal
    : undefined
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
  const hasExcel = Boolean(document?.DocumentURL)
  const hasPdf = Boolean(document?.PdfDocumentURL)
  const hasDocument = hasExcel || hasPdf

  return (
    <AppModal
      centered
      classNames={{
        body: 'accounting-cash-flow-export-modal-body',
        content: 'accounting-cash-flow-export-modal-content',
        header: 'accounting-cash-flow-export-modal-header',
        title: 'accounting-cash-flow-export-modal-title',
      }}
      opened={opened}
      size="lg"
      title={
        <div>
          <span>{t('Документ')}</span>
          <strong>{title}</strong>
        </div>
      }
      onClose={onClose}
    >
      <div className="accounting-cash-flow-export-modal">
        <div className="accounting-cash-flow-export-hero">
          <ThemeIcon className="accounting-cash-flow-export-hero-icon" color="orange" radius="xl" size={42} variant="light">
            <IconDownload size={20} />
          </ThemeIcon>
          <div>
            <span>{hasDocument ? t('Готово до завантаження') : t('Документ недоступний')}</span>
            <strong>{hasDocument ? t('Виберіть формат файлу') : t('Файл не сформовано')}</strong>
            <small>
              {hasDocument
                ? t('Посилання відкриються у новій вкладці.')
                : t('Сервер не повернув посилання для завантаження.')}
            </small>
          </div>
        </div>

        {hasDocument ? (
          <div className="accounting-cash-flow-export-options">
            {document?.DocumentURL && (
              <Anchor
                className="accounting-cash-flow-export-card is-excel"
                href={getDocumentHref(document.DocumentURL)}
                rel="noreferrer"
                target="_blank"
              >
                <span className="accounting-cash-flow-export-card-icon">
                  <ExcelIcon size={24} />
                </span>
                <span className="accounting-cash-flow-export-card-text">
                  <strong>{t('Excel')}</strong>
                  <small>{t('Табличний файл для роботи з даними')}</small>
                </span>
                <span className="accounting-cash-flow-export-card-action">{t('Відкрити')}</span>
              </Anchor>
            )}
            {document?.PdfDocumentURL && (
              <Anchor
                className="accounting-cash-flow-export-card is-pdf"
                href={getDocumentHref(document.PdfDocumentURL)}
                rel="noreferrer"
                target="_blank"
              >
                <span className="accounting-cash-flow-export-card-icon">
                  <IconFileTypePdf size={24} stroke={1.8} />
                </span>
                <span className="accounting-cash-flow-export-card-text">
                  <strong>{t('PDF')}</strong>
                  <small>{t('Документ для друку або перегляду')}</small>
                </span>
                <span className="accounting-cash-flow-export-card-action">{t('Відкрити')}</span>
              </Anchor>
            )}
          </div>
        ) : (
          <div className="accounting-cash-flow-export-empty">
            <ThemeIcon color="gray" radius="xl" size={38} variant="light">
              <IconAlertCircle size={18} />
            </ThemeIcon>
            <div>
              <strong>{t('Документ недоступний для завантаження')}</strong>
              <span>{t('Спробуйте сформувати експорт ще раз.')}</span>
            </div>
          </div>
        )}
      </div>
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
