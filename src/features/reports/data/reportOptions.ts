import type {
  ReportFilterCondition,
  ReportFilterField,
  ReportFilterFieldGroup,
  ReportGroupingGroup,
  ReportGroupingItem,
  ReportMeasurementGroup,
  ReportMeasurementSelection,
  ReportRequestBody,
  ReportSelection,
} from '../types'

const REPORT_CONDITION_TYPES = {
  equals: 0,
  notEquals: 1,
  inList: 2,
  notInList: 4,
} as const

// Codes 3/5/6/7 (InGroupFromList, NotInGroupFromList, InGroup, NotInGroup) are not offered: the report engine
// keeps only Equals/NotEquals/InList/NotInList and drops everything else («if (!membership) continue» in
// SalesReportProjectionRepository.BuildFilters), so the report comes back unfiltered while the screen claims it is
// filtered — and each negative twin returns exactly the positive twin's numbers. There is no product group
// hierarchy to implement them against either. The codes survive here only so saved templates that still carry one
// can be recognised and dropped.
const UNSUPPORTED_CONDITION_TYPES = new Set<number>([3, 5, 6, 7])

export const REPORT_FILTER_FIELD_TYPES = {
  organization: 0,
  product: 1,
  productArticle: 2,
  productTop: 3,
  productGroup: 4,
  customer: 5,
  customerName: 6,
  customerRegion: 7,
  customerRegionCode: 8,
  customerContract: 9,
  customerManager: 10,
  customerPriceType: 11,
  saleDocument: 12,
  saleDocumentNumberDate: 13,
  saleReturnDocument: 14,
  saleDocumentManagerInput: 15,
  saleDocumentManagerPosted: 16,
} as const

const REPORT_GROUPING_TYPES = {
  year: 0,
  quarter: 1,
  month: 2,
  day: 3,
  organization: 4,
  product: 5,
  productArticle: 6,
  productName: 7,
  productDescription: 8,
  productTop: 9,
  productGroup: 10,
  customer: 11,
  customerName: 12,
  customerRegion: 13,
  customerRegionCode: 14,
  customerContract: 15,
  customerManager: 16,
  saleDocument: 17,
  saleReturnDocument: 18,
  saleDocumentManagerInput: 19,
  saleDocumentManagerPosted: 20,
  supplier: 21,
} as const

// costVat (7) is not offered: PivotCell.Compute returns a hardcoded 0m for it, so «ПДВ собівартості» only ever
// widens the sheet with a zero column.
const REPORT_FIELD_TYPES = {
  salesQuantity: 0,
  salesValueWithoutVat: 2,
  salesValueVat: 3,
  salesValueWithVat: 4,
  costWithoutVat: 6,
  costWithVat: 8,
  markupWithoutVat: 10,
  markupVat: 11,
  markupWithVat: 12,
  profitabilityPercentWithoutVat: 14,
  profitabilityPercentWithVat: 15,
} as const

export const REPORT_FILTER_CONDITIONS: ReportFilterCondition[] = [
  { Name: 'Дорівнює', Type: REPORT_CONDITION_TYPES.equals },
  { Name: 'Не дорівнює', Type: REPORT_CONDITION_TYPES.notEquals },
  { Name: 'У списку', Type: REPORT_CONDITION_TYPES.inList },
  { Name: 'Не у списку', Type: REPORT_CONDITION_TYPES.notInList },
]

// Legacy accepted multiple filter values only for the list conditions; Equals/NotEquals take exactly one value.
const MULTI_VALUE_CONDITION_TYPES = new Set<number>([
  REPORT_CONDITION_TYPES.inList,
  REPORT_CONDITION_TYPES.notInList,
])

export function isMultiValueReportCondition(type: number): boolean {
  return MULTI_VALUE_CONDITION_TYPES.has(type)
}

