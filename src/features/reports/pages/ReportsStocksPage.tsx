import { CustomerGroupOrganizationPicker } from './CustomerGroupOrganizationPicker'
import { customerGroupOrganizationError, isCustomerGroupOrganization } from '../data/customerGroupOrganization'
import { appendBeforeDocumentDetail, DOCUMENT_DETAIL_GROUPING } from '../data/reportDocumentDetails'
import { ReportDocumentDetailsPanel } from './ReportDocumentDetailsPanel'
import { searchNativeSalesDocuments, usesSalesDocumentLookup, salesDocumentSelectedEntity, salesDocumentKey } from '../api/nativeSalesDocumentLookup'
import { NativePriceComparisonPanel } from './NativePriceComparisonPanel'
import { nativePriceComparisonError, type NativePriceComparison } from '../data/nativePriceComparison'
import { CustomerGroupsPanel } from './CustomerGroupsPanel'
import { customerGroupsError, type CustomerGroups } from '../data/customerGroups'
import { ConstructorPresentationPanel } from './ConstructorPresentationPanel'
import { requestConstructorPresentation } from '../data/constructorPresentation'
import { readReportProfile, requestReportProfile, salesConstructorDataset, salesConstructorTitle, salesConstructorWorkbook } from '../data/salesConstructorProfiles'
import { searchCurrentFinancialBuyerManagers } from '../api/currentFinancialBuyerManagerLookup'
import { financialBuyerManagerReference, financialBuyerManagerEntityReference, financialBuyerManagerSelectedEntity, financialBuyerManagerLookupPolicy } from '../data/currentFinancialBuyerManagerFilter'
import { searchCurrentFinancialDocuments } from '../api/currentFinancialDocumentLookup'
import { financialDocumentReference, financialDocumentEntityReference, financialDocumentSelectedEntity, financialDocumentKey, financialDocumentLookupPolicy } from '../data/currentFinancialDocumentFilter'
import { ReportPresentationCurrencyPanel } from './ReportPresentationCurrencyPanel'
import { requestPresentationCurrency, readPresentationCurrency, presentationCurrencySupported, presentationCurrencyModeSupported, isPresentationCurrencyMoneyMeasure, currencyNeutralMeasureLabel } from '../data/reportPresentationCurrency'
import { PublishedReportWorkspace } from './lazyReportDialogs'
import { financialAxesCapability, financialAxesConfigurationError } from '../data/financialAxes'
import { ReportsNavigation } from './workbook-desk/ReportsNavigation'
import { ReportsSubmenu } from './workbook-desk/ReportsSubmenu'
import type { PublishedReportTab } from './workbook-desk/publishedReportTabs'
import { ReportValueAutocomplete } from './ReportValueAutocomplete'
import { WorkbookSectionActions } from './workbook-desk/WorkbookSectionActions'
import type { ReportFilterCondition } from '../types'
import { currentVparivanieAnalysisCapability, requestCurrentVparivanieAnalysis, upgradeCurrentVparivanieAnalysis, analysisFilterConditions, analysisSelectionValueError, changeAnalysisSelectionCondition, changeAnalysisSelectionValues, analysisConditionUnavailableReason, analysisHierarchy, analysisHierarchyUnavailableReason, type AnalysisFieldDescriptor, type AnalysisHierarchyStatus } from '../data/currentVparivanieAnalysis'
import { useAnalysisHierarchyStatus } from '../hooks/useAnalysisHierarchyStatus'
import { datasetGroupConditionTypes, datasetGroupSelectionError, datasetHierarchyDescriptor, isDatasetGroupSelection, withDatasetGroupConditions } from '../data/reportHierarchyFilters'
import type { AnalysisItemSearch } from './CurrentVparivanieAnalysisValuePicker'
import { ReportFieldPicker } from './ReportFieldPicker'
import { CurrentVparivanieAnalysisValuePicker } from './CurrentVparivanieAnalysisValuePicker'
import { CurrentVparivanieMovementSettings } from './CurrentVparivanieMovementSettings'
import { vparivanieSelectionDataset, vparivanieSelectionRequest } from '../data/vparivanieWorkbookSelection'
import { EMPTY_MOVEMENT_SELECTION, movementSelection, type CurrentVparivanieMovementSelection } from '../data/currentVparivanieMovements'
import { ReportPreviewPages } from './ReportPreviewPages'
import { exportStockReportPreview } from '../api/reportsApi'
import { ReportNumberPresentationPanel } from './ReportNumberPresentationPanel'
import { financialFilterConditionTypes } from '../data/currentFinancialFilterConditions'
import { requestNumberPresentation, readNumberPresentation, readValueSemantics, reportValueUnit } from '../data/reportNumberPresentation'
import { effectiveReportConfiguration, reportAxesPolicy, reportMaximumDate } from '../data/reportConfiguration'
import { BUG_1274_ACTIVE_DATA_SOURCES, BUG_1274_DISABLED_MESSAGE } from '../data/reportMigration'
import { BUG_1274_ONLY_REPORT_SURFACE } from '../reportSurfacePolicy'
import { lacksCurrentReadMode, TEMPLATE_WITHOUT_READ_MODE_ERROR } from '../data/currentReadModePolicy'
import { withoutProductClassification, withUnifiedSource } from '../data/unifiedReportSource'
import { useWorkbookPresentation } from '../hooks/useWorkbookPresentation'
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
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { FINANCIAL_EXPORT_LAYOUT_OPTIONS, financialExportLayoutQuery, financialExportLayoutText, isFinancialExportLayout,
  type FinancialExportLayout } from '../data/financialExportLayout'
