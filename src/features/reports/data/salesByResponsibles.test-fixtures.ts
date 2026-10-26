import type { ReportDataset } from '../types'

export const salesByResponsiblesDataset: ReportDataset = {
  DataSource: 43,
  Name: 'Продажі по менеджерах',
  Description: 'Продажі мінус повернення GBA в EUR без ПДВ і з ПДВ.',
  PeriodRequired: true,
  PeriodSupported: true,
  Groupings: [
    { Type: 4, Name: 'Організація' }, { Type: 22, Name: 'Документ продажу. Відповідальний' },
    { Type: 23, Name: 'Замовлення покупця. Відповідальний' }, { Type: 12, Name: 'Клієнт' },
    { Type: 0, Name: 'Рік' }, { Type: 1, Name: 'Квартал' }, { Type: 2, Name: 'Місяць' }, { Type: 3, Name: 'День' },
  ],
  Measurements: [
    { Type: 2, Name: 'Сума продажу без ПДВ, EUR' }, { Type: 3, Name: 'ПДВ продажу, EUR' }, { Type: 4, Name: 'Сума продажу з ПДВ, EUR' },
  ],
  Filters: [
    { Type: 0, Name: 'Організація' }, { Type: 6, Name: 'Клієнт' },
    { Type: 62, Name: 'Документ продажу. Відповідальний' }, { Type: 63, Name: 'Замовлення покупця. Відповідальний' },
  ],
  Limitations: ['ФОП Пархоменко Ганна Юріївна виключена з синхронізації.'],
  configuration: {
    version: 1, axisMode: 'flexible', allowedRows: [4, 22, 23, 12, 0, 1, 2, 3], allowedColumns: [4, 22, 23, 12, 0, 1, 2, 3],
    minimumRows: 1, maximumRows: 4, allowRowReorder: true, rowLayouts: [], columnLayouts: [], mutuallyExclusiveRows: [],
    period: { required: true, supported: true, maximumDays: null, maximumMonths: 120, minimumDate: '2000-01-01',
      endDatePolicy: 'unrestricted', maximumDate: '2099-12-31', inclusiveEnd: true },
    variants: [], maximumColumns: 2,
  },
}
