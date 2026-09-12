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
  productClassification: { Version: 1, SourceWorld: 0, RequiresIsService: true, RequiresProductKindId: true,
    ProductKindIdFormat: '32 hexadecimal characters (16 bytes)' },
  sourceOrganizations: { Version: 1, SourceWorlds: ['fenix'], MaximumOrganizationIds: 64,
    OrganizationIdFormat: '32 hexadecimal characters (16 bytes)', RequiresDurableNativeBinding: true,
    RequiresCompleteFactLineage: true },
  Groupings: subset(grossDataset.Groupings, [0, 1, 2, 3, 4, 5, 6, 7, 12, 15, 17, 18, 28]),
  Filters: subset(grossDataset.Filters, [0, 2, 6, 9, 14, 20]),
  Limitations: ['Повернення враховуються за датою проведення.'],
}

export const purchaseDataset: ReportDataset = {
  DataSource: 3, Name: 'Надходження товарів', Description: 'Проведені закупівлі.',
  Groupings: [...subset(grossDataset.Groupings, [0, 1, 2, 3, 4, 5, 6, 7, 8, 21, 28]),
    { Type: 24, Name: 'Документ надходження' }, { Type: 25, Name: 'Договір постачальника' }],
  Measurements: [{ Type: 0, Name: 'Кількість надходжень' }, { Type: 2, Name: 'Вартість надходження без ПДВ, EUR' }],
  Filters: [{ Type: 0, Name: 'Організація' }, { Type: 1, Name: 'Товар' }, { Type: 2, Name: 'Артикул' },
    { Type: 17, Name: 'Постачальник' }, { Type: 18, Name: 'Договір постачальника' }, { Type: 19, Name: 'Документ надходження' },
    { Type: 20, Name: 'Одиниця виміру' }],
  Limitations: ['Суми з ПДВ не включені.'],
}

export const reportDatasets = [grossDataset, netDataset, purchaseDataset]

export const stockDataset: ReportDataset = {
  DataSource: 4, Name: 'Склад: поточні залишки', Description: 'Поточний стан на час читання операційних записів.',
  PeriodSupported: false, PeriodRequired: false,
  Groupings: [...subset(grossDataset.Groupings, [5, 6, 7, 8, 28]), { Type: 29, Name: 'Склад' }],
  Measurements: [{ Type: 17, Name: 'Фізичний залишок' }, { Type: 18, Name: 'Вільна кількість' }, { Type: 19, Name: 'Записаний резерв' }],
  Filters: [{ Type: 1, Name: 'Товар' }, { Type: 2, Name: 'Артикул' }, { Type: 20, Name: 'Одиниця виміру' }, { Type: 21, Name: 'Склад' }],
  Limitations: ['Поточний стан, без історичного періоду та оцінки вартості. Різні одиниці не додаються.'],
}

export const placementDataset: ReportDataset = {
  ...stockDataset, DataSource: 5, Name: 'Склад: розміщення товарів',
  Groupings: [...stockDataset.Groupings, { Type: 30, Name: 'Стелаж' }, { Type: 31, Name: 'Ряд' },
    { Type: 32, Name: 'Комірка' }, { Type: 33, Name: 'Рядок партії' }],
  Measurements: stockDataset.Measurements.filter(field => field.Type === 17),
  Filters: [...stockDataset.Filters, { Type: 22, Name: 'Рядок партії' }],
}

export const reservationDataset: ReportDataset = {
  ...stockDataset, DataSource: 6, Name: 'Склад: резерви за договорами',
  Groupings: [...stockDataset.Groupings, { Type: 12, Name: 'Клієнт' }, { Type: 15, Name: 'Договір клієнта' }],
  Measurements: stockDataset.Measurements.filter(field => field.Type === 19),
  Filters: [...stockDataset.Filters, { Type: 6, Name: 'Клієнт' }, { Type: 9, Name: 'Договір клієнта' }],
}

export const lotDataset: ReportDataset = {
  ...stockDataset, DataSource: 7, Name: 'Склад: залишки партій',
  Groupings: [...stockDataset.Groupings, { Type: 33, Name: 'Рядок партії' }, { Type: 34, Name: 'Організація партії' }],
  Measurements: [{ Type: 20, Name: 'Записаний залишок партії' }],
  Filters: [...stockDataset.Filters, { Type: 22, Name: 'Рядок партії' }, { Type: 23, Name: 'Організація партії' }],
}

export const currentStockDatasets = [stockDataset, placementDataset, reservationDataset, lotDataset]

export const valuationDataset: ReportDataset = {
  ...stockDataset, DataSource: 8, Name: 'Склад: оцінка за договором',
  Measurements: [{ Type: 17, Name: 'Фізичний залишок' }, { Type: 21, Name: 'Оцінка за договором, EUR' }],
  Limitations: ['Оцінка за регулярною ціною EUR та режимом ПДВ обраного договору. Невизначені ціни залишають суму порожньою.'],
}

export const supplierReturnDataset: ReportDataset = {
  DataSource: 9, Name: 'Документи повернень постачальникам', Description: 'Записані документи повернень постачальникам.',
  PeriodSupported: true, PeriodRequired: true,
  Groupings: [...subset(grossDataset.Groupings, [0,1,2,3,5,6,7,8,21,28]),
    {Type:25,Name:'Договір постачальника'}, {Type:29,Name:'Склад'}, {Type:35,Name:'Документ повернення постачальнику'},
    {Type:38,Name:'Тип повернення'}, {Type:39,Name:'Організація документа'}],
  Measurements: [{Type:22,Name:'Записана кількість повернення'}],
  Filters: [{Type:1,Name:'Товар'}, {Type:2,Name:'Артикул'}, {Type:17,Name:'Постачальник'}, {Type:18,Name:'Договір постачальника'},
    {Type:20,Name:'Одиниця виміру'}, {Type:21,Name:'Склад'}, {Type:24,Name:'Документ повернення постачальнику'},
    {Type:27,Name:'Тип повернення'}, {Type:28,Name:'Організація документа'}],
  Limitations: ['Записана кількість не доводить повноти складського руху.'],
}
export const currentDebtDataset: ReportDataset = {
  DataSource: 10, Name: 'Поточна заборгованість', Description: 'Поточні записи боргу в підтверджених валютах.',
  PeriodSupported: false, PeriodRequired: false,
  Groupings: [{Type:12,Name:'Клієнт'}, {Type:15,Name:'Договір клієнта'}, {Type:36,Name:'Валюта боргу'},
    {Type:37,Name:'Запис боргу'}, {Type:39,Name:'Організація документа'}],
  Measurements: [{Type:23,Name:'Записана заборгованість'}],
  Filters: [{Type:6,Name:'Клієнт'}, {Type:9,Name:'Договір клієнта'}, {Type:25,Name:'Валюта боргу'},
    {Type:26,Name:'Запис боргу'}, {Type:28,Name:'Організація документа'}],
  Limitations: ['Різні або непідтверджені валюти залишають грошовий підсумок порожнім.'],
}
export const nativeDocumentDatasets = [supplierReturnDataset, currentDebtDataset]
