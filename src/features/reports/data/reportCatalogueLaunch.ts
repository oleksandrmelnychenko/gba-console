import type { ReportCatalogue, ReportCatalogueEntry, ReportDataset, ReportDatasetField, ReportTemplate } from '../types'
import { isReportCatalogue, inspectCatalogueMigration, sourceIdentity } from './reportMigration'
import { datasetGroupings, datasetMeasurements, defaultDatasetRequest } from './reportDatasets'
import { flattenCheckedMeasurements } from './reportOptions'
import { getNativeReportProfile } from './nativeReportProfiles'
import { isClientComparisonCapability } from './clientPeriodComparison'
import { isXyzCapability } from './salesXyz'
import { isRevenueComparisonCapability } from './revenueComparison'
import { isBuyerSalesShareCapability } from './buyerSalesShare'
import { isReturnComparisonCapability } from './returnComparison'
import { isRateComparisonCapability } from './rateComparison'
import { isMarginComparisonCapability } from './marginComparison'
import { defaultPaymentComparison, isPaymentComparisonCapability } from './paymentComparison'

export type CatalogueLaunchChoice = { reportId: string; world: string; sourceId: string; dataSource: number }
export type CatalogueLaunchOption = { choice: CatalogueLaunchChoice; label: string; title: string; notice: string }
export type CatalogueLaunchResult = { ok: true; template: ReportTemplate; dataset: ReportDataset; title: string; notice: string }
  | { ok: false; message: string }

type Mode = 'native' | 'sales' | 'purchases' | 'daily' | 'monthly' | 'reserve' | 'new' | 'repeat' | 'incoming' | 'outgoing' | 'return-only'
type Registration = { reportId: string; sourceId: string; worlds: readonly string[]; dataSources: readonly number[]; mode: Mode }
// Exact metadata identities from Catalogue.json (2026-09-09, SHA256 37096c3c12a3ad2b02785ff24718a7a7185c41eeb01a38f3f16ce239d2b5cad8).
// A registry entry permits only a native configuration, independently of source-parity status.
const builtin = (name: string, sourceId: string, dataSources: number[], mode: Mode = 'native'): Registration =>
  ({ reportId: `builtin:${name}`, sourceId, worlds: ['amg', 'fenix'], dataSources, mode })
const indicator = (sourceId: string, dataSources: number[], mode: Mode = 'native'): Registration =>
  ({ reportId: `custom:fenix:${sourceId}`, sourceId, worlds: ['fenix'], dataSources, mode })
