import { apiRequest } from '../../../shared/api/apiClient'
import { validCustomerGroupTopName } from '../data/customerGroupTop'
export async function searchCustomerGroupTop(value:string,offset:number,signal?:AbortSignal):Promise<string[]>{
  if(value.length>120 || !Number.isInteger(offset) || offset<0 || offset>10000)throw new Error('Некоректні параметри пошуку TOP.')
  const response=await apiRequest<unknown>('/report/datasets/lookup',{query:{dataSource:44,field:3,value,offset,limit:30},signal})
  if(!Array.isArray(response)||response.length>30)throw new Error('Некоректний список TOP.')
  const seen=new Set<string>()
  return response.map(item=>{
    if(!item || typeof item!=='object' || Array.isArray(item) || !validCustomerGroupTopName(item.Name) || seen.has(item.Name))throw new Error('Код TOP не підтверджено.')
    seen.add(item.Name);return item.Name
  })
}
