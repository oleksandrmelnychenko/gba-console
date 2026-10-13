import type { ReportDataset, ReportRequestBody } from '../types'

const aliases = (value: object) => Object.keys(value).filter(key => key.toLowerCase() === 'cashreadmode')
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

export function requestCashReadMode(value: object): unknown {
  const key = aliases(value)[0]
  return key === undefined ? undefined : (value as Record<string, unknown>)[key]
}

export function cloneCashReadModeAliases(value: object): Record<string, unknown> {
  return Object.fromEntries(aliases(value).map(key => [key, structuredClone((value as Record<string, unknown>)[key])]))
}

export function isCashReadModeCapability(value: unknown): boolean {
  const expected = ['Version', 'SupportedModes', 'CurrentDocumentsMaximumMonths', 'LegacyInferencePreserved']
  if (!record(value) || Object.keys(value).length !== expected.length) return false
  const fields: Record<string, unknown> = {}
  for (const name of expected) {
    const keys = Object.keys(value).filter(key => key.toLowerCase() === name.toLowerCase())
    if (keys.length !== 1) return false
    fields[name] = value[keys[0]]
  }
  return fields.Version === 1 && Array.isArray(fields.SupportedModes)
    && fields.SupportedModes.length === 2 && fields.SupportedModes[0] === 0 && fields.SupportedModes[1] === 1
    && fields.CurrentDocumentsMaximumMonths === 120 && fields.LegacyInferencePreserved === true
}

export function normalizeCashReadModeDataset(value: Record<string, unknown>): Record<string, unknown> {
  const keys = aliases(value)
  if (!keys.length) return value
  const capability = keys.length === 1 && value.DataSource === 40 && isCashReadModeCapability(value[keys[0]])
    ? structuredClone(value[keys[0]]) : undefined
  const normalized = { ...value }
  for (const key of keys) delete normalized[key]
  if (capability !== undefined) normalized.cashReadMode = capability
  return normalized
}

export function cashReadModeConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (aliases(data).length > 1) return 'Джерело розрахунку коштів задано двічі. Налаштування не застосовано.'
  const mode = requestCashReadMode(data)
  if (mode == null) return null
  if (data.dataSource !== 40) return 'Вибір джерела розрахунку коштів доступний лише для руху коштів за період.'
  if (mode !== 0 && mode !== 1) return 'Некоректне джерело розрахунку коштів.'
  if (dataset && !isCashReadModeCapability(dataset.cashReadMode))
    return 'Сервер не підтвердив вибір джерела розрахунку коштів.'
  return null
}

export function cashReadModeLabel(mode: 0 | 1): string {
  return mode === 0 ? 'Поточні документи GBA' : 'Збережені регістри 1С'
}
