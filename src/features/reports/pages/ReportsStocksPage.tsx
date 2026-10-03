import './stocks-workspace.css'
import PaymentComparisonPanel from './PaymentComparisonPanel'
import { clonePaymentComparisonValue, paymentComparisonSummary } from '../data/paymentComparison'
import MarginComparisonPanel from './MarginComparisonPanel'
import { cloneMarginComparisonValue, marginComparisonSummary } from '../data/marginComparison'
import ReportPeriodInputs from './ReportPeriodInputs'
import RateComparisonPanel from './RateComparisonPanel'
import { rateComparisonOptions, requestRateComparison, type RateComparisonOptions } from '../data/rateComparison'
import ReturnComparisonPanel from './ReturnComparisonPanel'
import { requestReturnComparison, returnComparisonOptions, returnComparisonSummary } from '../data/returnComparison'
import BuyerSalesSharePanel from './BuyerSalesSharePanel'
import { requestBuyerSalesShare, buyerSalesShareOptions } from '../data/buyerSalesShare'
import RevenueComparisonPanel from './RevenueComparisonPanel'
import { requestRevenueComparison, revenueComparisonOptions } from '../data/revenueComparison'
import SalesXyzPanel from './SalesXyzPanel'
import { requestXyz, xyzOptions } from '../data/salesXyz'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  type OptionsFilter,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { CheckboxMultiSelect } from '../../../shared/ui/CheckboxMultiSelect'
import { CircleAlert, LayoutTemplate, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { IconFileSpreadsheet } from '@tabler/icons-react'
import { TableRowAction } from '../../../shared/ui/table-row-action/TableRowAction'
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import type { TranslateFunction } from '../../../shared/i18n/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useAuth } from '../../auth/useAuth'
import {
  createStockReport,
  previewStockReport,
  getReportClientAgreements,
  getReportClientTypes,
  getReportOrganizations,
  getReportPricings,
  getReportProductGroups,
  getReportProductTop,
  getReportRegions,
  getReportRegionCodes,
  searchReportClients,
  searchDatasetReportValues,
  searchReportProducts,
  searchReportUsers,
  searchSaleReturnReportDocuments,
  searchSalesReportDocuments,
} from '../api/reportsApi'
import {
  REPORT_FILTER_CONDITIONS,
  isMultiValueReportCondition,
  REPORT_FILTER_FIELD_TYPES,
  createDefaultMeasurementGroups,
  flattenCheckedMeasurements,
  getReportFieldLabel,
} from '../data/reportOptions'
import type {
  OneCTurnoverFilters,
  ReportCatalogue,
  ReportDataset,
  ReportEntity,
  ReportFilterField,
  ReportGroupingItem,
  ReportMeasurementGroup,
  ReportRequestBody,
  ReportSelection,
  ReportSelectedValue,
  ReportTemplate,
} from '../types'
import {
  getEntityDisplayName,
  formatDate,
} from '../utils'
import './reports-pages.css'
import './report-constructor.css'
import { datasetConfigurationError, datasetFilters, datasetGroupings, datasetMeasurements, datasetPresetRequest, datasetPresets, defaultDatasetRequest, type DatasetReportPresetId } from '../data/reportDatasets'
import { useReportDatasets } from '../hooks/useReportDatasets'
import { usesNativeReportLookup, supportsFullReportDateRange, hasFixedReportAxes, nativeReportMeasurementUnit } from '../data/nativeReportProfiles'
import { CURRENT_VPARIVANIE_NOTICE, currentVparivanieFilterConditions, currentVparivanieNotice, currentVparivanieFullScope } from '../data/currentVparivanie'
import { previousKyivDay } from '../data/cashPeriod'
import { availableBug1274WorkbookLaunches, bug1274WorkbookRequest, type WorkbookLaunch } from '../data/bug1274WorkbookLaunch'
import { CashSettlementSettingsPanels } from './CashSettlementSettingsPanels'
import { cashFormDataset, requestGroupedCashPeriod } from '../data/groupedCashPeriod'
import { groupedSettlementPeriod as parseGroupedSettlementPeriod, requestGroupedSettlementPeriod, settlementFormDataset, settlementMaximumDate, settlementModePatch } from '../data/groupedSettlementPeriod'
import { requestSourceCounterpartyGroups } from '../data/sourceCounterpartyGroups'
import { requiresValuationAgreement } from '../data/reportValuation'
import { useValuationAgreement } from '../hooks/useValuationAgreement'
import { useReportRunState } from '../hooks/useReportRunState'
import { useReportWorkspaceDraft } from '../hooks/useReportWorkspaceDraft'
import type { ReportWorkspaceSnapshot } from '../data/reportWorkspaceDraft'
import { reportWorkspaceDraftCompatibility } from '../data/reportWorkspaceDraftCompatibility'
import { ReportDraftRecoveryPanel, ReportDraftStatus } from './ReportDraftRecoveryPanel'
import { ValuationAgreementPicker } from './ValuationAgreementPicker'
import { ReportDatasetPicker, ReportDatasetSummary } from './ReportDatasetPicker'
import { ReportConstructorHeader, ReportConstructorNavigation, ReportConstructorResultEmpty, ReportSectionPanel, type ReportConstructorSection } from './ReportConstructorNavigation'
import { ReportQuickPresets } from './ReportQuickPresets'
import { OneCTurnoverReportPanel } from './OneCTurnoverReportPanel'
import { DebtToSalesRatioReportPanel } from './DebtToSalesRatioReportPanel'
import { isDebtToSalesRatioCapabilities, type DebtToSalesRatioCapabilities } from '../data/debtToSalesRatio'
import { CollectionCoefficientConstructorModal } from './CollectionCoefficientConstructorModal'
import { useCollectionCoefficientConstructor } from '../hooks/useCollectionCoefficientConstructor'
import { SalesMarginConstructorModal } from './SalesMarginConstructorModal'
import { useSalesMarginConstructor } from '../hooks/useSalesMarginConstructor'
import { CashMovementConstructorModal } from './CashMovementConstructorModal'
import { useCashMovementConstructor } from '../hooks/useCashMovementConstructor'
import { SupplierDebtConstructorModal } from './SupplierDebtConstructorModal'
import { useSupplierDebtConstructor } from '../hooks/useSupplierDebtConstructor'
import { EmployeeGrossProfitConstructorModal } from './EmployeeGrossProfitConstructorModal'
import { useEmployeeGrossProfitConstructor } from '../hooks/useEmployeeGrossProfitConstructor'
import { OverdueReceivablesConstructorModal } from './OverdueReceivablesConstructorModal'
import { useOverdueReceivablesConstructor } from '../hooks/useOverdueReceivablesConstructor'
import { ManagementReturnsConstructorModal } from './ManagementReturnsConstructorModal'
import { useManagementReturnsConstructor } from '../hooks/useManagementReturnsConstructor'
import { ManagementBalanceConstructorModal } from './ManagementBalanceConstructorModal'
import { useManagementBalanceConstructor } from '../hooks/useManagementBalanceConstructor'
import { ManagementOrdersConstructorModal } from './ManagementOrdersConstructorModal'
import { useManagementOrdersConstructor } from '../hooks/useManagementOrdersConstructor'
import { DefectProductionConstructorModal } from './DefectProductionConstructorModal'
import { useDefectProductionConstructor } from '../hooks/useDefectProductionConstructor'
import { InventoryTurnoverConstructorModal } from './InventoryTurnoverConstructorModal'
import { useInventoryTurnoverConstructor } from '../hooks/useInventoryTurnoverConstructor'
import { PlannedCashConstructorModal } from './PlannedCashConstructorModal'
import { usePlannedCashConstructor } from '../hooks/usePlannedCashConstructor'
import { CurrentLiquidityConstructorModal } from './CurrentLiquidityConstructorModal'
import { useCurrentLiquidityConstructor } from '../hooks/useCurrentLiquidityConstructor'
import { ActiveClientsReportPanel } from './ActiveClientsReportPanel'
import { isActiveClientsCapabilities, type ActiveClientsCapabilities } from '../data/activeClients'
import { CurrencyRateDynamicsReportPanel } from './CurrencyRateDynamicsReportPanel'
import { CashAggregateBalanceReportPanel } from './CashAggregateBalanceReportPanel'
import { OriginalRevenueReportPanel } from './OriginalRevenueReportPanel'
import { OriginalBuyerSalesShareReportPanel } from './OriginalBuyerSalesShareReportPanel'
import { isOriginalBuyerSalesShareCapabilities, type OriginalBuyerSalesShareCapabilities } from '../data/originalBuyerSalesShare'
import { isOriginalRevenueCapabilities, type OriginalRevenueCapabilities } from '../data/originalRevenue'
import { isCashAggregateBalanceCapabilities, type CashAggregateBalanceCapabilities } from '../data/cashAggregateBalance'
import { defaultCurrencyRateDynamicsMonth, isCurrencyRateDynamicsCapabilities, type CurrencyRateDynamicsCapabilities } from '../data/currencyRateDynamics'
import { ReportGroupingPanel } from './ReportGroupingPanel'
import { reorderReportGrouping, transferReportGrouping, type ReportGroupingAxis } from '../data/reportGroupingLayout'

import { useServerReportTemplates, type TemplateMutationResult } from '../hooks/useServerReportTemplates'
import { ReportTemplatesPanel } from './ReportTemplatesPanel'
import { retainStoredTemplateFields } from '../data/reportTemplateDraft'

import { ReportCatalogueControl } from './ReportCatalogueControl'
import { isOneCTurnoverCatalogueChoice, resolveCatalogueLaunch, type CatalogueLaunchChoice } from '../data/reportCatalogueLaunch'
import { ReportOrderingPanel } from './ReportOrderingPanel'
import { requestOrdering } from '../data/reportOrdering'
import { requestFilterExpression } from '../data/reportFilterExpression'
import { CLIENT_COMPARISON_MAX_DATE, comparisonWindow, isComparisonDate, requestComparison } from '../data/clientPeriodComparison'
import { ClientComparisonPeriodPanel } from './ClientComparisonPeriodPanel'
import { buildReportBuilderRequest } from '../data/reportBuilderRequest'
import { ReportInlinePreview } from './ReportInlinePreview'
import { CurrentVparivanieRegionalPanel } from './CurrentVparivanieRegionalPanel'
import type { NativeReportPreview } from '../data/nativeReportPreview'
import { useReportFilterExpression, type ReportSelectionEdit } from '../hooks/useReportFilterExpression'
import { ReportFilterExpressionPanel } from './ReportFilterExpressionPanel'
import { requestThreshold } from '../data/reportThreshold'
import { requestHideZero } from '../data/reportHideZero'
import { ReportHideZeroPanel } from './ReportHideZeroPanel'
import { ReportThresholdPanel } from './ReportThresholdPanel'
import { ReportTopGroupsPanel } from './ReportTopGroupsPanel'
import { ABC_CLASS_GROUPING, requestAbcClassification } from '../data/reportAbcClassification'
import { ReportAbcClassificationPanel } from './ReportAbcClassificationPanel'
import { useReportAbcClassification } from '../hooks/useReportAbcClassification'
import { requestTopGroups } from '../data/reportTopGroups'
import { useReportGroupingOrdering } from '../hooks/useReportGroupingOrdering'
import type { ReportGroupingLayout } from '../data/reportGroupingLayout'
import { DayOrganizationBasisSelect } from './DayOrganizationBasisSelect'
import { requestDayOrganizationBasis } from '../data/dayOrganizationBasis'
import { requestSupplierBasis, rowGroupsForSupplierBasis } from '../data/supplierBasis'
import { SupplierBasisSelect } from './SupplierBasisSelect'
import { productClassification as parseProductClassification, sourceOrganizations as parseSourceOrganizations, sourceBuyerSubtree as parseSourceBuyerSubtree, requestProductClassification, requestSourceOrganizations, requestSourceBuyerSubtree, FENIX_BUYERS_ROOT_ID } from '../data/nativeExactFilters'
import { DAY_ORGANIZATION_GOODS_KIND_ID, DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS } from '../data/dayOrganizationGrossProfit'
import { isSupplierSourceWorldCapability, requestSupplierSourceWorld } from '../data/supplierBatchGrossProfit'
import PriceTypeSalesComparisonPanel from './PriceTypeSalesComparisonPanel'
import AgreementPriceComparisonPanel from './AgreementPriceComparisonPanel'
import { defaultAgreementPriceComparison, requestAgreementPriceComparison } from '../data/agreementPriceComparison'
import { OneCSpecialReportPanel } from './OneCSpecialReportPanel'
import { currentProvidedDiscountLookupBasis, defaultOneCSpecialSettings, oneCSpecialSpecification, requestOneCSpecialSettings } from '../data/oneCSpecialReports'
import {
  clonePriceTypeSalesComparisonValue,
  priceTypeSalesFormDataset,
  currentPriceTypeSalesLookupBasis,
  PRICE_TYPE_SALES_COMPARISON_SOURCE,
} from '../data/priceTypeSalesComparison'
const LOOKUP_SEARCH_DEBOUNCE_MS = 300
const LOOKUP_SEARCH_LIMIT = 30
const DATE_INPUT_DEBOUNCE_MS = 400
// A native <input type="date"> carries no bounds of its own and reports every intermediate value while the
// year is edited digit by digit («0002-07-18»), which the engine accepts and then walks for two millennia
// until the request dies of a timeout. Both ends are clamped, and the same range is re-checked here because
// min/max only style the input — they do not stop a typed value from reaching the form.
const REPORT_MIN_DATE = '2000-01-01'

// Only the sale-document lookup narrows its options by the report period; the rest ignore it.
//
// «Повернення від клієнта» deliberately does NOT: the report attributes a sale line of the period to the document
// that returned it, and that document is dated whenever the return happened. Measured on the dev database, the
// four return documents the 5–6 June sale lines are attributed to are dated 2025-05-08, 2025-07-01, 2026-03-26
// and 2026-04-06 — every one of them outside the report's own window. A picker scoped to the period would offer
// none of the documents the report can actually show.
const PERIOD_SCOPED_FILTER_FIELD_TYPES = new Set<number>([REPORT_FILTER_FIELD_TYPES.saleDocument, REPORT_FILTER_FIELD_TYPES.saleDocumentNumberDate])

// The whole return-document catalogue, which is what «Повернення від клієнта» is picked from. The list endpoint
// takes a period and nothing else, so it is asked for the widest period the report form itself allows.
const RETURN_DOCUMENT_CATALOGUE_PAGE_SIZE = 500
const RETURN_DOCUMENT_CATALOGUE_MAX_ITEMS = 200_000

const SALE_DOCUMENT_STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { value: 'All', label: 'Всі' },
  { value: 'New', label: 'SaleLifeCycleNew' },
  { value: 'Packaging', label: 'SaleLifeCyclePackaging' },
  { value: 'InvoiceChanged', label: 'InvoiceChanged' },
  { value: 'TransporterChanged', label: 'TransporterChanged' },
  { value: 'OrderClosed', label: 'OrderClosed' },
]

const defaultCondition = REPORT_FILTER_CONDITIONS[0]

// What the finished run was asked for, kept because the response carries none of it back.
type ReportRunOutcome = {
  rateComparison?: RateComparisonOptions
  comparison?: { From: string; To: string }
  periodSupported: boolean
  colGroupings: string[]
  from: string
  hasDocument: boolean
  measures: string[]
  name: string
  rowGroupings: string[]
  to: string
}

type StateSetter<T> = (value: T | ((current: T) => T)) => void

function createEmptySelection(): ReportSelection {
  return {
    IsChecked: true,
    SelectedField: {
      Name: '',
      Type: 0,
    },
    FilterCondition: {
      Name: defaultCondition.Name,
      Type: defaultCondition.Type,
    },
    Values: [],
  }
}

function shouldLoadDatasetDefaults(dataSource: number, periodSupported: boolean): boolean {
  return !periodSupported
    || supportsFullReportDateRange(dataSource)
    || dataSource === PRICE_TYPE_SALES_COMPARISON_SOURCE
}

function usesSavedFenixOrganizations(value: unknown): boolean {
  const ids = parseSourceOrganizations(value)?.OrganizationIds
  if (ids?.length !== DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS.length) return false
  return DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS.every(id => ids.some(value => value.toUpperCase() === id))
}

function reportLookupSourceWorld(dataSource: number, groupedSettlement: unknown, specialSettings: unknown): 1 | 2 | undefined {
  if (dataSource === 41) {
    const world = parseGroupedSettlementPeriod(groupedSettlement)?.SourceWorld
    return world === 'Fenix' ? 1 : world === 'Amg' ? 2 : undefined
  }
  return typeof specialSettings === 'object' && specialSettings !== null && 'SourceWorld' in specialSettings
    && (specialSettings.SourceWorld === 1 || specialSettings.SourceWorld === 2) ? specialSettings.SourceWorld : undefined
}

export function ReportsStocksPage({ constructorMode = false }: { constructorMode?: boolean }) {
  const { user, session } = useAuth()
  const ownerId = user?.NetUid ?? session?.userNetUid ?? null
  return <ReportsStocksWorkspace key={ownerId ?? 'anonymous'} ownerId={ownerId} constructorMode={constructorMode} />
}

