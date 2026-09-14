import type { ReportDataset, ReportRequestBody } from '../types'
import { EXACT_ONE_C_BUYER_ROOT_ID } from './oneCTurnoverReport'
import type { PriceTypeSalesComparisonCapabilities } from './priceTypeSalesComparison'

export const PRICE_TYPE_ID = '00000000000000000000000000000011'
export const PRICE_TYPE_SCOPE = {
  OrganizationIds: ['00000000000000000000000000000022'],
  ProductKindId: '00000000000000000000000000000033',
  ExcludeServices: true,
  BuyerRootId: EXACT_ONE_C_BUYER_ROOT_ID,
}

export const priceTypeSalesComparisonCapability: PriceTypeSalesComparisonCapabilities = {
  Version: 1,
  SourceWorlds: [1],
  PriceTypeIdFormat: '32 hexadecimal characters (16 bytes)',
  RequiresPriceTypeId: true,
  PriceTypeLookupField: 46,
  DefaultRowGroupings: [12, 5],
  DefaultMeasurements: [4, 70, 71],
  PriceSelection: 'DailyLatestExactPriceThenSourceOuterJoinWithoutDay',
  Aggregation: 'SourceTurnoverSum; discount percent recomputed from aggregated before-discount and net values',
  ExactAgreementPreserved: true,
  RecommendationEligible: false,
  AgreementPriceFallback: false,
  CoverageStatus: 'native_partial',
  ParityVerified: false,
  MaximumGroupedRows: 500000,
}

export const priceTypeSalesComparisonDataset: ReportDataset = {
  DataSource: 27,
  Name: '1С: Продажі (порівняння за типом цін)',
  Description: 'Продажі Fenix, порівняні з історичною ціною одного явного глобального типу цін 1С на день продажу.',
  PeriodRequired: true,
  PeriodSupported: true,
  priceTypeSalesComparison: priceTypeSalesComparisonCapability,
  Groupings: [
    [0, 'Рік'], [1, 'Квартал'], [2, 'Місяць'], [3, 'День'], [4, 'Організація'], [5, 'Товар'], [6, 'Артикул'],
    [12, 'Клієнт'], [15, 'Договір'], [22, 'Відповідальний реалізації (1С)'], [23, 'Відповідальний замовлення (1С)'],
    [63, 'Проєкт (1С)'], [64, 'Підрозділ (1С)'], [65, 'Характеристика товару (1С)'],
    [66, 'Замовлення покупця (1С)'], [67, 'Документ реалізації (1С)'],
  ].map(([Type, Name]) => ({ Type: Type as number, Name: Name as string })),
  Measurements: [
    [0, 'Кількість продажу в одиницях зберігання (1С)'], [2, 'Сума продажу без ПДВ у валюті управлінського обліку 1С'],
    [3, 'ПДВ продажу у валюті управлінського обліку 1С'], [4, 'Сума продажу з ПДВ у валюті управлінського обліку 1С'],
    [67, 'Сума продажу до знижки без ПДВ у валюті управлінського обліку 1С'], [68, 'Сума знижки без ПДВ у валюті управлінського обліку 1С'],
    [69, 'Знижка без ПДВ, % (1С)'], [70, 'Сума за глобальним типом цін без валютного перерахунку (1С)'],
    [71, 'Різниця між сумою продажу і сумою за типом цін без валютного перерахунку (1С)'],
  ].map(([Type, Name]) => ({ Type: Type as number, Name: Name as string })),
  Filters: [[51, 'Товар Fenix'], [52, 'Клієнт Fenix'], [45, 'Договір 1С'], [53, 'Проєкт Fenix'], [54, 'Підрозділ Fenix']]
    .map(([Type, Name]) => ({ Type: Type as number, Name: Name as string })),
  Limitations: ['Глобальна ціна не використовується для рекомендацій і ніколи не підміняється ціною договору.'],
}

export function priceTypeSalesComparisonRequest(): ReportRequestBody {
  return {
    dataSource: 27,
    from: '2026-09-01',
    to: '2026-09-03',
    oneC: structuredClone(PRICE_TYPE_SCOPE),
    priceTypeSalesComparison: { Version: 1, SourceWorld: 1, PriceTypeId: PRICE_TYPE_ID },
    sorted: {
      Row: [{ type: 12, key: 'CustomerName', label: 'Клієнт' }, { type: 5, key: 'Product', label: 'Товар' }],
      Col: [],
      Measurements: [
        { Type: 4, Name: 'SalesValueWithVAT', IsChecked: true, parentName: 'SalesValue' },
        { Type: 70, Name: 'OneCPriceTypeValue', IsChecked: true, parentName: '' },
        { Type: 71, Name: 'OneCPriceTypeDifference', IsChecked: true, parentName: '' },
      ],
    },
    selections: [],
  }
}
