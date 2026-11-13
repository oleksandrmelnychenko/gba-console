import type {
  ReportFilterCondition,
  ReportFilterFieldGroup,
  ReportGroupingGroup,
  ReportGroupingItem,
  ReportMeasurementGroup,
  ReportMeasurementSelection,
  ReportSelection,
} from '../types'

const REPORT_CONDITION_TYPES = {
  equals: 0,
  notEquals: 1,
  inList: 2,
  notInList: 4,
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
  supplier: 17,
  supplierContract: 18,
  purchaseDocument: 19,
  productMeasureUnit: 20,
  warehouse: 21,
  stockConsignmentItem: 22,
  stockOrganization: 23,
  supplierReturnDocument: 24,
  debtCurrency: 25,
  debtDocument: 26,
  supplierReturnMode: 27,
  documentOrganization: 28,
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
  sourceSaleResponsible: 22,
  sourceOrderResponsible: 23,
  productMeasureUnit: 28,
  sourceProject: 63,
  sourceDivision: 64,
  sourceProductCharacteristic: 65,
  sourceOrder: 66,
  sourceSaleDocument: 67,
} as const

// Cost VAT is supplied by published 1C batch allocations. Missing breakdowns
// remain blank on the server; they are not a zero-VAT claim.
const REPORT_FIELD_TYPES = {
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
  marginPercentWithoutVat: 115,
  marginPercentWithVat: 116,
  markupPercentWithoutVat: 117,
  markupPercentWithVat: 118,
} as const

export const REPORT_FILTER_CONDITIONS: ReportFilterCondition[] = [
  { Name: 'Дорівнює', Type: REPORT_CONDITION_TYPES.equals },
  { Name: 'Не дорівнює', Type: REPORT_CONDITION_TYPES.notEquals },
  { Name: 'У списку', Type: REPORT_CONDITION_TYPES.inList },
  { Name: 'Не у списку', Type: REPORT_CONDITION_TYPES.notInList },
]

// Cardinality is independent of availability: a dataset must separately admit group operators.
const MULTI_VALUE_CONDITION_TYPES = new Set<number>([
  REPORT_CONDITION_TYPES.inList,
  REPORT_CONDITION_TYPES.notInList,
  3, // InGroupFromList
  5, // NotInGroupFromList
])

export function isMultiValueReportCondition(type: number): boolean {
  return MULTI_VALUE_CONDITION_TYPES.has(type)
}