function ReportsStocksWorkspace({ ownerId, constructorMode }: { ownerId: string | null; constructorMode: boolean }) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const canGenerateReport = hasPermission(
    PermissionKeys.ReportsStocks.Report.Generate,
  )
  const today = useMemo(() => formatKyivBusinessDate(), [])
  const [from, setFrom] = useValueState(today)
  const [to, setTo] = useValueState(today)
  const [previousPeriod, setPreviousPeriod] = useValueState({ from: today, to: today })
  const datasetStorage = useReportDatasets(canGenerateReport)
  const [dataSource, setDataSource] = useValueState(0)
  const [fullCurrentVparivanie, setFullCurrentVparivanie] = useValueState(false)
  const [constructorSection, setConstructorSection] = useState<ReportConstructorSection>('structure')
  const navigateConstructorSection = (section: ReportConstructorSection) => {
    setConstructorSection(section)
    document.getElementById(`report-constructor-tab-${section}`)?.focus()
  }
  const [comparison, setComparison] = useValueState<unknown>(undefined)
  const [rateComparison, setRateComparison] = useValueState<unknown>(undefined)
  const [paymentComparison, setPaymentComparison] = useValueState<unknown>(undefined)
  const [marginComparison, setMarginComparison] = useValueState<unknown>(undefined)
  const [returnComparison, setReturnComparison] = useValueState<unknown>(undefined)
  const [buyerSalesShare, setBuyerSalesShare] = useValueState<unknown>(undefined)
  const [revenueComparison, setRevenueComparison] = useValueState<unknown>(undefined)
  const [xyz, setXyz] = useValueState<unknown>(undefined)
  const [productClassification, setProductClassification] = useValueState<unknown>(undefined)
  const [sourceOrganizations, setSourceOrganizations] = useValueState<unknown>(undefined)
  const [sourceBuyerSubtree, setSourceBuyerSubtree] = useValueState<unknown>(undefined)
  const [dayOrganizationBasis, setDayOrganizationBasis] = useValueState<unknown>(undefined)
  const [supplierBasis, setSupplierBasis] = useValueState<unknown>(undefined)
  const [supplierSourceWorld, setSupplierSourceWorld] = useValueState<unknown>(undefined)
  const [returnsOnly, setReturnsOnly] = useValueState<boolean | undefined>(undefined)
  const [priceTypeSalesComparison, setPriceTypeSalesComparison] = useValueState<unknown>(undefined)
  const [agreementPriceComparison, setAgreementPriceComparison] = useValueState<unknown>(undefined)
  const [settlementPeriod, setSettlementPeriod] = useValueState<unknown>(undefined)
  const [groupedSettlementPeriod, setGroupedSettlementPeriod] = useValueState<unknown>(undefined)
  const [sourceCounterpartyGroups, setSourceCounterpartyGroups] = useValueState<unknown>(undefined)
  const [groupedCashPeriod, setGroupedCashPeriod] = useValueState<unknown>(undefined)
  const [cashPeriod, setCashPeriod] = useValueState<unknown>(undefined)
  const [oneCSpecialSettings, setOneCSpecialSettings] = useValueState<unknown>(undefined)
  const [oneCScope, setOneCScope] = useValueState<OneCTurnoverFilters | undefined>(undefined)
  const [oneCReportOpen, setOneCReportOpen] = useState(false)
  const [oneCReportGenerating, setOneCReportGenerating] = useState(false)
  const [debtRatioCapability, setDebtRatioCapability] = useState<DebtToSalesRatioCapabilities | null>(null)
  const [debtRatioGenerating, setDebtRatioGenerating] = useState(false)
  const [activeClientsCapability, setActiveClientsCapability] = useState<ActiveClientsCapabilities | null>(null)
  const [activeClientsGenerating, setActiveClientsGenerating] = useState(false)
  const [currencyDynamicsCapability, setCurrencyDynamicsCapability] = useState<CurrencyRateDynamicsCapabilities | null>(null)
  const [currencyDynamicsGenerating, setCurrencyDynamicsGenerating] = useState(false)
  const [cashAggregateCapability, setCashAggregateCapability] = useState<CashAggregateBalanceCapabilities | null>(null)
  const [cashAggregateGenerating, setCashAggregateGenerating] = useState(false)
  const [originalRevenueCapability, setOriginalRevenueCapability] = useState<OriginalRevenueCapabilities | null>(null)
  const [originalRevenueGenerating, setOriginalRevenueGenerating] = useState(false)
  const [originalBuyerSalesShareCapability, setOriginalBuyerSalesShareCapability] = useState<OriginalBuyerSalesShareCapabilities | null>(null)
  const [originalBuyerSalesShareGenerating, setOriginalBuyerSalesShareGenerating] = useState(false)
  const [valuationClientAgreementId, setValuationAgreementId] = useValueState<number | undefined>(undefined)
  const valuation = useValuationAgreement(valuationClientAgreementId, canGenerateReport && requiresValuationAgreement(dataSource))
  const dataset = datasetStorage.datasets.find(item => item.DataSource === dataSource)
  const periodSupported = dataset?.PeriodSupported !== false
  const [selectedMeasurements, setMeasurements] = useValueState<ReportMeasurementGroup[]>(createDefaultMeasurementGroups)
  const priceTypeDataset = useMemo(() => priceTypeSalesFormDataset(dataset, priceTypeSalesComparison), [dataset, priceTypeSalesComparison])
  const measurements = useMemo(() => datasetMeasurements(priceTypeDataset, flattenCheckedMeasurements(selectedMeasurements)), [priceTypeDataset, selectedMeasurements])
  const presets = useMemo(() => datasetPresets(dataset), [dataset])
  const groupingOrdering = useReportGroupingOrdering()
  const { rowGroups, setRowGroups, colGroups, setColGroups, ordering } = groupingOrdering
  const abc = useReportAbcClassification({ Row: rowGroups, Col: colGroups }, groupingOrdering.changeLayout, dataset)
  const abcClassification = abc.value
  const [hideZero, setHideZero] = useValueState<unknown>(undefined)
  const [threshold, setThreshold] = useValueState<unknown>(undefined)
  const [topGroups, setTopGroups] = useValueState<unknown>(undefined)
  const filterLogic = useReportFilterExpression()
  const { selections, expression: filterExpression } = filterLogic
  const [templateName, setTemplateName] = useValueState('')
  const templateStorage = useServerReportTemplates(canGenerateReport, datasetStorage.datasets, ownerId)
  const [activeTemplate, setActiveTemplate] = useState<ReportTemplate | null>(null)
  const [restoredData, setRestoredData] = useState<ReportRequestBody | null>(null)
  const [draftRestoreError, setDraftRestoreError] = useState<string | null>(null)
  const [templateNotice, setTemplateNotice] = useValueState<string | null>(null)
  const [catalogueNotice, setCatalogueNotice] = useState<{ text: string; failed: boolean } | null>(null)
  const groupingOptions = useMemo(() => datasetGroupings(priceTypeDataset).filter(field => field.type !== ABC_CLASS_GROUPING || abcClassification != null), [abcClassification, priceTypeDataset])
  const groupingSelectData = useMemo(
    () =>
      groupingOptions.map((item) => ({
        assignedTo: [
          ...(rowGroups.some((group) => group.type === item.type) ? ['rows' as const] : []),
          ...(colGroups.some((group) => group.type === item.type) ? ['columns' as const] : []),
        ],
        label: item.label,
        value: String(item.type),
      }) satisfies GroupingOption),
    [colGroups, groupingOptions, rowGroups],
  )
  const settlementDataset = useMemo(() => settlementFormDataset(priceTypeDataset, groupedSettlementPeriod), [priceTypeDataset, groupedSettlementPeriod])
  const cashDataset = useMemo(() => cashFormDataset(settlementDataset, groupedCashPeriod), [settlementDataset, groupedCashPeriod])
  const filterFieldOptions = useMemo(() => datasetFilters(cashDataset), [cashDataset])
  const maxDate = useMemo(() => settlementMaximumDate(dataSource, groupedSettlementPeriod, today)
    ?? (supportsFullReportDateRange(dataSource) ? CLIENT_COMPARISON_MAX_DATE : `${today.slice(0, 4)}-12-31`), [dataSource, groupedSettlementPeriod, today])
  const [debouncedFrom] = useDebouncedValue(from, DATE_INPUT_DEBOUNCE_MS)
  const [debouncedTo] = useDebouncedValue(to, DATE_INPUT_DEBOUNCE_MS)
  const periodError = supportsFullReportDateRange(dataSource) ? (!isComparisonDate(from) || !isComparisonDate(to) || from > to ? 'Оберіть коректний період у межах 1900–9998 років.' : null)
    : periodSupported ? getPeriodError(from, to, maxDate, t) : null
  // The value lookups re-query on every keystroke in the date fields, half-typed years included. They follow the
  // period on a pause, and only once it is a period the server can answer for.
  const hasLookupPeriod = !getPeriodError(debouncedFrom, debouncedTo, maxDate, t)
  const reportBody = useMemo<ReportRequestBody>(
    () => ({ ...buildReportBuilderRequest({ dataSource, returnsOnly, comparison, xyz, revenueComparison, buyerSalesShare, returnComparison, paymentComparison, marginComparison, rateComparison, productClassification, sourceOrganizations, sourceBuyerSubtree, dayOrganizationBasis, supplierBasis, supplierSourceWorld, priceTypeSalesComparison, agreementPriceComparison, settlementPeriod, groupedSettlementPeriod, sourceCounterpartyGroups, cashPeriod, groupedCashPeriod, oneCSpecialSettings, oneC: oneCScope, from, to, ordering, filterExpression, topGroups, threshold, hideZero, abcClassification, valuationClientAgreementId, rowGroups, colGroups, measurements, selections }), ...(dataSource === 39 && fullCurrentVparivanie ? { currentVparivanieFullScope: true } : {}) }),
    [fullCurrentVparivanie, abcClassification, agreementPriceComparison, settlementPeriod, groupedSettlementPeriod, sourceCounterpartyGroups, cashPeriod, groupedCashPeriod, colGroups, comparison, xyz, revenueComparison, buyerSalesShare, returnComparison, paymentComparison, marginComparison, rateComparison, productClassification, sourceOrganizations, sourceBuyerSubtree, dayOrganizationBasis, supplierBasis, supplierSourceWorld, returnsOnly, priceTypeSalesComparison, oneCSpecialSettings, oneCScope, dataSource, filterExpression, from, hideZero, measurements, ordering, rowGroups, selections, to, topGroups, threshold, valuationClientAgreementId],
  )
  const { result, preview, lastRun, error, isLoading, downloadModalOpened, update: updateRun, begin: beginRun, clear: clearRun } = useReportRunState<ReportRunOutcome>(JSON.stringify({
    request: reportBody,
    allowed: canGenerateReport,
    agreementVerified: !requiresValuationAgreement(dataSource) || valuation.agreement?.Id === valuationClientAgreementId,
  }))
  const collectionConstructor = useCollectionCoefficientConstructor({ enabled: canGenerateReport, disabled: isLoading,
    callerKey: ownerId, from, today })
  const salesMarginConstructor = useSalesMarginConstructor({ enabled: canGenerateReport, disabled: isLoading,
    callerKey: ownerId, from, today })
  const cashMovementConstructor = useCashMovementConstructor({ enabled: canGenerateReport, disabled: isLoading,
    callerKey: ownerId, from, today })
  const supplierDebtConstructor = useSupplierDebtConstructor({ enabled: canGenerateReport, disabled: isLoading,
    callerKey: ownerId, from, today })
  const employeeGrossProfitConstructor = useEmployeeGrossProfitConstructor({ enabled: canGenerateReport, disabled: isLoading,
    callerKey: ownerId, from, today })
  const overdueReceivablesConstructor = useOverdueReceivablesConstructor({ enabled: canGenerateReport, disabled: isLoading,
    callerKey: ownerId, from, today })
  const managementReturnsConstructor = useManagementReturnsConstructor({ enabled: canGenerateReport, disabled: isLoading,
    callerKey: ownerId, from, today })
  const managementBalanceConstructor = useManagementBalanceConstructor({ enabled: canGenerateReport, disabled: isLoading,
    callerKey: ownerId, from, today })
  const managementOrdersConstructor = useManagementOrdersConstructor({ enabled: canGenerateReport, disabled: isLoading,
    callerKey: ownerId, from, today })
  const defectProductionConstructor = useDefectProductionConstructor({ enabled: canGenerateReport, disabled: isLoading,
    callerKey: ownerId, from, today })
  const inventoryTurnoverConstructor = useInventoryTurnoverConstructor({ enabled: canGenerateReport, disabled: isLoading,
    callerKey: ownerId, from, today })
  const currentLiquidityConstructor = useCurrentLiquidityConstructor({ enabled: canGenerateReport, disabled: isLoading,
    callerKey: ownerId, today })
  const plannedCashConstructor = usePlannedCashConstructor({ enabled: canGenerateReport, disabled: isLoading, callerKey: ownerId, today })
  const comparisonSettingsDisabled = isLoading || !canGenerateReport
  const retainedData = restoredData ?? activeTemplate?.Data
  const templateBody = useMemo(() => retainedData
    ? retainStoredTemplateFields(retainedData, { ...reportBody, selections })
    : { ...reportBody, selections }, [retainedData, reportBody, selections])
  const draftSnapshot = useMemo<ReportWorkspaceSnapshot>(() => ({
    name: templateName, data: templateBody, measurements: selectedMeasurements, activeTemplate, previousPeriod,
  }), [activeTemplate, previousPeriod, selectedMeasurements, templateBody, templateName])
  const workspaceDraft = useReportWorkspaceDraft({ ownerId, enabled: canGenerateReport,
    ready: datasetStorage.loaded && !datasetStorage.error, snapshot: draftSnapshot })
  const configurationError = datasetStorage.error ?? (!datasetStorage.loaded ? t('Завантаження наборів даних…') : datasetConfigurationError(templateBody, dataset))
    ?? (requiresValuationAgreement(dataSource) && valuation.agreement?.Id !== valuationClientAgreementId ? 'Підтвердіть доступний договір оцінки.' : null)
  const checkedMeasurements = reportBody.sorted.Measurements.length
  // The report engine lays the sheet out from the row groupings; without one it fails deep
  // inside the spreadsheet writer («Column out of range»), so the form has to require it.
  const missingRowGrouping = rowGroups.length === 0
  // A row whose field is chosen but whose value list is still empty is not «no filter»: the engine compares the
  // column against nothing, so «Дорівнює» empties the report and «Не дорівнює» drops the filter altogether. The
  // sheet that comes back looks plausible either way, so the row has to be finished before the request goes out.
  const incompleteSelectionIndex = selections.findIndex(isIncompleteSelection)
  const incompleteSelectionMessage =
    incompleteSelectionIndex < 0
      ? ''
      : t('Умова відбору {position} ({field}): додайте значення або зніміть галочку', {
          field: getReportFieldLabel(selections[incompleteSelectionIndex].SelectedField.Name),
          position: incompleteSelectionIndex + 1,
        })
  const reportIsReady = !configurationError && !periodError && !incompleteSelectionMessage && checkedMeasurements > 0 && !missingRowGrouping
  const canSubmit = canGenerateReport && reportIsReady
  const submitBlockedReason = !canGenerateReport
    ? t('Немає права формувати звіт залишків')
    : configurationError
      ? configurationError
      : periodError
      ? periodError
      : checkedMeasurements === 0
        ? t('Виберіть хоча б один показник')
        : missingRowGrouping
          ? t('Додайте хоча б одне групування рядків')
          : incompleteSelectionMessage
  const emptyRunNotice =
    lastRun && !lastRun.hasDocument
      ? lastRun.rateComparison ? 'Сервер не повернув файл історичних курсів. Перевірте обрану серію.' : !lastRun.periodSupported ? t(dataSource === 11 ? 'Сервер не повернув файл записаних залишків рахунків. Спробуйте послабити умови відбору.' : dataSource === 10 ? 'Сервер не повернув файл поточної заборгованості. Спробуйте послабити умови відбору.' : 'Сервер не повернув файл поточних залишків. Спробуйте послабити умови відбору.')
      : t('За період {from} – {to} сервер не повернув файл звіту. Спробуйте інший період або послабте умови відбору.', {
          from: formatDate(lastRun.from),
          to: formatDate(lastRun.to),
        })
      : null
  const resultPlaceholder = describeResultPlaceholder(lastRun, Boolean(error), t)

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runReport(false)
  }

  async function runReport(showPreview: boolean) {
    if (!canGenerateReport || !reportIsReady || isLoading) {
      return
    }

    const updateAttempt = beginRun()
    if (constructorMode) setConstructorSection('result')

    try {
      const previewResult = showPreview ? await previewStockReport(reportBody) : null
      const nextResult = previewResult?.result ?? await createStockReport(reportBody)
      const outcome: ReportRunOutcome = {
        ...(rateComparisonOptions(rateComparison) ? { rateComparison: structuredClone(rateComparisonOptions(rateComparison)!) } : {}),
        ...returnComparisonSummary(returnComparison),
        ...paymentComparisonSummary(paymentComparison),
        ...marginComparisonSummary(marginComparison),
        ...(buyerSalesShareOptions(buyerSalesShare) ? { comparison: structuredClone(buyerSalesShareOptions(buyerSalesShare)!) } : {}),
        ...(revenueComparisonOptions(revenueComparison) ? { comparison: structuredClone(revenueComparisonOptions(revenueComparison)!) } : {}),
        ...(comparisonWindow(comparison) ? { comparison: structuredClone(comparisonWindow(comparison)!) } : {}),
        periodSupported,
        colGroupings: colGroups.map((group) => group.label || getReportFieldLabel(group.key)),
        from,
        hasDocument: Boolean(nextResult.document.DocumentURL || nextResult.document.PdfDocumentURL),
        measures: reportBody.sorted.Measurements.map((measurement) => measurement.Label || getReportFieldLabel(measurement.Name)),
        name: templateName.trim(),
        rowGroupings: rowGroups.map((group) => group.label || getReportFieldLabel(group.key)),
        to,
      }

      updateAttempt({ result: nextResult, preview: previewResult?.preview ?? null, lastRun: outcome,
        downloadModalOpened: !showPreview && outcome.hasDocument })
    } catch (submitError) {
      updateAttempt({ result: null, error: describeReportError(submitError, t) })
    } finally {
      updateAttempt({ isLoading: false })
    }
  }

  function changeSettlementMode(mode: 'buyers' | 'agreement') {
    const patch = settlementModePatch(mode, groupingOptions)
    setGroupedSettlementPeriod(patch.grouped)
    setSourceCounterpartyGroups(undefined)
    setSettlementPeriod(undefined)
    setSourceBuyerSubtree(patch.buyer)
    setRowGroups(patch.rows)
    filterLogic.load([])
  }

  function resetReport() {
    setFullCurrentVparivanie(false)
    setConstructorSection('structure')
    setCatalogueNotice(null)
    workspaceDraft.rememberBeforeReplace()
    setRestoredData(null)
    setDraftRestoreError(null)
    setActiveTemplate(null)
    const resetDay = (dataSource === 40 || dataSource === 41) ? previousKyivDay(today) : today
    const snapshotDefaults = dataset && shouldLoadDatasetDefaults(dataSource, periodSupported)
      ? defaultDatasetRequest(dataset, resetDay, resetDay)
      : null
    setComparison(snapshotDefaults?.comparison)
    setXyz(snapshotDefaults?.xyz)
    setRateComparison(snapshotDefaults?.rateComparison)
    setPaymentComparison(snapshotDefaults?.paymentComparison)
    setMarginComparison(snapshotDefaults?.marginComparison)
    setReturnComparison(snapshotDefaults?.returnComparison)
    setBuyerSalesShare(snapshotDefaults?.buyerSalesShare)
    setRevenueComparison(snapshotDefaults?.revenueComparison)
    setProductClassification(undefined)
    setSourceOrganizations(undefined)
    setSourceBuyerSubtree(snapshotDefaults?.sourceBuyerSubtree)
    setDayOrganizationBasis(snapshotDefaults?.dayOrganizationBasis)
    setSupplierBasis(snapshotDefaults?.supplierBasis)
    setSupplierSourceWorld(snapshotDefaults?.supplierSourceWorld)
    setPriceTypeSalesComparison(snapshotDefaults?.priceTypeSalesComparison)
    setAgreementPriceComparison(snapshotDefaults?.agreementPriceComparison)
    setSettlementPeriod(undefined)
    setGroupedSettlementPeriod(snapshotDefaults?.groupedSettlementPeriod)
    setSourceCounterpartyGroups(undefined)
    setCashPeriod(undefined)
    setGroupedCashPeriod(snapshotDefaults?.groupedCashPeriod)
    setOneCSpecialSettings(snapshotDefaults && oneCSpecialSpecification(dataSource)
      ? requestOneCSpecialSettings(snapshotDefaults, dataSource) : undefined)
    setOneCScope(snapshotDefaults?.oneC)
    setFrom(periodSupported ? resetDay : '')
    setTo(periodSupported ? resetDay : '')
    setMeasurements(snapshotDefaults ? datasetMeasurements(dataset, snapshotDefaults.sorted.Measurements) : createDefaultMeasurementGroups())
    setRowGroups(snapshotDefaults?.sorted.Row ?? [])
    setColGroups((dataSource === 40 || dataSource === 41) ? snapshotDefaults?.sorted.Col ?? [] : [])
    filterLogic.load([])
    setTopGroups(undefined)
    setThreshold(undefined)
    setHideZero(undefined)
    abc.load(undefined)
    setValuationAgreementId(undefined)
    groupingOrdering.loadOrdering(undefined)
    clearRun()
    setTemplateNotice(null)
  }

  async function saveTemplate(): Promise<TemplateMutationResult> {
    setTemplateNotice(null)
    if (configurationError) return { ok: false }
    const saved = await templateStorage.save(templateName, templateBody)
    if (saved.ok && saved.template) setActiveTemplate(structuredClone(saved.template))
    return saved
  }

  function loadTemplates() {
    setTemplateNotice(null)
    templateStorage.reload()
  }

  async function updateTemplate(): Promise<TemplateMutationResult> {
    setTemplateNotice(null)
    if (configurationError || !activeTemplate) return { ok: false }
    const saved = await templateStorage.update(activeTemplate, templateBody)
    if (saved.ok && saved.template) setActiveTemplate(structuredClone(saved.template))
    return saved
  }

  function renamedTemplate(saved: ReportTemplate, source: ReportTemplate) {
    if (!activeTemplate || activeTemplate.Id !== saved.Id || activeTemplate.Revision !== source.Revision) return
    if (templateName === activeTemplate.Name) setTemplateName(saved.Name)
    setActiveTemplate(structuredClone(saved))
  }

  function deletedTemplate(id: string) {
    if (activeTemplate?.Id === id) setActiveTemplate(null)
  }

  function applyTemplate(template: ReportTemplate): boolean {
    const nextDataset = datasetStorage.datasets.find(item => item.DataSource === (template.Data.dataSource ?? 0))
    const incompatible = datasetConfigurationError(template.Data, nextDataset)
    if (incompatible || !nextDataset) {
      setTemplateNotice(incompatible)
      return false
    }
    applyConfiguration(template, nextDataset)
    setActiveTemplate(structuredClone(template))
    return true
  }

  function applyConfiguration(template: ReportTemplate, nextDataset: ReportDataset) {
    setConstructorSection('structure')
    setCatalogueNotice(null)
    workspaceDraft.rememberBeforeReplace()
    setRestoredData(null)
    setDraftRestoreError(null)
    setActiveTemplate(null)
    const data = template.Data
    setFullCurrentVparivanie(currentVparivanieFullScope(data))
    setComparison(structuredClone(requestComparison(data)))
    setXyz(structuredClone(xyzOptions(requestXyz(data)) ?? requestXyz(data)))
    setRateComparison(structuredClone(rateComparisonOptions(requestRateComparison(data)) ?? requestRateComparison(data)))
    setPaymentComparison(clonePaymentComparisonValue(data))
    setMarginComparison(cloneMarginComparisonValue(data))
    setReturnComparison(structuredClone(returnComparisonOptions(requestReturnComparison(data)) ?? requestReturnComparison(data)))
    setBuyerSalesShare(structuredClone(buyerSalesShareOptions(requestBuyerSalesShare(data)) ?? requestBuyerSalesShare(data)))
    setRevenueComparison(structuredClone(revenueComparisonOptions(requestRevenueComparison(data)) ?? requestRevenueComparison(data)))
    setProductClassification(structuredClone(requestProductClassification(data)))
    setSourceOrganizations(structuredClone(requestSourceOrganizations(data)))
    setSourceBuyerSubtree(structuredClone(requestSourceBuyerSubtree(data)))
    setDayOrganizationBasis(structuredClone(requestDayOrganizationBasis(data)))
    setSupplierBasis(structuredClone(requestSupplierBasis(data)))
    setSupplierSourceWorld(structuredClone(requestSupplierSourceWorld(data)))
    setReturnsOnly(data.returnsOnly ?? data.ReturnsOnly)
    setPriceTypeSalesComparison(clonePriceTypeSalesComparisonValue(data))
    setAgreementPriceComparison(structuredClone(requestAgreementPriceComparison(data)))
    setSettlementPeriod(structuredClone(data.settlementPeriod))
    setGroupedSettlementPeriod(structuredClone(requestGroupedSettlementPeriod(data)))
    setSourceCounterpartyGroups(structuredClone(requestSourceCounterpartyGroups(data)))
    setCashPeriod(structuredClone(data.cashPeriod))
    setGroupedCashPeriod(structuredClone(requestGroupedCashPeriod(data)))
    setOneCSpecialSettings(structuredClone(requestOneCSpecialSettings(data, nextDataset.DataSource)))
    setOneCScope(structuredClone(data.oneC))
    groupingOrdering.loadOrdering(requestOrdering(data))
    const nextAgreementId = data.valuationClientAgreementId ?? undefined
    setValuationAgreementId(nextAgreementId)
    const groupingByType = new Map(datasetGroupings(nextDataset).map(item => [item.type, item]))
    if (periodSupported && !getPeriodError(from, to, maxDate, t)) setPreviousPeriod({ from, to })
    setDataSource(nextDataset.DataSource)
    setTemplateName(template.Name)
    setFrom(nextDataset.PeriodSupported === false ? '' : data.from || today)
    setTo(nextDataset.PeriodSupported === false ? '' : data.to || today)
    setRowGroups(data.sorted.Row.map(item => groupingByType.get(item.type)!))
    setColGroups(data.sorted.Col.map(item => groupingByType.get(item.type)!))
    filterLogic.load(data.selections, requestFilterExpression(data))
    setTopGroups(structuredClone(requestTopGroups(data)))
    setThreshold(structuredClone(requestThreshold(data)))
    setHideZero(structuredClone(requestHideZero(data)))
    abc.load(requestAbcClassification(data))
    setMeasurements(datasetMeasurements(nextDataset, data.sorted.Measurements))
    setTemplateNotice(null)
    clearRun()
  }

  function restoreWorkspace(snapshot: ReportWorkspaceSnapshot): boolean {
    if (!canGenerateReport || !datasetStorage.loaded) return false
    const nextDataset = datasetStorage.datasets.find(item => item.DataSource === (snapshot.data.dataSource ?? 0))
    const incompatible = reportWorkspaceDraftCompatibility(snapshot, nextDataset)
    if (incompatible || !nextDataset) {
      setDraftRestoreError(incompatible)
      return false
    }
    const data = structuredClone(snapshot.data)
    setFullCurrentVparivanie(currentVparivanieFullScope(data))
    setCatalogueNotice(null)
    setRestoredData(data)
    setActiveTemplate(structuredClone(snapshot.activeTemplate))
    setTemplateName(snapshot.name)
    setPreviousPeriod(structuredClone(snapshot.previousPeriod))
    setDataSource(nextDataset.DataSource)
    setFrom(data.from)
    setTo(data.to)
    setRowGroups(data.sorted.Row)
    setColGroups(data.sorted.Col)
    setMeasurements(structuredClone(snapshot.measurements))
    filterLogic.load(data.selections, requestFilterExpression(data))
    groupingOrdering.loadOrdering(requestOrdering(data))
    setComparison(structuredClone(requestComparison(data)))
    setXyz(structuredClone(requestXyz(data)))
    setRateComparison(structuredClone(requestRateComparison(data)))
    setPaymentComparison(clonePaymentComparisonValue(data))
    setMarginComparison(cloneMarginComparisonValue(data))
    setReturnComparison(structuredClone(requestReturnComparison(data)))
    setBuyerSalesShare(structuredClone(requestBuyerSalesShare(data)))
    setRevenueComparison(structuredClone(requestRevenueComparison(data)))
    setProductClassification(structuredClone(requestProductClassification(data)))
    setSourceOrganizations(structuredClone(requestSourceOrganizations(data)))
    setSourceBuyerSubtree(structuredClone(requestSourceBuyerSubtree(data)))
    setDayOrganizationBasis(structuredClone(requestDayOrganizationBasis(data)))
    setSupplierBasis(structuredClone(requestSupplierBasis(data)))
    setSupplierSourceWorld(structuredClone(requestSupplierSourceWorld(data)))
    setReturnsOnly(data.returnsOnly ?? data.ReturnsOnly)
    setPriceTypeSalesComparison(clonePriceTypeSalesComparisonValue(data))
    setAgreementPriceComparison(structuredClone(requestAgreementPriceComparison(data)))
    setSettlementPeriod(structuredClone(data.settlementPeriod))
    setGroupedSettlementPeriod(structuredClone(requestGroupedSettlementPeriod(data)))
    setSourceCounterpartyGroups(structuredClone(requestSourceCounterpartyGroups(data)))
    setCashPeriod(structuredClone(data.cashPeriod))
    setGroupedCashPeriod(structuredClone(requestGroupedCashPeriod(data)))
    setOneCSpecialSettings(structuredClone(requestOneCSpecialSettings(data, nextDataset.DataSource)))
    setOneCScope(structuredClone(data.oneC))
    setTopGroups(structuredClone(requestTopGroups(data)))
    setThreshold(structuredClone(requestThreshold(data)))
    setHideZero(structuredClone(requestHideZero(data)))
    abc.load(requestAbcClassification(data))
    setValuationAgreementId(data.valuationClientAgreementId ?? undefined)
    setTemplateNotice(null)
    setDraftRestoreError(null)
    clearRun()
    return true
  }

  function openCatalogueReport(choice: CatalogueLaunchChoice, catalogue: ReportCatalogue): boolean {
    if (!canGenerateReport || isLoading || !datasetStorage.loaded || datasetStorage.error) return false
    if (choice.dataSource === 1) {
      if (!isOneCTurnoverCatalogueChoice(catalogue, choice)) return false
      setCatalogueNotice(null)
      setOneCReportOpen(true)
      return true
    }
    const period = periodSupported ? { from, to } : previousPeriod
    const launch = resolveCatalogueLaunch(catalogue, choice, datasetStorage.datasets, period)
    if (!launch.ok) {
      setCatalogueNotice({ text: launch.message, failed: true })
      return false
    }
    applyConfiguration(launch.template, launch.dataset)
    setCatalogueNotice({ text: launch.notice, failed: false })
    return true
  }

  function openDebtToSalesRatio(capability: DebtToSalesRatioCapabilities): boolean {
    if (!canGenerateReport || isLoading || !isDebtToSalesRatioCapabilities(capability) || !capability.Executable) return false
    setDebtRatioCapability(structuredClone(capability))
    return true
  }

  function openActiveClients(capability: ActiveClientsCapabilities): boolean {
    if (!canGenerateReport || isLoading || !isActiveClientsCapabilities(capability) || !capability.Executable) return false
    setActiveClientsCapability(structuredClone(capability))
    return true
  }

  function openCurrencyRateDynamics(capability: CurrencyRateDynamicsCapabilities): boolean {
    if (!canGenerateReport || isLoading || !isCurrencyRateDynamicsCapabilities(capability) || !capability.Executable) return false
    setCurrencyDynamicsCapability(structuredClone(capability))
    return true
  }

  function openOriginalBuyerSalesShare(capability: OriginalBuyerSalesShareCapabilities): boolean {
    if (!canGenerateReport || isLoading || !isOriginalBuyerSalesShareCapabilities(capability) || !capability.Executable) return false
    setOriginalBuyerSalesShareCapability(structuredClone(capability))
    setOriginalBuyerSalesShareGenerating(false)
    return true
  }

  function openOriginalRevenue(capability: OriginalRevenueCapabilities): boolean {
    if (!canGenerateReport || isLoading || !isOriginalRevenueCapabilities(capability) || !capability.Executable) return false
    setOriginalRevenueCapability(structuredClone(capability))
    setOriginalRevenueGenerating(false)
    return true
  }
  function openCashAggregateBalance(capability: CashAggregateBalanceCapabilities): boolean {
    if (!canGenerateReport || isLoading || !isCashAggregateBalanceCapabilities(capability) || !capability.Executable) return false
    setCashAggregateCapability(structuredClone(capability))
    return true
  }

  function changeDataset(nextDataset: ReportDataset, workbook?: WorkbookLaunch) {
    const period = periodSupported ? { from, to } : previousPeriod
    const day = (nextDataset.DataSource === 40 || nextDataset.DataSource === 41) ? previousKyivDay(today) : null
    applyConfiguration({ Name: '', Data: bug1274WorkbookRequest(defaultDatasetRequest(nextDataset, day ?? period.from, day ?? period.to), workbook) }, nextDataset)
  }

  function applyPreset(id: DatasetReportPresetId) {
    if (!dataset) return
    const preset = datasetPresetRequest(dataset, id, templateBody)
    if (preset) groupingOrdering.applyPreset(preset, next => applyConfiguration(next, dataset))
  }

  const workbookLaunches = availableBug1274WorkbookLaunches(datasetStorage.datasets)

  if (canGenerateReport && ownerId && workspaceDraft.recovery !== 'none'
    && (workspaceDraft.recovery !== 'loading' || !datasetStorage.loaded)) {
    return <ReportDraftRecoveryPanel savedAt={workspaceDraft.savedAt}
      loading={!datasetStorage.loaded && !datasetStorage.error}
      error={draftRestoreError ?? datasetStorage.error ?? workspaceDraft.message}
      canRestore={workspaceDraft.recovery === 'pending' && datasetStorage.loaded && !datasetStorage.error}
      onRestore={() => workspaceDraft.restore(restoreWorkspace)}
      onDiscard={() => { if (workspaceDraft.discardRecovery()) setDraftRestoreError(null) }}
      onRetry={datasetStorage.retry} />
  }

  return (
    <Stack className={`reports-stocks-page${constructorMode ? ' report-constructor-page' : ' reports-stocks-workspace'}`} gap={6}>
      {constructorMode ? <ReportConstructorHeader name={templateName} /> : null}
      {canGenerateReport && ownerId ? <ReportDraftStatus savedAt={workspaceDraft.status === 'saved' ? workspaceDraft.savedAt : null}
        notice={draftRestoreError ?? workspaceDraft.message} canUndo={Boolean(workspaceDraft.previousSnapshot)}
        disabled={isLoading || !datasetStorage.loaded || Boolean(datasetStorage.error)}
        onUndo={() => workspaceDraft.undo(restoreWorkspace)} /> : null}
      <div className={!constructorMode ? 'stocks-workspace-header' : undefined}>
        {!constructorMode ? <div className="stocks-workspace-heading">
          <span className="stocks-workspace-heading__icon"><IconFileSpreadsheet size={24} aria-hidden="true" /></span>
          <div><Text component="h2">{t('Налаштування звіту')}</Text>
            <Text size="xs" c="dimmed">{t('Оберіть набір даних, налаштуйте структуру та сформуйте звіт.')}</Text></div>
        </div> : null}
      <Group justify="flex-end" gap={8}>
        {!constructorMode && canGenerateReport ? <Button component="a" href="/reports/registers" variant="default">{t('Звіти регістрів')}</Button> : null}
        <Button type="button" variant="filled" disabled={!canGenerateReport}
          aria-haspopup="dialog" aria-expanded={oneCReportOpen} onClick={() => setOneCReportOpen(true)}>
          {t('Валовий прибуток — як у 1С')}
        </Button>
      </Group>
      </div>
      {!constructorMode && canGenerateReport && datasetStorage.loaded && !datasetStorage.error && workbookLaunches.length > 0
        ? <details className="app-section-card">
          <summary>{t('Часткові форми за зразками Excel')}</summary>
          <Stack gap="xs" p="sm">{workbookLaunches.map(item =>
            <Group key={item.fileName} justify="space-between" align="start" wrap="wrap">
              <Text size="sm">{item.fileName} · {t(item.notice)}</Text>
              <Button type="button" size="xs" variant="light" disabled={isLoading}
                onClick={() => {
                  changeDataset(item.dataset, item)
                  setCatalogueNotice({ text: `${item.fileName}: ${item.notice}`, failed: false })
                }}>{t('Відкрити часткову форму: {name}', { name: item.label })}</Button>
            </Group>)}</Stack>
        </details> : null}
      <AppModal opened={oneCReportOpen} title={t('Валовий прибуток — як у 1С')} size={960}
        onClose={() => { if (!oneCReportGenerating) setOneCReportOpen(false) }}
        closeOnClickOutside={!oneCReportGenerating} closeOnEscape={!oneCReportGenerating}
        closeButtonProps={{ disabled: oneCReportGenerating, 'aria-label': t('Закрити звіт 1С') }}>
        {oneCReportOpen ? <OneCTurnoverReportPanel canGenerate={canGenerateReport} from={from} to={to}
          onFromChange={setFrom} onToChange={setTo} onLoadingChange={setOneCReportGenerating}
          onClose={() => setOneCReportOpen(false)} /> : null}
      </AppModal>
      <AppModal opened={canGenerateReport && debtRatioCapability !== null} title={debtRatioCapability?.Title ?? ''} size={960}
        onClose={() => { if (!debtRatioGenerating) setDebtRatioCapability(null) }}
        closeOnClickOutside={!debtRatioGenerating} closeOnEscape={!debtRatioGenerating}
        closeButtonProps={{ disabled: debtRatioGenerating, 'aria-label': t('Закрити оригінальний конструктор') }}>
        {canGenerateReport && debtRatioCapability ? <DebtToSalesRatioReportPanel capability={debtRatioCapability}
          initialMonth={(from || today).slice(0, 7)} canGenerate={canGenerateReport} onLoadingChange={setDebtRatioGenerating} /> : null}
      </AppModal>
      <AppModal opened={canGenerateReport && activeClientsCapability !== null} title={activeClientsCapability?.Title ?? ''} size={960}
        onClose={() => { if (!activeClientsGenerating) setActiveClientsCapability(null) }}
        closeOnClickOutside={!activeClientsGenerating} closeOnEscape={!activeClientsGenerating}
        closeButtonProps={{ disabled: activeClientsGenerating, 'aria-label': t('Закрити конструктор активних клієнтів') }}>
        {canGenerateReport && activeClientsCapability ? <ActiveClientsReportPanel capability={activeClientsCapability}
          initialMonth={(from || today).slice(0, 7)} canGenerate={canGenerateReport} callerKey={ownerId}
          onLoadingChange={setActiveClientsGenerating} /> : null}
      </AppModal>
      <CollectionCoefficientConstructorModal {...collectionConstructor.modalProps} />
      <SalesMarginConstructorModal {...salesMarginConstructor.modalProps} />
      <CashMovementConstructorModal {...cashMovementConstructor.modalProps} />
      <SupplierDebtConstructorModal {...supplierDebtConstructor.modalProps} />
      <EmployeeGrossProfitConstructorModal {...employeeGrossProfitConstructor.modalProps} />
      <OverdueReceivablesConstructorModal {...overdueReceivablesConstructor.modalProps} />
      <ManagementReturnsConstructorModal {...managementReturnsConstructor.modalProps} />
      <ManagementBalanceConstructorModal {...managementBalanceConstructor.modalProps} />
      <ManagementOrdersConstructorModal {...managementOrdersConstructor.modalProps} />
      <DefectProductionConstructorModal {...defectProductionConstructor.modalProps} />
      <InventoryTurnoverConstructorModal {...inventoryTurnoverConstructor.modalProps} />
      <CurrentLiquidityConstructorModal {...currentLiquidityConstructor.modalProps} />
      <PlannedCashConstructorModal {...plannedCashConstructor.modalProps} />
      <AppModal opened={canGenerateReport && currencyDynamicsCapability !== null} title={currencyDynamicsCapability?.Title ?? ''} size={960}
        onClose={() => { if (!currencyDynamicsGenerating) setCurrencyDynamicsCapability(null) }}
        closeOnClickOutside={!currencyDynamicsGenerating} closeOnEscape={!currencyDynamicsGenerating}
        closeButtonProps={{ disabled: currencyDynamicsGenerating, 'aria-label': t('Закрити конструктор динаміки курсу') }}>
        {canGenerateReport && currencyDynamicsCapability ? <CurrencyRateDynamicsReportPanel capability={currencyDynamicsCapability}
          initialMonth={defaultCurrencyRateDynamicsMonth(today)} canGenerate={canGenerateReport} callerKey={ownerId}
          onLoadingChange={setCurrencyDynamicsGenerating} /> : null}
      </AppModal>
      <AppModal opened={canGenerateReport && originalBuyerSalesShareCapability !== null} title={originalBuyerSalesShareCapability?.Title ?? ''} size={960}
        onClose={() => { if (!originalBuyerSalesShareGenerating) setOriginalBuyerSalesShareCapability(null) }}
        closeOnClickOutside={!originalBuyerSalesShareGenerating} closeOnEscape={!originalBuyerSalesShareGenerating}
        closeButtonProps={{ disabled: originalBuyerSalesShareGenerating, 'aria-label': t('Закрити конструктор частки продажів') }}>
        {canGenerateReport && originalBuyerSalesShareCapability ? <OriginalBuyerSalesShareReportPanel capability={originalBuyerSalesShareCapability}
          initialMonth={defaultCurrencyRateDynamicsMonth(today)} canGenerate={canGenerateReport} callerKey={ownerId}
          onLoadingChange={setOriginalBuyerSalesShareGenerating} /> : null}
      </AppModal>
      <AppModal opened={canGenerateReport && originalRevenueCapability !== null} title={originalRevenueCapability?.Title ?? ''} size={1100}
        onClose={() => { if (!originalRevenueGenerating) setOriginalRevenueCapability(null) }}
        closeOnClickOutside={!originalRevenueGenerating} closeOnEscape={!originalRevenueGenerating}
        closeButtonProps={{ disabled: originalRevenueGenerating, 'aria-label': t('Закрити конструктор виручки') }}>
        {canGenerateReport && originalRevenueCapability ? <OriginalRevenueReportPanel capability={originalRevenueCapability}
          initialMonth={defaultCurrencyRateDynamicsMonth(today)} canGenerate={canGenerateReport} callerKey={ownerId}
          onLoadingChange={setOriginalRevenueGenerating} /> : null}
      </AppModal>
      <AppModal opened={canGenerateReport && cashAggregateCapability !== null} title={cashAggregateCapability?.Title ?? ''} size={1100}
        onClose={() => { if (!cashAggregateGenerating) setCashAggregateCapability(null) }}
        closeOnClickOutside={!cashAggregateGenerating} closeOnEscape={!cashAggregateGenerating}
        closeButtonProps={{ disabled: cashAggregateGenerating, 'aria-label': t('Закрити конструктор залишків коштів') }}>
        {canGenerateReport && cashAggregateCapability ? <CashAggregateBalanceReportPanel capability={cashAggregateCapability}
          initialPeriod={previousKyivDay(today)} canGenerate={canGenerateReport} callerKey={ownerId}
          onLoadingChange={setCashAggregateGenerating} /> : null}
      </AppModal>
      {!constructorMode && canGenerateReport && templateName.trim() ? <Text fw={600} aria-label={t('Назва поточного звіту')}>{templateName}</Text> : null}
      {canGenerateReport && catalogueNotice ? <Alert color={catalogueNotice.failed ? 'red' : 'blue'} style={{ flexShrink: 0 }}
        title={t(catalogueNotice.failed ? 'Не вдалося відкрити звіт' : 'Звіт відкрито в конструкторі')}
        withCloseButton onClose={() => setCatalogueNotice(null)}>{catalogueNotice.text}</Alert> : null}
      {!constructorMode ? <>{dataSource === 31 ? <AgreementPriceComparisonPanel value={agreementPriceComparison ?? defaultAgreementPriceComparison()} disabled={comparisonSettingsDisabled} onChange={setAgreementPriceComparison} />
        : requiresValuationAgreement(dataSource) ? <ValuationAgreementPicker purpose={dataSource === 22 ? 'prices' : 'stock'} value={valuationClientAgreementId} enabled={canGenerateReport} disabled={isLoading}
        agreement={valuation.agreement} validating={valuation.loading} validationError={valuation.error}
        onChange={setValuationAgreementId} onRetry={valuation.retry} /> : dataSource === 29
          ? <CurrentDiscountAgreementInput value={valuationClientAgreementId} enabled={canGenerateReport} disabled={isLoading} onChange={setValuationAgreementId} />
          : null}</> : null}
      <ReportBuilderForm
        constructorMode={constructorMode}
        constructorSection={constructorSection}
        onConstructorSectionChange={navigateConstructorSection}
        analysisCount={[topGroups, threshold, hideZero, abcClassification, ordering].filter(value => value != null).length}
        datasetPanel={<ReportDatasetPicker compact datasets={datasetStorage.datasets} selected={dataSource}
          disabled={!canGenerateReport || isLoading} loaded={datasetStorage.loaded} error={datasetStorage.error}
          onChange={changeDataset} onRetry={datasetStorage.retry} />}
        catalogueControl={<ReportCatalogueControl presentation="dialog" enabled={canGenerateReport}
          disabled={isLoading} onOpen={openCatalogueReport}
          onOpenDebtToSalesRatio={openDebtToSalesRatio} onOpenCollectionCoefficient={collectionConstructor.open} onOpenSalesMargin={salesMarginConstructor.open} onOpenCashMovement={cashMovementConstructor.open} onOpenSupplierDebt={supplierDebtConstructor.open} onOpenEmployeeGrossProfit={employeeGrossProfitConstructor.open} onOpenOverdueReceivables={overdueReceivablesConstructor.open} onOpenManagementReturns={managementReturnsConstructor.open} onOpenManagementBalance={managementBalanceConstructor.open} onOpenManagementOrders={managementOrdersConstructor.open} onOpenDefectProduction={defectProductionConstructor.open} onOpenInventoryTurnover={inventoryTurnoverConstructor.open} onOpenCurrentLiquidity={currentLiquidityConstructor.open} onOpenPlannedCash={plannedCashConstructor.open} callerKey={ownerId} onOpenActiveClients={openActiveClients}
          onOpenCurrencyRateDynamics={openCurrencyRateDynamics} onOpenCashAggregateBalance={openCashAggregateBalance} onOpenOriginalRevenue={openOriginalRevenue} onOpenOriginalBuyerSalesShare={openOriginalBuyerSalesShare} />}
        datasetSummary={<><ReportDatasetSummary dataset={dataset} />
          {!constructorMode ? <details className="stocks-workspace-dataset-help"><summary>{t('Що змінює вибір набору даних')}</summary>
            <Text size="xs" c="dimmed">{t('Зміна набору застосує початкові групування й показники та очистить відбори, групи І/АБО, TOP, ABC-класифікацію і правила сортування. Набори поточного стану очищують період; після повернення до набору з періодом попередні дати відновляться.')}</Text>
          </details> : null}</>}
        agreementPanel={constructorMode && (requiresValuationAgreement(dataSource) || dataSource === 29 || dataSource === 31) ? <div className="app-section-card report-constructor-agreement">
          {dataSource === 31 ? <AgreementPriceComparisonPanel value={agreementPriceComparison ?? defaultAgreementPriceComparison()} disabled={comparisonSettingsDisabled} onChange={setAgreementPriceComparison} />
            : dataSource === 29 ? <CurrentDiscountAgreementInput value={valuationClientAgreementId} enabled={canGenerateReport} disabled={isLoading} onChange={setValuationAgreementId} />
            : <ValuationAgreementPicker purpose={dataSource === 22 ? 'prices' : 'stock'} value={valuationClientAgreementId}
            enabled={canGenerateReport} disabled={isLoading} agreement={valuation.agreement} validating={valuation.loading}
            validationError={valuation.error} onChange={setValuationAgreementId} onRetry={valuation.retry} />}
        </div> : null}
        priceTypeSalesComparisonPanel={<PriceTypeSalesComparisonPanel dataSource={dataSource} value={priceTypeSalesComparison}
          scope={oneCScope} capability={dataset?.priceTypeSalesComparison} disabled={comparisonSettingsDisabled} onChange={setPriceTypeSalesComparison} onScopeChange={setOneCScope} />}
        oneCSpecialReportPanel={<OneCSpecialReportPanel dataSource={dataSource} dataset={dataset} value={oneCSpecialSettings ??
          (oneCSpecialSpecification(dataSource) ? defaultOneCSpecialSettings(dataSource, dataset)[oneCSpecialSpecification(dataSource)!.key] : undefined)}
          disabled={comparisonSettingsDisabled} onChange={setOneCSpecialSettings} />}
        classificationPanel={dataSource === 39 ? <CurrentVparivanieRegionalPanel dataset={dataset ?? null} request={reportBody}
          enabled={canGenerateReport} disabled={comparisonSettingsDisabled}
          fullScope={fullCurrentVparivanie} onFullScopeChange={setFullCurrentVparivanie} /> : dataSource === 41 || dataSource === 40 ? <CashSettlementSettingsPanels dataSource={dataSource}
          cash={{ dataset, grouped: groupedCashPeriod, exact: cashPeriod, rows: rowGroups,
            available: groupingOptions, onRowsChange: setRowGroups, disabled: comparisonSettingsDisabled, enabled: canGenerateReport }}
          settlement={{ dataset, grouped: groupedSettlementPeriod, exact: settlementPeriod,
            buyer: sourceBuyerSubtree, groups: sourceCounterpartyGroups, rows: rowGroups,
            available: groupingOptions, from, to, disabled: comparisonSettingsDisabled, enabled: canGenerateReport,
            onModeChange: changeSettlementMode, onGroupedChange: setGroupedSettlementPeriod,
            onExactChange: setSettlementPeriod, onBuyerChange: setSourceBuyerSubtree,
            onRowsChange: setRowGroups, onGroupsChange: setSourceCounterpartyGroups }}
          onGroupedCashChange={setGroupedCashPeriod} onExactCashChange={setCashPeriod}
          onCashMeasurementsChange={setMeasurements} onClearCashFilters={() => filterLogic.load([])} /> : dataSource === 35 ? <Card className="app-section-card" withBorder radius="md" padding="md" style={{ minWidth: 0 }}>
          <DayOrganizationBasisSelect capability={dataset?.dayOrganizationBasis} value={dayOrganizationBasis}
            disabled={comparisonSettingsDisabled} onChange={setDayOrganizationBasis} />
          <Checkbox mt="sm" label={t('Товар без послуг (Fenix)')}
            checked={parseProductClassification(productClassification)?.ProductKindId.toUpperCase() === DAY_ORGANIZATION_GOODS_KIND_ID
              && parseProductClassification(productClassification)?.IsService === false}
            disabled={comparisonSettingsDisabled}
            onChange={event => setProductClassification(event.currentTarget.checked
              ? { Version: 1, SourceWorld: 0, ProductKindId: DAY_ORGANIZATION_GOODS_KIND_ID, IsService: false }
              : undefined)} />
          <Text size="xs" c="dimmed">{t('Точний відбір зі збереженого налаштування 1С, що структурно збігається з XLS. Якщо для товару немає повної локальної класифікації, звіт покаже помилку покриття.')}</Text>
          {productClassification != null
            && !(parseProductClassification(productClassification)?.ProductKindId.toUpperCase() === DAY_ORGANIZATION_GOODS_KIND_ID
              && parseProductClassification(productClassification)?.IsService === false)
            ? <Text size="xs" c="orange">{t('Шаблон містить інший вид товару Fenix. Увімкнення перемикача замінить цей відбір на «Товар».')}</Text> : null}
          <Checkbox mt="sm" label={t('П’ять організацій зі збереженого налаштування 1С')}
            checked={usesSavedFenixOrganizations(sourceOrganizations)}
            disabled={comparisonSettingsDisabled}
            onChange={event => setSourceOrganizations(event.currentTarget.checked
              ? { Version: 1, SourceWorld: 'fenix', OrganizationIds: [...DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS] }
              : undefined)} />
          <Text size="xs" c="dimmed">{t('Точні ID зі збереженого налаштування 1С. Якщо організації ще не прив’язані до локальних даних, звіт покаже помилку покриття.')}</Text>
          {sourceOrganizations != null
            && !usesSavedFenixOrganizations(sourceOrganizations)
            ? <Text size="xs" c="orange">{t('Шаблон містить інші організації Fenix. Увімкнення перемикача замінить цей відбір на п’ять організацій.')}</Text> : null}
          <Checkbox mt="sm" label={t('Група «Покупці» Fenix')}
            checked={parseSourceBuyerSubtree(sourceBuyerSubtree) != null}
            disabled={comparisonSettingsDisabled}
            onChange={event => setSourceBuyerSubtree(event.currentTarget.checked
              ? { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID }
              : undefined)} />
          <Text size="xs" c="dimmed">{t('Поточний збережений знімок ієрархії покупців. Якщо лінія покупця або ієрархія неповні, звіт покаже помилку покриття.')}</Text>
          {sourceBuyerSubtree != null && !parseSourceBuyerSubtree(sourceBuyerSubtree)
            ? <Text size="xs" c="orange">{t('Шаблон містить інше піддерево Fenix; цей набір приймає тільки групу «Покупці».')}</Text> : null}
        </Card> : dataSource === 38 && isSupplierSourceWorldCapability(dataset?.supplierSourceWorld)
          ? <Card className="app-section-card" withBorder radius="md" padding="md" style={{ minWidth: 0 }}>
            <SupplierBasisSelect capability={dataset?.supplierBasis} value={supplierBasis}
              disabled={comparisonSettingsDisabled} onChange={basis => {
                setSupplierBasis(basis)
                setRowGroups(rows => rowGroupsForSupplierBasis(basis, rows, groupingOptions))
              }} />
            <Select label={t('База продажів для прибутку за постачальниками')}
              data={[{ value: '0', label: 'Fenix' }, { value: '1', label: 'AMG' },
                { value: 'all', label: t('Обидві бази') }]}
              value={supplierSourceWorld === 0 ? '0' : supplierSourceWorld === 1 ? '1' : 'all'}
              disabled={comparisonSettingsDisabled}
              onChange={value => {
                const world = value === '0' ? 0 : value === '1' ? 1 : undefined
                setSupplierSourceWorld(world)
                if (world !== 0) setSourceBuyerSubtree(undefined)
              }} />
            <Text size="xs" c="dimmed">{t(supplierBasis === 0
              ? 'Для продажів потрібні повні дані партій вибраної бази.'
              : 'Окремий зріз формується лише за однозначної лінії кожного продажу в періоді. Неповна партія вибраної бази зупинить звіт.')}</Text>
            {dataset?.sourceBuyerSubtree != null ? <>
              <Checkbox mt="sm" label={t('Група «Покупці» Fenix')}
                checked={parseSourceBuyerSubtree(sourceBuyerSubtree) != null}
                disabled={comparisonSettingsDisabled}
                onChange={event => {
                  if (event.currentTarget.checked) setSupplierSourceWorld(0)
                  setSourceBuyerSubtree(event.currentTarget.checked
                    ? { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID }
                    : undefined)
                }} />
              <Text size="xs" c="dimmed">{t(supplierBasis === 0
                ? 'Покупці визначаються за поточним деревом. Повернення з невідомою належністю залишаються у звіті.'
                : 'Вимагає базу Fenix, повну лінію покупців усіх продажів періоду і чинний захоплений граф. За неповних даних звіт покаже помилку покриття.')}</Text>
              {sourceBuyerSubtree != null && !parseSourceBuyerSubtree(sourceBuyerSubtree)
                ? <Text size="xs" c="orange">{t('Шаблон містить інше піддерево Fenix; цей набір приймає тільки групу «Покупці».')}</Text> : null}
            </> : null}
            {supplierSourceWorld !== undefined && supplierSourceWorld !== 0 && supplierSourceWorld !== 1
              ? <Text size="xs" c="orange">{t('Шаблон містить невідому базу джерела; виберіть Fenix або AMG.')}</Text> : null}
          </Card> : null}
        dataSource={dataSource}
        rateComparisonPanel={<RateComparisonPanel dataSource={dataSource} value={rateComparison} disabled={comparisonSettingsDisabled} onChange={setRateComparison} />}
        paymentComparisonPanel={<PaymentComparisonPanel dataSource={dataSource} value={paymentComparison} disabled={comparisonSettingsDisabled} onChange={setPaymentComparison} />}
        marginComparisonPanel={<MarginComparisonPanel dataSource={dataSource} value={marginComparison} disabled={comparisonSettingsDisabled} onChange={setMarginComparison} />}
        returnComparisonPanel={<ReturnComparisonPanel dataSource={dataSource} value={returnComparison} disabled={comparisonSettingsDisabled} onChange={setReturnComparison} />}
        buyerSalesSharePanel={dataSource === 17 ? <BuyerSalesSharePanel value={buyerSalesShare} disabled={comparisonSettingsDisabled} onChange={setBuyerSalesShare} /> : null}
        revenueComparisonPanel={dataSource === 16 ? <RevenueComparisonPanel value={revenueComparison} disabled={comparisonSettingsDisabled} onChange={setRevenueComparison} /> : null}
        xyzPanel={dataSource === 15 ? <SalesXyzPanel value={xyz} disabled={comparisonSettingsDisabled} onChange={setXyz} /> : null}
        comparisonPanel={dataSource === 13 ? <ClientComparisonPeriodPanel value={comparison} disabled={comparisonSettingsDisabled} onChange={setComparison} /> : null}
        periodSupported={periodSupported}
        presets={presets}
        configurationReady={!configurationError}
        onApplyPreset={applyPreset}
        canSubmit={canSubmit}
        colGroups={colGroups}
        filterFieldOptions={filterFieldOptions}
        from={from}
        groupingOptions={groupingOptions}
        groupingSelectData={groupingSelectData}
        incompleteSelectionMessage={incompleteSelectionMessage}
        isLoading={isLoading}
        lastRun={lastRun}
        lookupFrom={hasLookupPeriod ? debouncedFrom : ''}
        lookupTo={hasLookupPeriod ? debouncedTo : ''}
        lookupProvidedDiscountBasis={currentProvidedDiscountLookupBasis(dataSource, oneCSpecialSettings, dataset)}
        lookupSalesBasis={currentPriceTypeSalesLookupBasis(dataSource, priceTypeSalesComparison, dataset?.priceTypeSalesComparison)}
        lookupSourceWorld={reportLookupSourceWorld(dataSource, groupedSettlementPeriod, oneCSpecialSettings)}
        maxDate={maxDate}
        measurements={measurements}
        notices={{ emptyRun: emptyRunNotice, error, period: periodError }}
        resultHasFiles={Boolean(result?.document.DocumentURL || result?.document.PdfDocumentURL)}
        preview={preview}
        resultPlaceholder={resultPlaceholder}
        rowGroups={rowGroups}
        selections={selections}
        submitBlockedReason={submitBlockedReason}
        templateName={templateName}
        templateNotice={templateNotice ?? templateStorage.notice}
        templateStorage={templateStorage}
        templateDatasets={datasetStorage.datasets}
        templateCallerKey={ownerId}
        activeTemplate={activeTemplate}
        templatesDisabled={!canGenerateReport || isLoading}
        onRenamedTemplate={renamedTemplate}
        onClearTemplateNotice={() => setTemplateNotice(null)}
        to={to}
        onApplyTemplate={applyTemplate}
        onDeleteTemplate={deletedTemplate}
        onFromChange={setFrom}
        onMeasurementsChange={setMeasurements}
        onOpenFiles={() => updateRun({ downloadModalOpened: true })}
        onPreview={() => void runReport(true)}
        onRefreshTemplates={loadTemplates}
        onReset={resetReport}
        onRowGroupsChange={value => groupingOrdering.changeAxis('Row', value)}
        onColGroupsChange={value => groupingOrdering.changeAxis('Col', value)}
        onGroupingLayoutChange={groupingOrdering.changeLayout}
        abcPanel={<ReportAbcClassificationPanel data={templateBody} dataset={dataset} disabled={comparisonSettingsDisabled} notice={abc.notice} onChange={abc.change}
          onConfigureGrouping={constructorMode ? () => navigateConstructorSection('structure') : undefined}
          onConfigureMeasures={constructorMode ? () => navigateConstructorSection('structure') : undefined} />}
        hideZeroPanel={<ReportHideZeroPanel data={templateBody} dataset={dataset} disabled={comparisonSettingsDisabled} onChange={setHideZero} />}
        thresholdPanel={<ReportThresholdPanel data={templateBody} dataset={dataset} disabled={comparisonSettingsDisabled} onChange={setThreshold} />}
        topGroupsPanel={<ReportTopGroupsPanel data={templateBody} dataset={dataset} disabled={comparisonSettingsDisabled} onChange={setTopGroups}
          onConfigureGrouping={constructorMode ? () => navigateConstructorSection('structure') : undefined}
          onConfigureMeasures={constructorMode ? () => navigateConstructorSection('structure') : undefined} />}
        filterExpressionPanel={<ReportFilterExpressionPanel data={templateBody} dataset={settlementDataset} disabled={comparisonSettingsDisabled}
          notice={filterLogic.notice} onChange={filterLogic.change} />}
        orderingPanel={<ReportOrderingPanel data={templateBody} dataset={dataset} disabled={comparisonSettingsDisabled}
          notice={groupingOrdering.notice} onChange={groupingOrdering.changeOrdering} />}
        onSaveTemplate={saveTemplate}
        onSelectionsChange={filterLogic.editSelection}
        onSubmit={submitReport}
        onTemplateNameChange={setTemplateName}
        onToChange={setTo}
        onUpdateTemplate={updateTemplate}
      />

      <DocumentExportModal
        document={result?.document}
        notice={
          lastRun ? (
            <Text c="gray.9" size="xs">
              {describeReportRun(lastRun, t)}
            </Text>
          ) : null
        }
        opened={downloadModalOpened}
        title={lastRun?.name || dataset?.Name || t('Звіт')}
        onClose={() => updateRun({ downloadModalOpened: false })}
      />
    </Stack>
  )
}