import { useDebouncedValue } from '@mantine/hooks'
import { CheckboxMultiSelect } from '../../../shared/ui/CheckboxMultiSelect'
import { CheckCheck, CircleAlert, LayoutTemplate, MonitorPlay, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { IconFileSpreadsheet } from '@tabler/icons-react'
import { TableChip } from '../../../shared/ui/TableChip'
import { TableRowAction } from '../../../shared/ui/table-row-action/TableRowAction'
import { requestProfitReadMode } from '../data/profitReadMode'
import { isSettlementReadModeCapability, requestSettlementReadMode } from '../data/settlementReadMode'
import { requestCashReadMode } from '../data/cashReadMode'
import { Suspense, type FormEvent, type ReactNode, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import type { TranslateFunction } from '../../../shared/i18n/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import '../../../shared/ui/selection-surface.css'
import { AppModalFooter } from '../../../shared/ui/AppModal'
import { ReportModal } from './ReportModal'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR, PageSubmenuActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
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
  reportSelectionCardinalityError,
  REPORT_FILTER_FIELD_TYPES,
  createDefaultMeasurementGroups,
  flattenCheckedMeasurements,
  getReportFieldLabel,
  grossProfitMeasureGroupLabel,
  measurementGroupCaption,
} from '../data/reportOptions'
import type {
  OneCTurnoverFilters,
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
import { datasetConfigurationError, datasetFilters, datasetGroupings, datasetMeasurements, datasetPresetRequest, datasetPresets, defaultDatasetRequest, withDefaultReadModes, type DatasetReportPresetId } from '../data/reportDatasets'
import { useReportDatasets } from '../hooks/useReportDatasets'
import { usesNativeReportLookup, supportsFullReportDateRange, hasFixedReportAxes, nativeReportMeasurementUnit } from '../data/nativeReportProfiles'
import { CURRENT_VPARIVANIE_NOTICE, currentVparivanieConfigurationError, currentVparivanieFilterConditions, currentVparivanieNotice, currentVparivanieFullScope, withCurrentVparivanieMovementScope } from '../data/currentVparivanie'
import { previousKyivDay } from '../data/cashPeriod'
import { availableBug1274WorkbookLaunches, bug1274WorkbookRequest, opensOnPreviousDay, type WorkbookLaunch } from '../data/bug1274WorkbookLaunch'
import { workbookDisplayFileName, bug1274WorkbookGuide, bug1274WorkbookPeriod, reportPeriodPresets, type ReportPeriodPreset } from '../data/bug1274WorkbookGuide'
import { supportedAnalysisRules } from '../data/supportedAnalysisRules'
import { reportFileBaseName } from '../data/reportFileName'
import { Bug1274WorkbookShortcuts } from './Bug1274WorkbookShortcuts'
import { resolveBug1274WorkbookFilters, resolvesWorkbookFilters, workbookFiltersNotice, type ResolvedWorkbookFilters } from '../data/bug1274WorkbookFilters'
import { CashSettlementSettingsPanels } from './CashSettlementSettingsPanels'
import { cashFormDataset, requestGroupedCashPeriod } from '../data/groupedCashPeriod'
import { defaultGroupedSettlementBuyer, defaultGroupedSettlementPeriod, groupedSettlementPeriod as parseGroupedSettlementPeriod, requestGroupedSettlementPeriod, settlementFormDataset, settlementAxesDescription, settlementMaximumDate, settlementModePatch, SINGLE_SETTLEMENT_AXES } from '../data/groupedSettlementPeriod'
import { requestSourceCounterpartyGroups } from '../data/sourceCounterpartyGroups'
import { requiresValuationAgreement } from '../data/reportValuation'
import { useValuationAgreement } from '../hooks/useValuationAgreement'
import { useAppliedReportSettings } from '../hooks/useAppliedReportSettings'
import { useReportRunState } from '../hooks/useReportRunState'
import { useReportWorkspaceDraft } from '../hooks/useReportWorkspaceDraft'
import type { ReportWorkspaceSnapshot } from '../data/reportWorkspaceDraft'
import { reportWorkspaceDraftCompatibility } from '../data/reportWorkspaceDraftCompatibility'
import { ReportDraftRecoveryPanel, ReportDraftStatus } from './ReportDraftRecoveryPanel'
import { ReportDraftControl } from './ReportDraftControl'
import { ValuationAgreementPicker } from './ValuationAgreementPicker'
import { ReportDatasetPicker, ReportDatasetSummary } from './ReportDatasetPicker'
import { ReportMeasureTree } from './ReportMeasureTree'
import { reportGroupingPath } from '../data/reportConstructorTree'
import { ReportConstructorHeader, ReportConstructorNavigation, ReportConstructorResultEmpty, ReportSectionPanel, type ReportConstructorSection } from './ReportConstructorNavigation'
import { ReportQuickPresets } from './ReportQuickPresets'
import { ReportGroupingPanel } from './ReportGroupingPanel'
import { reorderReportGrouping, transferReportGrouping, type ReportGroupingAxis } from '../data/reportGroupingLayout'

import { useServerReportTemplates, type TemplateMutationResult } from '../hooks/useServerReportTemplates'
import { ReportTemplatesPanel } from './ReportTemplatesPanel'
import { retainStoredGroupingLabels, retainStoredMeasurementLabels, retainStoredTemplateFields } from '../data/reportTemplateDraft'

import { ReportOrderingPanel } from './ReportOrderingPanel'
import { requestOrdering } from '../data/reportOrdering'
import { requestFilterExpression } from '../data/reportFilterExpression'
import { CLIENT_COMPARISON_MAX_DATE, CLIENT_COMPARISON_MIN_DATE, comparisonWindow, isComparisonDate, requestComparison } from '../data/clientPeriodComparison'
import { ClientComparisonPeriodPanel } from './ClientComparisonPeriodPanel'
import { buildReportBuilderRequest } from '../data/reportBuilderRequest'
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
import { DayProfitControls, SupplierProfitControls, type ProfitControlsPart } from './ProfitWorkbookControls'
import { deskPlural, organizationFilterField, workbookDeskTitle, workbookOrganizationScope, workbookRequestSummary } from '../data/workbookDesk'
import { WorkbookSwitcher } from './workbook-desk/WorkbookSwitcher'
import { WorkbookHeader } from './workbook-desk/WorkbookHeader'
import { WorkbookActionBar } from './workbook-desk/WorkbookActionBar'
import { WorkbookPeriodField, WorkbookSettings, type WorkbookSettingsSection } from './workbook-desk/WorkbookSettings'
import { WorkbookResult } from './workbook-desk/WorkbookResult'
import './workbook-desk/workbook-desk.css'
import { requestDayOrganizationBasis } from '../data/dayOrganizationBasis'
import { supplierWarehouseAfterRowEdit, requestSupplierBasis, supplierBasisFormDataset } from '../data/supplierBasis'
import { productClassificationReviewError, requestProductClassification, requestProductServiceFilter, requestSourceOrganizations, requestSourceBuyerSubtree } from '../data/nativeExactFilters'
import { isSupplierSourceWorldCapability } from '../data/supplierBatchGrossProfit'
import PriceTypeSalesComparisonPanel from './PriceTypeSalesComparisonPanel'
import AgreementPriceComparisonPanel from './AgreementPriceComparisonPanel'
import { defaultAgreementPriceComparison, requestAgreementPriceComparison } from '../data/agreementPriceComparison'
import { currentProvidedDiscountLookupBasis, oneCSpecialSpecification, requestOneCSpecialSettings } from '../data/oneCSpecialReports'
import {
  clonePriceTypeSalesComparisonValue,
  priceTypeSalesFormDataset,
  currentPriceTypeSalesLookupBasis,
  PRICE_TYPE_SALES_COMPARISON_SOURCE,
} from '../data/priceTypeSalesComparison'
const LOOKUP_SEARCH_DEBOUNCE_MS = 400
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
  fileName: string
  from: string
  hasDocument: boolean
  previewNeedsExport: boolean
  measures: string[]
  name: string
  title: string
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
    || BUG_1274_ONLY_REPORT_SURFACE && dataSource === 35
}

function reportLookupSourceWorld(dataSource: number, groupedSettlement: unknown, specialSettings: unknown): 1 | 2 | undefined {
  if (dataSource === 41) {
    const world = parseGroupedSettlementPeriod(groupedSettlement)?.SourceWorld
    return world === 'Fenix' ? 1 : world === 'Amg' ? 2 : undefined
  }
  return typeof specialSettings === 'object' && specialSettings !== null && 'SourceWorld' in specialSettings
    && (specialSettings.SourceWorld === 1 || specialSettings.SourceWorld === 2) ? specialSettings.SourceWorld : undefined
}

export function ReportsStocksPage({ constructorMode = false, consoleScope = true }: { constructorMode?: boolean; consoleScope?: boolean }) {
  const { user, session } = useAuth()
  const ownerId = user?.NetUid ?? session?.userNetUid ?? null
  return <ReportsStocksWorkspace key={ownerId ?? 'anonymous'} ownerId={ownerId} constructorMode={constructorMode} consoleScope={consoleScope} />
}

function ReportsStocksWorkspace({ ownerId, constructorMode, consoleScope }: { ownerId: string | null; constructorMode: boolean; consoleScope: boolean }) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const canGenerateReport = hasPermission(
    PermissionKeys.ReportsStocks.Report.Generate,
  )
  const today = useMemo(() => formatKyivBusinessDate(), [])
  const [settingsRevision, setSettingsRevision] = useState(0)
  const [from, setFrom] = useValueState(today)
  const [to, setTo] = useValueState(today)
  const [previousPeriod, setPreviousPeriod] = useValueState({ from: today, to: today })
  const datasetStorage = useReportDatasets(canGenerateReport)
  const [dataSource, setDataSource] = useValueState(0)
  const [movementQuantities, setMovementQuantities] = useValueState<CurrentVparivanieMovementSelection>(EMPTY_MOVEMENT_SELECTION)
  const [fullCurrentVparivanie, setFullCurrentVparivanie] = useValueState(false)
  const [exportLayout, setExportLayout] = useState<FinancialExportLayout>('auto')
  function changeMovementQuantities(value: CurrentVparivanieMovementSelection) {
    setMovementQuantities(value)
    if (value.Incoming || value.Outgoing) setFullCurrentVparivanie(true)
  }

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
  const [productServiceFilter, setProductServiceFilter] = useValueState<unknown>(undefined)
  const [sourceOrganizations, setSourceOrganizations] = useValueState<unknown>(undefined)
  const [sourceBuyerSubtree, setSourceBuyerSubtree] = useValueState<unknown>(undefined)
  const [profitReadMode, setProfitReadMode] = useValueState<unknown>(undefined)
  const [dayOrganizationBasis, setDayOrganizationBasis] = useValueState<unknown>(undefined)
  const [supplierWarehouse, setSupplierWarehouse] = useValueState<unknown>(undefined)
  const [presentationCurrency, setPresentationCurrency] = useValueState<unknown>(undefined)
  const [constructorPresentation, setConstructorPresentation] = useValueState<unknown>(undefined)
  const [reportProfile, setReportProfile] = useValueState<unknown>(undefined)
  const [numberPresentation, setNumberPresentation] = useValueState<unknown>(undefined)
  const [supplierBasis, setSupplierBasis] = useValueState<unknown>(undefined)
  const [nativePriceComparison, setNativePriceComparison] = useValueState<NativePriceComparison | undefined>(undefined)
  const [customerGroups, setCustomerGroups] = useValueState<CustomerGroups | undefined>(undefined)
  const [returnsOnly, setReturnsOnly] = useValueState<boolean | undefined>(undefined)
  const [priceTypeSalesComparison, setPriceTypeSalesComparison] = useValueState<unknown>(undefined)
  const [agreementPriceComparison, setAgreementPriceComparison] = useValueState<unknown>(undefined)
  const [settlementPeriod, setSettlementPeriod] = useValueState<unknown>(undefined)
  const [groupedSettlementPeriod, setGroupedSettlementPeriod] = useValueState<unknown>(undefined)
  const [settlementReadMode, setSettlementReadMode] = useValueState<unknown>(undefined)
  const [sourceCounterpartyGroups, setSourceCounterpartyGroups] = useValueState<unknown>(undefined)
  const [groupedCashPeriod, setGroupedCashPeriod] = useValueState<unknown>(undefined)
  const [cashReadMode, setCashReadMode] = useValueState<unknown>(undefined)
  const [cashPeriod, setCashPeriod] = useValueState<unknown>(undefined)
  const [oneCSpecialSettings, setOneCSpecialSettings] = useValueState<unknown>(undefined)
  const [oneCScope, setOneCScope] = useValueState<OneCTurnoverFilters | undefined>(undefined)
  const [publishedTab, setPublishedTab] = useState<PublishedReportTab | null>(null)
  const [visitedPublished, setVisitedPublished] = useState<PublishedReportTab[]>([])
  const [publishedBusy, setPublishedBusy] = useState(false)
  const [valuationClientAgreementId, setValuationAgreementId] = useValueState<number | undefined>(undefined)
  const valuation = useValuationAgreement(valuationClientAgreementId, canGenerateReport && requiresValuationAgreement(dataSource))
  const [activeTemplate, setActiveTemplate] = useState<ReportTemplate | null>(null)
  const [restoredData, setRestoredData] = useState<ReportRequestBody | null>(null)
  const retainedData = restoredData ?? activeTemplate?.Data
  const dataset = datasetStorage.datasets.find(item => item.DataSource === dataSource)
  const periodSupported = dataset?.PeriodSupported !== false
  const bug1274Only = consoleScope && BUG_1274_ONLY_REPORT_SURFACE
  const datasetHidden = bug1274Only && !BUG_1274_ACTIVE_DATA_SOURCES.has(dataSource)
  const [selectedMeasurements, setMeasurements] = useValueState<ReportMeasurementGroup[]>(createDefaultMeasurementGroups)
  const priceTypeDataset = useMemo(() => priceTypeSalesFormDataset(dataset, priceTypeSalesComparison), [dataset, priceTypeSalesComparison])
  const supplierDataset = useMemo(() => supplierBasisFormDataset(priceTypeDataset, supplierBasis), [priceTypeDataset, supplierBasis])
  const measurements = useMemo(() => retainStoredMeasurementLabels(retainedData, { dataSource, supplierBasis },
    datasetMeasurements(salesConstructorDataset(supplierDataset, reportProfile), flattenCheckedMeasurements(selectedMeasurements))),
  [dataSource, retainedData, reportProfile, selectedMeasurements, supplierBasis, supplierDataset])
  const presets = useMemo(() => datasetHidden || bug1274Only ? [] : datasetPresets(dataset), [bug1274Only, dataset, datasetHidden])
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
  const [draftRestoreError, setDraftRestoreError] = useState<string | null>(null)
  const [templateNotice, setTemplateNotice] = useValueState<string | null>(null)
  const [catalogueNotice, setCatalogueNotice] = useState<{ text: string; failed: boolean; title?: string; warning?: string } | null>(null)
  const [activeWorkbook, setActiveWorkbook] = useState<string | null>(null)
  const [workbookResolving, setWorkbookResolving] = useState(false)
  const [initialWorkbook, setInitialWorkbook] = useState<'pending' | 'opening' | 'settled'>('pending')
  if (initialWorkbook === 'opening' && !workbookResolving) setInitialWorkbook('settled')
  const workbookLaunches = useMemo(() => availableBug1274WorkbookLaunches(datasetStorage.datasets), [datasetStorage.datasets])
  const initialWorkbookLaunch = initialWorkbook === 'pending' && bug1274Only && canGenerateReport && datasetHidden && !activeWorkbook
    && datasetStorage.loaded && !datasetStorage.error ? workbookLaunches[0] ?? null : null
  const [deskTemplatesOpened, setDeskTemplatesOpened] = useState(false)
  const [templateIntent, setTemplateIntent] = useState({ create: false, revision: 0 })
  function openDeskTemplates(create: boolean) {
    setTemplateNotice(null); templateStorage.clearNotice()
    setTemplateIntent(current => ({ create, revision: current.revision + 1 })); setDeskTemplatesOpened(true)
  }
  const [shownReport, setShownReport] = useState<string | null>(null)
  const workbookLaunchToken = useRef(0)
  const groupingOptions = useMemo(() => datasetGroupings(priceTypeDataset, { dataSource, profitReadMode, dayOrganizationBasis, reportProfile }).filter(field => field.type !== ABC_CLASS_GROUPING || abcClassification != null), [abcClassification, priceTypeDataset, dataSource, profitReadMode, dayOrganizationBasis, reportProfile])
  const workbook = useWorkbookPresentation({ dataSource, groupingOptions, setRowGroups, setGroupedCashPeriod })
  const groupingSelectData = useMemo(
    () =>
      groupingOptions.map((item) => ({
        assignedTo: [
          ...(rowGroups.some((group) => group.type === item.type) ? ['rows' as const] : []),
          ...(colGroups.some((group) => group.type === item.type) ? ['columns' as const] : []),
        ],
        label: item.label,
        path: currentVparivanieAnalysisCapability(priceTypeDataset)?.groupings.find(f => f.type === item.type)?.path ?? reportGroupingPath(item.type),
        value: String(item.type),
      }) satisfies GroupingOption),
    [colGroups, groupingOptions, rowGroups, priceTypeDataset],
  )
  const settlementDataset = useMemo(() => settlementFormDataset(priceTypeDataset, groupedSettlementPeriod, settlementReadMode), [priceTypeDataset, groupedSettlementPeriod, settlementReadMode])
  const cashDataset = useMemo(() => cashFormDataset(settlementDataset, groupedCashPeriod), [settlementDataset, groupedCashPeriod])
  const reportBody = useMemo<ReportRequestBody>(
    () => upgradeCurrentVparivanieAnalysis(withCurrentVparivanieMovementScope({ ...(dataSource === 46 ? {nativePriceComparison} : {}), ...(dataSource === 44 ? {customerGroups} : {}), ...(currentVparivanieAnalysisCapability(dataset) ? { currentVparivanieAnalysis: { version: 1 } } : {}), ...buildReportBuilderRequest({ constructorPresentation, reportProfile, supplierWarehouse, presentationCurrency, numberPresentation, dataSource, returnsOnly, comparison, xyz, revenueComparison, buyerSalesShare, returnComparison, paymentComparison, marginComparison, rateComparison, productClassification, productServiceFilter, sourceOrganizations, sourceBuyerSubtree, profitReadMode, dayOrganizationBasis, supplierBasis, priceTypeSalesComparison, agreementPriceComparison, settlementPeriod, groupedSettlementPeriod, settlementReadMode, sourceCounterpartyGroups, cashPeriod, groupedCashPeriod, cashReadMode, workbookPresentation: workbook.value, oneCSpecialSettings, oneC: oneCScope, from, to, ordering, filterExpression, topGroups, threshold, hideZero, abcClassification, valuationClientAgreementId, rowGroups, colGroups, measurements, selections }), ...(dataSource === 39 && (movementQuantities.Incoming || movementQuantities.Outgoing) ? { currentVparivanieMovements: movementQuantities } : {}), ...(dataSource === 39 && fullCurrentVparivanie ? { currentVparivanieFullScope: true } : {}) }), dataset),
    [dataset, nativePriceComparison, constructorPresentation, customerGroups, reportProfile, supplierWarehouse, presentationCurrency, numberPresentation, movementQuantities, fullCurrentVparivanie, abcClassification, agreementPriceComparison, settlementPeriod, groupedSettlementPeriod, settlementReadMode, sourceCounterpartyGroups, cashPeriod, groupedCashPeriod, cashReadMode, workbook.value, colGroups, comparison, xyz, revenueComparison, buyerSalesShare, returnComparison, paymentComparison, marginComparison, rateComparison, productClassification, productServiceFilter, sourceOrganizations, sourceBuyerSubtree, profitReadMode, dayOrganizationBasis, supplierBasis, returnsOnly, priceTypeSalesComparison, oneCSpecialSettings, oneCScope, dataSource, filterExpression, from, hideZero, measurements, ordering, rowGroups, selections, to, topGroups, threshold, valuationClientAgreementId],
  )
  const effectiveConfiguration = effectiveReportConfiguration(dataset, reportBody)
  const effectiveFilterTypes = effectiveConfiguration?.filters
  const filterFieldOptions = useMemo(() => {
    const allowed = effectiveFilterTypes ? new Set(effectiveFilterTypes) : null
    return datasetFilters(salesConstructorDataset(cashDataset, reportProfile), reportBody).filter(option => !allowed || allowed.has(option.field.Type))
  }, [cashDataset, effectiveFilterTypes, reportBody, reportProfile])
  const maxDate = reportMaximumDate(effectiveConfiguration, today) ?? settlementMaximumDate(dataSource, groupedSettlementPeriod, today, cashReadMode)
    ?? (supportsFullReportDateRange(dataSource) ? CLIENT_COMPARISON_MAX_DATE : `${today.slice(0, 4)}-12-31`)
  const [debouncedFrom] = useDebouncedValue(from, DATE_INPUT_DEBOUNCE_MS)
  const [debouncedTo] = useDebouncedValue(to, DATE_INPUT_DEBOUNCE_MS)
  const periodError = supportsFullReportDateRange(dataSource) ? (!isComparisonDate(from) || !isComparisonDate(to) || from > to ? 'Оберіть коректний період у межах 1900–9998 років.' : null)
    : periodSupported ? getPeriodError(from, to, maxDate, t) : null
  // The value lookups re-query on every keystroke in the date fields, half-typed years included. They follow the
  // period on a pause, and only once it is a period the server can answer for.
  const hasLookupPeriod = !getPeriodError(debouncedFrom, debouncedTo, maxDate, t)
  const agreementVerified = !requiresValuationAgreement(dataSource) || valuation.agreement?.Id === valuationClientAgreementId
  const templateBody = useMemo(() => retainedData
    ? retainStoredTemplateFields(retainedData, { ...reportBody, selections })
    : { ...reportBody, selections }, [retainedData, reportBody, selections])
  const draftSnapshot = useMemo<ReportWorkspaceSnapshot>(() => ({
    name: templateName, data: templateBody, measurements: selectedMeasurements, activeTemplate, previousPeriod,
  }), [activeTemplate, previousPeriod, selectedMeasurements, templateBody, templateName])
  const settingsScope = `${dataSource}|${activeWorkbook ?? ''}|${settingsRevision}`
  const appliedSettings = useAppliedReportSettings(settingsScope, draftSnapshot, reportBody)
  const resultRequest = bug1274Only ? appliedSettings.appliedRequest ?? reportBody : reportBody
  const runRequestKey = useMemo(() => JSON.stringify({ request: bug1274Only ? settingsScope : reportBody, allowed: canGenerateReport, agreementVerified }),
    [agreementVerified, canGenerateReport, reportBody, bug1274Only, settingsScope])
  const { result, preview, lastRun, error, isLoading, downloadModalOpened, update: updateRun, begin: beginRun, clear: clearRun } = useReportRunState<ReportRunOutcome>(runRequestKey)
  const comparisonSettingsDisabled = isLoading || workbookResolving || !canGenerateReport
  const workspaceDraft = useReportWorkspaceDraft({ ownerId, enabled: canGenerateReport,
    ready: datasetStorage.loaded && !datasetStorage.error && !initialWorkbookLaunch && initialWorkbook !== 'opening',
    snapshot: draftSnapshot, backgroundRecovery: bug1274Only })
  const configurationError = (dataSource === 46 ? nativePriceComparisonError(nativePriceComparison) : null) ?? (dataSource === 44 ? customerGroupsError(customerGroups) : null) ?? (consoleScope && !BUG_1274_ACTIVE_DATA_SOURCES.has(dataSource) ? BUG_1274_DISABLED_MESSAGE : null) ?? datasetStorage.error ?? (!datasetStorage.loaded ? t('Завантаження наборів даних…') : datasetConfigurationError(templateBody, dataset, 'workspace'))
    ?? (requiresValuationAgreement(dataSource) && valuation.agreement?.Id !== valuationClientAgreementId ? 'Підтвердіть доступний договір оцінки.' : null)
  const checkedMeasurements = reportBody.sorted.Measurements.length
  // The report engine lays the sheet out from the row groupings; without one it fails deep
  // inside the spreadsheet writer («Column out of range»), so the form has to require it.
  const missingRowGrouping = rowGroups.length === 0
  // A row whose field is chosen but whose value list is still empty is not «no filter»: the engine compares the
  // column against nothing, so «Дорівнює» empties the report and «Не дорівнює» drops the filter altogether. The
  // sheet that comes back looks plausible either way, so the row has to be finished before the request goes out.
  const incompleteSelectionIndex = selections.findIndex(selection => isIncompleteSelection(selection)
    || bug1274Only && selection.IsChecked !== false && !selection.SelectedField.Name)
  const incompleteSelectionMessage =
    incompleteSelectionIndex < 0
      ? ''
      : t('Умова відбору {position} ({field}): додайте значення або зніміть галочку', {
          field: getReportFieldLabel(selections[incompleteSelectionIndex].SelectedField.Name),
          position: incompleteSelectionIndex + 1,
        })
  const currentMatrixError = currentVparivanieConfigurationError(reportBody, dataset)
  const receiptWarehouseCardinalityError = dataSource === 3
    ? selections.filter(selection => selection.IsChecked !== false
      && selection.SelectedField.Type === REPORT_FILTER_FIELD_TYPES.warehouse)
      .map(reportSelectionCardinalityError).find(Boolean) ?? null
    : null
  const organizationConfigurationError = customerGroupOrganizationError(dataSource, selections)
  const templateConfigurationError = configurationError ?? organizationConfigurationError
  const generationConfigurationError = configurationError ?? currentMatrixError ?? receiptWarehouseCardinalityError
    ?? organizationConfigurationError
  const reportIsReady = !generationConfigurationError && !periodError && !incompleteSelectionMessage && checkedMeasurements > 0 && !missingRowGrouping
  const canSubmit = canGenerateReport && reportIsReady
  const submitBlockedReason = !canGenerateReport
    ? t('Немає права формувати звіт залишків')
    : generationConfigurationError
      ? generationConfigurationError
      : periodError
      ? periodError
      : checkedMeasurements === 0
        ? t('Виберіть хоча б один показник')
        : missingRowGrouping
          ? t('Додайте хоча б одне групування рядків')
          : incompleteSelectionMessage
  const emptyRunNotice =
    lastRun && !lastRun.hasDocument && !preview
      ? lastRun.rateComparison ? 'Сервер не повернув файл історичних курсів. Перевірте обрану серію.' : !lastRun.periodSupported ? t(dataSource === 11 ? 'Сервер не повернув файл записаних залишків рахунків. Спробуйте послабити умови відбору.' : dataSource === 10 ? 'Сервер не повернув файл поточної заборгованості. Спробуйте послабити умови відбору.' : 'Сервер не повернув файл поточних залишків. Спробуйте послабити умови відбору.')
      : t('За період {from} – {to} сервер не повернув файл звіту. Спробуйте інший період або послабте умови відбору.', {
          from: formatDate(lastRun.from),
          to: formatDate(lastRun.to),
        })
      : null
  const resultPlaceholder = describeResultPlaceholder(lastRun, Boolean(error), t)

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runReport(bug1274Only)
  }

  async function runReport(showPreview: boolean) {
    const exportingApplied = bug1274Only && !showPreview && !!appliedSettings.appliedRequest && !!lastRun
    if (!canGenerateReport || (!exportingApplied && !reportIsReady) || isLoading) {
      return
    }

    const request = exportingApplied ? resultRequest : bug1274Only ? appliedSettings.apply() : reportBody
    const selectedCurrency = requestPresentationCurrency(request) != null
    const existingPreview = !showPreview && (exportingApplied || !selectedCurrency && !preview?.Request?.presentationCurrency) ? preview : null
    const updateAttempt = beginRun()
    if (constructorMode) setConstructorSection('result')

    try {
      const previewResult = showPreview || selectedCurrency && !existingPreview?.ResultSession ? await previewStockReport(request, dataset) : null
      if (selectedCurrency && previewResult && !previewResult.preview.ResultSession) throw new Error('Сервер не підтвердив збережений результат для вибраної валюти. Файл не сформовано.')
      const layout = financialAxesCapability(dataset) && request.sorted.Col.length > 0 ? financialExportLayoutQuery(exportLayout) : undefined
      const exportPreview = (session: NonNullable<NativeReportPreview['ResultSession']>) => layout ? exportStockReportPreview(session, layout) : exportStockReportPreview(session)
      const nextResult = !showPreview && previewResult?.preview.ResultSession ? await exportPreview(previewResult.preview.ResultSession) : previewResult?.result ?? (existingPreview?.ResultSession ? await exportPreview(existingPreview.ResultSession) : await createStockReport(request, dataset))
      const outcome: ReportRunOutcome = exportingApplied ? { ...lastRun!,
        hasDocument: Boolean(nextResult.document.DocumentURL || nextResult.document.PdfDocumentURL), previewNeedsExport: false } : {
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
        previewNeedsExport: Boolean(showPreview && previewResult?.preview.ResultSession),
        measures: selectedCurrency && previewResult?.preview.Request?.Measures ? previewResult.preview.Request.Measures
          : reportBody.sorted.Measurements.map((measurement) => measurement.Label || getReportFieldLabel(measurement.Name)),
        name: templateName.trim(),
        fileName: reportFileBaseName(activeWorkbook ?? dataset?.Name ?? '', from, to, periodSupported),
        title: activeWorkbook && bug1274WorkbookGuide(activeWorkbook)
          ? `${workbookDisplayFileName(activeWorkbook)} — ${t(bug1274WorkbookGuide(activeWorkbook)!.title)}` : dataset?.Name ?? '',
        rowGroupings: rowGroups.map((group) => group.label || getReportFieldLabel(group.key)),
        to,
      }

      updateAttempt({ result: nextResult, preview: previewResult?.preview ?? existingPreview ?? null, lastRun: outcome,
        downloadModalOpened: !showPreview && outcome.hasDocument })
      if (previewResult) setShownReport(`${activeWorkbook ?? ''}|${dataSource}`)
    } catch (submitError) {
      updateAttempt({ result: existingPreview?.ResultSession ? result : null,
        ...(existingPreview?.ResultSession ? { preview: existingPreview, lastRun } : {}),
        error: describeReportError(submitError, t) })
    } finally {
      updateAttempt({ isLoading: false })
    }
  }

  function changeSettlementMode(mode: 'buyers' | 'agreement') {
    const patch = settlementModePatch(mode, groupingOptions)
    setGroupedSettlementPeriod(patch.grouped)
    setSettlementReadMode(mode === 'buyers' && isSettlementReadModeCapability(dataset?.settlementReadMode) ? 0 : undefined)
    setSourceCounterpartyGroups(undefined)
    setSettlementPeriod(undefined)
    setSourceBuyerSubtree(patch.buyer)
    setRowGroups(patch.rows)
    filterLogic.load([])
  }

  function resetReport() {
    setSettingsRevision(value => value + 1)
    const workbookLaunch = activeWorkbook ? workbookLaunches.find(item => item.fileName === activeWorkbook) : undefined
    if (workbookLaunch && openWorkbook(workbookLaunch)) return
    setActiveWorkbook(null)
    setFullCurrentVparivanie(false)
    setMovementQuantities(EMPTY_MOVEMENT_SELECTION)
    setConstructorSection('structure')
    setCatalogueNotice(null)
    workspaceDraft.rememberBeforeReplace()
    setRestoredData(null)
    setDraftRestoreError(null)
    setActiveTemplate(null)
    const resetDay = opensOnPreviousDay(dataSource) ? previousKyivDay(today) : today
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
    setProductServiceFilter(undefined)
    setSourceOrganizations(undefined)
    setSourceBuyerSubtree(snapshotDefaults?.sourceBuyerSubtree)
    setProfitReadMode(snapshotDefaults?.profitReadMode)
    setDayOrganizationBasis(snapshotDefaults?.dayOrganizationBasis)
    setSupplierWarehouse(snapshotDefaults?.supplierWarehouse)
    setPresentationCurrency(snapshotDefaults ? requestPresentationCurrency(snapshotDefaults) : undefined)
    setConstructorPresentation(snapshotDefaults?.constructorPresentation)
    setReportProfile(snapshotDefaults?.reportProfile)
    setNumberPresentation(snapshotDefaults?.numberPresentation)
    setSupplierBasis(snapshotDefaults?.supplierBasis)
    setPriceTypeSalesComparison(snapshotDefaults?.priceTypeSalesComparison)
    setAgreementPriceComparison(snapshotDefaults?.agreementPriceComparison)
    setSettlementPeriod(undefined)
    setGroupedSettlementPeriod(snapshotDefaults?.groupedSettlementPeriod)
    setSettlementReadMode(snapshotDefaults?.settlementReadMode)
    setSourceCounterpartyGroups(undefined)
    setCashPeriod(undefined)
    setGroupedCashPeriod(snapshotDefaults?.groupedCashPeriod)
    setCashReadMode(snapshotDefaults?.cashReadMode)
    workbook.reset(snapshotDefaults)
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
    if (templateConfigurationError) return { ok: false }
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
    if (templateConfigurationError || !activeTemplate) return { ok: false }
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
    template = { ...template, Data: upgradeCurrentVparivanieAnalysis(withUnifiedSource(template.Data, nextDataset), nextDataset) }
    const reviewed = productClassificationReviewError(template.Data, nextDataset) ? withoutProductClassification(template.Data) : template.Data
    const incompatible = (consoleScope && !BUG_1274_ACTIVE_DATA_SOURCES.has(template.Data.dataSource ?? 0) ? BUG_1274_DISABLED_MESSAGE : null) ?? datasetConfigurationError(reviewed, nextDataset, 'workspace')
    if (incompatible || !nextDataset) {
      setTemplateNotice(incompatible)
      return false
    }
    const data = withCurrentVparivanieMovementScope(withDefaultReadModes(template.Data, nextDataset))
    if (bug1274Only && lacksCurrentReadMode(data, nextDataset)) {
      setTemplateNotice(TEMPLATE_WITHOUT_READ_MODE_ERROR)
      return false
    }
    applyConfiguration({ ...template, Data: data }, nextDataset)
    setActiveWorkbook(readReportProfile(requestReportProfile(data)) ? salesConstructorWorkbook(readReportProfile(requestReportProfile(data))!) : null)
    setActiveTemplate(structuredClone(template))
    return true
  }

  function applyConfiguration(template: ReportTemplate, nextDataset: ReportDataset) {
    setSettingsRevision(value => value + 1)
    workbookLaunchToken.current += 1
    setWorkbookResolving(false)
    setConstructorSection('structure')
    setCatalogueNotice(null)
    workspaceDraft.rememberBeforeReplace()
    setRestoredData(null)
    setDraftRestoreError(null)
    setActiveTemplate(null)
    const data = upgradeCurrentVparivanieAnalysis(withCurrentVparivanieMovementScope(template.Data), nextDataset)
    setFullCurrentVparivanie(currentVparivanieFullScope(data))
    setMovementQuantities(movementSelection(data) ?? EMPTY_MOVEMENT_SELECTION)
    setComparison(structuredClone(requestComparison(data)))
    setXyz(structuredClone(xyzOptions(requestXyz(data)) ?? requestXyz(data)))
    setRateComparison(structuredClone(rateComparisonOptions(requestRateComparison(data)) ?? requestRateComparison(data)))
    setPaymentComparison(clonePaymentComparisonValue(data))
    setMarginComparison(cloneMarginComparisonValue(data))
    setReturnComparison(structuredClone(returnComparisonOptions(requestReturnComparison(data)) ?? requestReturnComparison(data)))
    setBuyerSalesShare(structuredClone(buyerSalesShareOptions(requestBuyerSalesShare(data)) ?? requestBuyerSalesShare(data)))
    setRevenueComparison(structuredClone(revenueComparisonOptions(requestRevenueComparison(data)) ?? requestRevenueComparison(data)))
    setProductClassification(structuredClone(requestProductClassification(data)))
    setProductServiceFilter(structuredClone(requestProductServiceFilter(data)))
    setSourceOrganizations(structuredClone(requestSourceOrganizations(data)))
    setSourceBuyerSubtree(structuredClone(requestSourceBuyerSubtree(data)))
    setProfitReadMode(structuredClone(requestProfitReadMode(data)))
    setDayOrganizationBasis(structuredClone(requestDayOrganizationBasis(data)))
    setSupplierBasis(structuredClone(requestSupplierBasis(data)))
    setNativePriceComparison(data.nativePriceComparison ?? data.NativePriceComparison)
    setCustomerGroups(data.customerGroups ?? data.CustomerGroups)
    setReturnsOnly(data.returnsOnly ?? data.ReturnsOnly)
    setPriceTypeSalesComparison(clonePriceTypeSalesComparisonValue(data))
    setAgreementPriceComparison(structuredClone(requestAgreementPriceComparison(data)))
    setSettlementPeriod(structuredClone(data.settlementPeriod))
    setGroupedSettlementPeriod(structuredClone(requestGroupedSettlementPeriod(data)))
    setSettlementReadMode(structuredClone(requestSettlementReadMode(data)))
    setSourceCounterpartyGroups(structuredClone(requestSourceCounterpartyGroups(data)))
    setCashPeriod(structuredClone(data.cashPeriod))
    setGroupedCashPeriod(structuredClone(requestGroupedCashPeriod(data)))
    setCashReadMode(structuredClone(requestCashReadMode(data)))
    setSupplierWarehouse(structuredClone(data.supplierWarehouse ?? data.SupplierWarehouse))
    setPresentationCurrency(structuredClone(requestPresentationCurrency(data)))
    setConstructorPresentation(structuredClone(requestConstructorPresentation(data)))
    setReportProfile(structuredClone(requestReportProfile(data)))
    setNumberPresentation(structuredClone(requestNumberPresentation(data)))
    workbook.restore(data)
    setOneCSpecialSettings(structuredClone(requestOneCSpecialSettings(data, nextDataset.DataSource)))
    setOneCScope(structuredClone(data.oneC))
    groupingOrdering.loadOrdering(requestOrdering(data))
    const nextAgreementId = data.valuationClientAgreementId ?? undefined
    setValuationAgreementId(nextAgreementId)
    const groupingByType = new Map(datasetGroupings(nextDataset, data).map(item => [item.type, item]))
    if (periodSupported && !getPeriodError(from, to, maxDate, t)) setPreviousPeriod({ from, to })
    setDataSource(nextDataset.DataSource)
    setTemplateName(template.Name)
    setFrom(nextDataset.PeriodSupported === false ? '' : data.from || today)
    setTo(nextDataset.PeriodSupported === false ? '' : data.to || today)
    setRowGroups(retainStoredGroupingLabels(data, nextDataset.DataSource, 'Row',
      data.sorted.Row.map(item => groupingByType.get(item.type)!)))
    setColGroups(retainStoredGroupingLabels(data, nextDataset.DataSource, 'Col',
      data.sorted.Col.map(item => groupingByType.get(item.type)!)))
    filterLogic.load(data.selections, requestFilterExpression(data))
    setTopGroups(structuredClone(requestTopGroups(data)))
    setThreshold(structuredClone(requestThreshold(data)))
    setHideZero(structuredClone(requestHideZero(data)))
    abc.load(requestAbcClassification(data))
    setMeasurements(datasetMeasurements(nextDataset, data.sorted.Measurements))
    setTemplateNotice(null)
    clearRun()
  }

  function restoreWorkspace(snapshot: ReportWorkspaceSnapshot, cancelDraft = false): boolean {
    if (!canGenerateReport || !datasetStorage.loaded) return false
    const nextDataset = datasetStorage.datasets.find(item => item.DataSource === (snapshot.data.dataSource ?? 0))
    const unified = withUnifiedSource(snapshot.data, nextDataset)
    snapshot = { ...snapshot, data: upgradeCurrentVparivanieAnalysis(bug1274Only ? withDefaultReadModes(unified, nextDataset) : unified, nextDataset) }
    const incompatible = reportWorkspaceDraftCompatibility(snapshot, nextDataset)
    if (incompatible || !nextDataset) {
      setDraftRestoreError(incompatible)
      return false
    }
    const data = withCurrentVparivanieMovementScope(structuredClone(snapshot.data))
    setFullCurrentVparivanie(currentVparivanieFullScope(data))
    setMovementQuantities(movementSelection(data) ?? EMPTY_MOVEMENT_SELECTION)
    setCatalogueNotice(null)
    if (!cancelDraft) { setActiveWorkbook(null); setSettingsRevision(value => value + 1) }
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
    setProductServiceFilter(structuredClone(requestProductServiceFilter(data)))
    setSourceOrganizations(structuredClone(requestSourceOrganizations(data)))
    setSourceBuyerSubtree(structuredClone(requestSourceBuyerSubtree(data)))
    setProfitReadMode(structuredClone(requestProfitReadMode(data)))
    setDayOrganizationBasis(structuredClone(requestDayOrganizationBasis(data)))
    setSupplierBasis(structuredClone(requestSupplierBasis(data)))
    setNativePriceComparison(data.nativePriceComparison ?? data.NativePriceComparison)
    setCustomerGroups(data.customerGroups ?? data.CustomerGroups)
    setReturnsOnly(data.returnsOnly ?? data.ReturnsOnly)
    setPriceTypeSalesComparison(clonePriceTypeSalesComparisonValue(data))
    setAgreementPriceComparison(structuredClone(requestAgreementPriceComparison(data)))
    setSettlementPeriod(structuredClone(data.settlementPeriod))
    setGroupedSettlementPeriod(structuredClone(requestGroupedSettlementPeriod(data)))
    setSettlementReadMode(structuredClone(requestSettlementReadMode(data)))
    setSourceCounterpartyGroups(structuredClone(requestSourceCounterpartyGroups(data)))
    setCashPeriod(structuredClone(data.cashPeriod))
    setGroupedCashPeriod(structuredClone(requestGroupedCashPeriod(data)))
    setCashReadMode(structuredClone(requestCashReadMode(data)))
    setSupplierWarehouse(structuredClone(data.supplierWarehouse ?? data.SupplierWarehouse))
    setPresentationCurrency(structuredClone(requestPresentationCurrency(data)))
    setConstructorPresentation(structuredClone(requestConstructorPresentation(data)))
    setReportProfile(structuredClone(requestReportProfile(data)))
    setNumberPresentation(structuredClone(requestNumberPresentation(data)))
    workbook.restore(data)
    setOneCSpecialSettings(structuredClone(requestOneCSpecialSettings(data, nextDataset.DataSource)))
    setOneCScope(structuredClone(data.oneC))
    setTopGroups(structuredClone(requestTopGroups(data)))
    setThreshold(structuredClone(requestThreshold(data)))
    setHideZero(structuredClone(requestHideZero(data)))
    abc.load(requestAbcClassification(data))
    setValuationAgreementId(data.valuationClientAgreementId ?? undefined)
    setTemplateNotice(null)
    setDraftRestoreError(null)
    if (!cancelDraft) clearRun()
    return true
  }

  function changeDataset(nextDataset: ReportDataset, workbook?: WorkbookLaunch, resolved?: ResolvedWorkbookFilters) {
    if (consoleScope && !BUG_1274_ACTIVE_DATA_SOURCES.has(nextDataset.DataSource)) return
    const period = periodSupported ? { from, to } : previousPeriod
    const day = opensOnPreviousDay(nextDataset.DataSource) ? previousKyivDay(today) : null
    const opened = (workbook ? bug1274WorkbookPeriod(workbook.fileName, today) : null) ?? { from: day ?? period.from, to: day ?? period.to }
    const request = bug1274WorkbookRequest(defaultDatasetRequest(nextDataset, opened.from, opened.to), workbook, resolved)
    applyConfiguration({ Name: '', Data: bug1274Only && workbook?.fileName === 'Впарювання.xls'
      ? vparivanieSelectionRequest(request, nextDataset) : request }, nextDataset)
  }

  function pickDataset(nextDataset: ReportDataset) {
    workbookLaunchToken.current += 1
    setWorkbookResolving(false)
    setActiveWorkbook(null)
    changeDataset(nextDataset)
  }

  function openWorkbook(item: WorkbookLaunch): boolean {
    if (!canGenerateReport || isLoading || workbookResolving) return false
    const token = ++workbookLaunchToken.current
    const guide = bug1274WorkbookGuide(item.fileName)
    const title = guide ? `${workbookDisplayFileName(item.fileName)} — ${t(guide.title)}` : undefined
    const notice = guide ? t(guide.summary) : `${item.fileName}: ${item.notice}`
    if (!resolvesWorkbookFilters(item.fileName)) {
      changeDataset(item.dataset, item)
      setActiveWorkbook(item.fileName)
      setCatalogueNotice({ text: notice, title, failed: false })
      return true
    }
    setWorkbookResolving(true)
    setActiveWorkbook(item.fileName)
    setCatalogueNotice({ text: guide ? t('Застосовуються відбори книги…') : `${item.fileName}: ${t('застосовуються відбори книги…')}`, title, failed: false })
    const profitLookup = item.dataset.DataSource === 38 && item.dataset.profitReadModeLookup === true ? 0 : undefined
    void resolveBug1274WorkbookFilters(item.fileName, item.dataset, (source, field, value) => searchDatasetReportValues(source, field,
      { value, offset: 0, limit: LOOKUP_SEARCH_LIMIT }, undefined, undefined, undefined, undefined, profitLookup))
      .then(resolved => {
        if (token !== workbookLaunchToken.current) return
        changeDataset(item.dataset, item, resolved)
        setActiveWorkbook(item.fileName)
        setCatalogueNotice({ text: `${notice}${workbookFiltersNotice(resolved)}`, title, failed: false,
          warning: workbookFiltersNotice(resolved).trim() || undefined })
      })
      .finally(() => { if (token === workbookLaunchToken.current) setWorkbookResolving(false) })
    return true
  }

  function applyPreset(id: DatasetReportPresetId) {
    if (!dataset) return
    const preset = datasetPresetRequest(dataset, id, templateBody)
    if (preset) groupingOrdering.applyPreset(preset, next => applyConfiguration(next, dataset))
  }

  const initialWorkbookOpened = useRef(false)
  const openInitialWorkbook = useEffectEvent((item: WorkbookLaunch) => {
    setInitialWorkbook('opening')
    openWorkbook(item)
  })
  useEffect(() => {
    if (!initialWorkbookLaunch || initialWorkbookOpened.current) return
    initialWorkbookOpened.current = true
    openInitialWorkbook(initialWorkbookLaunch)
  }, [initialWorkbookLaunch])

  const analysisRules = bug1274Only ? supportedAnalysisRules(templateBody, dataset, settlementDataset)
    : { topGroups: true, threshold: true, abc: true, ordering: true, filterExpression: true }
  const lookup: { from: string; to: string; profitReadMode: 0 | 1 | undefined; profitUnavailable: boolean
    providedDiscountBasis: 0 | undefined; salesBasis: 0 | undefined; sourceWorld: number | undefined } = {
    from: hasLookupPeriod ? debouncedFrom : '',
    to: hasLookupPeriod ? debouncedTo : '',
    profitReadMode: (dataSource === 35 || dataSource === 38) && dataset?.profitReadModeLookup === true
      && (profitReadMode === 0 || profitReadMode === 1) ? profitReadMode : undefined,
    profitUnavailable: dataSource === 38 && profitReadMode === 0 && dataset?.profitReadModeLookup !== true,
    providedDiscountBasis: currentProvidedDiscountLookupBasis(dataSource, oneCSpecialSettings, dataset),
    salesBasis: currentPriceTypeSalesLookupBasis(dataSource, priceTypeSalesComparison, dataset?.priceTypeSalesComparison),
    sourceWorld: reportLookupSourceWorld(dataSource, groupedSettlementPeriod, oneCSpecialSettings),
  }
  const cashSettlementPanels = (part?: 'source' | 'filters' | 'form') => <CashSettlementSettingsPanels dataSource={dataSource} part={part}
    cash={{ dataset, grouped: groupedCashPeriod, exact: cashPeriod, rows: rowGroups,
      available: groupingOptions, onRowsChange: workbook.changeCashRows, disabled: comparisonSettingsDisabled, enabled: canGenerateReport,
      readMode: cashReadMode, onReadModeChange: setCashReadMode, hideRegisterReadMode: bug1274Only }}
    settlement={{ dataset, grouped: groupedSettlementPeriod, exact: settlementPeriod,
      buyer: sourceBuyerSubtree, groups: sourceCounterpartyGroups, rows: rowGroups,
      available: groupingOptions, from, to, disabled: comparisonSettingsDisabled, enabled: canGenerateReport,
      onModeChange: changeSettlementMode,
      onExactChange: setSettlementPeriod, onBuyerChange: setSourceBuyerSubtree,
      onRowsChange: setRowGroups, onGroupsChange: setSourceCounterpartyGroups,
      readMode: settlementReadMode, hideRegisterReadMode: bug1274Only, onReadModeChange: mode => {
        setSettlementReadMode(mode)
        if (mode == null) return
        setGroupedSettlementPeriod(defaultGroupedSettlementPeriod())
        setSourceBuyerSubtree(defaultGroupedSettlementBuyer())
      } }}
    onGroupedCashChange={workbook.changeGroupedCash} onExactCashChange={setCashPeriod}
    onCashMeasurementsChange={setMeasurements} onClearCashFilters={() => filterLogic.load([])} />
  const dayProfitControls = (part?: ProfitControlsPart) => <DayProfitControls part={part} dataset={dataset}
    disabled={comparisonSettingsDisabled} hideRegister={bug1274Only} profitReadMode={profitReadMode}
    dayOrganizationBasis={dayOrganizationBasis} productClassification={productClassification} productServiceFilter={productServiceFilter}
    sourceOrganizations={sourceOrganizations} sourceBuyerSubtree={sourceBuyerSubtree} setProfitReadMode={setProfitReadMode}
    setDayOrganizationBasis={setDayOrganizationBasis} setProductClassification={setProductClassification} setProductServiceFilter={setProductServiceFilter}
    setSourceOrganizations={setSourceOrganizations} setSourceBuyerSubtree={setSourceBuyerSubtree} />
  const supplierProfitControls = (part?: ProfitControlsPart) => <SupplierProfitControls part={part} dataset={dataset}
    disabled={comparisonSettingsDisabled} hideRegister={bug1274Only} profitReadMode={profitReadMode}
    supplierBasis={supplierBasis} sourceBuyerSubtree={sourceBuyerSubtree}
    groupingOptions={groupingOptions} setProfitReadMode={setProfitReadMode} setSupplierBasis={value => { setSupplierBasis(value); if (value === 0 && supplierWarehouse !== undefined) setSupplierWarehouse(78) }}
    setSourceBuyerSubtree={setSourceBuyerSubtree} setRowGroups={setRowGroups} />

  if (!bug1274Only && canGenerateReport && ownerId && workspaceDraft.recovery !== 'none'
    && (workspaceDraft.recovery !== 'loading' || !datasetStorage.loaded)) {
    return <ReportDraftRecoveryPanel savedAt={workspaceDraft.savedAt}
      loading={!datasetStorage.loaded && !datasetStorage.error}
      error={draftRestoreError ?? datasetStorage.error ?? workspaceDraft.message}
      canRestore={workspaceDraft.recovery === 'pending' && datasetStorage.loaded && !datasetStorage.error}
      onRestore={() => workspaceDraft.restore(restoreWorkspace)}
      onDiscard={() => { if (workspaceDraft.discardRecovery()) setDraftRestoreError(null) }}
      onRetry={datasetStorage.retry} />
  }

  const analysisPanels = {
    abc: !analysisRules.abc ? null : <ReportAbcClassificationPanel data={templateBody} dataset={dataset} disabled={comparisonSettingsDisabled} notice={abc.notice} onChange={abc.change}
      onConfigureGrouping={constructorMode ? () => navigateConstructorSection('structure') : undefined}
      onConfigureMeasures={constructorMode ? () => navigateConstructorSection('structure') : undefined} />,
    hideZero: <ReportHideZeroPanel data={templateBody} dataset={dataset} disabled={comparisonSettingsDisabled} onChange={setHideZero} />,
    threshold: !analysisRules.threshold ? null : <ReportThresholdPanel data={templateBody} dataset={dataset} disabled={comparisonSettingsDisabled} onChange={setThreshold} />,
    topGroups: !analysisRules.topGroups ? null : <ReportTopGroupsPanel data={templateBody} dataset={dataset} disabled={comparisonSettingsDisabled} onChange={setTopGroups}
      onConfigureGrouping={constructorMode ? () => navigateConstructorSection('structure') : undefined}
      onConfigureMeasures={constructorMode ? () => navigateConstructorSection('structure') : undefined} />,
    filterExpression: !analysisRules.filterExpression ? null : <ReportFilterExpressionPanel data={templateBody} dataset={settlementDataset} disabled={comparisonSettingsDisabled}
      notice={filterLogic.notice} onChange={filterLogic.change} />,
    ordering: !analysisRules.ordering ? null : <ReportOrderingPanel data={templateBody} dataset={dataset} disabled={comparisonSettingsDisabled}
      notice={groupingOrdering.notice} onChange={groupingOrdering.changeOrdering} />,
  }
  const exportModal = (
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
      fileBaseName={lastRun?.fileName}
      title={lastRun?.name || lastRun?.title || dataset?.Name || t('Звіт')}
      onClose={() => updateRun({ downloadModalOpened: false })}
    />
  )

  if (bug1274Only) {
    const selectionOnly = activeWorkbook === 'Впарювання.xls' || (dataSource === 2 && returnsOnly === true)
    const activeProfile = readReportProfile(reportProfile)
    const deskTitle = activeProfile ? salesConstructorTitle(activeProfile) : workbookDeskTitle(activeWorkbook, dataSource)
    const deskReportKey = `${activeWorkbook ?? ''}|${dataSource}`
    const deskSummary = workbookRequestSummary(reportBody, dataset, selection => getSelectionFieldSummary(selection, filterFieldOptions, t))
    const organizationField = organizationFilterField(dataSource)
    const organizationOption = organizationField === null ? undefined : filterFieldOptions.find(option => option.field.Type === organizationField)
    const isOrganizationSelection = (selection: ReportSelection) => organizationOption !== undefined && Boolean(selection.SelectedField.Name) && selection.SelectedField.Type === organizationField
    const builder = {
      inlineSelections: true, selectionKeys: filterLogic.selectionKeys, dataset, request: reportBody, dataSource, colGroups, filterFieldOptions, groupingOptions, groupingSelectData, measurements, rowGroups, selections,
      lookupFrom: lookup.from, lookupTo: lookup.to, lookupProfitReadMode: lookup.profitReadMode,
      lookupProfitUnavailable: lookup.profitUnavailable, lookupSourceWorld: lookup.sourceWorld, lookupSalesBasis: lookup.salesBasis,
      lookupProvidedDiscountBasis: lookup.providedDiscountBasis,
      onColGroupsChange: (value: ReportGroupingItem[] | ((current: ReportGroupingItem[]) => ReportGroupingItem[])) => groupingOrdering.changeAxis('Col', value),
      onRowGroupsChange: (value: ReportGroupingItem[] | ((current: ReportGroupingItem[]) => ReportGroupingItem[])) => {
        const next = typeof value === 'function' ? value(rowGroups) : value
        if (dataSource === 38) setSupplierWarehouse(supplierWarehouseAfterRowEdit(supplierWarehouse, rowGroups, next))
        groupingOrdering.changeAxis('Row', next)
      },
      onMeasurementsChange: setMeasurements, onSelectionsChange: filterLogic.editSelection, onGroupingLayoutChange: groupingOrdering.changeLayout,
      exportLayout, onExportLayoutChange: setExportLayout,
    }
    const supplierControls = dataSource === 38 && isSupplierSourceWorldCapability(dataset?.supplierSourceWorld)
    const organizationsContent = dataSource === 35 || organizationOption ? <>
      {dataSource === 35 ? <div className="workbook-desk__group">{dayProfitControls('organizations')}</div> : null}
      {organizationOption ? <LegacyReportBuilder part="selections" {...builder} selectionFilter={isOrganizationSelection}
        newSelection={() => ({ ...createEmptySelection(), SelectedField: { ...organizationOption.field },
          FilterCondition: { ...REPORT_FILTER_CONDITIONS[2] } })}
        selectionTitle={t('Відбір організацій')} addSelectionLabel={t('Додати організацію')} /> : null}
    </> : null
    const filtersContent = <>
      {dataSource === 46 ? <NativePriceComparisonPanel value={nativePriceComparison} onChange={setNativePriceComparison} disabled={comparisonSettingsDisabled} /> : null}
      {dataSource === 44 ? <CustomerGroupsPanel value={customerGroups} onChange={setCustomerGroups} disabled={comparisonSettingsDisabled} /> : null}
      {dataSource === 35 ? <div className="workbook-desk__group">{dayProfitControls('filters')}</div> : null}
      {supplierControls ? <div className="workbook-desk__group">{supplierProfitControls('filters')}</div> : null}
      {dataSource === 41 ? cashSettlementPanels('filters') : null}
      <LegacyReportBuilder part="selections" {...builder} dataset={activeWorkbook === 'Впарювання.xls' ? vparivanieSelectionDataset(dataset) : dataset}
        selectionFilter={organizationOption ? selection => !isOrganizationSelection(selection) : undefined} />
    </>
    const groupingContent = <>
      {dataSource === 40 || dataSource === 41 ? cashSettlementPanels('form') : null}
      <LegacyReportBuilder part="grouping" {...builder} />
    </>
    const advancedContent = <div className="workbook-advanced">
      {workbook.panel(dataset, reportBody, comparisonSettingsDisabled)}
      {dataSource === 35 ? <div className="workbook-desk__group">{dayProfitControls('source')}</div> : null}
      {supplierControls ? <div className="workbook-desk__group">{supplierProfitControls('source')}</div> : null}
      {dataSource === 40 || dataSource === 41 ? cashSettlementPanels('source') : null}
      {dataSource === 39 ? <CurrentVparivanieRegionalPanel dataset={dataset ?? null} request={reportBody}
        enabled={canGenerateReport} disabled={comparisonSettingsDisabled}
        fullScope={currentVparivanieFullScope(reportBody)} onFullScopeChange={setFullCurrentVparivanie} /> : null}
      {dataSource !== 19 ? analysisPanels.filterExpression : null}
      {!hasFixedReportAxes(dataSource) ? <>
        {analysisPanels.topGroups}
        {analysisPanels.threshold}
        {analysisPanels.hideZero}
        {analysisPanels.abc}
        {analysisPanels.ordering}
      </> : dataSource === 26 ? analysisPanels.abc : null}
    </div>
    const filterChips = deskSummary.chips.filter(chip => chip.kind === 'filter')
    const groupingLabels = (groups: ReportGroupingItem[]) => groups.map(group => group.label || getReportFieldLabel(group.key)).join(' → ')
    const deskSections: WorkbookSettingsSection[] = [
      ...(organizationsContent ? [{ id: 'organizations', title: 'Організації', summary: deskSummary.organizations ?? t('Усі'),
        compactSummary: t(workbookOrganizationScope(reportBody)), content: organizationsContent }] : []),
      { id: 'filters', title: 'Фільтри', summary: filterChips.length ? filterChips.map(chip => chip.label).join('; ') : t('Фільтрів немає'),
        compactSummary: String(filterChips.length), content: filtersContent },
      { id: 'measures', title: 'Показники', summary: checkedMeasurements
        ? `${checkedMeasurements} ${deskPlural(checkedMeasurements, ['показник', 'показники', 'показників'])}` : t('Не вибрано жодного'),
        compactSummary: String(checkedMeasurements), content: <>{dataSource === 39 ? <CurrentVparivanieMovementSettings dataset={dataset} value={movementQuantities} onChange={changeMovementQuantities} disabled={comparisonSettingsDisabled} /> : null}<LegacyReportBuilder part="measures" {...builder} /><ReportPresentationCurrencyPanel dataset={dataset} request={reportBody} disabled={comparisonSettingsDisabled} onChange={setPresentationCurrency} /><ConstructorPresentationPanel dataset={dataset} request={reportBody} disabled={comparisonSettingsDisabled} onChange={setConstructorPresentation} /><ReportNumberPresentationPanel value={numberPresentation} dataset={dataset} disabled={comparisonSettingsDisabled} onChange={setNumberPresentation} /></> },
      { id: 'grouping', title: 'Групування', summary: reportAxesPolicy(dataset, reportBody).fixed ? t('За формою')
        : rowGroups.length ? `${groupingLabels(rowGroups)}${colGroups.length ? ` · ${t('стовпці')}: ${groupingLabels(colGroups)}` : ''}` : t('Не вибрано'),
        compactSummary: reportAxesPolicy(dataset, reportBody).fixed ? t('За формою')
          : colGroups.length ? `${rowGroups.length} ${t('ряд.')} · ${colGroups.length} ${t('стовп.')}`
          : rowGroups.length ? `${rowGroups.length} ${deskPlural(rowGroups.length, ['рівень', 'рівні', 'рівнів'])}` : t('Немає'),
        content: groupingContent },
    ]
    const submenuProps = { onTemplates: () => openDeskTemplates(false), templatesDisabled: !canGenerateReport || isLoading || !!publishedTab,
      templatesOpened: deskTemplatesOpened, onCatalogue: () => setPublishedTab(null), catalogueDisabled: isLoading || publishedBusy }
    const quietActions = <>
      {canGenerateReport && ownerId ? <ReportDraftControl renderTrigger={trigger => <ReportsSubmenu {...submenuProps} onDraft={trigger.onOpen} draftDisabled={trigger.disabled} draftOpened={trigger.opened} />}
        pending={workspaceDraft.recovery === 'pending' || workspaceDraft.recovery === 'blocked'}
        canRestore={workspaceDraft.recovery === 'pending' && datasetStorage.loaded && !datasetStorage.error}
        canUndo={Boolean(workspaceDraft.previousSnapshot)} disabled={isLoading || !datasetStorage.loaded || !!publishedTab}
        savedAt={workspaceDraft.savedAt} error={draftRestoreError ?? workspaceDraft.message}
        onRestore={() => workspaceDraft.restore(restoreWorkspace)} onUndo={() => workspaceDraft.undo(restoreWorkspace)}
        onDiscard={() => { const discarded = workspaceDraft.discardRecovery(); if (discarded) setDraftRestoreError(null); return discarded }} /> : <ReportsSubmenu {...submenuProps} />}
    </>
    const navigationDisabled = isLoading || workbookResolving || !canGenerateReport || publishedBusy
    const openNavigationWorkbook = (item: WorkbookLaunch) => {
      setPublishedTab(null)
      if (item.fileName !== activeWorkbook) openWorkbook(item)
    }
    const openPublishedReport = (tab: PublishedReportTab) => {
      setPublishedTab(tab)
      setVisitedPublished(current => current.includes(tab) ? current : [...current, tab])
    }
    const excelUrl = result?.document.DocumentURL || null
    const pdfUrl = result?.document.PdfDocumentURL || null
    return (
      <Stack className="reports-stocks-page workbook-desk" gap={6}>
        <PageSubmenuActions>
          <ReportsNavigation launches={workbookLaunches} active={activeWorkbook} movement={publishedTab === 'movement'}
            disabled={navigationDisabled} onOpen={openNavigationWorkbook} onStocks={() => openPublishedReport('movement')} />
        </PageSubmenuActions>
        {canGenerateReport && catalogueNotice?.failed ? <Alert color="red" className="workbook-desk__notice" icon={<CircleAlert size={18} />}
          title={catalogueNotice.title ?? t('Не вдалося відкрити звіт')}
          withCloseButton closeButtonLabel={t('Закрити повідомлення')} onClose={() => setCatalogueNotice(null)}>{catalogueNotice.text}</Alert> : null}
        <WorkbookSwitcher compact launches={workbookLaunches} active={publishedTab ? null : activeWorkbook} disabled={navigationDisabled}
          published={publishedTab} onOpenPublished={openPublishedReport} extra={quietActions} onOpen={openNavigationWorkbook} />
        {canGenerateReport && ownerId ? visitedPublished.map(tab => <div key={tab} style={{ display: publishedTab === tab ? undefined : 'none' }}>
          <Suspense fallback={<Group role="status" gap="xs"><Loader size="sm" /><Text>{t('Завантаження звіту…')}</Text></Group>}>
            <PublishedReportWorkspace tab={tab} callerKey={ownerId} onBusyChange={setPublishedBusy} />
          </Suspense>
        </div>) : null}
        <div style={{ display: publishedTab && canGenerateReport ? 'none' : undefined }}>
        {!canGenerateReport ? <Alert color="yellow" icon={<CircleAlert size={18} />} title={t('Немає доступу до звітів')}>
          {t('Ваша роль не дозволяє формувати звіти. Зверніться до адміністратора.')}
        </Alert> : datasetStorage.error ? <Alert color="red" icon={<CircleAlert size={18} />} title={t('Не вдалося завантажити список звітів')}>
          <Text size="sm">{datasetStorage.error}</Text>
          <Button variant="default" size="xs" mt="xs" onClick={datasetStorage.retry}>{t('Спробувати ще раз')}</Button>
        </Alert> : !datasetStorage.loaded || (datasetHidden && workbookResolving) ? <Group justify="center" p="xl" role="status">
          <Loader size="sm" /><Text size="sm">{t('Завантаження звіту…')}</Text>
        </Group> : datasetHidden ? <Alert color="gray" icon={<CircleAlert size={18} />} title={t('Звіти зараз недоступні')}>
          {t('Оберіть доступний звіт у вкладках або спробуйте оновити список.')}
          <Button variant="default" size="xs" mt="xs" onClick={datasetStorage.retry}>{t('Оновити')}</Button>
        </Alert> : <form className="reports-stocks-form workbook-desk__form" onSubmit={submitReport}>
            <WorkbookHeader title={deskTitle} showTitle={!activeWorkbook} templateName={activeTemplate?.Name ?? ''}
              resolving={workbookResolving} warning={catalogueNotice?.warning ?? null} />
            <WorkbookSettings unified sections={selectionOnly ? deskSections.filter(section => section.id === 'filters') : deskSections}
              advanced={selectionOnly ? null : advancedContent} disabled={comparisonSettingsDisabled}
              period={periodSupported ? <WorkbookPeriodField from={from} to={to}
                minDate={effectiveConfiguration?.period.minimumDate ?? (supportsFullReportDateRange(dataSource) ? CLIENT_COMPARISON_MIN_DATE : REPORT_MIN_DATE)} maxDate={maxDate}
                presets={reportPeriodPresets(dataSource, today)} error={periodError} disabled={isLoading || workbookResolving}
                onFromChange={setFrom} onToChange={setTo} />
                : <Text size="sm">{t('Поточний стан на час читання даних. Історичний період не застосовується.')}</Text>} />
            {appliedSettings.pending ? <Alert color="yellow" role="status">{t('Налаштування змінено. Застосуйте весь набір, щоб оновити звіт.')}{lastRun ? <> {t('Показаний результат та його експорт відповідають попередньому застосованому набору.')}</> : null}</Alert> : null}
            <WorkbookActionBar canSubmit={canSubmit && !workbookResolving} isLoading={isLoading}
              blockedReason={workbookResolving ? null : submitBlockedReason || null}
              ran={Boolean(result)} previewNeedsExport={Boolean(lastRun?.previewNeedsExport)} excelUrl={excelUrl} pdfUrl={pdfUrl} fileBaseName={lastRun?.fileName ?? null}
              resetDisabled={!canGenerateReport || isLoading} onPreview={() => void runReport(true)}
              onGenerate={() => void runReport(false)} onReset={resetReport}
              pending={appliedSettings.pending} canExport={Boolean(lastRun) || canSubmit && !appliedSettings.pending} onCancel={() => { restoreWorkspace(appliedSettings.cancelSnapshot(activeTemplate), true) }}
              onSaveTemplate={() => openDeskTemplates(true)}
              applyLabel="Застосувати й показати" />
            {lastRun ? <Text size="sm" role="status">{t('Період показаного результату')}: {workbookRequestSummary(resultRequest, dataset, selection => getSelectionFieldSummary(selection, filterFieldOptions, t)).period}</Text> : null}
            <WorkbookResult dataSource={dataSource} title={deskTitle} period={workbookRequestSummary(resultRequest, dataset, selection => getSelectionFieldSummary(selection, filterFieldOptions, t)).period} isLoading={isLoading}
              error={error} emptyRun={emptyRunNotice} generated={Boolean(lastRun?.hasDocument && !preview)}
              stale={!preview && !lastRun && !isLoading && !error && shownReport === deskReportKey}
              table={preview ? <ReportPreviewPages key={preview.ResultSession?.ResultId ?? preview.ResultSha256} initial={preview} request={resultRequest} embedded /> : null}
              excelUrl={excelUrl} pdfUrl={pdfUrl} fileBaseName={lastRun?.fileName ?? null} />
          </form>}
        </div>
        <ReportModal centered classNames={{ body: 'reports-stocks-template-modal__body', title: 'reports-stocks-modal-title' }}
          opened={deskTemplatesOpened} closeOnClickOutside={!templateStorage.busy} closeOnEscape={!templateStorage.busy}
          closeButtonProps={{ disabled: templateStorage.busy }} size={820} title={t('Шаблони звіту')}
          onClose={() => setDeskTemplatesOpened(false)}>
          <ReportTemplatesPanel ordering={templateStorage.ordering} storage={templateStorage} datasets={datasetStorage.datasets}
            dataSources={BUG_1274_ACTIVE_DATA_SOURCES} callerKey={ownerId} requireReadMode configurationReady={!templateConfigurationError && !workbookResolving}
            configurationName={deskTitle} key={`${ownerId}:${templateIntent.revision}`} initiallyCreating={templateIntent.create}
            notice={templateNotice ?? templateStorage.notice} templateName={templateName} activeTemplate={activeTemplate}
            disabled={!canGenerateReport || isLoading} onRenamed={renamedTemplate} onClearNotice={() => { setTemplateNotice(null); templateStorage.clearNotice() }}
            onApply={template => { if (applyTemplate(template)) setDeskTemplatesOpened(false) }}
            onDeleted={deletedTemplate} onNameChange={setTemplateName} onRefresh={loadTemplates}
            onSave={saveTemplate} onUpdate={updateTemplate} />
        </ReportModal>
        {exportModal}
      </Stack>
    )
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
            <Text size="xs" c="dimmed">{t(bug1274Only ? 'Відкрийте звіт 1С, за потреби змініть період і відбори, потім «Показати на екрані» або «Сформувати» файл Excel / PDF.'
              : 'Оберіть набір даних, налаштуйте структуру та сформуйте звіт.')}</Text></div>
        </div> : null}
      <Group justify="flex-end" gap={8}>
        {consoleScope && !bug1274Only ? <Badge color="green">Готово</Badge> : null}
      </Group>
      </div>
      {!constructorMode && canGenerateReport && datasetStorage.loaded && !datasetStorage.error && workbookLaunches.length > 0
        ? <Bug1274WorkbookShortcuts launches={workbookLaunches} active={activeWorkbook && !datasetHidden ? activeWorkbook : null}
          disabled={isLoading || workbookResolving} onOpen={item => { openWorkbook(item) }} /> : null}
      {!constructorMode && canGenerateReport && templateName.trim() ? <Text fw={600} aria-label={t('Назва поточного звіту')}>{templateName}</Text> : null}
      {canGenerateReport && catalogueNotice ? <Alert color={catalogueNotice.failed ? 'red' : 'blue'} style={{ flexShrink: 0 }}
        title={catalogueNotice.title ?? t(catalogueNotice.failed ? 'Не вдалося відкрити звіт' : 'Звіт відкрито')}
        withCloseButton closeButtonLabel={t('Закрити повідомлення')} onClose={() => setCatalogueNotice(null)}>{catalogueNotice.text}</Alert> : null}
      {!constructorMode && !datasetHidden ? <>{dataSource === 31 ? <AgreementPriceComparisonPanel value={agreementPriceComparison ?? defaultAgreementPriceComparison()} disabled={comparisonSettingsDisabled} onChange={setAgreementPriceComparison} />
        : requiresValuationAgreement(dataSource) ? <ValuationAgreementPicker purpose={dataSource === 22 ? 'prices' : 'stock'} value={valuationClientAgreementId} enabled={canGenerateReport} disabled={isLoading}
        agreement={valuation.agreement} validating={valuation.loading} validationError={valuation.error}
        onChange={setValuationAgreementId} onRetry={valuation.retry} /> : dataSource === 29
          ? <CurrentDiscountAgreementInput value={valuationClientAgreementId} enabled={canGenerateReport} disabled={isLoading} onChange={setValuationAgreementId} />
          : null}</> : null}
      <ReportBuilderForm dataset={dataset} reportBody={reportBody}
        exportLayout={exportLayout} onExportLayoutChange={setExportLayout}
        constructorMode={constructorMode}
        constructorSection={constructorSection}
        onConstructorSectionChange={navigateConstructorSection}
        analysisCount={[topGroups, threshold, hideZero, abcClassification, ordering].filter(value => value != null).length}
        datasetPanel={<ReportDatasetPicker compact activeDataSources={consoleScope ? BUG_1274_ACTIVE_DATA_SOURCES : undefined}
          datasets={bug1274Only ? datasetStorage.datasets.filter(item => BUG_1274_ACTIVE_DATA_SOURCES.has(item.DataSource)) : datasetStorage.datasets} selected={dataSource}
          disabled={!canGenerateReport || isLoading} loaded={datasetStorage.loaded} error={datasetStorage.error}
          onChange={pickDataset} onRetry={datasetStorage.retry} />}
        datasetSummary={bug1274Only ? null : <><ReportDatasetSummary dataset={dataset} />
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
        classificationPanel={<><ConstructorPresentationPanel dataset={dataset} request={reportBody} disabled={comparisonSettingsDisabled} onChange={setConstructorPresentation} />{workbook.panel(dataset, reportBody, comparisonSettingsDisabled)}
          <ReportPresentationCurrencyPanel dataset={dataset} request={reportBody} disabled={comparisonSettingsDisabled} onChange={setPresentationCurrency} />
          {dataSource === 39 ? <><CurrentVparivanieMovementSettings dataset={dataset} value={movementQuantities} onChange={changeMovementQuantities} disabled={comparisonSettingsDisabled} />
          <CurrentVparivanieRegionalPanel dataset={dataset ?? null} request={reportBody}
          enabled={canGenerateReport} disabled={comparisonSettingsDisabled}
          fullScope={currentVparivanieFullScope(reportBody)} onFullScopeChange={setFullCurrentVparivanie} /></> : dataSource === 41 || dataSource === 40 ? cashSettlementPanels() : dataSource === 35 ? <Card className="app-section-card" withBorder radius="md" padding="md" style={{ minWidth: 0 }}>
          {dayProfitControls()}
        </Card> : dataSource === 38 && isSupplierSourceWorldCapability(dataset?.supplierSourceWorld)
          ? <Card className="app-section-card" withBorder radius="md" padding="md" style={{ minWidth: 0 }}>
            {supplierProfitControls()}
          </Card> : null}</>}
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
        datasetHidden={datasetHidden}
        showBlockedReason={bug1274Only}
        periodPresets={bug1274Only ? reportPeriodPresets(dataSource, today) : undefined}
        templateDataSources={bug1274Only ? BUG_1274_ACTIVE_DATA_SOURCES : undefined}
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
        lookupFrom={lookup.from}
        lookupTo={lookup.to}
        lookupProfitReadMode={lookup.profitReadMode}
        lookupProfitUnavailable={lookup.profitUnavailable}
        lookupProvidedDiscountBasis={lookup.providedDiscountBasis}
        lookupSalesBasis={lookup.salesBasis}
        lookupSourceWorld={lookup.sourceWorld}
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
        onClearTemplateNotice={() => { setTemplateNotice(null); templateStorage.clearNotice() }}
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
        abcPanel={analysisPanels.abc}
        hideZeroPanel={analysisPanels.hideZero}
        thresholdPanel={analysisPanels.threshold}
        topGroupsPanel={analysisPanels.topGroups}
        filterExpressionPanel={analysisPanels.filterExpression}
        orderingPanel={analysisPanels.ordering}
        onSaveTemplate={saveTemplate}
        onSelectionsChange={filterLogic.editSelection}
        onSubmit={submitReport}
        onTemplateNameChange={setTemplateName}
        onToChange={setTo}
        onUpdateTemplate={updateTemplate}
      />

      {exportModal}
    </Stack>
  )
}

