import type { ReportDataset } from '../types'

export const grossDataset: ReportDataset = {
  DataSource: 30, Name: 'Валовий прибуток проведених продажів GBA', Description: 'Один період продажів',
  PeriodRequired: true, PeriodSupported: true,
  Groupings: [{ Type: 12, Name: 'Клієнт' }, { Type: 15, Name: 'Договір' }],
  Measurements: [2, 6, 10, 14].map(Type => ({ Type, Name: `Показник ${Type}` })),
  Filters: [1, 2, 6, 9].map(Type => ({ Type, Name: `Фільтр ${Type}` })),
  Limitations: ['Повернення не віднімаються.', 'Немає підтвердженої відповідності 1С.'],
}