const REGISTRY: readonly Registration[] = [
  builtin('XYZABCАнализПродаж', '970aa31b-9852-4036-99ed-53aa94566304', [15]),
  builtin('АнализДвиженияДенежныхСредств', '9e7d129c-bc85-457f-88f4-91db2c620577', [14]),
  builtin('АнализДоступностиТоваровНаСкладах', '2008cac6-109b-4585-aa0f-6d5c422d9be3', [4]),
  builtin('ВедомостьДенежныеСредства', '977cb58d-ff0b-46b7-90fd-124a560ec6ff', [11]),
  builtin('ВедомостьПартииТоваровНаСкладах', 'fde97241-e736-4c21-9e61-2d6ecafa0b91', [7]),
  builtin('ВедомостьПартииТоваровНаСкладахКоличественныйУчет', 'dd98a3b9-e627-4a83-9f66-2dfe7686085c', [7]),
  builtin('ВедомостьПартииТоваровНаСкладахСКД', '9531c9a1-1ba3-41a5-966b-bc13257701dd', [7]),
  builtin('ВедомостьТоварыНаСкладах', 'a2f4cc04-d423-4537-b730-4179112bab40', [4]),
  builtin('ВедомостьТоварыОрганизаций', '8fe492c1-3bb1-4dfa-a5ef-ce689d3ff1ea', [7]),
  builtin('ГрафикЗакупокНоменклатуры', '817c9f2f-ebc7-4656-a543-515931fe1bb4', [3], 'daily'),
  builtin('ГрафикПродажВозвратовНоменклатуры', '8fe9d4b6-5a10-4db6-bfd4-5d0b42dcc763', [0, 2], 'daily'),
  builtin('ГрафикПродажНоменклатуры', 'b63e6d14-b0a8-4c33-8e91-9fb397aee4f1', [0, 2], 'daily'),
  builtin('ГрафикПродажНоменклатурыПоПериодам', 'cb2964a3-59a3-431e-b3e2-fec3ab5e279f', [0, 2], 'monthly'),
  builtin('ЗадолженностьПоКонтрагентам', '0e9ed1d2-a9c6-4865-89bc-2f25c8b7ebd3', [10]),
  builtin('Закупки', 'ed77c5cc-6688-4316-a631-2ad0b237140d', [3], 'purchases'),
  builtin('ОтчетЗаполненностиСклада', '7b5e0297-dc32-4dc4-8803-b7982a9618ce', [5]),
  builtin('ОтчетПоВозвратам', '0ec7344c-690f-4b13-af08-78b26a0f13f3', [2], 'return-only'),
  builtin('ОтчетПоМестамХраненияНоменклатуры', '9f693421-5a01-40b2-bf49-52d15132d3cb', [4, 5]),
  builtin('Продажи', '1d3b4053-a6fa-4c32-83be-269e93f7e853', [0, 2], 'sales'),
  builtin('ПродажиВозвраты', '8faf93b5-27ac-4e8a-bba2-107e6e64a998', [0, 2], 'sales'),
  builtin('ТоварыВРезервеНаСкладах', '91ef0806-a3fa-4bac-be65-5614d5ef270a', [4, 6], 'reserve'),
  indicator('0xb4b500055d78a52511ddfe9d4aaca7ff', [18]),
  indicator('0xb4b500055d78a52511ddfe606a8c1463', [21], 'outgoing'),
  indicator('0xb4b500055d78a52511ddfc172c5097fe', [16]),
  indicator('0xb4b500055d78a52511ddfdbede3b0526', [19]),
  indicator('0xa6b50007e90a504c11de0990eefaedb5', [17], 'repeat'),
  indicator('0xa6b50007e90a504c11de0990eefaedb3', [17], 'new'),
  indicator('0xb4b500055d78a52511ddfe73b936bfac', [12, 13]),
  indicator('0xa6b50007e90a504c11de0962351b1edd', [20]),
  indicator('0xb4b500055d78a52511ddfe606a8c1461', [21], 'incoming'),
]