type ReportBuilderFormProps = {
  dataset?: ReportDataset
  reportBody: ReportRequestBody
  exportLayout: FinancialExportLayout
  onExportLayoutChange: (layout: FinancialExportLayout) => void
  constructorMode: boolean
  constructorSection: ReportConstructorSection
  onConstructorSectionChange: (section: ReportConstructorSection) => void
  analysisCount: number
  datasetPanel: ReactNode
  datasetSummary: ReactNode
  agreementPanel: ReactNode
  priceTypeSalesComparisonPanel: ReactNode
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
  datasetHidden: boolean
  showBlockedReason?: boolean
  periodPresets?: readonly ReportPeriodPreset[]
  templateDataSources?: ReadonlySet<number>
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
  lookupProfitReadMode?: 0 | 1
  lookupProfitUnavailable?: boolean
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
          <div className="app-filter-fields reports-stocks-toolbar-fields">
          {datasetPanel}
          <ReportPeriodInputs dataSource={dataSource} supported={periodSupported} from={from} to={to} maxDate={maxDate} disabled={constructorMode && isLoading}
            presets={props.periodPresets} onFromChange={onFromChange} onToChange={onToChange} />
          {!constructorMode && !props.datasetHidden && comparisonPanel ? <div className="reports-stocks-toolbar-comparison">{comparisonPanel}</div> : null}
          <div className="app-filter-actions reports-stocks-actions">
            <Button color="brand" variant="filled" size="sm" className="app-filter-primary-action"
              disabled={templatesDisabled}
              aria-label={t('Шаблони')} title={t('Шаблони')}
              leftSection={<LayoutTemplate size={16} />}
              type="button"
              onClick={() => { onClearTemplateNotice(); setTemplatesOpened(true) }}
            >
              {t('Шаблони')}
            </Button>
            <Tooltip label={t('Скинути')}>
              <Button aria-label={t('Скинути')} disabled={templatesDisabled} type="button" onClick={onReset} className="reports-toolbar-action" variant="default" leftSection={<RotateCcw size={17} />} title={t('Скинути')}>{t('Скинути')}</Button>
            </Tooltip>
          </div>
          </div>
          <Button type="button" variant="default" className="reports-stocks-preview" leftSection={<MonitorPlay size={16} />}
            aria-label={t('Показати на екрані')} title={t('Показати на екрані')} disabled={!canSubmit || isLoading}
            onClick={onPreview}>{t('Показати на екрані')}</Button>
          <Tooltip label={t('Сформувати')}>
            <Button
              className="reports-stocks-generate"
              aria-label={t('Сформувати')}
              color={CREATE_ACTION_COLOR}
              leftSection={<IconFileSpreadsheet size={16} />}
              loading={isLoading}
              disabled={!canSubmit}
              title={submitBlockedReason}
              aria-describedby={!canSubmit && submitBlockedReason ? 'report-constructor-blocked-reason' : undefined}
              type="submit"
            >
              {t('Сформувати')}
            </Button>
          </Tooltip>
        </div>
        </div>
        {constructorMode && !canSubmit ? <Text id="report-constructor-blocked-reason" className="report-constructor-blocked-reason" size="xs" c="gray.7">{submitBlockedReason}</Text>
          : props.showBlockedReason && !canSubmit && !isLoading && submitBlockedReason && !props.datasetHidden && submitBlockedReason !== props.notices.period
            && submitBlockedReason !== props.incompleteSelectionMessage ? <Alert id="report-constructor-blocked-reason"
            className="reports-page-alert" color="yellow" icon={<CircleAlert size={18} />}>{submitBlockedReason}</Alert> : null}
        {!constructorMode && presets.length ? <ReportQuickPresets disabled={isLoading || !configurationReady} presets={presets} onApply={onApplyPreset} /> : null}

        {props.datasetHidden ? <Alert className="reports-page-alert" color="blue" icon={<CircleAlert size={18} />}>
          {t('Відкрийте звіт 1С за зразком Excel вище або оберіть звіт у полі «Звіт».')}
        </Alert> : <ReportBuilderContent {...props} />}

        <ReportModal
          centered
          classNames={{ body: 'reports-stocks-template-modal__body', title: 'reports-stocks-modal-title' }}
          opened={templatesOpened}
          closeOnClickOutside={!templateStorage.busy}
          closeOnEscape={!templateStorage.busy}
          closeButtonProps={{ disabled: templateStorage.busy }}
          size={820}
          title={t('Шаблони звіту')}
          onClose={() => setTemplatesOpened(false)}
        >
          <ReportTemplatesPanel
            key={props.templateCallerKey}
            ordering={props.templateStorage.ordering}
            storage={templateStorage}
            datasets={props.templateDatasets}
            dataSources={props.templateDataSources}
            callerKey={props.templateCallerKey}
            requireReadMode={props.templateDataSources != null}
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
        </ReportModal>
      </form>
    </Card>
  )
}

