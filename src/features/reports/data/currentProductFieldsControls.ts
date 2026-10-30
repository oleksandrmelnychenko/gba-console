import type { ReportRequestBody } from '../types'
import { hasProductRow, isCurrentProductVersion, isSalesProductProfile, readWorkbookSelection, workbookConfigurationError,
  type WorkbookCapability, type WorkbookSelection } from './workbookPresentation'

export function currentProductFieldsControls(capability: WorkbookCapability | null, request: ReportRequestBody, value: unknown) {
  const selection = readWorkbookSelection(value)
  const supported = isCurrentProductVersion(capability?.version) && isSalesProductProfile(request)
  const error = value == null ? null : workbookConfigurationError({ ...request, workbookPresentation: value })
    ?? (selection?.version === 4 && capability?.version !== 4 ? 'Поточний сервер не підтвердив нові поля товару. Приберіть непідтримувані поля або оновіть сервер.' : null)
    ?? (selection?.version === 3 && ![3, 4].includes(capability?.version ?? 0) ? 'Поточний сервер не підтвердив список груп товару. Приберіть поле груп або оновіть сервер.' : null)
  const selected = selection && isCurrentProductVersion(selection.version) ? selection.additionalFields : []
  const productRow = hasProductRow(request)
  const selectedRank = new Map(selected.map((type, index) => [type, index]))
  const availableFields = capability?.additionalFields ?? []
  const fieldsByType = new Map(availableFields.map(field => [field.type, field]))
  for (const [type, caption] of [[68, 'Основна назва'], [69, 'Назва (укр.)'], [70, 'Нотатки'], [73, 'Основний оригінальний номер'], [74, 'Код УКТ ЗЕД']] as const)
    if (selected.includes(type) && !fieldsByType.has(type)) fieldsByType.set(type, { type, caption: type === 69 ? 'Назва (укр., поточний товар)' : `${caption} (поточний товар)`, placement: 'column' })
  if (selected.includes(67) && !fieldsByType.has(67)) fieldsByType.set(67, { type: 67, caption: 'Групи (поточний товар)', placement: 'column' })
  const fields = isCurrentProductVersion(capability?.version) ? [...selected.flatMap(type => { const field = fieldsByType.get(type); return field ? [field] : [] }),
    ...availableFields.filter(field => !selectedRank.has(field.type))] : []
  return { selection, supported, error, selected, productRow, selectedRank, fields, canAdd: supported && productRow && !error }
}

/** Downgrade unsupported versions only after an explicit edit removes their fields. */
export function nextCurrentProductFieldsSelection(capability: WorkbookCapability | null, selection: WorkbookSelection | null, next: number[]): WorkbookSelection | undefined {
  if (!next.length) return undefined
  const needsNewColumns = next.some(type => [68, 69, 70, 73, 74].includes(type))
  const version = needsNewColumns || selection?.version === 4 && capability?.version === 4 ? 4
    : capability?.version === 2 && !next.includes(67) ? 2 : selection?.version === 3 || selection?.version === 4 && capability?.version === 3 || next.includes(67) ? 3 : 2
  return { version, additionalFields: next, ordering: null }
}
