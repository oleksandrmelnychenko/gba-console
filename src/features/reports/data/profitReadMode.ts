import type { ReportDataset, ReportRequestBody } from '../types'

const aliases = (value: object) => Object.keys(value).filter(key => key.toLowerCase() === 'profitreadmode')
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** Absence and null preserve the historical routing of saved reports. */
export function requestProfitReadMode(value: object): unknown {
  const key = aliases(value)[0]
  return key === undefined ? undefined : (value as Record<string, unknown>)[key]
}

export function isProfitReadModeCapability(value: unknown): boolean {
  const expected = ['Version', 'SupportedModes', 'CurrentDocumentsMaximumDays', 'LegacyInferencePreserved']
  if (!record(value) || Object.keys(value).length !== expected.length) return false
  const fields: Record<string, unknown> = {}
  for (const name of expected) {
    const keys = Object.keys(value).filter(key => key.toLowerCase() === name.toLowerCase())
    if (keys.length !== 1) return false
    fields[name] = value[keys[0]]
  }
  return fields.Version === 1 && Array.isArray(fields.SupportedModes)
    && fields.SupportedModes.join(',') === '0,1' && fields.SupportedModes.every(mode => typeof mode === 'number')
    && (fields.CurrentDocumentsMaximumDays === 31 || fields.CurrentDocumentsMaximumDays === 62)
    && fields.LegacyInferencePreserved === true
}

/** Uses only an understood server limit; older or absent capabilities retain 31 days. */
export function currentProfitMaximumDays(capability: unknown): number {
  if (!isProfitReadModeCapability(capability) || !record(capability)) return 31
  const key = Object.keys(capability).find(name => name.toLowerCase() === 'currentdocumentsmaximumdays')!
  return capability[key] as number
}

export function profitReadModeConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (aliases(data).length > 1) return 'Джерело розрахунку прибутку задано двічі. Налаштування не застосовано.'
  const mode = requestProfitReadMode(data)
  if (mode == null) return null
  if (data.dataSource !== 35 && data.dataSource !== 38) return 'Вибір джерела розрахунку доступний лише для звітів прибутку за днем або постачальниками.'
  if (mode !== 0 && mode !== 1) return 'Некоректне джерело розрахунку прибутку.'
  if (dataset && !isProfitReadModeCapability(dataset.profitReadMode)) return 'Сервер не підтвердив вибір джерела розрахунку прибутку.'
  const basisName = data.dataSource === 35 ? 'dayorganizationbasis' : 'supplierbasis'
  const keys = Object.keys(data).filter(key => key.toLowerCase() === basisName)
  if (keys.length !== 1 || (data as unknown as Record<string, unknown>)[keys[0]] !== 0)
    return 'Для вибраного джерела потрібен розрахунок «Продажі мінус повернення».'
  return null
}

export function profitReadModeLabel(mode: 0 | 1): string {
  return mode === 0 ? 'Поточні документи GBA' : 'Збережені регістри 1С'
}
