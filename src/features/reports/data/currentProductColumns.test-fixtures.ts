import { productGroupsCapability, productGroupsDataset, productGroupsPreview, productGroupsRequest } from './currentProductGroups.test-fixtures'
export const productColumnsCapability = { ...productGroupsCapability, version: 4, additionalFields: [...productGroupsCapability.additionalFields,
  ...([[68, 'Основна назва'], [69, 'Назва (укр.)'], [70, 'Нотатки'], [73, 'Основний оригінальний номер'], [74, 'Код УКТ ЗЕД']] as const).map(([type, caption]) => ({ type, caption, placement: 'column' }))] }
export const productColumnsDataset = { ...productGroupsDataset, currentProductColumns: productColumnsCapability }
export function productColumnsRequest() { return { ...productGroupsRequest(), workbookPresentation: { version: 4, additionalFields: [70, 67, 68, 69, 73, 74], ordering: null } } }
export function productColumnsPreview() {
  const raw = productGroupsPreview()
  const values = ['Нотатки з картки', 'Основна назва', 'Українська назва', '', null]
  const types = [70, 68, 69, 73, 74]
  const scalar = types.map((type, index) => ({ type, state: values[index] === null ? 'null' as const : 'known' as const,
    values: values[index] === null ? [] : [values[index]!], inputSha256: 'a'.repeat(64) }))
  raw.workbookPresentation.version = 4
  raw.workbookPresentation.selection = { version: 4, additionalFields: [70, 67, 68, 69, 73, 74], ordering: null }
  raw.workbookPresentation.fields = raw.workbookPresentation.selection.additionalFields.map(type => ({ type,
    caption: String(productColumnsCapability.additionalFields.find(field => field.type === type)?.caption ?? 'Невідоме поле'), placement: 'column' }))
  raw.workbookPresentation.rows[0].values = [scalar[0], raw.workbookPresentation.rows[0].values[1], ...scalar.slice(1)]
  return raw
}
