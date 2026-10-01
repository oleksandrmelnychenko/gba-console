import type { ReportDataset, ReportRequestBody } from '../types'

type JsonRecord = Record<string, unknown>
type SettingsKey = 'discountMarkup' | 'providedDiscounts' | 'priceAnalysis'
type CapabilityKey = 'discountMarkup' | 'providedDiscounts' | 'priceAnalysis'
type DateKey = 'DateEnd' | 'AsOf'
type Specification = { key: SettingsKey; capability: CapabilityKey; worlds: readonly number[]; date?: DateKey }

const SPECS: Readonly<Record<number, Specification>> = {
  23: { key: 'discountMarkup', capability: 'discountMarkup', worlds: [1, 2], date: 'DateEnd' },
  24: { key: 'providedDiscounts', capability: 'providedDiscounts', worlds: [1, 2] },
  25: { key: 'discountMarkup', capability: 'discountMarkup', worlds: [1, 2], date: 'DateEnd' },
  28: { key: 'priceAnalysis', capability: 'priceAnalysis', worlds: [1], date: 'AsOf' },
}
const record = (value: unknown): value is JsonRecord => value !== null && typeof value === 'object' && !Array.isArray(value)
const field = (value: object, name: string) => Object.keys(value).filter(key => key.toLowerCase() === name.toLowerCase())
const date = (value: unknown, minimum: number) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number(value.slice(0, 4)) >= minimum && Number(value.slice(0, 4)) <= 7999
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

export function oneCSpecialSpecification(dataSource: number): Specification | undefined { return SPECS[dataSource] }

export function ownPriceAnalysisRatesSupported(dataset?: ReportDataset): boolean {
  if (dataset?.DataSource !== 28 || !record(dataset.priceAnalysis)) return false
  const capability = dataset.priceAnalysis
  return capability.OwnCommercialRatesSupported === true
    && Array.isArray(capability.SupportedVersions)
    && capability.SupportedVersions.length === 2
    && capability.SupportedVersions[0] === 1 && capability.SupportedVersions[1] === 2
}

export function currentProvidedDiscountsSupported(dataset?: ReportDataset): boolean {
  if (dataset?.DataSource !== 24 || !record(dataset.providedDiscounts)) return false
  const capability = dataset.providedDiscounts
  return capability.DefaultNewBasis === 0 && capability.OperationalMissingInputsRemainNull === true
    && Array.isArray(capability.Bases) && capability.Bases.length === 2 && capability.Bases[0] === 0 && capability.Bases[1] === 1
    && Array.isArray(capability.OperationalSourceWorlds) && capability.OperationalSourceWorlds.length === 1 && capability.OperationalSourceWorlds[0] === 1
}

export function providedDiscountBasis(settings: unknown): 0 | 1 {
  if (!record(settings)) return 1
  const keys = field(settings, 'Basis')
  return keys.length === 1 && settings[keys[0]] === 0 ? 0 : 1
}

export function currentProvidedDiscountLookupBasis(dataSource: number, settings: unknown, dataset?: ReportDataset): 0 | undefined {
  return dataSource === 24 && providedDiscountBasis(settings) === 0 && currentProvidedDiscountsSupported(dataset) ? 0 : undefined
}

export function cloneProvidedDiscountSettings(value: unknown): unknown {
  return cloneSpecialSettings('providedDiscounts', value)
}

function cloneSpecialSettings(key: string, value: unknown): unknown {
  if (key.toLowerCase() !== 'provideddiscounts' || !record(value)) return structuredClone(value)
  const bases = field(value, 'Basis')
  if (bases.length !== 1) return structuredClone(value)
  const copy = structuredClone(value)
  const basis = copy[bases[0]]
  delete copy[bases[0]]
  return { ...copy, Basis: basis }
}

export function oneCSpecialVersionSupported(dataSource: number, version: unknown, dataset?: ReportDataset): boolean {
  return version === 1 || (dataSource === 28 && version === 2
    && (!dataset || ownPriceAnalysisRatesSupported(dataset)))
}

export function isOneCSpecialDataset(dataset: ReportDataset): boolean {
  const spec = SPECS[dataset.DataSource]
  if (!spec) return true
  const capability = dataset[spec.capability]
  if (!record(capability) || capability.Version !== 1) return false
  const sourceWorlds = capability.SourceWorlds
  if (!Array.isArray(sourceWorlds) || sourceWorlds.length !== spec.worlds.length
    || !spec.worlds.every((world, index) => sourceWorlds[index] === world)) return false
  if (dataset.DataSource === 28 && (capability.CoverageStatus !== 'native_partial'
    || capability.AgreementPricingSupported !== false || capability.RecommendationEligible !== false)) return false
  return spec.date ? dataset.PeriodSupported === false && dataset.PeriodRequired === false
    : dataset.PeriodRequired === true && dataset.PeriodSupported === true
}