const REPORT_GROUPING_GROUPS: ReportGroupingGroup[] = [
  {
    categoryKey: 'Date',
    categoryLabel: 'Дата',
    items: [
      { key: 'Year', label: 'По роках', type: REPORT_GROUPING_TYPES.year },
      { key: 'Quarter', label: 'По кварталах', type: REPORT_GROUPING_TYPES.quarter },
      { key: 'Month', label: 'По місяцях', type: REPORT_GROUPING_TYPES.month },
      { key: 'Day', label: 'По днях', type: REPORT_GROUPING_TYPES.day },
    ],
  },
  {
    categoryKey: 'Organization',
    categoryLabel: 'Організація',
    items: [{ key: 'Organization', label: 'Організація', type: REPORT_GROUPING_TYPES.organization }],
  },
  {
    categoryKey: 'Product',
    categoryLabel: 'Товар',
    items: [
      { key: 'Product', label: 'Товар', type: REPORT_GROUPING_TYPES.product },
      { key: 'ProductArticle', label: 'Артикул', type: REPORT_GROUPING_TYPES.productArticle },
      { key: 'ProductName', label: 'Назва товару', type: REPORT_GROUPING_TYPES.productName },
      { key: 'ProductDescription', label: 'Опис товару', type: REPORT_GROUPING_TYPES.productDescription },
      { key: 'ProductTop', label: 'Топ товару', type: REPORT_GROUPING_TYPES.productTop },
      { key: 'ProductGroup', label: 'Група товару', type: REPORT_GROUPING_TYPES.productGroup },
    ],
  },
  {
    categoryKey: 'Customer',
    categoryLabel: 'Клієнт',
    items: [
      { key: 'CustomerName', label: 'Клієнт', type: REPORT_GROUPING_TYPES.customerName },
      { key: 'CustomerRegion', label: 'Регіон', type: REPORT_GROUPING_TYPES.customerRegion },
      { key: 'CustomerRegionCode', label: 'Код регіону', type: REPORT_GROUPING_TYPES.customerRegionCode },
      { key: 'CustomerContract', label: 'Договір', type: REPORT_GROUPING_TYPES.customerContract },
    ],
  },
  {
    categoryKey: 'SaleDocument',
    categoryLabel: 'Документ продажу',
    items: [
      { key: 'SaleDocument', label: 'Документ продажу', type: REPORT_GROUPING_TYPES.saleDocument },
      { key: 'SaleDocumentManagerInput', label: 'Ввів документ', type: REPORT_GROUPING_TYPES.saleDocumentManagerInput },
      { key: 'SaleDocumentManagerPosted', label: 'Провів документ', type: REPORT_GROUPING_TYPES.saleDocumentManagerPosted },
    ],
  },
]

// Withheld options, and why — do not re-add them without a server change:
// · SaleReturnDocument (grouping 18) and Supplier (grouping 21) are projected as «CAST(NULL AS nvarchar(50))» by
//   SalesReportProjectionRepository.MapDimension, so grouping by either collapses the whole report into one blank
//   row; the SaleReturnDocument filter field (14) is a no-op there too («case ...SaleReturnDocument: break»).
// · CustomerManager (grouping 16 / filter field 10) and SaleDocumentManagerInput (19 / 15) both resolve to the
//   very same s.UserID, so «Відповідальний менеджер» promised the client's account manager and delivered whoever
//   keyed the document. Only the honest «Ввів документ» entry is offered; saved templates carrying the old one
//   are remapped rather than dropped, because the server behaviour is identical.
const UNSUPPORTED_GROUPING_TYPES = new Set<number>([
  REPORT_GROUPING_TYPES.saleReturnDocument,
  REPORT_GROUPING_TYPES.supplier,
])

const UNSUPPORTED_FILTER_FIELD_TYPES = new Set<number>([REPORT_FILTER_FIELD_TYPES.saleReturnDocument])

const GROUPING_TYPE_REPLACEMENTS = new Map<number, number>([
  [REPORT_GROUPING_TYPES.customerManager, REPORT_GROUPING_TYPES.saleDocumentManagerInput],
])

const FILTER_FIELD_TYPE_REPLACEMENTS = new Map<number, number>([
  [REPORT_FILTER_FIELD_TYPES.customerManager, REPORT_FILTER_FIELD_TYPES.saleDocumentManagerInput],
])

export const REPORT_FILTER_FIELD_GROUPS: ReportFilterFieldGroup[] = [
  {
    type: REPORT_FILTER_FIELD_TYPES.organization,
    label: 'Organization',
    children: [{ type: REPORT_FILTER_FIELD_TYPES.organization, label: 'Organization' }],
  },
  {
    type: REPORT_FILTER_FIELD_TYPES.product,
    label: 'Product',
    children: [
      { type: REPORT_FILTER_FIELD_TYPES.productArticle, label: 'ProductArticle' },
      { type: REPORT_FILTER_FIELD_TYPES.productTop, label: 'ProductTop' },
      { type: REPORT_FILTER_FIELD_TYPES.productGroup, label: 'ProductGroup' },
    ],
  },
  {
    type: REPORT_FILTER_FIELD_TYPES.customer,
    label: 'Customer',
    children: [
      { type: REPORT_FILTER_FIELD_TYPES.customer, label: 'Customer' },
      { type: REPORT_FILTER_FIELD_TYPES.customerName, label: 'CustomerName' },
      { type: REPORT_FILTER_FIELD_TYPES.customerRegion, label: 'CustomerRegion' },
      { type: REPORT_FILTER_FIELD_TYPES.customerRegionCode, label: 'CustomerRegionCode' },
      { type: REPORT_FILTER_FIELD_TYPES.customerContract, label: 'CustomerContract' },
      { type: REPORT_FILTER_FIELD_TYPES.customerPriceType, label: 'CustomerPriceType' },
    ],
  },
  {
    type: REPORT_FILTER_FIELD_TYPES.saleDocument,
    label: 'SaleDocument',
    children: [
      { type: REPORT_FILTER_FIELD_TYPES.saleDocumentNumberDate, label: 'SaleDocumentNumberDate' },
      { type: REPORT_FILTER_FIELD_TYPES.saleDocumentManagerInput, label: 'SaleDocumentManagerInput' },
      { type: REPORT_FILTER_FIELD_TYPES.saleDocumentManagerPosted, label: 'SaleDocumentManagerPosted' },
    ],
  },
]