export function reportSelectionCardinalityError(selection: ReportSelection): string | null {
  return selection.Values.length > 1 && !isMultiValueReportCondition(selection.FilterCondition.Type)
    ? [6, 7].includes(selection.FilterCondition.Type) ? 'Оберіть одну групу для цієї умови.' : 'Оберіть одне значення для цієї умови.'
    : null
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
      { key: 'ProductMeasureUnit', label: 'Одиниця виміру', type: REPORT_GROUPING_TYPES.productMeasureUnit },
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
      // «Повернення від клієнта» is a dimension of its own, not a subtraction: a returned line keeps its sales
      // value where it was and appears under the document that returned it, so the report can show what was sold
      // and what came back side by side. Sales are never netted down by it.
      { key: 'SaleReturnDocument', label: 'Повернення від клієнта', type: REPORT_GROUPING_TYPES.saleReturnDocument },
      { key: 'SaleDocumentManagerInput', label: 'Ввів документ', type: REPORT_GROUPING_TYPES.saleDocumentManagerInput },
      { key: 'SaleDocumentManagerPosted', label: 'Провів документ', type: REPORT_GROUPING_TYPES.saleDocumentManagerPosted },
      { key: 'SourceSaleResponsible', label: 'Відповідальний реалізації (1С)', type: REPORT_GROUPING_TYPES.sourceSaleResponsible },
      { key: 'SourceOrderResponsible', label: 'Відповідальний замовлення (1С)', type: REPORT_GROUPING_TYPES.sourceOrderResponsible },
    ],
  },
  {
    categoryKey: 'OneCSource',
    categoryLabel: 'Зерно джерела 1С',
    items: [
      { key: 'SourceProject', label: 'Проєкт (1С)', type: REPORT_GROUPING_TYPES.sourceProject },
      { key: 'SourceDivision', label: 'Підрозділ (1С)', type: REPORT_GROUPING_TYPES.sourceDivision },
      { key: 'SourceProductCharacteristic', label: 'Характеристика товару (1С)', type: REPORT_GROUPING_TYPES.sourceProductCharacteristic },
      { key: 'SourceOrder', label: 'Замовлення покупця (1С)', type: REPORT_GROUPING_TYPES.sourceOrder },
      { key: 'SourceSaleDocument', label: 'Документ реалізації (1С)', type: REPORT_GROUPING_TYPES.sourceSaleDocument },
    ],
  },
  {
    categoryKey: 'Supplier',
    categoryLabel: 'Постачальник',
    items: [{ key: 'Supplier', label: 'Постачальник', type: REPORT_GROUPING_TYPES.supplier }],
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
      { type: REPORT_FILTER_FIELD_TYPES.productMeasureUnit, label: 'ProductMeasureUnit' },
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
      { type: REPORT_FILTER_FIELD_TYPES.saleReturnDocument, label: 'SaleReturnDocument' },
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
  Markup: 'Валовий прибуток',
  MarginPercent: 'Маржа, %',
  MarginPercentWithVAT: 'Маржа з ПДВ, %',
  MarginPercentWithoutVAT: 'Маржа без ПДВ, %',
  MarkupPercent: 'Націнка, %',
  MarkupPercentWithVAT: 'Націнка з ПДВ, %',
  MarkupPercentWithoutVAT: 'Націнка без ПДВ, %',
  MarkupVAT: 'ПДВ валового прибутку',
  MarkupWithVAT: 'Валовий прибуток з ПДВ',
  MarkupWithoutVAT: 'Валовий прибуток без ПДВ',
  Month: 'По місяцях',
  Organization: 'Організація',
  Product: 'Товар',
  ProductArticle: 'Артикул',
  ProductDescription: 'Опис товару',
  ProductGroup: 'Група товару',
  ProductName: 'Назва товару',
  ProductMeasureUnit: 'Одиниця виміру',
  Warehouse: 'Склад',
  StockStorageNumber: 'Стелаж',
  StockRowNumber: 'Ряд',
  StockCellNumber: 'Комірка',
  StockConsignmentItem: 'Рядок партії',
  StockOrganization: 'Організація партії',
  StockLotRemainingQuantity: 'Записаний залишок партії',
  StockAgreementValueEur: 'Оцінка за договором, EUR',
  SupplierReturnedQuantity: 'Записана кількість повернення',
  CurrentDebtAmount: 'Записана заборгованість',
  CurrentAccountBalanceAmount: 'Записаний залишок рахунку',
  DistinctSaleClientCount: 'Унікальні клієнти (поточні прив’язки GBA)',
  PaymentRegister: 'Рахунок',
  PaymentCurrency: 'Валюта рахунку',
  PaymentBalanceRecord: 'Запис залишку рахунку',
  PaymentOrganization: 'Організація рахунку',
  PaymentRegisterKind: 'Тип рахунку',
  PaymentRegisterPurpose: 'Призначення рахунку',
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
  SupplierContract: 'Договір постачальника',
  PurchaseDocument: 'Документ надходження',
  SourceSaleResponsible: 'Відповідальний реалізації (1С)',
  SourceOrderResponsible: 'Відповідальний замовлення (1С)',
  SourceProject: 'Проєкт (1С)',
  SourceDivision: 'Підрозділ (1С)',
  SourceProductCharacteristic: 'Характеристика товару (1С)',
  SourceOrder: 'Замовлення покупця (1С)',
  SourceSaleDocument: 'Документ реалізації (1С)',
  OneCPriceComparisonProduct: 'Товар Fenix',
  OneCPriceComparisonClient: 'Клієнт Fenix',
  OneCDiscountAgreement: 'Договір 1С',
  OneCPriceComparisonProject: 'Проєкт Fenix',
  OneCPriceComparisonDivision: 'Підрозділ Fenix',
  OneCSalesValueBeforeDiscount: 'Сума продажу до знижки без ПДВ (1С)',
  OneCSalesDiscountAmount: 'Сума знижки без ПДВ (1С)',
  OneCSalesDiscountPercent: 'Знижка без ПДВ, % (1С)',
  OneCPriceTypeValue: 'Сума за глобальним типом цін (1С)',
  OneCPriceTypeDifference: 'Різниця між продажем і глобальним типом цін (1С)',
  CurrentAgreementGroupDiscountPercent: 'Поточна ставка знижки, %',
  Year: 'По роках',
}

const GROSS_PROFIT_MEASURE_GROUPS: Readonly<Record<string, string>> = { SalesValue: 'Продажі', Markup: 'Валовий прибуток' }

function grossProfitMeasureGroupLabel(dataSource: number, name: string): string | undefined {
  return dataSource === 35 || dataSource === 38 ? GROSS_PROFIT_MEASURE_GROUPS[name] : undefined
}

/** Group vocabulary follows the explicit report source, while caller-owned labels still win. */
export function nativeConstructorMeasureGroupLabel(dataSource: number, name: string): string | undefined {
  return dataSource === 3 && name === 'SalesValue' ? 'Вартість закупівлі' : grossProfitMeasureGroupLabel(dataSource, name)
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
    {
      Name: 'MarginPercent',
      IsChecked: false,
      SubList: [
        { Name: 'MarginPercentWithoutVAT', IsChecked: false, Type: REPORT_FIELD_TYPES.marginPercentWithoutVat },
        { Name: 'MarginPercentWithVAT', IsChecked: false, Type: REPORT_FIELD_TYPES.marginPercentWithVat },
      ],
    },
    {
      Name: 'MarkupPercent',
      IsChecked: false,
      SubList: [
        { Name: 'MarkupPercentWithoutVAT', IsChecked: false, Type: REPORT_FIELD_TYPES.markupPercentWithoutVat },
        { Name: 'MarkupPercentWithVAT', IsChecked: false, Type: REPORT_FIELD_TYPES.markupPercentWithVat },
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

export function measurementGroupCaption(name: string, label: string): string {
  return name === 'Profitability' && !label.includes('%') ? `${label}, %` : label
}

export function getReportFieldLabel(key?: string): string {
  if (!key) {
    return ''
  }

  return REPORT_FIELD_LABELS[key] || key
}
