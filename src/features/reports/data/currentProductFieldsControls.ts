import type { ReportRequestBody } from '../types'
import { hasProductRow, isCurrentProductVersion, isSalesProductProfile, readWorkbookSelection, workbookConfigurationError,
  type WorkbookCapability, type WorkbookSelection } from './workbookPresentation'

export function currentProductFieldsControls(capability: WorkbookCapability | null, request: ReportRequestBody, value: unknown) {
  const selection = readWorkbookSelection(value)
  const supported = isCurrentProductVersion(capability?.version) && isSalesProductProfile(request)
  const error = value == null ? null : workbookConfigurationError({ ...request, workbookPresentation: value })
    ?? (selection?.version === 3 && capability?.version !== 3 ? 'Поточний сервер не підтвердив список груп товару. Приберіть поле груп або оновіть сервер.' : null)
  const selected = selection && isCurrentProductVersion(selection.version) ? selection.additionalFields : []
  const productRow = hasProductRow(request)
  const selectedRank = new Map(selected.map((type, index) => [type, index]))
  const availableFields = capability?.additionalFields ?? []
  const fieldsByType = new Map(availableFields.map(field => [field.type, field]))
  if (selected.includes(67) && !fieldsByType.has(67)) fieldsByType.set(67, { type: 67, caption: 'Групи (поточний товар)', placement: 'column' })
  const fields = isCurrentProductVersion(capability?.version) ? [...selected.flatMap(type => { const field = fieldsByType.get(type); return field ? [field] : [] }),
    ...availableFields.filter(field => !selectedRank.has(field.type))] : []
  return { selection, supported, error, selected, productRow, selectedRank, fields, canAdd: supported && productRow && !error }
}

/** Only an explicit user edit can downgrade a restored v3 selection for an old v2 server. */
export function nextCurrentProductFieldsSelection(capability: WorkbookCapability | null, selection: WorkbookSelection | null, next: number[]): WorkbookSelection | undefined {
  if (!next.length) return undefined
  const version = capability?.version === 2 && !next.includes(67) ? 2 : selection?.version === 3 || next.includes(67) ? 3 : 2
  return { version, additionalFields: next, ordering: null }
}