export function defaultOneCSpecialSettings(dataSource: number, dataset?: ReportDataset): Record<string, unknown> {
  const spec = SPECS[dataSource]
  return spec ? { [spec.key]: { Version: dataSource === 28 && ownPriceAnalysisRatesSupported(dataset) ? 2 : 1,
    SourceWorld: dataSource === 24 && currentProvidedDiscountsSupported(dataset) ? 1 : spec.worlds.length === 1 ? spec.worlds[0] : null,
    ...(dataSource === 24 && currentProvidedDiscountsSupported(dataset) ? { Basis: 0 } : {}),
    ...(spec.date ? { [spec.date]: '' } : {}) } } : {}
}

export function oneCSpecialSettingsForWorld(dataSource: number, world: string, dataset?: ReportDataset): Record<string, unknown> {
  const defaults = defaultOneCSpecialSettings(dataSource, dataset)
  const spec = SPECS[dataSource]
  if (!spec) return defaults
  const sourceWorld = world === 'fenix' ? 1 : world === 'amg' ? 2 : null
  return sourceWorld && spec.worlds.includes(sourceWorld)
    ? { [spec.key]: { ...(defaults[spec.key] as JsonRecord), SourceWorld: sourceWorld,
      ...(dataSource === 24 && sourceWorld === 2 && currentProvidedDiscountsSupported(dataset) ? { Basis: 1 } : {}) } } : defaults
}

export function requestOneCSpecialSettings(data: object, dataSource: number): unknown {
  const spec = SPECS[dataSource]
  if (!spec) return undefined
  const aliases = field(data, spec.key)
  return aliases.length ? (data as JsonRecord)[aliases[0]] : undefined
}

export function cloneOneCSpecialAliases(data: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).flatMap(([key, value]) =>
    Object.values(SPECS).some(spec => key.toLowerCase() === spec.key.toLowerCase())
      ? [[key, cloneSpecialSettings(key, value)]] : []))
}

export function oneCSpecialSettingsError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  const dataSource = data.dataSource ?? -1
  const spec = SPECS[dataSource]
  const allKeys = [...new Set(Object.values(SPECS).map(value => value.key))]
  const present = allKeys.flatMap(key => field(data, key))
  if (!spec) return present.length ? 'Параметри звіту 1С належать іншому набору даних.' : null
  if (dataset && (!isOneCSpecialDataset(dataset) || dataset.DataSource !== data.dataSource))
    return 'Сервер не підтвердив параметри цього набору 1С.'
  if (present.length !== 1 || present[0].toLowerCase() !== spec.key.toLowerCase())
    return 'Залиште один набір параметрів цього звіту 1С.'
  const value = requestOneCSpecialSettings(data, dataSource)
  const bases = dataSource === 24 && record(value) ? field(value, 'Basis') : []
  if (bases.length > 1 || (bases.length === 1 && ![undefined, null, 0, 1].includes((value as JsonRecord)[bases[0]] as null | 0 | 1 | undefined)))
    return 'Невідома або повторена основа наданих знижок.'
  const expected = spec.date ? ['Version', 'SourceWorld', spec.date] : ['Version', 'SourceWorld']
  if (!record(value) || Object.keys(value).length !== expected.length + bases.length
    || !expected.every(key => Object.hasOwn(value, key)) || !oneCSpecialVersionSupported(dataSource, value.Version, dataset)
    || !spec.worlds.includes(value.SourceWorld as number)) return 'Оберіть підтверджену базу 1С для цього звіту.'
  if (dataSource === 24 && providedDiscountBasis(value) === 0 && (value.SourceWorld !== 1
    || (dataset && !currentProvidedDiscountsSupported(dataset)))) return 'Поточні надані знижки доступні для Fenix за підтвердженою можливістю сервера.'
  if (spec.date && !date(value[spec.date], data.dataSource === 28 ? 1900 : 1753))
    return 'Оберіть коректну дату стану звіту 1С.'
  if (spec.date && (data.from || data.to)) return 'Звіт за датою стану не приймає період «від/до».'
  return null
}
