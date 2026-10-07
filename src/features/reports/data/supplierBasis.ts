import type { ReportDataset, ReportGroupingItem, ReportRequestBody } from '../types'

type JsonRecord = Record<string, unknown>
const capabilityFields = ['Version', 'DefaultBasis', 'Bases', 'MaximumDays',
  'IncludesReturns', 'PreservesUnavailableValues', 'RegistrarWarehouseGrouping'] as const

function aliases(value: object): string[] {
  return Object.keys(value).filter(key => key.toLowerCase() === 'supplierbasis')
}

/** Absence and null retain the saved sale-allocation calculation. */
export function requestSupplierBasis(value: object): unknown {
  const key = aliases(value)[0]
  return key === undefined ? undefined : (value as JsonRecord)[key]
}

/** The quantity label follows the executed calculation, including saved legacy requests. */
export function supplierBasisFormDataset(dataset: ReportDataset | undefined, basis: unknown): ReportDataset | undefined {
  if (dataset?.DataSource !== 38 || !isSupplierBasisCapability(dataset.supplierBasis)
    || (basis != null && basis !== 0 && basis !== 1)) return dataset
  const caption = basis === 0 ? 'Кількість продажів мінус повернення' : 'Кількість за регістром собівартості 1С'
  if (!dataset.Measurements.some(field => field.Type === 0 && field.Name !== caption)) return dataset
  return { ...dataset, Measurements: dataset.Measurements.map(field => field.Type === 0 ? { ...field, Name: caption } : field) }
}

/** An explicit ordinary choice replaces only the receipt warehouse dimension. */
export function rowGroupsForSupplierBasis(basis: 0 | 1, rows: ReportGroupingItem[],
  available: readonly ReportGroupingItem[]): ReportGroupingItem[] {
  if (basis !== 0) return rows
  const registrar = available.find(field => field.type === 78)
  if (!registrar) return rows
  return rows.map(field => field.type === 73 ? registrar : field)
}

export function isSupplierBasisCapability(value: unknown): boolean {
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
    && fields.MaximumDays === 31 && fields.IncludesReturns === true && fields.PreservesUnavailableValues === true
    && fields.RegistrarWarehouseGrouping === 78
}

export function supplierBasisConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (aliases(data).length > 1) return 'Спосіб розрахунку за постачальниками задано двічі. Налаштування не застосовано.'
  const basis = requestSupplierBasis(data)
  if (basis == null) return null
  if (data.dataSource !== 38) return 'Спосіб розрахунку за постачальниками доступний лише у відповідному звіті.'
  if (basis !== 0 && basis !== 1) return 'Некоректний спосіб розрахунку за постачальниками. Налаштування не застосовано.'
  if (dataset && !isSupplierBasisCapability(dataset.supplierBasis))
    return 'Сервер не підтвердив вибір способу розрахунку за постачальниками.'
  if (basis === 0 && (data.sorted?.Row?.map(item => item.type).join(',') !== '78,4,21'
    || data.sorted?.Col?.length !== 0))
    return 'Продажі мінус повернення підтримують склад документа → організацію → постачальника.'
  return null
}
