import type { ReportDataset } from '../types'
import { defaultDatasetRequest } from './reportDatasets'
export const stockQuantityCapability = { version:1,measure:106,comparison:'GreaterThan',value:0,stage:'GroupedRowsBeforeTotals',requiresMeasure:true,maxColumnGroupings:0,maxRowGroupings:3,unknownQuantity:'Reject',rowGroupingTypes:[5,6,7,8,9,24,28,29,34,83] }
export const stockQuantityDataset:ReportDataset={DataSource:45,Name:'Звіт по залишкам',Description:'',Limitations:[],PeriodRequired:true,PeriodSupported:true,
 Groupings:[0,1,2,3,5,6,7,8,9,24,28,29,34,83].map(Type=>({Type,Name:({5:'Товар',29:'Склад',24:'Надходження'}as Record<number,string>)[Type]??String(Type)})),
 Measurements:Array.from({length:12},(_,i)=>({Type:97+i,Name:97+i===106?'Кінцевий залишок: кількість':String(97+i)})),Filters:[0,1,2,19,20,21,23].map(Type=>({Type,Name:String(Type)})),stockQuantityFilter:stockQuantityCapability}
export function stockQuantityRequest(){const request=defaultDatasetRequest(stockQuantityDataset,'2026-09-01','2026-09-03');request.sorted.Row=[{key:'StockWarehouse',label:'Склад',type:29}];request.sorted.Col=[];request.sorted.Measurements=[{Type:106,Name:'Кінцевий залишок: кількість',parentName:'Кінцевий залишок',IsChecked:true}];return request}