type ReportBuilderFormProps = {
  constructorMode: boolean
  constructorSection: ReportConstructorSection
  onConstructorSectionChange: (section: ReportConstructorSection) => void
  analysisCount: number
  datasetPanel: ReactNode
  datasetSummary: ReactNode
  catalogueControl: ReactNode
  agreementPanel: ReactNode
  priceTypeSalesComparisonPanel: ReactNode
  oneCSpecialReportPanel: ReactNode
  classificationPanel: ReactNode
  rateComparisonPanel: ReactNode
  paymentComparisonPanel: ReactNode
  marginComparisonPanel: ReactNode
  returnComparisonPanel: ReactNode
  buyerSalesSharePanel: ReactNode
  revenueComparisonPanel: ReactNode
  xyzPanel: ReactNode
  comparisonPanel: ReactNode
  abcPanel: ReactNode
  hideZeroPanel: ReactNode
  thresholdPanel: ReactNode
  topGroupsPanel: ReactNode
  filterExpressionPanel: ReactNode
  orderingPanel: ReactNode
  onGroupingLayoutChange: (layout: ReportGroupingLayout) => void
  dataSource: number
  periodSupported: boolean
  presets: ReturnType<typeof datasetPresets>
  configurationReady: boolean
  templateStorage: ReturnType<typeof useServerReportTemplates>
  templateDatasets: readonly ReportDataset[]
  templateCallerKey: string | null
  onApplyPreset: (id: DatasetReportPresetId) => void
  canSubmit: boolean
  colGroups: ReportGroupingItem[]
  filterFieldOptions: FilterFieldOption[]
  from: string
  groupingOptions: ReportGroupingItem[]
  groupingSelectData: GroupingOption[]
  incompleteSelectionMessage: string
  isLoading: boolean
  lastRun: ReportRunOutcome | null
  lookupFrom: string
  lookupTo: string
  lookupSourceWorld?: number
  lookupProvidedDiscountBasis?: 0
  lookupSalesBasis?: 0
  maxDate: string
  measurements: ReportMeasurementGroup[]
  notices: { emptyRun: string | null; error: string | null; period: string | null }
  resultHasFiles: boolean
  preview: NativeReportPreview | null
  resultPlaceholder: { description: string; title: string }
  rowGroups: ReportGroupingItem[]
  selections: ReportSelection[]
  submitBlockedReason: string
  templateName: string
  templateNotice: string | null
  activeTemplate: ReportTemplate | null
  templatesDisabled: boolean
  onRenamedTemplate: (template: ReportTemplate, source: ReportTemplate) => void
  onClearTemplateNotice: () => void
  to: string
  onApplyTemplate: (template: ReportTemplate) => boolean
  onColGroupsChange: StateSetter<ReportGroupingItem[]>
  onDeleteTemplate: (name: string) => void
  onFromChange: StateSetter<string>
  onMeasurementsChange: StateSetter<ReportMeasurementGroup[]>
  onOpenFiles: () => void
  onPreview: () => void
  onRefreshTemplates: () => void
  onReset: () => void
  onRowGroupsChange: StateSetter<ReportGroupingItem[]>
  onSaveTemplate: () => Promise<TemplateMutationResult>
  onSelectionsChange: (edit: ReportSelectionEdit) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onTemplateNameChange: StateSetter<string>
  onToChange: StateSetter<string>
  onUpdateTemplate: () => Promise<TemplateMutationResult>
}