const REPORT_FIELD_LABELS: Record<string, string> = {
  Cost: 'Собівартість',
  CostVAT: 'ПДВ собівартості',
  CostWithVAT: 'Собівартість з ПДВ',
  CostWithoutVAT: 'Собівартість без ПДВ',
  Customer: 'Тип клієнта',
  CustomerContract: 'Договір',
  CustomerManager: 'Менеджер клієнта',
  CustomerName: 'Клієнт',
  CustomerPriceType: 'Тип ціни',
  CustomerRegion: 'Регіон клієнта',
  CustomerRegionCode: 'Код регіону',
  Date: 'Дата',
  Day: 'По днях',
  Field: 'Поле',
  Markup: 'Націнка',
  MarkupVAT: 'ПДВ націнки',
  MarkupWithVAT: 'Націнка з ПДВ',
  MarkupWithoutVAT: 'Націнка без ПДВ',
  Month: 'По місяцях',
  Organization: 'Організація',
  Product: 'Товар',
  ProductArticle: 'Артикул',
  ProductDescription: 'Опис товару',
  ProductGroup: 'Група товару',
  ProductName: 'Назва товару',
  ProductTop: 'Топ товару',
  Profitability: 'Рентабельність',
  ProfitabilityPercentWithVAT: 'Рентабельність з ПДВ, %',
  ProfitabilityPercentWithoutVAT: 'Рентабельність без ПДВ, %',
  Quarter: 'По кварталах',
  SaleDocument: 'Документ продажу',
  SaleDocumentManagerInput: 'Ввів документ',
  SaleDocumentManagerPosted: 'Провів документ',
  SaleDocumentNumberDate: 'Документ продажу',
  SaleReturnDocument: 'Повернення від клієнта',
  SalesQuantity: 'Кількість продажів',
  SalesValue: 'Сума продажів',
  SalesValueVAT: 'ПДВ продажу',
  SalesValueWithVAT: 'Продажі з ПДВ',
  SalesValueWithoutVAT: 'Продажі без ПДВ',
  Supplier: 'Постачальник',
  Year: 'По роках',
}

export function createDefaultMeasurementGroups(): ReportMeasurementGroup[] {
  return [
    {
      Name: 'SalesQuantity',
      IsChecked: false,
      SubList: [{ Name: 'SalesQuantity', IsChecked: false, Type: REPORT_FIELD_TYPES.salesQuantity }],
    },
    {
      Name: 'SalesValue',
      IsChecked: false,
      SubList: [
        { Name: 'SalesValueWithoutVAT', IsChecked: false, Type: REPORT_FIELD_TYPES.salesValueWithoutVat },
        { Name: 'SalesValueVAT', IsChecked: false, Type: REPORT_FIELD_TYPES.salesValueVat },
        { Name: 'SalesValueWithVAT', IsChecked: false, Type: REPORT_FIELD_TYPES.salesValueWithVat },
      ],
    },
    {
      Name: 'Cost',
      IsChecked: false,
      SubList: [
        { Name: 'CostWithoutVAT', IsChecked: false, Type: REPORT_FIELD_TYPES.costWithoutVat },
        { Name: 'CostWithVAT', IsChecked: false, Type: REPORT_FIELD_TYPES.costWithVat },
      ],
    },
    {
      Name: 'Markup',
      IsChecked: false,
      SubList: [
        { Name: 'MarkupWithoutVAT', IsChecked: false, Type: REPORT_FIELD_TYPES.markupWithoutVat },
        { Name: 'MarkupVAT', IsChecked: false, Type: REPORT_FIELD_TYPES.markupVat },
        { Name: 'MarkupWithVAT', IsChecked: false, Type: REPORT_FIELD_TYPES.markupWithVat },
      ],
    },
    {
      Name: 'Profitability',
      IsChecked: false,
      SubList: [
        {
          Name: 'ProfitabilityPercentWithoutVAT',
          IsChecked: false,
          Type: REPORT_FIELD_TYPES.profitabilityPercentWithoutVat,
        },
        {
          Name: 'ProfitabilityPercentWithVAT',
          IsChecked: false,
          Type: REPORT_FIELD_TYPES.profitabilityPercentWithVat,
        },
      ],
    },
  ]
}

