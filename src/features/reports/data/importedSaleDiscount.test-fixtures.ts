import type { ReportDataset } from '../types'

export const importedDiscountDataset: ReportDataset = {
  DataSource: 32, Name: 'Записана знижка/націнка імпортованих продажів GBA, EUR',
  Description: 'Записані суми імпортованих продажів за точним договором.', PeriodRequired: true, PeriodSupported: true,
  Groupings: [12, 15, 5].map(Type => ({ Type, Name: `Група ${Type}` })),
  Measurements: [{ Type: 79, Name: 'Записана знижка/націнка, EUR' }],
  Filters: [1, 2, 6, 9].map(Type => ({ Type, Name: `Відбір ${Type}` })),
  Limitations: ['Без ПДВ.', 'Повернення не віднімаються.', 'Відповідність звіту 1С не підтверджена.'],
}