function CurrentDiscountAgreementInput({ value, enabled, disabled, onChange }: {
  value: number | undefined
  enabled: boolean
  disabled: boolean
  onChange: (value: number | undefined) => void
}) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [query] = useDebouncedValue(search, 300)
  const [options, setOptions] = useState<ReportEntity[]>([])
  const [selected, setSelected] = useState<ReportEntity | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    searchDatasetReportValues(29, REPORT_FILTER_FIELD_TYPES.customerContract,
      { value: query, offset: 0, limit: 25 }, controller.signal)
      .then(items => { setOptions(items); setError(null) })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Не вдалося завантажити договори.') })
    return () => controller.abort()
  }, [enabled, query])
  const data = useMemo(() => {
    const choices = new Map(options.map(item => [String(item.Id), { value: String(item.Id), label: item.Name ?? String(item.Id) }]))
    if (value !== undefined && !choices.has(String(value))) choices.set(String(value), {
      value: String(value), label: selected?.Id === value ? selected.Name ?? `Договір [${value}]` : `Договір [${value}]`,
    })
    return [...choices.values()]
  }, [options, selected, value])
  return <Stack gap={4} p="sm">
    <Select label={t('Договір клієнта для чинних знижок')}
      description={t('Пошук за назвою або локальним ID договору з чинними ставками.')}
      searchable clearable data={data} value={value?.toString() ?? null} searchValue={search}
      onSearchChange={setSearch} filter={({ options: items }) => items} maxLength={120}
      disabled={!enabled || disabled} nothingFoundMessage={t('Договір не знайдено')}
      onChange={next => {
        setSelected(options.find(item => String(item.Id) === next) ?? null)
        setSearch('')
        onChange(next === null ? undefined : Number(next))
      }} />
    {error ? <Text size="xs" c="red">{t(error)}</Text> : null}
  </Stack>
}

