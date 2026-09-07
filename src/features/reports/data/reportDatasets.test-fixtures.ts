import type { ReportDataset, ReportDatasetField } from '../types'
import { createDefaultMeasurementGroups, flattenGroupingOptions, getReportFieldLabel, REPORT_FILTER_FIELD_GROUPS } from './reportOptions'

function subset(fields: ReportDatasetField[], types: number[]) {
  const included = new Set(types)
  return fields.filter(item => included.has(item.Type))
}

export const grossDataset: ReportDataset = {
  DataSource: 0, Name: 'Продажі', Description: 'Проведені продажі без віднімання повернень.',
  Groupings: flattenGroupingOptions().map(item => ({ Type: item.type, Name: getReportFieldLabel(item.key) })),
  Measurements: createDefaultMeasurementGroups().flatMap(group => group.SubList.map(item => ({ Type: item.Type, Name: getReportFieldLabel(item.Name) }))),
  Filters: REPORT_FILTER_FIELD_GROUPS.flatMap(group => group.children.map(item => ({ Type: item.type, Name: getReportFieldLabel(item.label) }))),
  Limitations: ['Повернення не віднімаються.'],
}

export const netDataset: ReportDataset = {
  ...grossDataset, DataSource: 2, Name: 'Продажі з поверненнями', Description: 'Продажі мінус повернення.',
  Groupings: subset(grossDataset.Groupings, [0, 1, 2, 3, 4, 5, 6, 7, 12, 15, 17, 18, 26]),
  Filters: subset(grossDataset.Filters, [0, 2, 6, 9, 14, 20]),
  Limitations: ['Повернення враховуються за датою проведення.'],
}

export const purchaseDataset: ReportDataset = {
  DataSource: 3, Name: 'Надходження товарів', Description: 'Проведені закупівлі.',
  Groupings: [...subset(grossDataset.Groupings, [0, 1, 2, 3, 4, 5, 6, 7, 8, 21, 26]),
    { Type: 24, Name: 'Документ надходження' }, { Type: 25, Name: 'Договір постачальника' }],
  Measurements: [{ Type: 0, Name: 'Кількість надходжень' }, { Type: 2, Name: 'Вартість надходження без ПДВ, EUR' }],
  Filters: [{ Type: 0, Name: 'Організація' }, { Type: 1, Name: 'Товар' }, { Type: 2, Name: 'Артикул' },
    { Type: 17, Name: 'Постачальник' }, { Type: 18, Name: 'Договір постачальника' }, { Type: 19, Name: 'Документ надходження' },
    { Type: 20, Name: 'Одиниця виміру' }],
  Limitations: ['Суми з ПДВ не включені.'],
}

export const reportDatasets = [grossDataset, netDataset, purchaseDataset]