export function flattenCheckedMeasurements(groups: ReportMeasurementGroup[]): ReportMeasurementSelection[] {
  return groups.flatMap((group) =>
    group.SubList.reduce<ReportMeasurementSelection[]>((acc, item) => {
      if (item.IsChecked) {
        acc.push({ ...item, parentName: group.Name })
      }
      return acc
    }, []),
  )
}

export function flattenGroupingOptions(groups = REPORT_GROUPING_GROUPS): Array<ReportGroupingItem & { group: string }> {
  return groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.categoryLabel })))
}

export function getReportFieldLabel(key?: string): string {
  if (!key) {
    return ''
  }

  return REPORT_FIELD_LABELS[key] || key
}

const GROUPING_ITEMS_BY_TYPE = new Map<number, ReportGroupingItem>(
  REPORT_GROUPING_GROUPS.flatMap((group) => group.items.map((item) => [item.type, item] as const)),
)

const FILTER_FIELDS_BY_TYPE = new Map<number, ReportFilterField>(
  REPORT_FILTER_FIELD_GROUPS.flatMap((group) =>
    group.children.map((child) =>
      [child.type, { Name: child.label, Type: child.type, ParentType: group.label }] as const,
    ),
  ),
)

const SUPPORTED_MEASUREMENT_TYPES = new Set<number>(
  createDefaultMeasurementGroups().flatMap((group) => group.SubList.map((item) => item.Type)),
)

export type SanitizedReportTemplate = {
  data: ReportRequestBody
  removedCount: number
}

// Templates live in localStorage and predate the withdrawal of the options above, so a saved one can still ask for
// a grouping the server projects as NULL, a condition it silently drops or a measure it hardcodes to zero. Rebuild
// the payload out of what the engine actually honours before it reaches the form — remapping where the withdrawn
// option had an exact equivalent, dropping it otherwise, so the report never claims more than it did.
export function sanitizeReportTemplate(data: ReportRequestBody): SanitizedReportTemplate {
  let removedCount = 0

  function sanitizeGroupings(items: ReportGroupingItem[]): ReportGroupingItem[] {
    return items.reduce<ReportGroupingItem[]>((acc, item) => {
      if (UNSUPPORTED_GROUPING_TYPES.has(item.type)) {
        removedCount += 1

        return acc
      }

      const replacementType = GROUPING_TYPE_REPLACEMENTS.get(item.type)
      const replacement = replacementType === undefined ? undefined : GROUPING_ITEMS_BY_TYPE.get(replacementType)

      acc.push(replacement ?? item)

      return acc
    }, [])
  }

  const selections = (data.selections ?? []).reduce<ReportSelection[]>((acc, selection) => {
    const fieldType = selection.SelectedField?.Type
    const conditionType = selection.FilterCondition?.Type

    if (fieldType === undefined || UNSUPPORTED_FILTER_FIELD_TYPES.has(fieldType)) {
      removedCount += 1

      return acc
    }

    if (conditionType === undefined || UNSUPPORTED_CONDITION_TYPES.has(conditionType)) {
      removedCount += 1

      return acc
    }

    const replacementType = FILTER_FIELD_TYPE_REPLACEMENTS.get(fieldType)
    const replacement = replacementType === undefined ? undefined : FILTER_FIELDS_BY_TYPE.get(replacementType)

    acc.push(replacement ? { ...selection, SelectedField: replacement } : selection)

    return acc
  }, [])

  const measurements = (data.sorted?.Measurements ?? []).filter((measurement) => {
    if (SUPPORTED_MEASUREMENT_TYPES.has(measurement.Type)) {
      return true
    }

    removedCount += 1

    return false
  })

  return {
    data: {
      ...data,
      selections,
      sorted: {
        Col: sanitizeGroupings(data.sorted?.Col ?? []),
        Measurements: measurements,
        Row: sanitizeGroupings(data.sorted?.Row ?? []),
      },
    },
    removedCount,
  }
}
