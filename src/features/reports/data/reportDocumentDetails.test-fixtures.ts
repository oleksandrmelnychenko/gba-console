import { productCapability, productRequest } from './currentProductFields.test-fixtures'
import { supplierProfileDataset } from './salesProfileSupplier.test-fixtures'
import type { ReportDataset } from '../types'
export const documentDetails = { version: 1, grouping: 84, profiles: ['sales', 'grossProfit'], maximumUserRows: 2, maximumColumns: 1, deepestRowOnly: true,
  unsupportedTransforms: ['topGroups', 'abcClassification', 'threshold'], unallocatedCaption: 'Без підтвердженої деталізації' }
export const detailField = { Type: 84, Name: 'Детальний запис GBA', Selectable: true }
export const detailGrouping = { type: 84, key: 'GbaDocumentDetail', label: detailField.Name }
export const detailDataset: ReportDataset = { ...supplierProfileDataset, workbookPresentation: productCapability, documentDetails,
  profileGroupings: { sales: [{ Type: 21, Name: 'Постачальник', Selectable: true }, detailField], grossProfit: [{ Type: 21, Name: 'Постачальник', Selectable: true }, detailField] } }
export function detailRequest(profile = 'sales') {
  const request = productRequest(profile)
  request.sorted.Row.push(detailGrouping)
  return request
}
