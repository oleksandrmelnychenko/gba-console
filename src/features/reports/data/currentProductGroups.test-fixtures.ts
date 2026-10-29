import { productCapability, productDataset, productPreview, productRequest } from './currentProductFields.test-fixtures'
import type { WorkbookAttribute } from './workbookPreview'
export const productGroupsCapability = { ...productCapability, version: 3, attributeKind: 'currentProductFields', additionalFields: [
  ...productCapability.additionalFields, { type: 67, caption: 'Групи (поточний товар)', placement: 'column' }] }
export const productGroupsDataset = { ...productDataset, currentProductGroupLists: productGroupsCapability }
export function productGroupsRequest() {
  return { ...productRequest(), workbookPresentation: { version: 3, additionalFields: [66, 67, 2], ordering: null } }
}
export const groupValue = (): WorkbookAttribute => ({ type: 67, state: 'known', values: [], inputSha256: 'e'.repeat(64), references: [
  { id: '9007199254740993', netUid: '11111111-1111-1111-1111-111111111111', caption: 'Однакова назва' },
  { id: '9223372036854775807', netUid: '22222222-2222-2222-2222-222222222222', caption: 'Однакова назва' }] })
export function productGroupsPreview() {
  const raw = productPreview()
  raw.workbookPresentation.version = 3
  raw.workbookPresentation.selection = { version: 3, additionalFields: [66, 67, 2], ordering: null }
  raw.workbookPresentation.fields.splice(1, 0, { type: 67, caption: 'Групи (поточний товар)', placement: 'column' })
  raw.workbookPresentation.rows[0].values.splice(1, 0, groupValue())
  return raw
}