function ReportBuilderForm(props: ReportBuilderFormProps) {
  const {
    constructorMode,
    datasetPanel,
    catalogueControl,
    comparisonPanel,
    dataSource,
    periodSupported,
    presets,
    configurationReady,
    onApplyPreset,
    canSubmit,
    from,
    isLoading,
    maxDate,
    submitBlockedReason,
    templateName,
    templateNotice,
    activeTemplate,
    templatesDisabled,
    onRenamedTemplate,
    onClearTemplateNotice,
    templateStorage,
    to,
    onApplyTemplate,
    onDeleteTemplate,
    onFromChange,
    onRefreshTemplates,
    onReset,
    onSaveTemplate,
    onSubmit,
    onPreview,
    onTemplateNameChange,
    onToChange,
    onUpdateTemplate,
  } = props
  const { t } = useI18n()
  const [templatesOpened, setTemplatesOpened] = useValueState(false)

  return (
    <Card className="reports-stocks-shell" radius="md" padding={0}>
      <form className="reports-stocks-form" onSubmit={onSubmit}>
        <div className="reports-stocks-filter-scroll">
        <div className="app-filter-bar reports-stocks-filter-bar">
          <div className="reports-stocks-toolbar-fields">
          {datasetPanel}
          <ReportPeriodInputs dataSource={dataSource} supported={periodSupported} from={from} to={to} maxDate={maxDate} disabled={constructorMode && isLoading} onFromChange={onFromChange} onToChange={onToChange} />
          {!constructorMode ? comparisonPanel : null}
          <div className="app-filter-actions reports-stocks-actions">
            {catalogueControl}
            <Button color="brand" variant="filled" size="sm" className="app-filter-primary-action"
              disabled={templatesDisabled}
              leftSection={<LayoutTemplate size={16} />}
              type="button"
              onClick={() => setTemplatesOpened(true)}
            >
              {t('Шаблони')}
            </Button>
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} disabled={templatesDisabled} variant="default" size={34} type="button" onClick={onReset}>
                <RotateCcw size={17} />
              </ActionIcon>
            </Tooltip>
          </div>
          </div>
          <Button type="button" variant="default" disabled={!canSubmit || isLoading}
            onClick={onPreview}>{t('Показати на екрані')}</Button>
          <Tooltip label={t('Сформувати')}>
            <Button
              className="reports-stocks-generate"
              color={CREATE_ACTION_COLOR}
              leftSection={<IconFileSpreadsheet size={16} />}
              loading={isLoading}
              disabled={!canSubmit}
              title={submitBlockedReason}
              aria-describedby={constructorMode && !canSubmit ? 'report-constructor-blocked-reason' : undefined}
              type="submit"
            >
              {t('Сформувати')}
            </Button>
          </Tooltip>
        </div>
        </div>
        {constructorMode && !canSubmit ? <Text id="report-constructor-blocked-reason" className="report-constructor-blocked-reason" size="xs" c="gray.7">{submitBlockedReason}</Text> : null}
        {!constructorMode && presets.length ? <ReportQuickPresets disabled={isLoading || !configurationReady} presets={presets} onApply={onApplyPreset} /> : null}

        <ReportBuilderContent {...props} />

        <AppModal
          centered
          classNames={{ body: 'reports-stocks-template-modal__body', title: 'reports-stocks-modal-title' }}
          opened={templatesOpened}
          closeOnClickOutside={!templateStorage.busy}
          closeOnEscape={!templateStorage.busy}
          closeButtonProps={{ disabled: templateStorage.busy }}
          size="lg"
          title={t('Шаблони звіту')}
          onClose={() => setTemplatesOpened(false)}
        >
          <ReportTemplatesPanel
            ordering={props.templateStorage.ordering}
            storage={templateStorage}
            datasets={props.templateDatasets}
            callerKey={props.templateCallerKey}
            configurationReady={configurationReady}
            notice={templateNotice}
            templateName={templateName}
            activeTemplate={activeTemplate}
            disabled={templatesDisabled}
            onRenamed={onRenamedTemplate}
            onClearNotice={onClearTemplateNotice}
            onApply={(template) => {
              if (onApplyTemplate(template)) setTemplatesOpened(false)
            }}
            onDeleted={onDeleteTemplate}
            onNameChange={onTemplateNameChange}
            onRefresh={onRefreshTemplates}
            onSave={onSaveTemplate}
            onUpdate={onUpdateTemplate}
          />
        </AppModal>
      </form>
    </Card>
  )
}

function ReportBuilderContent(props: ReportBuilderFormProps) {
  const {
    constructorMode,
    constructorSection,
    onConstructorSectionChange,
    analysisCount,
    datasetSummary,
    abcPanel,
    topGroupsPanel,
    hideZeroPanel,
    thresholdPanel,
    filterExpressionPanel,
    orderingPanel,
    onGroupingLayoutChange,
    dataSource,
    canSubmit,
    colGroups,
    filterFieldOptions,
    groupingOptions,
    groupingSelectData,
    isLoading,
    lastRun,
    lookupFrom,
    lookupTo,
    measurements,
    resultHasFiles,
    preview,
    resultPlaceholder,
    rowGroups,
    selections,
    submitBlockedReason,
    templatesDisabled,
    onColGroupsChange,
    onMeasurementsChange,
    onOpenFiles,
    onRowGroupsChange,
    onSelectionsChange,
  } = props
  return (
        <div className={constructorMode ? 'report-constructor-workspace' : undefined}>
          {constructorMode ? <ReportConstructorNavigation active={constructorSection} onChange={onConstructorSectionChange}
            measures={flattenCheckedMeasurements(measurements).length} rows={rowGroups.length}
            filters={selections.filter(selection => selection.IsChecked).length} analysis={analysisCount}
            ready={canSubmit} reason={submitBlockedReason} loading={isLoading} hasResult={Boolean(lastRun)} /> : null}
        <div className="reports-stocks-body">
          {datasetSummary}
          <ReportSourceSettings {...props} />
          <ReportBuilderNotices {...props} />
          <fieldset className="report-constructor-fields" disabled={constructorMode && templatesDisabled}>
          <LegacyReportBuilder
            constructorSection={constructorMode ? constructorSection : undefined}
            filterExpressionPanel={filterExpressionPanel}
            onGroupingLayoutChange={onGroupingLayoutChange}
            dataSource={dataSource}
            colGroups={colGroups}
            filterFieldOptions={filterFieldOptions}
            groupingOptions={groupingOptions}
            groupingSelectData={groupingSelectData}
            lookupFrom={lookupFrom}
            lookupTo={lookupTo}
            lookupSourceWorld={props.lookupSourceWorld} lookupSalesBasis={props.lookupSalesBasis} lookupProvidedDiscountBasis={props.lookupProvidedDiscountBasis}
            measurements={measurements}
            rowGroups={rowGroups}
            selections={selections}
            onColGroupsChange={onColGroupsChange}
            onMeasurementsChange={onMeasurementsChange}
            onRowGroupsChange={onRowGroupsChange}
            onSelectionsChange={onSelectionsChange}
          />
          {!constructorMode && dataSource !== 19 ? filterExpressionPanel : null}
          <ReportSectionPanel className={constructorMode ? 'report-constructor-analysis' : 'stocks-workspace-analysis'} active={constructorMode ? constructorSection : undefined} section="analysis">
          {!hasFixedReportAxes(dataSource) ? <>
            {topGroupsPanel}
            {thresholdPanel}
            {hideZeroPanel}
            {abcPanel}
            {orderingPanel}
          </> : dataSource === 26 ? abcPanel
            : constructorMode ? <Text size="sm" c="gray.7">Цей набір має фіксовану структуру аналізу. Налаштуйте його параметри в розділі «Структура звіту».</Text> : null}
          </ReportSectionPanel>
          </fieldset>
          <ReportSectionPanel active={constructorMode ? constructorSection : undefined} section="result">
          {constructorMode && !lastRun ? <ReportConstructorResultEmpty loading={isLoading} ready={canSubmit} reason={submitBlockedReason}
            onConfigure={() => onConstructorSectionChange('structure')} /> : null}
          <ReportResultSection
            hasFiles={resultHasFiles}
            lastRun={lastRun}
            placeholder={resultPlaceholder}
            onOpenFiles={onOpenFiles}
          />
          {preview ? <ReportInlinePreview preview={preview} /> : null}
          </ReportSectionPanel>
        </div>
        </div>
  )
}

