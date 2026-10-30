import type { ReportSelectedValue } from '../types'
/** Same whitespace-only/UTF-16 length admission as .NET; never trim a stored TOP code. */
export function validCustomerGroupTopName(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && !/^\p{White_Space}*$/u.test(value)
}
function uniqueNameKey(raw: string): boolean {
  let depth=0,count=0
  for(let index=0;index<raw.length;index+=1){
    const character=raw[index]
    if(character==='{' || character==='[')depth+=1
    else if(character==='}' || character===']')depth-=1
    else if(character==='"'){
      const start=index
      for(index+=1;index<raw.length;index+=1){if(raw[index]==='\\')index+=1;else if(raw[index]==='"')break}
      if(depth===1 && /^\s*:/.test(raw.slice(index+1)) && String(JSON.parse(raw.slice(start,index+1))).toLowerCase()==='name')count+=1
    }
  }
  return count===1
}
export function customerGroupTopName(raw: unknown): string | null {
  try {
    if(typeof raw==='string' && (raw.length>65536 || !uniqueNameKey(raw)))return null
    const value:unknown=typeof raw==='string'?JSON.parse(raw):raw
    if(!value || typeof value!=='object' || Array.isArray(value))return null
    const keys=Object.keys(value).filter(key=>key.toLowerCase()==='name')
    if(keys.length!==1)return null
    const name=(value as Record<string,unknown>)[keys[0]]
    return validCustomerGroupTopName(name)?name:null
  }catch{return null}
}
const keyFor=(name:string)=>'top:'+JSON.stringify(name)
export function customerGroupTopValues(values:ReportSelectedValue[],options:string[]){
  const entries=values.map((value,index)=>{const name=customerGroupTopName(value.Data);return{value:name===null?'invalid:'+index:keyFor(name),label:value.Name||name||'Збережене значення без коду TOP'}})
  const selected=[...new Map(entries.map(item=>[item.value,item])).values()],previous=new Set(selected.map(item=>item.value))
  const data=options.map(name=>selected.find(item=>item.value===keyFor(name))??{value:keyFor(name),label:name})
  const change=(keys:string[])=>{
    const desired=new Set(keys),retained=values.filter((_,index)=>desired.has(entries[index].value))
    return [...retained,...options.filter(name=>desired.has(keyFor(name))&&!previous.has(keyFor(name))).map(name=>({Data:{Name:name},Name:name,Value:0}))]
  }
  return{selected,data,change}
}
export const CUSTOMER_GROUP_TOP_NOTE='TOP у відборі — поточні дані картки товару; його зміна впливає і на звіти за минулі періоди.'