const capabilities: Readonly<Record<number, (dataset: ReportDataset) => boolean>> = {
  13: dataset => isClientComparisonCapability(dataset.Comparison),
  15: dataset => isXyzCapability(dataset.Xyz),
  16: dataset => isRevenueComparisonCapability(dataset.RevenueComparison),
  17: dataset => isBuyerSalesShareCapability(dataset.BuyerSalesShare),
  18: dataset => isReturnComparisonCapability(dataset.ReturnComparison),
  19: dataset => isRateComparisonCapability(dataset.rateComparison),
  20: dataset => isMarginComparisonCapability(dataset.MarginComparison),
  21: dataset => isPaymentComparisonCapability(dataset.paymentComparison),
}
function validFields(fields: ReportDatasetField[]): boolean {
  return Array.isArray(fields) && fields.every(field => field && Number.isSafeInteger(field.Type) && field.Type >= 0
    && typeof field.Name === 'string' && !!field.Name.trim()
    && (field.Selectable === undefined || typeof field.Selectable === 'boolean'))
    && new Set(fields.map(field => field.Type)).size === fields.length
}
function requirements(registration: Registration, dataSource: number) {
  const profile = getNativeReportProfile(dataSource)
  const rows = registration.mode === 'daily' ? [3, 5, 28] : registration.mode === 'monthly' ? [2, 5, 28]
    : registration.mode === 'sales' ? [12, 15, 5, 28] : registration.mode === 'purchases' ? [21, 25, 5, 28]
      : profile ? [...profile.rowGroupings] : []
  const measures = registration.mode === 'new' ? [39, 40, 41, 42] : registration.mode === 'repeat' ? [43, 44, 45, 46]
    : registration.mode === 'reserve' ? [19] : profile ? [...profile.measurements] : [0, dataSource === 3 ? 2 : 4]
  return { rows, measures }
}
function supports(registration: Registration, dataset: ReportDataset): boolean {
  if (!dataset || typeof dataset.Name !== 'string' || !dataset.Name.trim() || !validFields(dataset.Groupings)
    || !validFields(dataset.Measurements) || !validFields(dataset.Filters)) return false
  const current = [4, 5, 6, 7, 10, 11, 19].includes(dataset.DataSource)
  if (current ? dataset.PeriodSupported !== false || dataset.PeriodRequired === true : dataset.PeriodSupported === false) return false
  if (capabilities[dataset.DataSource] && !capabilities[dataset.DataSource](dataset)) return false
  const { rows, measures } = requirements(registration, dataset.DataSource)
  return rows.length > 0 && rows.every(type => dataset.Groupings.some(field => field.Type === type && field.Selectable !== false))
    && measures.every(type => dataset.Measurements.some(field => field.Type === type && field.Selectable !== false))
}
function validatedCatalogue(value: unknown) {
  if (!isReportCatalogue(value)) return null
  const inspection = inspectCatalogueMigration(value)
  // Supplied but malformed per-source proof must not become an innocuous unassessed row.
  if (!inspection.valid || value.Reports.some(report => report.Sources.some(source =>
    source.Migration !== undefined && !inspection.migrations.has(sourceIdentity(source))))) return null
  return { catalogue: value, inspection }
}
function description(registration: Registration, report: ReportCatalogueEntry, dataset: ReportDataset): Omit<CatalogueLaunchOption, 'choice'> {
  const profile = getNativeReportProfile(dataset.DataSource)
  const variant = registration.mode === 'incoming' ? 'Надходження' : registration.mode === 'outgoing' ? 'Виплати'
    : registration.mode === 'new' ? 'Частка продажів новим покупцям' : registration.mode === 'repeat' ? 'Частка повторних продажів'
      : registration.mode === 'reserve' && dataset.DataSource === 4 ? 'Записаний резерв за складами'
        : registration.mode === 'daily' ? 'Таблиця за днями' : registration.mode === 'monthly' ? 'Таблиця за місяцями' : ''
  const nativeTitle = profile?.title ?? dataset.Name
  const label = variant ? `${variant} · ${nativeTitle}` : nativeTitle
  const required = dataset.DataSource === 19 ? ' Виберіть точну серію курсу та дві дати.'
    : [13, 16, 17, 18, 20, 21].includes(dataset.DataSource) ? ' Задайте окремий період порівняння.'
      : dataset.DataSource === 15 ? ' Перевірте повні закриті місяці, кількість періодів і межі XYZ.' : ''
  return { title: report.Title, label,
    notice: `Готові налаштування «${report.Title}»: ${label}. ${profile?.preset.description ?? dataset.Description} Часткове покриття GBA; повна відповідність звіту 1С не підтверджена.${required}` }
}
function findLaunch(catalogue: ReportCatalogue, inspection: ReturnType<typeof inspectCatalogueMigration>, choice: CatalogueLaunchChoice,
  datasets: readonly ReportDataset[]) {
  const report = catalogue.Reports.find(item => item.Id === choice.reportId)
  const source = report?.Sources.find(item => item.World === choice.world && item.SourceId === choice.sourceId)
  if (!report || !source) return { error: 'Точне джерело звіту відсутнє в поточному каталозі.' } as const
  const migration = inspection.migrations.get(sourceIdentity(source))
  if (!migration || !['native_partial', 'parity_verified'].includes(migration.Status) || !migration.NativeDataSources.includes(choice.dataSource)) {
    return { error: 'Каталог не підтверджує відповідність цього звіту вибраному набору даних.' } as const
  }
  const registration = REGISTRY.find(item => item.reportId === choice.reportId && item.sourceId === choice.sourceId
    && item.worlds.includes(choice.world) && item.dataSources.includes(choice.dataSource))
  if (!registration) return { error: 'Для цього точного джерела ще немає готової конфігурації конструктора.' } as const
  if (registration.mode === 'return-only') return { error: 'Звіт лише про повернення ще не має окремої готової конфігурації. Загальні чисті продажі не відтворюють цей звіт.' } as const
  const matches = datasets.filter(dataset => dataset?.DataSource === choice.dataSource)
  if (matches.length !== 1 || !supports(registration, matches[0])) return { error: 'Поточний набір даних не підтримує всі потрібні групування, показники або правила цього звіту.' } as const
  return { report, registration, dataset: matches[0] }
}

