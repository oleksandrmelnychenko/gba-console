import type { ReportDataset, ReportRequestBody } from '../types'
import { datasetGroupings } from './reportDatasets'
export type CustomerGroups = { Version: 1; Groups: Array<{ Name: string; ClientIds: number[] }> }
export const CUSTOMER_GROUPS_WORKBOOK = 'Порівняння роботи клієнтів.xls'
export function initialCustomerGroups(): CustomerGroups {
  return { Version: 1, Groups: [{ Name: 'Еталон', ClientIds: [] }, { Name: 'Порівнюваний набір', ClientIds: [] }] }
}
export function customerGroupsRequest(request: ReportRequestBody, dataset: ReportDataset): ReportRequestBody {
  const groups=datasetGroupings(dataset)
  return { dataSource: 44, from: request.from, to: request.to, customerGroups: initialCustomerGroups(), selections: [],
    sorted: { Row: [83,6].flatMap(type=>groups.filter(field=>field.type===type)), Col: groups.filter(field=>field.type===82),
      Measurements: dataset.Measurements.filter(field=>field.Type===109 || field.Type===112).map(field=>({Type:field.Type,Name:field.Name,parentName:field.Name,IsChecked:true})) } }
}

export function customerGroupsError(value: CustomerGroups | undefined): string | null {
  if (!value || value.Version!==1 || value.Groups.length<2 || value.Groups.length>8
    || value.Groups.some(group=>!group.Name.trim() || group.Name.length>80 || group.ClientIds.length<1 || group.ClientIds.length>100
      || group.ClientIds.some(id=>!Number.isSafeInteger(id) || id<=0) || new Set(group.ClientIds).size!==group.ClientIds.length)
    || new Set(value.Groups.map(group=>group.Name.trim().toLocaleLowerCase())).size!==value.Groups.length)
    return 'Додайте від 2 до 8 наборів з різними назвами та клієнтами; перший набір є еталоном.'
  return null
}
