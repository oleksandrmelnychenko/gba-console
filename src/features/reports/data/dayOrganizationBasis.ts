import type { ReportDataset, ReportRequestBody } from '../types'

type JsonRecord = Record<string, unknown>
const capabilityFields = ['Version', 'DefaultBasis', 'Bases', 'OperationalMaximumDays',
  'SignedRegisterMaximumDays', 'LegacyInferenceWhenAbsent'] as const

function aliases(value: object): string[] {
  return Object.keys(value).filter(key => key.toLowerCase() === 'dayorganizationbasis')
}

/** Preserve null and absence: both keep the saved request's original inference. */
export function requestDayOrganizationBasis(value: object): unknown {
  const key = aliases(value)[0]
  return key === undefined ? undefined : (value as JsonRecord)[key]
}

/** New requests opt in only to the precise contract advertised by this server. */
export function isDayOrganizationBasisCapability(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== capabilityFields.length) return false
  const fields: JsonRecord = {}
  for (const name of capabilityFields) {
    const keys = Object.keys(value).filter(key => key.toLowerCase() === name.toLowerCase())
    if (keys.length !== 1) return false
    fields[name] = (value as JsonRecord)[keys[0]]
  }
  return fields.Version === 1 && fields.DefaultBasis === 0
    && Array.isArray(fields.Bases) && fields.Bases.length === 2 && fields.Bases[0] === 0 && fields.Bases[1] === 1
    && fields.OperationalMaximumDays === 31 && fields.SignedRegisterMaximumDays === 1
    && fields.LegacyInferenceWhenAbsent === true
}

export function dayOrganizationBasisConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (aliases(data).length > 1) return 'Спосіб розрахунку валового прибутку задано двічі. Налаштування не застосовано.'
  const basis = requestDayOrganizationBasis(data)
  if (basis == null) return null
  if (data.dataSource !== 35) return 'Спосіб розрахунку за днем та організацією доступний лише у відповідному звіті.'
  if (basis !== 0 && basis !== 1) return 'Некоректний спосіб розрахунку валового прибутку. Налаштування не застосовано.'
  if (dataset && !isDayOrganizationBasisCapability(dataset.dayOrganizationBasis))
    return 'Сервер не підтвердив вибір способу розрахунку валового прибутку.'
  return null
}