/** Offers exact source/dataset choices only; catalogue status alone does not grant an adapter. */
export function catalogueLaunchOptions(value: unknown, reportId: string, datasets: readonly ReportDataset[]): CatalogueLaunchOption[] {
  const validated = validatedCatalogue(value)
  if (!validated || !Array.isArray(datasets)) return []
  const { catalogue, inspection } = validated
  const report = catalogue.Reports.find(item => item.Id === reportId)
  return report?.Sources.flatMap(source => (inspection.migrations.get(sourceIdentity(source))?.NativeDataSources ?? []).flatMap(dataSource => {
    const choice = { reportId, world: source.World, sourceId: source.SourceId, dataSource }
    const launch = findLaunch(catalogue, inspection, choice, datasets)
    return 'error' in launch ? [] : [{ choice, ...description(launch.registration, report, launch.dataset) }]
  })) ?? []
}

/** Fresh constructor settings: never inherits another draft, agreement, filter or saved-template revision. */
export function resolveCatalogueLaunch(value: unknown, choice: CatalogueLaunchChoice, datasets: readonly ReportDataset[],
  period: { from: string; to: string }): CatalogueLaunchResult {
  const validated = validatedCatalogue(value)
  if (!validated) return { ok: false, message: 'Каталог або докази його міграції некоректні. Оновіть каталог.' }
  if (!choice || !Number.isSafeInteger(choice.dataSource) || !Array.isArray(datasets)
    || !period || typeof period.from !== 'string' || typeof period.to !== 'string') return { ok: false, message: 'Некоректний вибір звіту або періоду.' }
  const launch = findLaunch(validated.catalogue, validated.inspection, choice, datasets)
  if ('error' in launch) return { ok: false, message: launch.error ?? 'Не вдалося підготувати конфігурацію звіту.' }
  const { registration, dataset, report } = launch
  const data = defaultDatasetRequest(dataset, period.from, period.to)
  const { rows, measures } = requirements(registration, dataset.DataSource)
  const groupings = datasetGroupings(dataset)
  data.sorted.Row = rows.flatMap(type => groupings.filter(item => item.type === type))
  const requiredMeasures = new Set(measures)
  const selected = dataset.Measurements.flatMap(field => requiredMeasures.has(field.Type)
    ? [{ Type: field.Type, Name: field.Name, IsChecked: true, parentName: '' }] : [])
  const measurements = flattenCheckedMeasurements(datasetMeasurements(dataset, selected))
  data.sorted.Measurements = measures.flatMap(type => measurements.filter(item => item.Type === type))
  if (data.sorted.Row.length !== rows.length || data.sorted.Measurements.length !== measures.length) {
    return { ok: false, message: 'Не вдалося зберегти всі потрібні групування та показники. Налаштування не застосовано.' }
  }
  if (registration.mode === 'incoming' || registration.mode === 'outgoing') {
    data.paymentComparison = { ...defaultPaymentComparison(), Direction: registration.mode === 'incoming' ? 1 : 2 }
  }
  const { title, notice } = description(registration, report, dataset)
  return { ok: true, title, notice, dataset: structuredClone(dataset), template: { Name: title, Data: data } }
}
