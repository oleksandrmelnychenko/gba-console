import type { ReportSelection, ReportTemplate } from '../types'
import { createDefaultMeasurementGroups, flattenCheckedMeasurements, flattenGroupingOptions } from './reportOptions'

export const SALES_REPORT_PRESETS = [
  {
    id: 'agreements',
    name: 'Продажі за договорами',
    description: 'Організація → клієнт → договір. Кількість, фактична вартість продажів, собівартість і рентабельність.',
    rowKeys: ['Organization', 'CustomerName', 'CustomerContract'],
    colKeys: [],
    measureTypes: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15],
  },
  {
    id: 'agreement-products',
    name: 'Товари за договорами',
    description: 'Клієнт → договір → артикул. Фактичні продажі товарів за кожним договором окремо.',
    rowKeys: ['CustomerName', 'CustomerContract', 'ProductArticle'],
    colKeys: [],
    measureTypes: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15],
  },
  {
    id: 'daily',
    name: 'Продажі за днями',
    description: 'День → організація. Продажі, собівартість і рентабельність, окремо без ПДВ та з ПДВ.',
    rowKeys: ['Day', 'Organization'],
    colKeys: [],
    measureTypes: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15],
  },
  {
    id: 'products',
    name: 'Продажі за товарами',
    description: 'Група → артикул → товар. Кількість, продажі, собівартість і націнка для вибраного періоду.',
    rowKeys: ['ProductGroup', 'ProductArticle', 'Product'],
    colKeys: [],
    measureTypes: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15],
  },
  {
    id: 'responsibles',
    name: 'Продажі за відповідальними 1С',
    description: 'Рядки: організація → відповідальний реалізації. Колонки: відповідальний замовлення. Потрібен імпорт цих полів; повернення ще не віднімаються.',
    rowKeys: ['Organization', 'SourceSaleResponsible'],
    colKeys: ['SourceOrderResponsible'],
    measureTypes: [2, 4],
  },
] as const

export type SalesReportPresetId = typeof SALES_REPORT_PRESETS[number]['id']

/** Applies layout only: preserves the operator's dates and all selection rows. */
export function createSalesReportPreset(
  id: SalesReportPresetId,
  from: string,
  to: string,
  selections: ReportSelection[],
): ReportTemplate {
  const preset = SALES_REPORT_PRESETS.find((entry) => entry.id === id)!
  const groupings = flattenGroupingOptions()
  const measurements = createDefaultMeasurementGroups().map((group) => ({
    ...group,
    IsChecked: true,
    SubList: group.SubList.map((measure) => ({ ...measure, IsChecked: true })),
  }))

  return {
    Name: preset.name,
    Data: {
      from,
      to,
      selections: structuredClone(selections),
      sorted: {
        Col: preset.colKeys.map((key) => ({ ...groupings.find((group) => group.key === key)! })),
        Row: preset.rowKeys.map((key) => ({ ...groupings.find((group) => group.key === key)! })),
        Measurements: flattenCheckedMeasurements(measurements)
          .filter((measure) => (preset.measureTypes as readonly number[]).includes(measure.Type)),
      },
    },
  }
}
