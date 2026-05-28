import type {
  ReportFilterCondition,
  ReportFilterFieldGroup,
  ReportGroupingGroup,
  ReportGroupingItem,
  ReportMeasurementGroup,
  ReportMeasurementSelection,
} from '../types'

export const REPORT_CONDITION_TYPES = {
  equals: 0,
  notEquals: 1,
  inList: 2,
  inGroupFromList: 3,
  notInList: 4,
  notInGroupFromList: 5,
  inGroup: 6,
  notInGroup: 7,
} as const

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

export const REPORT_GROUPING_TYPES = {
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

export const REPORT_FIELD_TYPES = {
  salesQuantity: 0,
  salesValueWithoutVat: 2,
  salesValueVat: 3,
  salesValueWithVat: 4,
  costWithoutVat: 6,
  costVat: 7,
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
  { Name: 'У групі зі списку', Type: REPORT_CONDITION_TYPES.inGroupFromList },
  { Name: 'Не у списку', Type: REPORT_CONDITION_TYPES.notInList },
  { Name: 'Не у групі зі списку', Type: REPORT_CONDITION_TYPES.notInGroupFromList },
  { Name: 'У групі', Type: REPORT_CONDITION_TYPES.inGroup },
  { Name: 'Не у групі', Type: REPORT_CONDITION_TYPES.notInGroup },
]

export const REPORT_GROUPING_GROUPS: ReportGroupingGroup[] = [
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
      { key: 'CustomerManager', label: 'Відповідальний менеджер', type: REPORT_GROUPING_TYPES.customerManager },
    ],
  },
  {
    categoryKey: 'SaleDocument',
    categoryLabel: 'Документ продажу',
    items: [
      { key: 'SaleDocument', label: 'Документ продажу', type: REPORT_GROUPING_TYPES.saleDocument },
      { key: 'SaleReturnDocument', label: 'Повернення від клієнта', type: REPORT_GROUPING_TYPES.saleReturnDocument },
      { key: 'SaleDocumentManagerInput', label: 'Ввів документ', type: REPORT_GROUPING_TYPES.saleDocumentManagerInput },
      { key: 'SaleDocumentManagerPosted', label: 'Провів документ', type: REPORT_GROUPING_TYPES.saleDocumentManagerPosted },
      { key: 'Supplier', label: 'Постачальник', type: REPORT_GROUPING_TYPES.supplier },
    ],
  },
]

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
      { type: REPORT_FILTER_FIELD_TYPES.customerManager, label: 'CustomerManager' },
      { type: REPORT_FILTER_FIELD_TYPES.customerPriceType, label: 'CustomerPriceType' },
    ],
  },
  {
    type: REPORT_FILTER_FIELD_TYPES.saleDocument,
    label: 'SaleDocument',
    children: [
      { type: REPORT_FILTER_FIELD_TYPES.saleDocumentNumberDate, label: 'SaleDocumentNumberDate' },
      { type: REPORT_FILTER_FIELD_TYPES.saleReturnDocument, label: 'SaleReturnDocument' },
      { type: REPORT_FILTER_FIELD_TYPES.saleDocumentManagerInput, label: 'SaleDocumentManagerInput' },
      { type: REPORT_FILTER_FIELD_TYPES.saleDocumentManagerPosted, label: 'SaleDocumentManagerPosted' },
    ],
  },
]

export const REPORT_FIELD_LABELS: Record<string, string> = {
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
        { Name: 'CostVAT', IsChecked: false, Type: REPORT_FIELD_TYPES.costVat },
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
    group.SubList.filter((item) => item.IsChecked).map((item) => ({
      ...item,
      parentName: group.Name,
    })),
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

export function isManyValueCondition(conditionType: number): boolean {
  return (
    conditionType === REPORT_CONDITION_TYPES.inList
    || conditionType === REPORT_CONDITION_TYPES.inGroupFromList
    || conditionType === REPORT_CONDITION_TYPES.notInList
    || conditionType === REPORT_CONDITION_TYPES.notInGroupFromList
  )
}
