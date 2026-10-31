import type { ReportDataset, ReportRequestBody, ReportSelectedValue, ReportSelection } from '../types'
import { grossDataset, netDataset } from './reportDatasets.test-fixtures'
import { availableBug1274WorkbookLaunches, bug1274WorkbookRequest } from './bug1274WorkbookLaunch'
import { defaultDatasetRequest } from './reportDatasets'
import type { SalesConstructorProfile } from './salesConstructorProfiles'
export const namedPriceDataset: ReportDataset = { ...netDataset, Limitations: [], reportProfiles: ['sales', 'grossProfit'], Groupings: grossDataset.Groupings,
 FilterExpression: { Version: 1 as const, Operators: [1,2], MaximumDepth: 8, MaximumLeaves: 64, MaximumNodes: 128 },
 Filters: [...netDataset.Filters.filter(field=>field.Type!==11),{Type:11,Name:'Тип ціни'}] }
export const archivedPriceValue = { Data: '{"Id":"9007199254740993","Archived":true}', Name: 'Збережений тип ціни [9007199254740993]', Value: 0 } as unknown as ReportSelectedValue
export function namedPriceSelection(condition=0,checked=true):ReportSelection{return{IsChecked:checked,SelectedField:{Type:11,Name:'Тип ціни'},FilterCondition:{Type:condition,Name:'Умова'},Values:[archivedPriceValue]}}
export function namedPriceRequest(profile:SalesConstructorProfile='sales',condition=0,checked=true):ReportRequestBody{
 const launch=availableBug1274WorkbookLaunches([namedPriceDataset]).find(item=>item.fileName===(profile==='sales'?'gba:sales-constructor:v1':'gba:gross-profit-constructor:v1'))!
 const request=bug1274WorkbookRequest(defaultDatasetRequest(namedPriceDataset,'2026-10-01','2026-10-27'),launch)
 return{...request,selections:[namedPriceSelection(condition,checked)]}
}
