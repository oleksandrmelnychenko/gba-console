import { netDataset } from './reportDatasets.test-fixtures'
export const returnStatusDataset = { ...netDataset, returnsOnly: true, customerReturnFilters: true, Filters: [...netDataset.Filters.filter(item=>item.Type!==64),{Type:1,Name:'Товар'},{Type:21,Name:'Склад'},{Type:64,Name:'Причина повернення'}],
 returnItemStatuses:{version:1,field:64,returnsOnly:true,values:Array.from({length:9},(_,value)=>({value,name:value===6?'Брак':`Причина ${value}`}))} }