function ReportBuilderContent(props: ReportBuilderFormProps) {
  const { dataset, reportBody,
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
          <LegacyReportBuilder dataset={dataset} request={reportBody}
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
            lookupProfitReadMode={props.lookupProfitReadMode} lookupProfitUnavailable={props.lookupProfitUnavailable}
            lookupSourceWorld={props.lookupSourceWorld} lookupSalesBasis={props.lookupSalesBasis} lookupProvidedDiscountBasis={props.lookupProvidedDiscountBasis}
            measurements={measurements}
            rowGroups={rowGroups}
            selections={selections}
            onColGroupsChange={onColGroupsChange}
            onMeasurementsChange={onMeasurementsChange}
            onRowGroupsChange={onRowGroupsChange}
            onSelectionsChange={onSelectionsChange}
            exportLayout={props.exportLayout} onExportLayoutChange={props.onExportLayoutChange}
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
          {preview ? <ReportPreviewPages key={preview.ResultSession?.ResultId ?? preview.ResultSha256} initial={preview} request={reportBody} /> : null}
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

type LegacyReportBuilderPart = 'measures' | 'grouping' | 'selections'

type LegacyReportBuilderProps = {
  inlineSelections?: boolean
  selectionKeys?: string[]
  dataset?: ReportDataset
  request?: ReportRequestBody
  part?: LegacyReportBuilderPart
  selectionFilter?: (selection: ReportSelection) => boolean
  newSelection?: () => ReportSelection
  selectionTitle?: string
  addSelectionLabel?: string
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
  lookupProfitReadMode?: 0 | 1
  lookupProfitUnavailable?: boolean
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
  exportLayout?: FinancialExportLayout
  onExportLayoutChange?: (layout: FinancialExportLayout) => void
}

const fixedAxesDescription: Partial<Record<number, string>> = {
  41: SINGLE_SETTLEMENT_AXES,
  40: 'Організація → Каса / рахунок (усі валюти) → Каса / рахунок → Валюта або Каса / рахунок (усі валюти) → Тип рахунку → Організація. Початковий залишок, надходження, видаток і кінцевий залишок у валюті рахунку.',
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
  inlineSelections = false,
  selectionKeys,
  dataset, request,
  part,
  selectionFilter,
  newSelection,
  selectionTitle,
  addSelectionLabel,
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
  lookupProfitReadMode,
  lookupProfitUnavailable,
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
  exportLayout = 'auto',
  onExportLayoutChange,
}: LegacyReportBuilderProps) {
  const { t } = useI18n()
  const [groupingPickerTarget, setGroupingPickerTarget] = useState<'rows' | 'columns' | null>(null)
  const checkedMeasurements = flattenCheckedMeasurements(measurements).length
  const groupingLayout = { Row: rowGroups, Col: colGroups }
  const policy = reportAxesPolicy(dataset, request ?? { dataSource, from: '', to: '', selections, sorted: { ...groupingLayout, Measurements: [] } })
  const analysis = !!currentVparivanieAnalysisCapability(dataset) && !!request && !!requestCurrentVparivanieAnalysis(request)
  const fixedAxes = policy.fixed
  const rowsOnly = policy.rowsOnly
  const currentAxesError = request ? financialAxesConfigurationError(request, dataset) : null
  const allowedGroupingTypes = new Set(groupingOptions.map(item => item.type))
  const lockedGroupingTypes = new Set([DOCUMENT_DETAIL_GROUPING, ...(analysis ? [74] : [])])
  const selectedGroupingTypes = new Set([...rowGroups, ...colGroups].map(item => item.type))

  const transferGrouping = (axis: ReportGroupingAxis, type: number) => {
    if (rowsOnly || fixedAxes || lockedGroupingTypes.has(type)) return
    const next = transferReportGrouping(groupingLayout, axis, type, allowedGroupingTypes)
    if (next === groupingLayout) return
    onGroupingLayoutChange(next)
  }

  const closeGroupingPicker = () => setGroupingPickerTarget(null)

  const addGroupingFromPicker = (value: string) => {
    const item = groupingOptions.find((option) => String(option.type) === value)
    if (fixedAxes || !item || item.type === DOCUMENT_DETAIL_GROUPING || !groupingPickerTarget || (rowsOnly && groupingPickerTarget === 'columns') || selectedGroupingTypes.has(item.type) || (groupingPickerTarget === 'columns' && item.type === ABC_CLASS_GROUPING)) return

    if (groupingPickerTarget === 'rows') {
      onRowGroupsChange((current) => addGrouping(current, item))
    } else {
      onColGroupsChange((current) => addGrouping(current, item))
    }

    closeGroupingPicker()
  }

  const useReportCurrency = !!request && !!readPresentationCurrency(requestPresentationCurrency(request))
    && presentationCurrencySupported(dataset) && presentationCurrencyModeSupported(request)
  const measurementLabel = (type: number | undefined, label: string) => useReportCurrency && isPresentationCurrencyMoneyMeasure(type)
    ? currencyNeutralMeasureLabel(label) : label
  const measurementUnit = (type: number | undefined, label: string) => {
    const semantics = readValueSemantics(dataset?.Measurements.find(field => field.Type === type)?.valueSemantics)
    const unit = semantics ? reportValueUnit(semantics, readNumberPresentation(request?.numberPresentation))
      : nativeReportMeasurementUnit(dataSource, label, type) ?? t('Без поділу за ПДВ')
    return measurementLabel(type, unit)
  }

  const selectionPanel = dataSource === 19 ? null : <section className="reports-stocks-legacy__selections">
    <ReportSelectionsCard inline={inlineSelections} selectionKeys={selectionKeys} dataset={dataset} dataSource={dataSource} description={null} filterFieldOptions={filterFieldOptions}
      request={request} from={lookupFrom} lookupProfitReadMode={lookupProfitReadMode} lookupProfitUnavailable={lookupProfitUnavailable} lookupSourceWorld={lookupSourceWorld} lookupSalesBasis={lookupSalesBasis} lookupProvidedDiscountBasis={lookupProvidedDiscountBasis} selections={selections} title={selectionTitle ?? t('Умови відбору')} to={lookupTo} onChange={onSelectionsChange}
      filter={selectionFilter} newSelection={newSelection} addLabel={addSelectionLabel} />
  </section>

  const measuresSection = (
    <section className="app-section-card reports-stocks-legacy-panel reports-stocks-legacy-measurements">
      <div className="reports-stocks-legacy-panel__header">
        <Group className="reports-stocks-legacy-panel__title" gap={6} wrap="nowrap">
          <Text className="app-section-title" component="h2" fw={600} size="sm">{t('Показники')}</Text>
          <TableChip value={checkedMeasurements} tone="neutral" />
        </Group>
        <WorkbookSectionActions><Group gap={4} wrap="nowrap">
          <Button
            color={CREATE_ACTION_COLOR}
            size="compact-xs"
            type="button"
            variant="default"
            leftSection={<CheckCheck size={14} aria-hidden="true" />}
            onClick={() => setAllMeasurements(onMeasurementsChange, true)}
          >
            Усі
          </Button>
          <Button
            color="gray"
            size="compact-xs"
            type="button"
            variant="default"
            leftSection={<RotateCcw size={14} aria-hidden="true" />}
            onClick={() => setAllMeasurements(onMeasurementsChange, false)}
          >
            Очистити
          </Button>
        </Group></WorkbookSectionActions>
      </div>

      <ReportMeasureTree groups={measurements} onChange={onMeasurementsChange}
        groupLabel={group => {
          const label = group.Label || grossProfitMeasureGroupLabel(dataSource, group.Name) || getReportFieldLabel(group.Name)
          return measurementGroupCaption(group.Name, useReportCurrency && group.SubList.every(item => isPresentationCurrencyMoneyMeasure(item.Type)) ? currencyNeutralMeasureLabel(label) : label)
        }}
        itemLabel={item => measurementLabel(item.Type, item.Label || getReportFieldLabel(item.Name))}
        itemUnit={item => measurementUnit(item.Type, item.Label || getReportFieldLabel(item.Name))} />
    </section>
  )

  const groupingSection = fixedAxes && part === 'grouping' && (dataSource === 40 || dataSource === 41) ? null : (
    <section className="app-section-card reports-stocks-structure">
      <Text className="app-section-title" component="h2" fw={600} size="sm">{t('Групування')}</Text>
      {request ? <ReportDocumentDetailsPanel dataset={dataset} request={request} onChange={onGroupingLayoutChange} /> : null}
      {fixedAxes ? part === 'grouping' ? (dataSource === 39
        ? <Text size="sm">Товари у рядках; залишки, продажі й контрагенти у стовпцях.</Text> : dataSource === 40 || dataSource === 41 ? null : <Text size="sm">{rowGroups.map(group => group.label).join(' → ')}</Text>)
        : <Text size="sm">{dataSource === 39
        ? `Товар → сім атрибутів. Колонки: Остатки, Продажи та Контрагенты; один показник «Результат». ${currentVparivanieNotice(filterFieldOptions.some(option => option.field.Type === 60))}`
        : dataSource === 41 ? settlementAxesDescription(rowGroups) : fixedAxesDescription[dataSource] ?? rowGroups.map(group => group.label).join(' → ')}</Text> : <ReportGroupingPanel locked={lockedGroupingTypes} layout={groupingLayout} axis="Row" allowed={allowedGroupingTypes} transferSupported={!rowsOnly}
        onOpenPicker={() => setGroupingPickerTarget('rows')}
        onRemove={(index) => onRowGroupsChange((current) => current.filter((_, itemIndex) => itemIndex !== index))}
        onReorder={(type, direction) => onRowGroupsChange(current => reorderReportGrouping(current, type, direction, allowedGroupingTypes))}
        onTransfer={type => transferGrouping('Row', type)} />}
      {fixedAxes ? null : !rowsOnly ? <ReportGroupingPanel locked={lockedGroupingTypes} layout={groupingLayout} axis="Col" allowed={allowedGroupingTypes}
        onOpenPicker={() => setGroupingPickerTarget('columns')}
        onRemove={(index) => onColGroupsChange((current) => current.filter((_, itemIndex) => itemIndex !== index))}
        onReorder={(type, direction) => onColGroupsChange(current => reorderReportGrouping(current, type, direction, allowedGroupingTypes))}
        onTransfer={type => transferGrouping('Col', type)} /> : <Text size="sm" c="dimmed">Вибрані показники відображаються у стовпцях.</Text>}
      {financialAxesCapability(dataset) && colGroups.length > 0 ? <div className="reports-stocks-export-layout">
        {onExportLayoutChange ? <SegmentedControl size="xs" aria-label={t('Файл Excel')} value={exportLayout}
          data={FINANCIAL_EXPORT_LAYOUT_OPTIONS.map(option => ({ value: option.value, label: t(option.label) }))}
          onChange={value => { if (isFinancialExportLayout(value)) onExportLayoutChange(value) }} /> : null}
        <Text size="sm" c="dimmed">{financialExportLayoutText(colGroups[0].type, exportLayout)}</Text>
      </div> : null}
      {currentAxesError ? <Alert color="orange" title="Перевірте групування">{currentAxesError}</Alert> : null}
    </section>
  )

  const pickerAllowed = policy.config ? new Set(groupingPickerTarget === 'columns' ? policy.config.allowedColumns : policy.config.allowedRows) : null
  const pickerExcluded = new Set(policy.config?.mutuallyExclusiveRows.filter(group => group.some(type => selectedGroupingTypes.has(type))).flat())
  const pickerOptions = groupingSelectData.filter(item => Number(item.value) !== DOCUMENT_DETAIL_GROUPING && !selectedGroupingTypes.has(Number(item.value))
    && (!analysis || Number(item.value) !== 74) && (!pickerAllowed || pickerAllowed.has(Number(item.value)))
    && !pickerExcluded.has(Number(item.value)) && (groupingPickerTarget !== 'columns' || Number(item.value) !== ABC_CLASS_GROUPING))
  const groupingPicker = <ReportFieldPicker key={groupingPickerTarget ?? 'closed'}
    opened={groupingPickerTarget !== null}
    title={`Додати поле · ${groupingPickerTarget === 'rows' ? 'Групування рядків' : 'Групування стовпців'}`}
    options={pickerOptions.map(item => ({ ...item, path: item.path ?? reportGroupingPath(Number(item.value)) }))}
    onSelect={addGroupingFromPicker}
    onSelectMany={values => {
      if (fixedAxes || !groupingPickerTarget || (rowsOnly && groupingPickerTarget === 'columns')) return
      const allowed = new Set(pickerOptions.map(item => item.value))
      const added = values.filter(value => allowed.has(value)).flatMap(value => groupingOptions.filter(item => String(item.type) === value))
      const change = groupingPickerTarget === 'rows' ? onRowGroupsChange : onColGroupsChange
      change(current => added.reduce((result, item) => addGrouping(result, item), current))
      closeGroupingPicker()
    }} onClose={closeGroupingPicker} />

  if (part === 'measures') return measuresSection
  if (part === 'grouping') return <>{groupingSection}{groupingPicker}</>
  if (part === 'selections') return selectionPanel

  return (
    <section className="reports-stocks-legacy" aria-label="Налаштування звіту">
      <ReportSectionPanel className="reports-stocks-legacy__columns" active={constructorSection} section="structure">
        {measuresSection}
        {groupingSection}
        {!constructorSection ? selectionPanel : null}
      </ReportSectionPanel>

      {constructorSection ? <ReportSectionPanel active={constructorSection} section="filters">
        {selectionPanel}
        {dataSource === 19 ? <Text size="sm" c="gray.7">Для історичних курсів валютна пара та дати задаються в параметрах звіту. Додаткові умови відбору не застосовуються.</Text> : filterExpressionPanel}
      </ReportSectionPanel> : null}

      {groupingPicker}

    </section>
  )
}

type GroupingOption = {
  path?: string[]
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
  request?: ReportRequestBody
  inline?: boolean
  selectionKeys?: string[]
  dataset?: ReportDataset

  dataSource: number
  lookupProfitReadMode?: 0 | 1
  lookupProfitUnavailable?: boolean
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
  filter?: (selection: ReportSelection) => boolean
  newSelection?: () => ReportSelection
  addLabel?: string
}

function ReportSelectionsCard({
  request,
  inline = false,
  selectionKeys,
  dataset,
  filter,
  newSelection,
  addLabel,
  dataSource,
  lookupProfitReadMode,
  lookupProfitUnavailable,
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
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false)
  const analysis = currentVparivanieAnalysisCapability(dataset)
  const managerLookup = financialBuyerManagerLookupPolicy(dataset, request, draftSelection?.SelectedField.Type, lookupProfitReadMode, lookupProfitUnavailable)
  const documentLookup = financialDocumentLookupPolicy(dataset, request, draftSelection?.SelectedField.Type, managerLookup.mode, managerLookup.unavailable)
  const financialConditions = dataSource === 35 ? new Set(financialFilterConditionTypes(dataset, request, draftSelection?.SelectedField.Type)) : null
  const draftField = draftSelection?.SelectedField.Type
  const filterConditions = analysis ? analysisFilterConditions(dataset, draftField ?? 0) : dataSource === 39 ? currentVparivanieFilterConditions(draftField ?? 0)
    : withCurrentGroupCondition(withDatasetGroupConditions(dataset, draftField, financialConditions ? REPORT_FILTER_CONDITIONS.filter(condition => (financialConditions.has(condition.Type) || condition.Type === draftSelection?.FilterCondition.Type)) : REPORT_FILTER_CONDITIONS,
      financialConditions ?? REPORT_FILTER_CONDITIONS.map(condition => condition.Type)), draftSelection)
  const admittedConditions = financialConditions ? new Set([...financialConditions, ...datasetGroupConditionTypes(dataset, draftField, financialConditions)]) : null
  const draftDescriptor = analysis ? analysis.filters.find(field => field.type === draftField)
    : draftSelection ? datasetHierarchyDescriptor(dataset, draftSelection.SelectedField.Type, draftSelection.SelectedField.Name) : undefined
  const hierarchyStatus = useAnalysisHierarchyStatus(needsHierarchyStatus(draftDescriptor))
  const draftItemSearch = useDatasetItemSearch(dataSource, draftField, documentLookup.mode)
  const draftValueError = draftSelection ? (analysis
    ? hierarchyStatusError(draftDescriptor, draftSelection.FilterCondition.Type, hierarchyStatus) ?? analysisSelectionValueError(draftSelection, draftDescriptor)
    : hierarchyStatusError(draftDescriptor, draftSelection.FilterCondition.Type, hierarchyStatus) ?? reportSelectionCardinalityError(draftSelection)
      ?? datasetGroupSelectionError(dataset, draftSelection)) : null
  const visibleCount = filter ? selections.filter(filter).length : selections.length
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
    setDraftSelection(cloneReportSelection(selection, dataSource))
  }

  function saveDraft() {
    if (!draftSelection || editorIndex === null || !draftSelection.SelectedField.Name || !draftSelection.Values.length || draftValueError) {
      return
    }

    const savedSelection = cloneReportSelection(draftSelection, dataSource)
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
              {visibleCount ? <Badge className="app-role-pill is-gray" variant="light">{visibleCount}</Badge> : null}
            </Group>
          </div>
          <WorkbookSectionActions>
          <Button
            className="reports-stocks-legacy-panel__add"
            color={CREATE_ACTION_COLOR}
            leftSection={<Plus size={14} />}
            size="xs"
            type="button"
            onClick={() => { const selection = newSelection ? newSelection() : createEmptySelection(); if (inline) onChange({ kind: 'append', selection }); else openEditor(-1, selection) }}
          >
            {addLabel ?? t('Додати умову')}
          </Button>
          </WorkbookSectionActions>
        </div>

        {resolvedDescription ? <Text className="reports-stocks-panel-description">{resolvedDescription}</Text> : null}
        {visibleCount ? (
          <div className="reports-stocks-selection-list">
            {selections.map((selection, index) => {
              if (filter && !filter(selection)) return null
              if (inline) return <InlineReportSelection key={selectionKeys?.[index]} dataset={dataset} request={request}
                selection={selection} selections={selections} index={index} dataSource={dataSource} from={from} to={to}
                filterFieldOptions={filterFieldOptions} lookupProfitReadMode={lookupProfitReadMode} lookupProfitUnavailable={lookupProfitUnavailable}
                lookupSourceWorld={lookupSourceWorld} lookupSalesBasis={lookupSalesBasis} lookupProvidedDiscountBasis={lookupProvidedDiscountBasis}
                onChange={onChange} />
              const fieldLabel = getSelectionFieldSummary(selection, filterFieldOptions, t)

              return (
                <div className="reports-stocks-selection-summary app-selection-surface" data-selected={hasFixedReportAxes(dataSource) ? selection.IsChecked !== false : selection.IsChecked} key={getSelectionRenderKey(selection, index)}>
                  <Checkbox
                    aria-label={`${t('Умова відбору')} ${index + 1}`}
                    checked={hasFixedReportAxes(dataSource) ? selection.IsChecked !== false : selection.IsChecked}
                    onChange={() => onChange({ kind: 'replace', index, selection: { ...selection, IsChecked: hasFixedReportAxes(dataSource) ? selection.IsChecked === false : !selection.IsChecked } })}
                  />
                  <Text className="reports-stocks-selection-summary__copy">
                    <span className="reports-stocks-selection-summary__field">{fieldLabel}</span>
                    <span className="reports-stocks-selection-summary__condition">
                      {selection.FilterCondition.Name}
                    </span>
                    <span className="reports-stocks-selection-summary__value">
                      <TableChip value={getSelectionValuesSummary(selection, t)} tone="document" />
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

      <ReportModal
        centered
        className="reports-stocks-selection-modal"
        opened={Boolean(draftSelection)}
        size="lg"
        title={editorIndex === -1 ? t('Додати умову відбору') : t('Редагувати умову відбору')}
        onClose={closeEditor}
      >
        {draftSelection ? (
          <Stack gap={10}>
            {analysis ? <><Text size="sm">Поле</Text><Button variant="default" onClick={() => setFieldPickerOpen(true)}>
              {analysis.filters.find(f => f.type === draftSelection.SelectedField.Type && draftSelection.SelectedField.Name)?.name ?? 'Оберіть поле'}</Button>
              <ReportFieldPicker opened={fieldPickerOpen} title="Поле відбору" options={analysis.filters.map(f => ({ value: String(f.type), label: f.name, path: f.path, disabled: f.available === false, reason: f.unavailabilityReason }))}
                onClose={() => setFieldPickerOpen(false)} onSelect={value => {
                  const field = analysis.filters.find(f => String(f.type) === value)!
                  setDraftSelection(current => current ? { ...current, SelectedField: { Type: field.type, Name: field.name },
                    FilterCondition: analysisFilterConditions(dataset, field.type)[0], Values: [] } : current)
                  setFieldPickerOpen(false)
                }} /></> : <Select
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
            />}
            <div className="reports-stocks-selection-modal__controls">
              <Select
                allowDeselect={false}
                data={filterConditions.map((condition) => ({
                  label: condition.Name,
                  value: String(condition.Type),
                  disabled: admittedConditions !== null && !admittedConditions.has(condition.Type)
                    || !!analysisConditionUnavailableReason(draftDescriptor, condition.Type, hierarchyStatus),
                }))}
                label={t('Умова')}
                description={groupConditionsNotice(draftDescriptor, hierarchyStatus)}
                value={String(draftSelection.FilterCondition.Type)}
                onChange={(value) => {
                  const condition = filterConditions.find((item) => String(item.Type) === value) || filterConditions[0]
                  setDraftSelection(current => current ? analysis || draftDescriptor?.hierarchy
                    ? changeAnalysisSelectionCondition(current, condition)
                    : { ...current, FilterCondition: condition } : current)
                }}
              />
              {analysis ? draftSelection.SelectedField.Name ? <CurrentVparivanieAnalysisValuePicker selection={draftSelection} selections={editorSelections} descriptor={draftDescriptor} status={hierarchyStatus} from={from} to={to}
                onChange={Values => setDraftSelection(current => current ? changeAnalysisSelectionValues(current, Values, analysis.filters.find(field => field.type === current.SelectedField.Type)) : current)} /> : <Text size="sm">Оберіть поле відбору.</Text>
                : isDatasetGroupSelection(dataset, draftSelection) ? <CurrentVparivanieAnalysisValuePicker selection={draftSelection} selections={editorSelections}
                  descriptor={draftDescriptor} status={hierarchyStatus} from={from} to={to} searchItems={draftItemSearch}
                  onChange={Values => setDraftSelection(current => current ? { ...current, Values } : current)} /> : <SelectionValuePicker
                dataSource={dataSource}
                lookupProfitReadMode={documentLookup.mode} lookupProfitUnavailable={documentLookup.unavailable} lookupSourceWorld={lookupSourceWorld} lookupSalesBasis={lookupSalesBasis} lookupProvidedDiscountBasis={lookupProvidedDiscountBasis}
                from={from}
                label={t('Значення')}
                selection={draftSelection}
                selections={editorSelections}
                to={to}
                width="100%"
                onChange={(values) => setDraftSelection((current) => current ? { ...current, Values: values } : current)}
              />}
            </div>
            {draftValueError ? <Alert color="yellow">{draftValueError}</Alert> : null}
            <AppModalFooter>
              <Button color="gray" type="button" variant="default" onClick={closeEditor}>{t('Скасувати')}</Button>
              <Button
                color={CREATE_ACTION_COLOR}
                disabled={!draftSelection.SelectedField.Name || !draftSelection.Values.length || !!draftValueError}
                leftSection={<Save size={16} />}
                type="button"
                onClick={saveDraft}
              >
                {t('Зберегти')}
              </Button>
            </AppModalFooter>
          </Stack>
        ) : null}
      </ReportModal>
    </>
  )
}

function InlineReportSelection({ dataset, request, selection, selections, index, dataSource, from, to, filterFieldOptions,
  lookupProfitReadMode, lookupProfitUnavailable, lookupSourceWorld, lookupSalesBasis, lookupProvidedDiscountBasis, onChange,
}: Pick<ReportSelectionsCardProps, 'dataset' | 'request' | 'selections' | 'dataSource' | 'from' | 'to' | 'filterFieldOptions' | 'lookupProfitReadMode'
  | 'lookupProfitUnavailable' | 'lookupSourceWorld' | 'lookupSalesBasis' | 'lookupProvidedDiscountBasis' | 'onChange'> & { selection: ReportSelection; index: number }) {
  const { t } = useI18n()
  const analysis = currentVparivanieAnalysisCapability(dataset)
  const managerLookup = financialBuyerManagerLookupPolicy(dataset, request, selection.SelectedField.Type, lookupProfitReadMode, lookupProfitUnavailable)
  const documentLookup = financialDocumentLookupPolicy(dataset, request, selection.SelectedField.Type, managerLookup.mode, managerLookup.unavailable)
  const financialConditions = dataSource === 35 ? new Set(financialFilterConditionTypes(dataset, request, selection.SelectedField.Type)) : null
  const conditions = analysis ? analysisFilterConditions(dataset, selection.SelectedField.Type)
    : dataSource === 39 ? currentVparivanieFilterConditions(selection.SelectedField.Type)
      : withCurrentGroupCondition(withDatasetGroupConditions(dataset, selection.SelectedField.Type, financialConditions ? REPORT_FILTER_CONDITIONS.filter(condition => (financialConditions.has(condition.Type) || condition.Type === selection.FilterCondition.Type)) : REPORT_FILTER_CONDITIONS,
        financialConditions ?? REPORT_FILTER_CONDITIONS.map(condition => condition.Type)), selection)
  const admittedConditions = financialConditions ? new Set([...financialConditions, ...datasetGroupConditionTypes(dataset, selection.SelectedField.Type, financialConditions)]) : null
  const change = (value: ReportSelection) => onChange({ kind: 'replace', index, selection: value })
  const descriptor = analysis ? analysis.filters.find(field => field.type === selection.SelectedField.Type)
    : datasetHierarchyDescriptor(dataset, selection.SelectedField.Type, selection.SelectedField.Name)
  const hierarchyStatus = useAnalysisHierarchyStatus(needsHierarchyStatus(descriptor))
  const itemSearch = useDatasetItemSearch(dataSource, selection.SelectedField.Type, documentLookup.mode)
  const valueError = analysis ? hierarchyStatusError(descriptor, selection.FilterCondition.Type, hierarchyStatus) ?? analysisSelectionValueError(selection, descriptor)
    : hierarchyStatusError(descriptor, selection.FilterCondition.Type, hierarchyStatus) ?? reportSelectionCardinalityError(selection) ?? datasetGroupSelectionError(dataset, selection)
  const fields = analysis ? [...new Set(analysis.filters.map(field => field.path.join(' / ')))].map(group => ({ group,
    items: analysis.filters.filter(field => field.path.join(' / ') === group).map(field => ({ value: String(field.type), label: field.name,
      disabled: field.available === false })) })) : filterFieldOptions
  return <section className="workbook-inline-selection" role="group" aria-label={t('Умова відбору {position}', { position: index + 1 })}>
    <Checkbox aria-label={t('Увімкнути умову {position}', { position: index + 1 })} checked={selection.IsChecked !== false}
      onChange={event => change({ ...selection, IsChecked: event.currentTarget.checked })} />
    <div className="workbook-inline-selection__field"><Select label={t('Поле')} searchable allowDeselect={false}
      data={fields} placeholder={t('Оберіть поле')} value={selection.SelectedField.Name ? String(selection.SelectedField.Type) : null}
      renderOption={({ option }) => <span title={analysis?.filters.find(field => String(field.type) === option.value)?.unavailabilityReason ?? undefined}>{option.label}</span>}
      onChange={value => {
        const field = analysis ? analysis.filters.find(item => String(item.type) === value) : null
        const option = filterFieldOptions.find(item => item.value === value)
        change({ ...selection, SelectedField: field ? { Type: field.type, Name: field.name } : option?.field ?? { Type: 0, Name: '' },
          FilterCondition: field ? analysisFilterConditions(dataset, field.type)[0]
            : dataSource === 39 ? currentVparivanieFilterConditions(option?.field.Type ?? 0)[0] : conditions[0], Values: [] })
      }} />
      {analysis?.filters.filter(field => field.available === false && selection.SelectedField.Name && field.type === selection.SelectedField.Type).map(field => <Text size="xs" c="dimmed" key={field.type}>{field.name}: {field.unavailabilityReason}</Text>)}
    </div>
    <div className="workbook-inline-selection__condition"><Select label={t('Умова')} allowDeselect={false}
      description={groupConditionsNotice(descriptor, hierarchyStatus)}
      data={conditions.map(condition => ({ value: String(condition.Type), label: condition.Name,
        disabled: admittedConditions !== null && !admittedConditions.has(condition.Type)
          || !!analysisConditionUnavailableReason(descriptor, condition.Type, hierarchyStatus) }))}
      value={String(selection.FilterCondition.Type)} onChange={value => {
        const condition = conditions.find(item => String(item.Type) === value) ?? conditions[0]
        change(analysis || descriptor?.hierarchy ? changeAnalysisSelectionCondition(selection, condition) : { ...selection, FilterCondition: condition })
      }} /></div>
    <div className="workbook-inline-selection__value">{!selection.SelectedField.Name ? <Text size="sm">Оберіть поле відбору.</Text>
      : analysis ? <CurrentVparivanieAnalysisValuePicker selection={selection} selections={selections}
        descriptor={descriptor} status={hierarchyStatus} from={from} to={to}
        onChange={Values => change(changeAnalysisSelectionValues(selection, Values, analysis.filters.find(field => field.type === selection.SelectedField.Type)))} />
      : isDatasetGroupSelection(dataset, selection) ? <CurrentVparivanieAnalysisValuePicker selection={selection} selections={selections}
        descriptor={descriptor} status={hierarchyStatus} from={from} to={to} searchItems={itemSearch} onChange={Values => change({ ...selection, Values })} />
      : <SelectionValuePicker dataSource={dataSource} lookupProfitReadMode={documentLookup.mode} lookupProfitUnavailable={documentLookup.unavailable}
        lookupSourceWorld={lookupSourceWorld} lookupSalesBasis={lookupSalesBasis} lookupProvidedDiscountBasis={lookupProvidedDiscountBasis}
        from={from} to={to} label={t('Значення')} selection={selection} selections={selections} width="100%"
        onChange={Values => change({ ...selection, Values })} />}</div>
    <TableRowAction action="delete" label={t('Видалити умову {position}', { position: index + 1 })} onClick={() => onChange({ kind: 'delete', index })} />
    {valueError && selection.IsChecked !== false ? <div className="workbook-inline-selection__error"><Alert color="yellow">{valueError}</Alert></div> : null}
  </section>
}

function withCurrentGroupCondition(conditions: ReportFilterCondition[], selection: ReportSelection | null | undefined): ReportFilterCondition[] {
  const current = selection?.FilterCondition
  return current && [3, 5, 6, 7].includes(current.Type) && !conditions.some(condition => condition.Type === current.Type)
    ? [...conditions, current].sort((a, b) => a.Type - b.Type) : conditions
}

function useDatasetItemSearch(dataSource: number, field: number | undefined, profitReadMode: 0 | 1 | undefined): AnalysisItemSearch | undefined {
  return useMemo(() => field === undefined || dataSource === 39 ? undefined : (value: string, offset: number, signal: AbortSignal) =>
    searchDatasetReportValues(dataSource, field, { value, offset, limit: LOOKUP_SEARCH_LIMIT }, signal, undefined, undefined, undefined,
      dataSource === 35 || dataSource === 38 ? profitReadMode : undefined)
      .then(items => items.flatMap(item => item.Id === undefined || item.Id === null ? []
        : [{ id: String(item.Id), name: getEntityDisplayName(item), data: { Id: item.Id } }])), [dataSource, field, profitReadMode])
}

function needsHierarchyStatus(descriptor: AnalysisFieldDescriptor | undefined): boolean {
  const hierarchy = analysisHierarchy(descriptor)
  return !!hierarchy && hierarchy.groupKind !== 'productGroup'
}

function hierarchyStatusError(descriptor: AnalysisFieldDescriptor | undefined, condition: number, status: AnalysisHierarchyStatus | null): string | null {
  return status ? analysisConditionUnavailableReason(descriptor, condition, status) : null
}

function groupConditionsNotice(descriptor: AnalysisFieldDescriptor | undefined, status: AnalysisHierarchyStatus | null): string | undefined {
  const reason = analysisHierarchyUnavailableReason(descriptor, status)
  return reason ? `Умови «У групі…» недоступні: ${reason}` : undefined
}

function cloneReportSelection(selection: ReportSelection, dataSource: number): ReportSelection {
  return {
    ...selection,
    FilterCondition: { ...selection.FilterCondition },
    SelectedField: { ...selection.SelectedField },
    Values: selection.Values.map((value) => {
      const reference = dataSource === 35 && selection.SelectedField.Type === 60 ? financialBuyerManagerReference(value.Data)
        : selection.SelectedField.Type === 12 ? financialDocumentReference(value.Data) : null
      return { ...value, Data: reference ?? { ...value.Data } }
    }),
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
  lookupProfitReadMode?: 0 | 1
  lookupProfitUnavailable?: boolean
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

const EMPTY_LOOKUP_OPTIONS: ReportEntity[] = []

export function SelectionValuePicker(props: SelectionValuePickerProps) {
  return isCustomerGroupOrganization(props.dataSource, props.selection.SelectedField.Type)
    ? <CustomerGroupOrganizationPicker selection={props.selection} label={props.label} disabled={props.lookupProfitUnavailable}
        error={props.error} onChange={props.onChange} />
    : <CommonSelectionValuePicker {...props} />
}

function CommonSelectionValuePicker({ dataSource, lookupProfitReadMode, lookupProfitUnavailable, lookupSourceWorld, lookupSalesBasis, lookupProvidedDiscountBasis, error, from, label, selection, selections, to, width = 320, onChange }: SelectionValuePickerProps) {
  const { t } = useI18n()
  const [search, setSearch] = useValueState('')
  const [manualValue, setManualValue] = useValueState('')
  const nativeSalesDocument = usesSalesDocumentLookup(dataSource, selection.SelectedField.Type)
  const lookupScope = JSON.stringify([dataSource, selection.SelectedField.Type, lookupProfitReadMode ?? null, lookupProfitUnavailable === true, ...(nativeSalesDocument || dataSource === 35 && selection.SelectedField.Type === 12 ? [from, to] : [])])
  const [optionResult, setOptionResult] = useValueState<{ scope: string; items: ReportEntity[]; failed?: boolean }>({ scope: '', items: [] })
  const options = optionResult.scope === lookupScope ? optionResult.items : EMPTY_LOOKUP_OPTIONS
  const lookupFailed = optionResult.scope === lookupScope && optionResult.failed === true
  const [isLoading, setLoading] = useValueState(false)
  const [docStatus, setDocStatus] = useValueState('All')
  const [docOrganisationIds, setDocOrganisationIds] = useValueState<string[]>([])
  const [docSelfSales, setDocSelfSales] = useValueState(false)
  const [organizationOptions, setOrganizationOptions] = useValueState<ReportEntity[]>([])
  const [debouncedSearch] = useDebouncedValue(search, LOOKUP_SEARCH_DEBOUNCE_MS)
  const nativeLookup = usesNativeReportLookup(dataSource) || usesPurchaseReceiptWarehouseLookup(dataSource, selection.SelectedField.Type)
  // Current reservations resolve exact ClientAgreement identities from their own
  // facts; the sales-only dependent customer-agreement picker must not run here.
  const lookupMode = usesSharedProductTopLookup(dataSource, selection.SelectedField.Type) ? 'static'
    : nativeLookup || nativeSalesDocument ? 'search' : getSelectionLookupMode(selection.SelectedField.Type)
  const isSaleDocumentFilter = !nativeLookup && !nativeSalesDocument && PERIOD_SCOPED_FILTER_FIELD_TYPES.has(selection.SelectedField.Type)
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
  const minSearchLength = nativeLookup || nativeSalesDocument ? 0 : getSelectionLookupMinLength(selection.SelectedField.Type)
  const needsPeriod = nativeSalesDocument || isSaleDocumentFilter || dataSource === 35 && selection.SelectedField.Type === 12
  const dependentClientNetId = lookupMode === 'dependent' ? getDependentClientNetId(selections) : ''
  const selectOptions = useMemo(
    () =>
      mergeReportEntities([...selection.Values.map((value) => financialSelectionEntity(value, dataSource, selection.SelectedField.Type)), ...options]).map((entity) => ({
        label: getEntityDisplayName(entity),
        value: getReportEntityKey(entity, getEntityDisplayName(entity)),
      })),
    [options, selection.Values, dataSource, selection.SelectedField.Type],
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
    if (lookupProfitUnavailable || !selection.SelectedField.Name || lookupMode === 'manual') {
      setOptionResult({ scope: lookupScope, items: [] })
      setLoading(false)

      return
    }

    if (lookupMode === 'search' && normalizedSearch.length < minSearchLength) {
      setOptionResult({ scope: lookupScope, items: [] })
      setLoading(false)

      return
    }

    if (lookupMode === 'dependent' && !dependentClientNetId) {
      setOptionResult({ scope: lookupScope, items: [] })
      setLoading(false)

      return
    }

    if (needsPeriod && (!from || !to)) {
      setOptionResult({ scope: lookupScope, items: [] })
      setLoading(false)

      return
    }

    let cancelled = false
    const controller = new AbortController()

    async function loadOptions() {
      setOptionResult(current => current.scope === lookupScope ? current : { scope: lookupScope, items: [] })
      setLoading(true)

      try {
        const nextOptions =
          lookupMode === 'dependent'
            ? await getReportClientAgreements(dependentClientNetId)
            : await loadSelectionLookupOptions(
                dataSource, selection.SelectedField.Type, normalizedSearch, from, to,
                controller.signal, saleDocumentFilters, lookupSourceWorld, lookupSalesBasis, lookupProvidedDiscountBasis, lookupProfitReadMode,
              )

        if (!cancelled) {
          setOptionResult({ scope: lookupScope, items: nextOptions })
        }
      } catch {
        if (!cancelled) {
          setOptionResult({ scope: lookupScope, items: [], failed: true })
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
    lookupProfitReadMode,
    lookupProfitUnavailable,
    lookupScope,
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
    setOptionResult,
    to,
  ])

  function selectedValueKey(value: ReportSelectedValue) {
    return getReportEntityKey(financialSelectionEntity(value, dataSource, selection.SelectedField.Type), value.Name)
  }

  function addEntity(entity: ReportEntity) {
    const key = getReportEntityKey(entity, getEntityDisplayName(entity))

    if (!isMultiValueReportCondition(selection.FilterCondition.Type)) {
      onChange([createSelectedValue(entity, dataSource, selection.SelectedField.Type)])
      return
    }
    if (selection.Values.some((value) => selectedValueKey(value) === key)) return

    onChange([...selection.Values, createSelectedValue(entity, dataSource, selection.SelectedField.Type)])
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
      {lookupProfitUnavailable ? <Text size="sm" c="orange" role="status">
        {t('Сервер ще не підтримує довідник поточних документів GBA для цього звіту. Збережені відбори залишено; новий пошук недоступний.')}
      </Text> : null}
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
      ) : isMultiValueReportCondition(selection.FilterCondition.Type) ? (
        <ReportValueAutocomplete label={label} search={search} onSearchChange={setSearch}
          data={isLoading || lookupMode === 'search' && search.trim() !== normalizedSearch ? [] : selectOptions.filter(option =>
            lookupMode !== 'search' || !search.trim() || options.some(entity => getReportEntityKey(entity, getEntityDisplayName(entity)) === option.value))}
          selected={selection.Values.map(value => ({ value: selectedValueKey(value), label: value.Name }))}
          loading={isLoading || lookupMode === 'search' && search.trim() !== normalizedSearch} disabled={lookupProfitUnavailable}
          remote={lookupMode === 'search'} error={error}
          emptyMessage={lookupFailed ? t('Не вдалося завантажити значення. Змініть пошук, щоб спробувати ще раз.')
            : needsPeriod && (!from || !to) ? t('Спочатку вкажіть коректний період')
            : lookupMode === 'search' && normalizedSearch.length < minSearchLength ? t('Введіть мінімум 2 символи')
            : lookupMode === 'dependent' && !dependentClientNetId ? t('Спочатку оберіть клієнта') : undefined}
          onChange={keys => {
            const desired = new Set(keys)
            const previous = new Set(selection.Values.map(value => selectedValueKey(value)))
            const added = options.filter(entity => {
              const key = getReportEntityKey(entity, getEntityDisplayName(entity))
              return desired.has(key) && !previous.has(key)
            }).map(entity => createSelectedValue(entity, dataSource, selection.SelectedField.Type))
            onChange([...selection.Values.filter(value => desired.has(selectedValueKey(value))), ...added])
          }} />
      ) : (
        <Select
          clearable
          searchable
          disabled={lookupProfitUnavailable}
          data={selectOptions}
          error={error}
          filter={lookupMode === 'search' ? keepServerLookupResults : undefined}
          label={label}
          nothingFoundMessage={
            lookupFailed
              ? t('Не вдалося завантажити значення. Змініть пошук, щоб спробувати ще раз.')
              : needsPeriod && (!from || !to)
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
              ? mergeReportEntities([...selection.Values.map((selectedValue) => financialSelectionEntity(selectedValue, dataSource, selection.SelectedField.Type)), ...options])
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
      {selection.Values.length && (lookupMode === 'manual' || !isMultiValueReportCondition(selection.FilterCondition.Type)) ? (
        <Group gap={4}>
          {selection.Values.map((value, valueIndex) => (
            <Badge
              className="app-role-pill is-gray reports-stocks-selected-value"
              key={selectedValueKey(value)}
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

  return isTaken ? current : appendBeforeDocumentDetail(current, item)
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

  if (error instanceof Error && isAuthoredServerMessage(error.message)) return error.message
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



// The searched lookups match on fields the option label never shows — a user's по батькові, e-mail or phone
// number, a client's ЄДРПОУ or code of region — and Mantine's default filter then drops those very rows because
// the typed text is not in the label, so a hit the server just found reads as «Нічого не знайдено». Everything
// the server returned is already the answer to the query; show it unfiltered. The static lists keep the default
// filter — there the whole catalogue is in the browser and the filtering is the search.
const keepServerLookupResults: OptionsFilter = ({ options }) => options

function usesPurchaseReceiptWarehouseLookup(dataSource: number, fieldType: number): boolean {
  return dataSource === 3 && fieldType === REPORT_FILTER_FIELD_TYPES.warehouse
}

function usesSharedProductTopLookup(dataSource: number, fieldType: number): boolean {
  return (dataSource === 3 || dataSource === 45) && fieldType === REPORT_FILTER_FIELD_TYPES.productTop
}

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
  lookupProfitReadMode?: 0 | 1,
): Promise<ReportEntity[]> {
  if (usesSharedProductTopLookup(dataSource, fieldType)) return getReportProductTop()
  if (usesSalesDocumentLookup(dataSource, fieldType))
    return searchNativeSalesDocuments(fieldType, from, to, {limit: LOOKUP_SEARCH_LIMIT, offset: 0, value}, signal)
  if (dataSource === 35 && fieldType === 60) {
    if (lookupProfitReadMode !== 0) throw new Error('Менеджери покупця доступні лише для поточного розрахунку GBA.')
    return searchCurrentFinancialBuyerManagers({ limit: LOOKUP_SEARCH_LIMIT, offset: 0, value }, signal)
  }
  if (dataSource === 35 && fieldType === 12) {
    if (lookupProfitReadMode !== 0) throw new Error('Документи доступні лише для поточного розрахунку GBA.')
    return searchCurrentFinancialDocuments(from, to, { limit: LOOKUP_SEARCH_LIMIT, offset: 0, value }, signal)
  }
  if (dataSource === 46 && [0,1,2,6,9,20].includes(fieldType))
    return searchDatasetReportValues(dataSource, fieldType, { limit: LOOKUP_SEARCH_LIMIT, offset: 0, value }, signal)
  if ((dataSource === 2 || dataSource === 44) && [6, 1, 2, 21, 64].includes(fieldType))
    return searchDatasetReportValues(dataSource, fieldType, { limit: LOOKUP_SEARCH_LIMIT, offset: 0, value }, signal)
  if (usesNativeReportLookup(dataSource) || usesPurchaseReceiptWarehouseLookup(dataSource, fieldType)) {
    const params = { limit: LOOKUP_SEARCH_LIMIT, offset: 0, value }
    if ((dataSource === 35 || dataSource === 38) && lookupProfitReadMode !== undefined)
      return searchDatasetReportValues(dataSource, fieldType, params, signal, undefined, undefined, undefined, lookupProfitReadMode)
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

function financialSelectionEntity(value: ReportSelectedValue, dataSource: number, field: number): ReportEntity {
  if (usesSalesDocumentLookup(dataSource, field)) return salesDocumentSelectedEntity(value, field)
  if (dataSource !== 35) return value.Data
  if (field === 60) return financialBuyerManagerSelectedEntity(value)
  return field === 12 ? financialDocumentSelectedEntity(value) : value.Data
}

function createSelectedValue(entity: ReportEntity, dataSource?: number, field?: number): ReportSelectedValue {
  const reference = dataSource === 35 && field === 60 ? financialBuyerManagerEntityReference(entity)
    : dataSource === 35 && field === 12 ? financialDocumentEntityReference(entity) : null
  return {
    Data: usesSalesDocumentLookup(dataSource ?? -1, field ?? -1) ? { Id: entity.Id } : reference ?? entity,
    Name: getEntityDisplayName(entity),
    Value: (dataSource === 16 || dataSource === 17 || dataSource === 18 || dataSource === 20 || dataSource === 21 || dataSource === 23 || dataSource === 24 || dataSource === 25 || dataSource === 28 || dataSource === 39 || dataSource === 41) ? 0 : getReportEntityNumericValue(entity),
  }
}

function getReportEntityKey(entity: ReportEntity, fallback = ''): string {
  const salesDocument = salesDocumentKey(entity)
  if (salesDocument) return salesDocument
  const manager = financialBuyerManagerEntityReference(entity)
  if (manager) return manager.Id
  const document = financialDocumentEntityReference(entity)
  if (document) return financialDocumentKey(document)
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