function ReportSourceSettings(props: ReportBuilderFormProps) {
  const {
    constructorMode,
    constructorSection,
    agreementPanel,
    priceTypeSalesComparisonPanel,
    oneCSpecialReportPanel,
    classificationPanel,
    comparisonPanel,
    xyzPanel,
    rateComparisonPanel,
    paymentComparisonPanel,
    marginComparisonPanel,
    returnComparisonPanel,
    buyerSalesSharePanel,
    revenueComparisonPanel,
    presets,
    configurationReady,
    onApplyPreset,
    isLoading,
  } = props
  return (
          <div hidden={constructorMode && constructorSection !== 'structure'} className={constructorMode ? 'report-constructor-source-settings' : undefined}>
          {agreementPanel}
          {priceTypeSalesComparisonPanel}
          {oneCSpecialReportPanel}
          {classificationPanel}
          {constructorMode ? comparisonPanel : null}
          {rateComparisonPanel}
          {paymentComparisonPanel}
          {marginComparisonPanel}
          {returnComparisonPanel}
          {buyerSalesSharePanel ? <Card className="app-section-card reports-buyer-sales-share-settings" withBorder radius="md" padding="md" style={{ minWidth: 0 }}>{buyerSalesSharePanel}</Card> : null}
          {revenueComparisonPanel ? <Card className="app-section-card reports-revenue-comparison-settings" withBorder radius="md" padding="md" style={{ minWidth: 0 }}>{revenueComparisonPanel}</Card> : null}
          {xyzPanel ? <Card className="app-section-card reports-sales-xyz-settings" withBorder radius="md" padding="md" style={{ minWidth: 0 }}>{xyzPanel}</Card> : null}
          {constructorMode && presets.length ? <ReportQuickPresets disabled={isLoading || !configurationReady} presets={presets} onApply={onApplyPreset} /> : null}
          </div>
  )
}

function ReportBuilderNotices(props: ReportBuilderFormProps) {
  const { incompleteSelectionMessage, notices } = props
  return (
    <>
          {notices.period || incompleteSelectionMessage ? (
            <Alert className="reports-page-alert" color={notices.period ? 'red' : 'yellow'} icon={<CircleAlert size={18} />}>
              {notices.period || incompleteSelectionMessage}
            </Alert>
          ) : null}

          {notices.error ? (
            <Alert className="reports-page-alert" color="red" icon={<CircleAlert size={18} />}>{notices.error}</Alert>
          ) : null}
          {notices.emptyRun ? (
            <Alert className="reports-page-alert" color="yellow" icon={<CircleAlert size={18} />}>
              {notices.emptyRun}
            </Alert>
          ) : null}
    </>
  )
}

type LegacyReportBuilderProps = {
  constructorSection?: ReportConstructorSection
  filterExpressionPanel?: ReactNode
  onGroupingLayoutChange: (layout: ReportGroupingLayout) => void
  dataSource: number
  colGroups: ReportGroupingItem[]
  filterFieldOptions: FilterFieldOption[]
  groupingOptions: ReportGroupingItem[]
  groupingSelectData: GroupingOption[]
  lookupFrom: string
  lookupTo: string
  lookupSourceWorld?: number
  lookupProvidedDiscountBasis?: 0
  lookupSalesBasis?: 0
  measurements: ReportMeasurementGroup[]
  rowGroups: ReportGroupingItem[]
  selections: ReportSelection[]
  onColGroupsChange: StateSetter<ReportGroupingItem[]>
  onMeasurementsChange: StateSetter<ReportMeasurementGroup[]>
  onRowGroupsChange: StateSetter<ReportGroupingItem[]>
  onSelectionsChange: (edit: ReportSelectionEdit) => void
}

const fixedAxesDescription: Partial<Record<number, string>> = {
  41: 'Організація → Валюта → Контрагент → Договір. Один точний договір і чотири показники у валюті взаєморозрахунків; структура фіксована.',
  40: 'Організація → Рахунок → Валютний запис → Валюта або Рахунок → Тип → Організація. Початок, надходження, витрати й кінець у валюті рахунку.',
  39: `Товар → сім атрибутів. Колонки: Остатки, Продажи та Контрагенты; один показник «Результат». ${CURRENT_VPARIVANIE_NOTICE}`,
  15: 'Клас XYZ → Товар. Показники у стовпцях; структура цього звіту фіксована.',
  16: 'Клієнт → Договір. Показники у стовпцях; структура цього звіту фіксована.',
  17: 'Клієнт → Договір. Показники у стовпцях; структура цього звіту фіксована.',
  18: 'Клієнт → Договір. Показники у стовпцях; структура цього звіту фіксована.',
  19: 'Одна точна валютна пара і серія. Показники у стовпцях; підсумки не обчислюються.',
  20: 'Клієнт → Договір. Показники у стовпцях; структура цього звіту фіксована.',
  21: 'Валюта → Клієнт → Договір. Показники у стовпцях; структура цього звіту фіксована.',
  26: 'ABC-клас → Товар. Показники у стовпцях; структура цього звіту фіксована.',
}

function LegacyReportBuilder({
  constructorSection,
  filterExpressionPanel,
  onGroupingLayoutChange,
  dataSource,
  colGroups,
  filterFieldOptions,
  groupingOptions,
  groupingSelectData,
  lookupFrom,
  lookupTo,
  lookupSourceWorld,
  lookupSalesBasis,
  lookupProvidedDiscountBasis,
  measurements,
  rowGroups,
  selections,
  onColGroupsChange,
  onMeasurementsChange,
  onRowGroupsChange,
  onSelectionsChange,
}: LegacyReportBuilderProps) {
  const { t } = useI18n()
  const [groupingPickerTarget, setGroupingPickerTarget] = useState<'rows' | 'columns' | null>(null)
  const checkedMeasurements = flattenCheckedMeasurements(measurements).length
  const groupingLayout = { Row: rowGroups, Col: colGroups }
  const allowedGroupingTypes = new Set(groupingOptions.map(item => item.type))
  const selectedGroupingTypes = new Set([...rowGroups, ...colGroups].map(item => item.type))

  const transferGrouping = (axis: ReportGroupingAxis, type: number) => {
    if (dataSource === 13 || hasFixedReportAxes(dataSource)) return
    const next = transferReportGrouping(groupingLayout, axis, type, allowedGroupingTypes)
    if (next === groupingLayout) return
    onGroupingLayoutChange(next)
  }

  const closeGroupingPicker = () => setGroupingPickerTarget(null)

  const addGroupingFromPicker = (value: string) => {
    const item = groupingOptions.find((option) => String(option.type) === value)
    if (hasFixedReportAxes(dataSource) || !item || !groupingPickerTarget || (dataSource === 13 && groupingPickerTarget === 'columns') || selectedGroupingTypes.has(item.type) || (groupingPickerTarget === 'columns' && item.type === ABC_CLASS_GROUPING)) return

    if (groupingPickerTarget === 'rows') {
      onRowGroupsChange((current) => addGrouping(current, item))
    } else {
      onColGroupsChange((current) => addGrouping(current, item))
    }

    closeGroupingPicker()
  }

  const selectionPanel = dataSource === 19 ? null : <section className="reports-stocks-legacy__selections">
    <ReportSelectionsCard dataSource={dataSource} description={null} filterFieldOptions={filterFieldOptions}
      from={lookupFrom} lookupSourceWorld={lookupSourceWorld} lookupSalesBasis={lookupSalesBasis} lookupProvidedDiscountBasis={lookupProvidedDiscountBasis} selections={selections} title={t('Умови відбору')} to={lookupTo} onChange={onSelectionsChange} />
  </section>

  return (
    <section className="reports-stocks-legacy" aria-label="Налаштування звіту">
      <ReportSectionPanel className="reports-stocks-legacy__columns" active={constructorSection} section="structure">
        <section className="app-section-card reports-stocks-legacy-panel reports-stocks-legacy-measurements">
          <div className="reports-stocks-legacy-panel__header">
            <Group className="reports-stocks-legacy-panel__title" gap={6} wrap="nowrap">
              <Text className="app-section-title" component="h2" fw={600} size="sm">{t('Показники')}</Text>
              <Text className="reports-stocks-count" size="xs">{checkedMeasurements || ''}</Text>
            </Group>
            <Group gap={4} wrap="nowrap">
              <Button
                color={CREATE_ACTION_COLOR}
                size="compact-xs"
                type="button"
                variant="subtle"
                onClick={() => setAllMeasurements(onMeasurementsChange, true)}
              >
                Усі
              </Button>
              <Button
                color="gray"
                size="compact-xs"
                type="button"
                variant="subtle"
                onClick={() => setAllMeasurements(onMeasurementsChange, false)}
              >
                Очистити
              </Button>
            </Group>
          </div>

          <div className="reports-stocks-legacy-measurements__list">
            {!hasFixedReportAxes(dataSource) ? <div className="reports-stocks-measurement-columns" aria-hidden="true">
              <span>{t('Показник')}</span>
              <span>{t('Без ПДВ')}</span>
              <span>{t('ПДВ')}</span>
              <span>{t('З ПДВ')}</span>
            </div> : null}
            {measurements.map((group, groupIndex) => {
              const groupLabel = group.Label || getReportFieldLabel(group.Name)
              const hasDistinctChildren =
                group.SubList.length > 1
                || (group.SubList[0]?.Label || getReportFieldLabel(group.SubList[0]?.Name ?? '')) !== groupLabel

              return (
                <div className="reports-stocks-legacy-measurement" key={group.Name}>
                  <Checkbox
                    checked={group.IsChecked}
                    indeterminate={!group.IsChecked && group.SubList.some((item) => item.IsChecked)}
                    aria-label={groupLabel}
                    label={group.Name === 'Profitability' ? `${groupLabel}, %` : groupLabel}
                    onChange={() => toggleMeasurementGroup(measurements, groupIndex, onMeasurementsChange)}
                  />
                  {hasDistinctChildren ? group.SubList.map((item, itemIndex) => (
                    <Checkbox
                      className="reports-stocks-measurement-value"
                      style={{ gridColumn: item.Name.endsWith('WithoutVAT') ? 2 : item.Name.endsWith('WithVAT') ? 4 : 3 }}
                      aria-label={(item.Label || getReportFieldLabel(item.Name))}
                      title={(item.Label || getReportFieldLabel(item.Name))}
                      checked={item.IsChecked}
                      key={item.Name}
                      size="sm"
                      onChange={() => toggleMeasurementItem(measurements, groupIndex, itemIndex, onMeasurementsChange)}
                    />
                  )) : <Text className="reports-stocks-measurement-unit" size="xs">{nativeReportMeasurementUnit(dataSource, groupLabel) ?? t('Без поділу за ПДВ')}</Text>}
                </div>
              )
            })}
          </div>
        </section>

        <section className="app-section-card reports-stocks-structure">
          <Text className="app-section-title" component="h2" fw={600} size="sm">{t('Групування')}</Text>
          {fixedAxesDescription[dataSource] ? <Text size="sm">{dataSource === 39
            ? `Товар → сім атрибутів. Колонки: Остатки, Продажи та Контрагенты; один показник «Результат». ${currentVparivanieNotice(filterFieldOptions.some(option => option.field.Type === 60))}`
            : fixedAxesDescription[dataSource]}</Text> : <ReportGroupingPanel layout={groupingLayout} axis="Row" allowed={allowedGroupingTypes} transferSupported={dataSource !== 13}
            onOpenPicker={() => setGroupingPickerTarget('rows')}
            onRemove={(index) => onRowGroupsChange((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            onReorder={(type, direction) => onRowGroupsChange(current => reorderReportGrouping(current, type, direction, allowedGroupingTypes))}
            onTransfer={type => transferGrouping('Row', type)} />}
          {hasFixedReportAxes(dataSource) ? null : dataSource !== 13 ? <ReportGroupingPanel layout={groupingLayout} axis="Col" allowed={allowedGroupingTypes}
            onOpenPicker={() => setGroupingPickerTarget('columns')}
            onRemove={(index) => onColGroupsChange((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            onReorder={(type, direction) => onColGroupsChange(current => reorderReportGrouping(current, type, direction, allowedGroupingTypes))}
            onTransfer={type => transferGrouping('Col', type)} /> : <Text size="sm" c="dimmed">Порівняння періодів показує вибрані показники у стовпцях.</Text>}
        </section>
        {!constructorSection ? selectionPanel : null}
      </ReportSectionPanel>

      {constructorSection ? <ReportSectionPanel active={constructorSection} section="filters">
        {selectionPanel}
        {dataSource === 19 ? <Text size="sm" c="gray.7">Для історичних курсів валютна пара та дати задаються в параметрах звіту. Додаткові умови відбору не застосовуються.</Text> : filterExpressionPanel}
      </ReportSectionPanel> : null}

      <LegacyGroupingPickerModal
        opened={groupingPickerTarget !== null}
        options={groupingSelectData.filter(item => !selectedGroupingTypes.has(Number(item.value)) && (groupingPickerTarget !== 'columns' || Number(item.value) !== ABC_CLASS_GROUPING))}
        target={groupingPickerTarget}
        title={groupingPickerTarget === 'rows' ? 'Групування рядків' : 'Групування стовпців'}
        onAdd={addGroupingFromPicker}
        onClose={closeGroupingPicker}
      />

    </section>
  )
}

type LegacyGroupingPickerModalProps = {
  opened: boolean
  options: GroupingOption[]
  target: 'rows' | 'columns' | null
  title: string
  onAdd: (value: string) => void
  onClose: () => void
}

function LegacyGroupingPickerModal({
  opened,
  options,
  target,
  title,
  onAdd,
  onClose,
}: LegacyGroupingPickerModalProps) {
  const [pickerQuery, setPickerQuery] = useState('')
  const normalizedPickerQuery = pickerQuery.trim().toLocaleLowerCase('uk-UA')
  const visibleOptions = useMemo(
    () =>
      normalizedPickerQuery
        ? options.filter((option) => option.label.toLocaleLowerCase('uk-UA').includes(normalizedPickerQuery))
        : options,
    [normalizedPickerQuery, options],
  )

  const closePicker = () => {
    setPickerQuery('')
    onClose()
  }

  const addOption = (value: string) => {
    setPickerQuery('')
    onAdd(value)
  }

  return (
    <AppModal
      centered
      classNames={{ title: 'reports-stocks-modal-title' }}
      opened={opened}
      size="lg"
      title={`Додати поле · ${title}`}
      onClose={closePicker}
    >
      <Stack gap="sm">
        <TextInput
          aria-label={`Пошук поля: ${title}`}
          autoFocus
          placeholder="Назва поля"
          value={pickerQuery}
          onChange={(event) => setPickerQuery(event.currentTarget.value)}
        />
        {visibleOptions.length ? (
          <div className="reports-stocks-group-picker">
            {visibleOptions.map((option) => {
              const [groupLabel, ...fieldLabelParts] = option.label.split(': ')
              const fieldLabel = fieldLabelParts.join(': ') || groupLabel
              const isAssignedToTarget = target ? option.assignedTo.includes(target) : false

              return (
                <button
                  className="reports-stocks-group-picker__option"
                  disabled={isAssignedToTarget}
                  key={option.value}
                  type="button"
                  onClick={() => addOption(option.value)}
                >
                  <span className="reports-stocks-group-picker__copy">
                    <span className="reports-stocks-group-picker__group">{groupLabel}</span>
                    <span className="reports-stocks-group-picker__label">{fieldLabel}</span>
                  </span>
                  {isAssignedToTarget ? (
                    <Badge
                      className="app-role-pill is-orange"
                      variant="light"
                    >
                      {target === 'rows' ? 'У рядках' : 'У колонках'}
                    </Badge>
                  ) : (
                    <Plus aria-hidden="true" size={15} />
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="reports-stocks-group-picker__empty">
            <Text c="gray.9" size="sm">Нічого не знайдено</Text>
          </div>
        )}
      </Stack>
    </AppModal>
  )
}

type GroupingOption = {
  assignedTo: Array<'rows' | 'columns'>
  label: string
  value: string
}

type FilterFieldOption = {
  field: ReportFilterField
  label: string
  value: string
}

type ReportSelectionsCardProps = {
  dataSource: number
  lookupSourceWorld?: number
  lookupProvidedDiscountBasis?: 0
  lookupSalesBasis?: 0
  description?: string | null
  filterFieldOptions: FilterFieldOption[]
  from: string
  selections: ReportSelection[]
  title?: string
  to: string
  onChange: (edit: ReportSelectionEdit) => void
}

function ReportSelectionsCard({
  dataSource,
  lookupSourceWorld,
  lookupSalesBasis,
  lookupProvidedDiscountBasis,
  description,
  filterFieldOptions,
  from,
  selections,
  title,
  to,
  onChange,
}: ReportSelectionsCardProps) {
  const { t } = useI18n()
  const [editorIndex, setEditorIndex] = useState<number | null>(null)
  const [draftSelection, setDraftSelection] = useState<ReportSelection | null>(null)
  const filterConditions = dataSource === 39 ? currentVparivanieFilterConditions(draftSelection?.SelectedField.Type ?? 0) : REPORT_FILTER_CONDITIONS
  const resolvedDescription = description === undefined
    ? t('Необов’язково: звузьте звіт до клієнта, товару, документа або іншої ознаки.')
    : description
  const editorSelections = draftSelection
    ? editorIndex === -1
      ? [...selections, draftSelection]
      : selections.map((selection, index) => (index === editorIndex ? draftSelection : selection))
    : selections

  function closeEditor() {
    setDraftSelection(null)
    setEditorIndex(null)
  }

  function openEditor(index: number, selection: ReportSelection) {
    setEditorIndex(index)
    setDraftSelection(cloneReportSelection(selection))
  }

  function saveDraft() {
    if (!draftSelection || editorIndex === null || !draftSelection.SelectedField.Name || !draftSelection.Values.length) {
      return
    }

    const savedSelection = cloneReportSelection(draftSelection)
    onChange(editorIndex === -1 ? { kind: 'append', selection: savedSelection } : { kind: 'replace', index: editorIndex, selection: savedSelection })
    closeEditor()
  }

  return (
    <>
      <Card className="app-section-card reports-stocks-selection-card" withBorder radius="md" padding="md">
        <div className="reports-stocks-legacy-panel__header">
          <div className="reports-stocks-legacy-panel__title">
            <Group gap={6} wrap="nowrap">
              <Text className="app-section-title" component="h2" fw={600} size="sm">
                {title ?? t('Умови відбору')}
              </Text>
              {selections.length ? <Badge className="app-role-pill is-gray" variant="light">{selections.length}</Badge> : null}
            </Group>
          </div>
          <Button
            className="reports-stocks-legacy-panel__add"
            color={CREATE_ACTION_COLOR}
            leftSection={<Plus size={14} />}
            size="xs"
            type="button"
            onClick={() => openEditor(-1, createEmptySelection())}
          >
            {t('Додати умову')}
          </Button>
        </div>

        {resolvedDescription ? <Text className="reports-stocks-panel-description">{resolvedDescription}</Text> : null}
        {selections.length ? (
          <div className="reports-stocks-selection-list">
            {selections.map((selection, index) => {
              const fieldLabel = getSelectionFieldSummary(selection, filterFieldOptions, t)

              return (
                <div className="reports-stocks-selection-summary" key={getSelectionRenderKey(selection, index)}>
                  <Checkbox
                    aria-label={`${t('Умова відбору')} ${index + 1}`}
                    checked={hasFixedReportAxes(dataSource) ? selection.IsChecked !== false : selection.IsChecked}
                    onChange={() => onChange({ kind: 'replace', index, selection: { ...selection, IsChecked: hasFixedReportAxes(dataSource) ? selection.IsChecked === false : !selection.IsChecked } })}
                  />
                  <Text className="reports-stocks-selection-summary__copy">
                    <span className="reports-stocks-selection-summary__field">№{index + 1}: {fieldLabel}</span>
                    <span className="reports-stocks-selection-summary__condition">
                      {selection.FilterCondition.Name}
                    </span>
                    <span className="reports-stocks-selection-summary__value">
                      {getSelectionValuesSummary(selection, t)}
                    </span>
                  </Text>
                  <Group className="reports-stocks-selection-summary__actions" gap={4} wrap="nowrap">
                    <TableRowAction
                      action="edit"
                      label={t('Редагувати')}
                      onClick={() => openEditor(index, selection)}
                    />
                    <TableRowAction
                      action="delete"
                      label={t('Видалити')}
                      onClick={() => onChange({ kind: 'delete', index })}
                    />
                  </Group>
                </div>
              )
            })}
          </div>
        ) : null}
      </Card>

      <AppModal
        centered
        className="reports-stocks-selection-modal"
        opened={Boolean(draftSelection)}
        size="lg"
        title={editorIndex === -1 ? t('Додати умову відбору') : t('Редагувати умову відбору')}
        onClose={closeEditor}
      >
        {draftSelection ? (
          <Stack gap="md">
            <Select
              data={filterFieldOptions}
              label={t('Поле')}
              placeholder={t('Оберіть поле')}
              searchable
              value={draftSelection.SelectedField.Name ? String(draftSelection.SelectedField.Type) : null}
              onChange={(value) => {
                const option = filterFieldOptions.find((item) => item.value === value)
                setDraftSelection((current) => current ? {
                  ...current,
                  SelectedField: option?.field || { Name: '', Type: 0 },
                  ...(dataSource === 39 ? { FilterCondition: currentVparivanieFilterConditions(option?.field.Type ?? 0)[0] } : {}),
                  Values: [],
                } : current)
              }}
            />
            <div className="reports-stocks-selection-modal__controls">
              <Select
                allowDeselect={false}
                data={filterConditions.map((condition) => ({
                  label: condition.Name,
                  value: String(condition.Type),
                }))}
                label={t('Умова')}
                value={String(draftSelection.FilterCondition.Type)}
                onChange={(value) => {
                  const condition = filterConditions.find((item) => String(item.Type) === value) || filterConditions[0]
                  setDraftSelection((current) => current ? {
                    ...current,
                    FilterCondition: condition,
                    Values: !isMultiValueReportCondition(condition.Type) && current.Values.length > 1
                      ? current.Values.slice(0, 1)
                      : current.Values,
                  } : current)
                }}
              />
              <SelectionValuePicker
                dataSource={dataSource}
                lookupSourceWorld={lookupSourceWorld} lookupSalesBasis={lookupSalesBasis} lookupProvidedDiscountBasis={lookupProvidedDiscountBasis}
                from={from}
                label={t('Значення')}
                selection={draftSelection}
                selections={editorSelections}
                to={to}
                width="100%"
                onChange={(values) => setDraftSelection((current) => current ? { ...current, Values: values } : current)}
              />
            </div>
            <AppModalFooter>
              <Button color="gray" type="button" variant="light" onClick={closeEditor}>{t('Скасувати')}</Button>
              <Button
                color={CREATE_ACTION_COLOR}
                disabled={!draftSelection.SelectedField.Name || !draftSelection.Values.length}
                leftSection={<Save size={16} />}
                type="button"
                onClick={saveDraft}
              >
                {t('Зберегти')}
              </Button>
            </AppModalFooter>
          </Stack>
        ) : null}
      </AppModal>
    </>
  )
}

function cloneReportSelection(selection: ReportSelection): ReportSelection {
  return {
    ...selection,
    FilterCondition: { ...selection.FilterCondition },
    SelectedField: { ...selection.SelectedField },
    Values: selection.Values.map((value) => ({ ...value, Data: { ...value.Data } })),
  }
}

function getSelectionValuesSummary(selection: ReportSelection, t: TranslateFunction) {
  if (!selection.Values.length) {
    return t('Значення не вибрано')
  }

  const visibleValues = selection.Values.slice(0, 2).map((value) => value.Name).join(', ')
  const hiddenCount = selection.Values.length - 2

  return hiddenCount > 0 ? `${visibleValues} · +${hiddenCount}` : visibleValues
}

function getSelectionFieldSummary(
  selection: ReportSelection,
  filterFieldOptions: FilterFieldOption[],
  t: TranslateFunction,
) {
  const label = filterFieldOptions.find((option) => option.value === String(selection.SelectedField.Type))?.label

  if (!label) {
    return t('Поле не вибрано')
  }

  const separatorIndex = label.indexOf(':')

  if (separatorIndex === -1) {
    return label
  }

  const groupLabel = label.slice(0, separatorIndex).trim()
  const fieldLabel = label.slice(separatorIndex + 1).trim()

  return groupLabel === fieldLabel ? fieldLabel : label
}

type ReportResultSectionProps = {
  hasFiles: boolean
  lastRun: ReportRunOutcome | null
  placeholder: { description: string; title: string }
  onOpenFiles: () => void
}

function reportRunScopeLabel(run: ReportRunOutcome, t: TranslateFunction): string {
  if (run.rateComparison) return `${formatDate(run.rateComparison.CurrentAsOf)} / ${formatDate(run.rateComparison.PreviousAsOf)}`
  return run.periodSupported ? `${formatDate(run.from)} – ${formatDate(run.to)}` : t('Поточний стан')
}

function ReportResultSection({
  hasFiles,
  lastRun,
  placeholder,
  onOpenFiles,
}: ReportResultSectionProps) {
  const { t } = useI18n()
  const resultRows = useMemo(() => (lastRun ? [lastRun] : []), [lastRun])
  const resultColumns = useMemo<DataTableColumn<ReportRunOutcome>[]>(
    () => [
      {
        id: 'period',
        header: lastRun?.rateComparison ? 'Дати курсів' : lastRun?.periodSupported === false ? t('Стан') : t('Період'),
        minWidth: 180,
        accessor: (row) => reportRunScopeLabel(row, t),
        cell: (row) => (
          <span className="reports-stocks-result__period">
            {reportRunScopeLabel(row, t)}
          </span>
        ),
      },
      {
        id: 'measures',
        header: t('Показники'),
        minWidth: 260,
        fill: true,
        accessor: (row) => row.measures.join(', '),
        cell: (row) => row.measures.join(', '),
      },
      {
        id: 'rowGroupings',
        header: t('Групування рядків'),
        minWidth: 220,
        accessor: (row) => row.rowGroupings.join(', '),
        cell: (row) => (
          <span className="reports-stocks-result__grouping">
            {row.rowGroupings.join(', ')}
          </span>
        ),
      },
      {
        id: 'colGroupings',
        header: t('Групування стовпців'),
        minWidth: 220,
        accessor: (row) => row.colGroupings.join(', '),
        cell: (row) => (
          <span className="reports-stocks-result__grouping">
            {row.colGroupings.join(', ')}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('Статус'),
        minWidth: 150,
        align: 'center',
        accessor: (row) => row.hasDocument,
        cell: (row) => (
          <Badge className={`app-role-pill ${row.hasDocument ? 'is-green' : 'is-orange'}`} variant="light">
            {row.hasDocument ? t('Готово') : t('Файл не сформовано')}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 170,
        rowActions: true,
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        cell: (row) => (
          <TableRowAction
            action="download"
            disabled={!row.hasDocument || !hasFiles}
            label={t('Завантажити')}
            onClick={onOpenFiles}
          />
        ),
      },
    ],
    [hasFiles, lastRun?.periodSupported, lastRun?.rateComparison, onOpenFiles, t],
  )

  if (!lastRun) return null

  return (
    <section className="app-section-card reports-stocks-result reports-stocks-panel" aria-labelledby="reports-stocks-result-title">
      <Group className="reports-stocks-result__header" justify="space-between" wrap="nowrap">
        <Box className="reports-stocks-result__heading">
          <Text className="app-section-title" component="h2" fw={600} size="sm" id="reports-stocks-result-title">
            {t('Результат')}
          </Text>
          <Text className="reports-stocks-result__meta" size="xs" c="gray.9">
            {lastRun
              ? `${reportRunScopeLabel(lastRun, t)} · ${t('Показників')}: ${lastRun.measures.length}`
              : t('Після формування тут з’являться файли Excel і PDF.')}
          </Text>
        </Box>
      </Group>
      <DataTable
        columns={resultColumns}
        data={resultRows}
        density="normal"
        distributeAvailableWidth
        emptyText={(
          <Box className="reports-stocks-result__empty" role="status">
            <Text fw={600}>{placeholder.title}</Text>
            <Text c="gray.9" size="sm">{placeholder.description}</Text>
          </Box>
        )}
        getRowId={(row) => `${row.from}-${row.to}`}
        height={156}
        layoutVersion="reports-stocks-result-v1"
        minWidth={1080}
        showDensityToggle={false}
        showLayoutControls={false}
        tableId="reports-stocks-result"
      />
    </section>
  )
}

type SelectionValuePickerProps = {
  dataSource: number
  lookupSourceWorld?: number
  lookupProvidedDiscountBasis?: 0
  lookupSalesBasis?: 0
  error?: string
  from: string
  label?: string
  selection: ReportSelection
  selections: ReportSelection[]
  to: string
  width?: number | string
  onChange: (values: ReportSelectedValue[]) => void
}

function SelectionValuePicker({ dataSource, lookupSourceWorld, lookupSalesBasis, lookupProvidedDiscountBasis, error, from, label, selection, selections, to, width = 320, onChange }: SelectionValuePickerProps) {
  const { t } = useI18n()
  const [search, setSearch] = useValueState('')
  const [manualValue, setManualValue] = useValueState('')
  const [options, setOptions] = useValueState<ReportEntity[]>([])
  const [isLoading, setLoading] = useValueState(false)
  const [docStatus, setDocStatus] = useValueState('All')
  const [docOrganisationIds, setDocOrganisationIds] = useValueState<string[]>([])
  const [docSelfSales, setDocSelfSales] = useValueState(false)
  const [organizationOptions, setOrganizationOptions] = useValueState<ReportEntity[]>([])
  const [debouncedSearch] = useDebouncedValue(search, LOOKUP_SEARCH_DEBOUNCE_MS)
  const nativeLookup = usesNativeReportLookup(dataSource)
  // Current reservations resolve exact ClientAgreement identities from their own
  // facts; the sales-only dependent customer-agreement picker must not run here.
  const lookupMode = nativeLookup ? 'search' : getSelectionLookupMode(selection.SelectedField.Type)
  const isSaleDocumentFilter = !nativeLookup && PERIOD_SCOPED_FILTER_FIELD_TYPES.has(selection.SelectedField.Type)
  const saleDocumentFilters = useMemo(
    () => ({
      organisationIds: docOrganisationIds.map((id) => Number(id)),
      status: docStatus,
      type: docSelfSales ? ('Self' as const) : ('All' as const),
    }),
    [docOrganisationIds, docSelfSales, docStatus],
  )
  const organizationSelectData = useMemo(
    () =>
      organizationOptions.flatMap((organization) =>
        typeof organization.Id === 'number'
          ? [{ label: getEntityDisplayName(organization), value: String(organization.Id) }]
          : [],
      ),
    [organizationOptions],
  )
  const normalizedSearch = lookupMode === 'search' ? debouncedSearch.trim() : ''
  const minSearchLength = nativeLookup ? 0 : getSelectionLookupMinLength(selection.SelectedField.Type)
  const needsPeriod = isSaleDocumentFilter
  const dependentClientNetId = lookupMode === 'dependent' ? getDependentClientNetId(selections) : ''
  const selectOptions = useMemo(
    () =>
      mergeReportEntities([...selection.Values.map((value) => value.Data), ...options]).map((entity) => ({
        label: getEntityDisplayName(entity),
        value: getReportEntityKey(entity, getEntityDisplayName(entity)),
      })),
    [options, selection.Values],
  )

  useEffect(() => {
    if (!isSaleDocumentFilter) {
      return
    }

    let cancelled = false

    async function loadOrganizations() {
      try {
        const organizations = await getReportOrganizations()

        if (!cancelled) {
          setOrganizationOptions(organizations)
        }
      } catch {
        if (!cancelled) {
          setOrganizationOptions([])
        }
      }
    }

    void loadOrganizations()

    return () => {
      cancelled = true
    }
  }, [isSaleDocumentFilter, setOrganizationOptions])

  useEffect(() => {
    if (!selection.SelectedField.Name || lookupMode === 'manual') {
      setOptions([])
      setLoading(false)

      return
    }

    if (lookupMode === 'search' && normalizedSearch.length < minSearchLength) {
      setOptions([])
      setLoading(false)

      return
    }

    if (lookupMode === 'dependent' && !dependentClientNetId) {
      setOptions([])
      setLoading(false)

      return
    }

    if (needsPeriod && (!from || !to)) {
      setOptions([])
      setLoading(false)

      return
    }

    let cancelled = false
    const controller = new AbortController()

    async function loadOptions() {
      setLoading(true)

      try {
        const nextOptions =
          lookupMode === 'dependent'
            ? await getReportClientAgreements(dependentClientNetId)
            : await loadSelectionLookupOptions(
                dataSource, selection.SelectedField.Type, normalizedSearch, from, to,
                controller.signal, saleDocumentFilters, lookupSourceWorld, lookupSalesBasis, lookupProvidedDiscountBasis,
              )

        if (!cancelled) {
          setOptions(nextOptions)
        }
      } catch {
        if (!cancelled) {
          setOptions([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadOptions()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    dataSource,
    lookupSourceWorld,
    lookupSalesBasis,
    lookupProvidedDiscountBasis,
    dependentClientNetId,
    from,
    lookupMode,
    minSearchLength,
    needsPeriod,
    normalizedSearch,
    saleDocumentFilters,
    selection.SelectedField.Name,
    selection.SelectedField.Type,
    setLoading,
    setOptions,
    to,
  ])

  function addEntity(entity: ReportEntity) {
    const key = getReportEntityKey(entity, getEntityDisplayName(entity))

    if (selection.Values.some((value) => getReportEntityKey(value.Data, value.Name) === key)) {
      return
    }

    // Equals/NotEquals (and single-group) conditions hold exactly one value — replace rather than accumulate;
    // only the list conditions build up multiple values (legacy parity).
    if (!isMultiValueReportCondition(selection.FilterCondition.Type)) {
      onChange([createSelectedValue(entity, dataSource)])
      return
    }

    onChange([...selection.Values, createSelectedValue(entity, dataSource)])
  }

  function addManualValue() {
    const value = manualValue.trim()

    if (!value) {
      return
    }

    addEntity({ Name: value, Value: value })
    setManualValue('')
  }

  function removeValue(valueIndex: number) {
    onChange(selection.Values.filter((_, index) => index !== valueIndex))
  }

  if (!selection.SelectedField.Name) {
    return (
      <TextInput
        disabled
        label={label}
        placeholder={t('Спочатку оберіть поле')}
        value=""
        w={width}
      />
    )
  }

  return (
    <Stack gap={4} w={width}>
      {isSaleDocumentFilter ? (
        <Stack gap={6}>
          <Select
            allowDeselect={false}
            data={SALE_DOCUMENT_STATUS_OPTIONS.map((option) => ({ label: t(option.label), value: option.value }))}
            label={t('Статус')}
            value={docStatus}
            onChange={(value) => setDocStatus(value || 'All')}
          />
          <CheckboxMultiSelect
            data={organizationSelectData}
            label={t('Організація')}
            placeholder={t('Всі')}
            value={docOrganisationIds}
            onChange={setDocOrganisationIds}
          />
          <Switch
            checked={docSelfSales}
            label={t('Власні продажі')}
            onChange={(event) => setDocSelfSales(event.currentTarget.checked)}
          />
        </Stack>
      ) : null}
      {lookupMode === 'manual' ? (
        <Group align="end" gap={6} wrap="nowrap">
          <TextInput
            error={error}
            label={label}
            placeholder={t('Значення')}
            value={manualValue}
            onChange={(event) => setManualValue(event.currentTarget.value)}
          />
          <Button color={CREATE_ACTION_COLOR} size="sm" type="button" onClick={addManualValue}>
            {t('Додати')}
          </Button>
        </Group>
      ) : (
        <Select
          clearable
          searchable
          data={selectOptions}
          error={error}
          filter={lookupMode === 'search' ? keepServerLookupResults : undefined}
          label={label}
          nothingFoundMessage={
            needsPeriod && (!from || !to)
              ? t('Спочатку вкажіть коректний період')
              : lookupMode === 'search' && normalizedSearch.length < minSearchLength
                ? t('Введіть мінімум 2 символи')
                : lookupMode === 'dependent' && !dependentClientNetId
                  ? t('Спочатку оберіть клієнта')
                  : t('Нічого не знайдено')
          }
          placeholder={t('Пошук значення')}
          rightSection={isLoading ? <Loader size="xs" /> : null}
          searchValue={search}
          value={null}
          onChange={(value) => {
            const entity = value
              ? mergeReportEntities([...selection.Values.map((selectedValue) => selectedValue.Data), ...options])
                  .find((option) => getReportEntityKey(option, getEntityDisplayName(option)) === value)
              : undefined

            if (entity) {
              addEntity(entity)
              setSearch('')
            }
          }}
          onSearchChange={setSearch}
        />
      )}
      {selection.Values.length ? (
        <Group gap={4}>
          {selection.Values.map((value, valueIndex) => (
            <Badge
              className="app-role-pill is-gray reports-stocks-selected-value"
              key={getReportEntityKey(value.Data, value.Name)}
              radius="sm"
              rightSection={(
                <ActionIcon
                  aria-label={t('Видалити')}
                  color="gray"
                  size="xs"
                  type="button"
                  variant="transparent"
                  onClick={() => removeValue(valueIndex)}
                >
                  <Trash2 size={12} />
                </ActionIcon>
              )}
              variant="light"
            >
              {value.Name}
            </Badge>
          ))}
        </Group>
      ) : null}
    </Stack>
  )
}

function getPeriodError(from: string, to: string, maxDate: string, t: TranslateFunction): string | null {
  if (!from || !to) {
    return t('Оберіть період')
  }

  if (!isSupportedReportDate(from, maxDate) || !isSupportedReportDate(to, maxDate)) {
    return t('Дата має бути в межах {min} – {max}', { max: formatDate(maxDate), min: formatDate(REPORT_MIN_DATE) })
  }

  if (from > to) {
    return t('Дата початку не може бути пізніше дати завершення')
  }

  return null
}

function isSupportedReportDate(value: string, maxDate: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= REPORT_MIN_DATE && value <= maxDate
}

function isIncompleteSelection(selection: ReportSelection): boolean {
  return selection.IsChecked && Boolean(selection.SelectedField.Name) && selection.Values.length === 0
}

function addGrouping(current: ReportGroupingItem[], item: ReportGroupingItem): ReportGroupingItem[] {
  const isTaken = current.some((group) => group.type === item.type)

  return isTaken ? current : [...current, item]
}

// The controller used to answer EVERY failure — its own crashes included — with HTTP 400 and the raw .NET
// exception text, so the status said nothing and the text was «Value cannot be null. (Parameter 'key')»: not
// ours to show, and not something anyone could act on. Nothing but the status was read here, and the screen
// offered a guess instead — «спробуйте вужчий період або менше групувань» — which for the commonest refusals is
// the opposite of the fix: a date typed as «01.06.2026», a filter row with no values, an unticked measure. None
// of those get better with a narrower period.
//
// The server now separates the two: 400 carries an authored Ukrainian sentence naming the row, the field and
// what to do about it, and its own faults come back as 500 with the detail in the log. So a 400 is shown as the
// server wrote it. The Cyrillic test is what tells the new contract from the old one — against a server that
// still answers 400 with a .NET stack message the screen keeps its own words rather than publishing that.
function describeReportError(error: unknown, t: TranslateFunction): string {
  if (error instanceof ApiError) {
    // Status 0 is the client's own network/timeout message, already translated.
    if (error.status === 0) {
      return error.message
    }

    if (error.status === 401) {
      return t('Сесію завершено. Увійдіть повторно.')
    }

    if (error.status === 403) {
      return t('Недостатньо прав для формування звіту. Зверніться до адміністратора щодо доступу до конструктора звітів.')
    }

    if (error.status >= 500) {
      return t('Сервер звітів недоступний. Спробуйте ще раз пізніше.')
    }

    // Report generation uses 409 for missing accepted source coverage. The API
    // client supplies a generic Cyrillic fallback when the response has no
    // Message; do not mistake that fallback for an authored server explanation.
    if (error.status === 409) {
      const payload = error.payload
      const authored = payload && typeof payload === 'object' && 'Message' in payload
        && typeof payload.Message === 'string' && isAuthoredServerMessage(payload.Message)
      return authored ? error.message : t('Сервер не підтвердив повноту даних для цього звіту. Звіт і файли не сформовано; після синхронізації потрібних даних повторіть запит.')
    }

    if (isAuthoredServerMessage(error.message)) {
      return error.message
    }

    return t('Сервер не зміг сформувати звіт із такими параметрами. Спробуйте вужчий період або менше групувань.')
  }

  return t('Не вдалося сформувати звіт')
}

function isAuthoredServerMessage(message: string): boolean {
  return /\p{Script=Cyrillic}/u.test(message || '')
}

// Names the run for the export modal, where the only other identity on offer is the engine's «Reports_MM.yyyy_
// <guid>.xlsx» file name.
function describeReportRun(run: ReportRunOutcome, t: TranslateFunction): string {
  const parts = [run.rateComparison ? `Курс на ${formatDate(run.rateComparison.CurrentAsOf)} / порівняння на ${formatDate(run.rateComparison.PreviousAsOf)} · ${run.rateComparison.RateKind === 'commercial' ? 'Комерційний' : 'Державний'} [${run.rateComparison.RateDefinitionId}]` : run.periodSupported ? `${formatDate(run.from)} – ${formatDate(run.to)}` : t('Поточний стан на час читання даних')]
  if (run.comparison) parts.push(`Порівняння: ${formatDate(run.comparison.From)} – ${formatDate(run.comparison.To)}`)

  if (run.rowGroupings.length) {
    parts.push(`${t('Рядки')}: ${run.rowGroupings.join(', ')}`)
  }

  if (run.colGroupings.length) {
    parts.push(`${t('Колонки')}: ${run.colGroupings.join(', ')}`)
  }

  if (run.measures.length) {
    parts.push(`${t('Показники')}: ${run.measures.join(', ')}`)
  }

  return parts.join(' · ')
}

function describeResultPlaceholder(
  lastRun: ReportRunOutcome | null,
  hasError: boolean,
  t: TranslateFunction,
): { description: string; title: string } {
  if (hasError) {
    return {
      description: t('Причина — у повідомленні вище. Змініть параметри та сформуйте звіт ще раз.'),
      title: t('Звіт не сформовано'),
    }
  }

  if (!lastRun) {
    return {
      description: t('Оберіть показники, додайте групування рядків і сформуйте звіт.'),
      title: t('Результат ще не сформовано'),
    }
  }

  const period = `${formatDate(lastRun.from)} – ${formatDate(lastRun.to)}`
  const measures = lastRun.measures.join(', ')

  if (lastRun.rateComparison) return { title: lastRun.hasDocument ? 'Звіт сформовано у файл' : 'Файл звіту не сформовано', description: describeReportRun(lastRun, t) }
  if (!lastRun.periodSupported) {
    return {
      description: lastRun.hasDocument
        ? t('Поточний стан. Показники: {measures}. Час читання даних і залишки — у файлі звіту.', { measures })
        : t('Поточний стан. Показники: {measures}. Спробуйте послабити умови відбору.', { measures }),
      title: lastRun.hasDocument ? t('Звіт сформовано у файл') : t('Файл звіту не сформовано'),
    }
  }

  if (!lastRun.hasDocument) {
    return {
      description: t('Період {period}. Показники: {measures}. Спробуйте інший період або послабте умови відбору.', {
        measures,
        period,
      }),
      title: t('Файл звіту не сформовано'),
    }
  }

  // The file itself records neither the period nor the measures it was built from, so the screen keeps them.
  // Whether the period actually held any data is visible only inside the sheet: «/report/get/all/filtered» hands
  // back the two file links and nothing else, and the writer closes even a data-less sheet with «Загальний
  // підсумок», so the screen must not claim either way — it says where the answer is instead.
  return {
    description: t('Період {period}. Показники: {measures}. Дані — у файлі: сервер не повертає рядки для перегляду.', {
      measures,
      period,
    }),
    title: t('Звіт сформовано у файл'),
  }
}

function setAllMeasurements(
  setter: (value: ReportMeasurementGroup[] | ((current: ReportMeasurementGroup[]) => ReportMeasurementGroup[])) => void,
  checked: boolean,
) {
  setter((current) =>
    current.map((group) => ({
      ...group,
      IsChecked: checked,
      SubList: group.SubList.map((item) => ({ ...item, IsChecked: checked })),
    })),
  )
}

function toggleMeasurementGroup(
  groups: ReportMeasurementGroup[],
  groupIndex: number,
  setter: (value: ReportMeasurementGroup[]) => void,
) {
  setter(groups.map((group, index) => {
    if (index !== groupIndex) {
      return group
    }

    const checked = !group.IsChecked

    return {
      ...group,
      IsChecked: checked,
      SubList: group.SubList.map((item) => ({ ...item, IsChecked: checked })),
    }
  }))
}

function toggleMeasurementItem(
  groups: ReportMeasurementGroup[],
  groupIndex: number,
  itemIndex: number,
  setter: (value: ReportMeasurementGroup[]) => void,
) {
  setter(groups.map((group, index) => {
    if (index !== groupIndex) {
      return group
    }

    const subList = group.SubList.map((item, subIndex) =>
      subIndex === itemIndex ? { ...item, IsChecked: !item.IsChecked } : item,
    )

    return {
      ...group,
      IsChecked: subList.every((item) => item.IsChecked),
      SubList: subList,
    }
  }))
}

// The searched lookups match on fields the option label never shows — a user's по батькові, e-mail or phone
// number, a client's ЄДРПОУ or code of region — and Mantine's default filter then drops those very rows because
// the typed text is not in the label, so a hit the server just found reads as «Нічого не знайдено». Everything
// the server returned is already the answer to the query; show it unfiltered. The static lists keep the default
// filter — there the whole catalogue is in the browser and the filtering is the search.
const keepServerLookupResults: OptionsFilter = ({ options }) => options

function getSelectionLookupMode(fieldType: number): 'manual' | 'search' | 'static' | 'dependent' {
  switch (fieldType) {
    case REPORT_FILTER_FIELD_TYPES.organization:
    case REPORT_FILTER_FIELD_TYPES.customer:
    case REPORT_FILTER_FIELD_TYPES.customerRegion:
    case REPORT_FILTER_FIELD_TYPES.customerRegionCode:
    case REPORT_FILTER_FIELD_TYPES.customerPriceType:
    case REPORT_FILTER_FIELD_TYPES.productTop:
    case REPORT_FILTER_FIELD_TYPES.saleReturnDocument:
      // «Повернення від клієнта» is fetched whole and filtered in the browser rather than searched on the
      // server: the list endpoint's `value` matches the client, the region code, the two users, the product
      // codes and the storage — everything except the document NUMBER, which is the only thing this picker
      // shows. Typing a number into that search returns nothing at all, so the typing has to filter here.
      return 'static'
    case REPORT_FILTER_FIELD_TYPES.customerContract:
      return 'dependent'
    case REPORT_FILTER_FIELD_TYPES.product:
    case REPORT_FILTER_FIELD_TYPES.productArticle:
    case REPORT_FILTER_FIELD_TYPES.productGroup:
    case REPORT_FILTER_FIELD_TYPES.customerName:
    case REPORT_FILTER_FIELD_TYPES.saleDocument:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentNumberDate:
    case REPORT_FILTER_FIELD_TYPES.supplier:
    case REPORT_FILTER_FIELD_TYPES.supplierContract:
    case REPORT_FILTER_FIELD_TYPES.purchaseDocument:
    case REPORT_FILTER_FIELD_TYPES.productMeasureUnit:
    case REPORT_FILTER_FIELD_TYPES.warehouse:
    case REPORT_FILTER_FIELD_TYPES.customerManager:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentManagerInput:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentManagerPosted:
      return 'search'
    default:
      return 'manual'
  }
}

function getSelectionLookupMinLength(fieldType: number): number {
  return fieldType === REPORT_FILTER_FIELD_TYPES.productGroup || fieldType === REPORT_FILTER_FIELD_TYPES.productMeasureUnit ? 0 : 2
}

function getDependentClientNetId(selections: ReportSelection[]): string {
  const customerNameSelection = selections.find(
    (selection) => selection.IsChecked && selection.SelectedField.Type === REPORT_FILTER_FIELD_TYPES.customerName,
  )

  const clientValue = customerNameSelection?.Values.find((value) => value.Data && value.Data.NetUid)

  return clientValue?.Data.NetUid ? String(clientValue.Data.NetUid) : ''
}

type SaleDocumentLookupFilters = {
  organisationIds: number[]
  status: string
  type: 'All' | 'Self'
}

async function loadSelectionLookupOptions(
  dataSource: number,
  fieldType: number,
  value: string,
  from: string,
  to: string,
  signal?: AbortSignal,
  saleDocumentFilters?: SaleDocumentLookupFilters,
  lookupSourceWorld?: number,
  lookupSalesBasis?: 0,
  lookupProvidedDiscountBasis?: 0,
): Promise<ReportEntity[]> {
  if (usesNativeReportLookup(dataSource)) {
    const params = { limit: LOOKUP_SEARCH_LIMIT, offset: 0, value }
    if (dataSource === 41 && [60, 61].includes(fieldType))
      return searchDatasetReportValues(dataSource, fieldType, params, signal, lookupSourceWorld)
    if (dataSource === 27 && lookupSalesBasis === 0)
      return searchDatasetReportValues(dataSource, fieldType, params, signal, undefined, 0)
    if (dataSource === 24 && lookupProvidedDiscountBasis === 0)
      return searchDatasetReportValues(dataSource, fieldType, params, signal, lookupSourceWorld, undefined, 0)
    return [23, 24, 25, 28].includes(dataSource)
      ? searchDatasetReportValues(dataSource, fieldType, params, signal, lookupSourceWorld)
      : searchDatasetReportValues(dataSource, fieldType, params, signal)
  }
  switch (fieldType) {
    case REPORT_FILTER_FIELD_TYPES.organization:
      return getReportOrganizations()
    case REPORT_FILTER_FIELD_TYPES.customer:
      return getReportClientTypes()
    case REPORT_FILTER_FIELD_TYPES.customerRegion:
      return getReportRegions()
    case REPORT_FILTER_FIELD_TYPES.customerRegionCode:
      return getReportRegionCodes()
    case REPORT_FILTER_FIELD_TYPES.customerPriceType:
      return getReportPricings()
    case REPORT_FILTER_FIELD_TYPES.productTop:
      return getReportProductTop()
    case REPORT_FILTER_FIELD_TYPES.productGroup:
      return getReportProductGroups(value)
    case REPORT_FILTER_FIELD_TYPES.product:
    case REPORT_FILTER_FIELD_TYPES.productArticle:
      return searchReportProducts({ limit: LOOKUP_SEARCH_LIMIT, offset: 0, value })
    case REPORT_FILTER_FIELD_TYPES.customerName:
      return searchReportClients({ limit: LOOKUP_SEARCH_LIMIT, offset: 0, value }, signal)
    case REPORT_FILTER_FIELD_TYPES.customerManager:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentManagerInput:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentManagerPosted:
      return searchReportUsers({ limit: LOOKUP_SEARCH_LIMIT, offset: 0, value })
    // The report filters on the return document a sale line is ATTRIBUTED to, and captions the grouping from the
    // same column, so «Повернення від клієнта» as a filter and as a dimension answer the same question — and the
    // document can be of any date, which is why the catalogue is asked for whole rather than for the period.
    case REPORT_FILTER_FIELD_TYPES.saleReturnDocument:
      return loadSaleReturnDocumentCatalogue()
    case REPORT_FILTER_FIELD_TYPES.supplier:
    case REPORT_FILTER_FIELD_TYPES.supplierContract:
    case REPORT_FILTER_FIELD_TYPES.purchaseDocument:
    case REPORT_FILTER_FIELD_TYPES.productMeasureUnit:
      return searchDatasetReportValues(dataSource, fieldType, { limit: LOOKUP_SEARCH_LIMIT, offset: 0, value }, signal)
    case REPORT_FILTER_FIELD_TYPES.saleDocument:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentNumberDate:
      return searchSalesReportDocuments({
        from,
        limit: LOOKUP_SEARCH_LIMIT,
        offset: 0,
        organisationIds: saleDocumentFilters?.organisationIds ?? [],
        status: saleDocumentFilters?.status ?? 'All',
        to,
        type: saleDocumentFilters?.type ?? 'All',
        value,
      })
    default:
      return []
  }
}

async function loadSaleReturnDocumentCatalogue(): Promise<ReportEntity[]> {
  let offset = 0
  let documents: ReportEntity[] = []

  while (offset < RETURN_DOCUMENT_CATALOGUE_MAX_ITEMS) {
    const page = await searchSaleReturnReportDocuments({
      from: REPORT_MIN_DATE,
      limit: RETURN_DOCUMENT_CATALOGUE_PAGE_SIZE,
      offset,
      to: `${new Date().getFullYear()}-12-31`,
      value: '',
    })

    if (!page.length) {
      break
    }

    const previousCount = documents.length
    documents = mergeReportEntities([...documents, ...page])

    // Also protects the picker from an older endpoint that ignores offset and repeats its first page.
    if (documents.length === previousCount || page.length < RETURN_DOCUMENT_CATALOGUE_PAGE_SIZE) {
      break
    }

    offset += page.length
  }

  return documents
}

function mergeReportEntities(entities: ReportEntity[]): ReportEntity[] {
  const seen = new Set<string>()
  const result: ReportEntity[] = []

  for (const entity of entities) {
    const key = getReportEntityKey(entity, getEntityDisplayName(entity))

    if (!seen.has(key)) {
      seen.add(key)
      result.push(entity)
    }
  }

  return result
}

function createSelectedValue(entity: ReportEntity, dataSource?: number): ReportSelectedValue {
  return {
    Data: entity,
    Name: getEntityDisplayName(entity),
    Value: (dataSource === 16 || dataSource === 17 || dataSource === 18 || dataSource === 20 || dataSource === 21 || dataSource === 23 || dataSource === 24 || dataSource === 25 || dataSource === 28 || dataSource === 39 || dataSource === 41) ? 0 : getReportEntityNumericValue(entity),
  }
}

function getReportEntityKey(entity: ReportEntity, fallback = ''): string {
  return [
    entity.NetUid,
    entity.Id,
    entity.Code,
    entity.Value,
    entity.Name,
    entity.FullName,
    fallback,
  ].filter((value) => value !== undefined && value !== null && value !== '').join(':')
}

function getReportEntityNumericValue(entity: ReportEntity): number {
  if (typeof entity.Value === 'number') {
    return entity.Value
  }

  if (typeof entity.Id === 'number') {
    return entity.Id
  }

  return 0
}

function getSelectionRenderKey(selection: ReportSelection, index: number): string {
  const values = selection.Values.map((value) => getReportEntityKey(value.Data, value.Name)).join('|')

  return [
    selection.SelectedField.ParentType,
    selection.SelectedField.Name,
    selection.SelectedField.Type,
    selection.FilterCondition.Type,
    values,
    index,
  ].filter((value) => value !== undefined && value !== null && value !== '').join(':')
}
