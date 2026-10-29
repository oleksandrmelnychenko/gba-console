import { expect, it } from 'vitest'
import { isNativePricingId, nativePriceComparisonError, nativePriceComparisonRequest } from './nativePriceComparison'
import type { ReportDataset, ReportRequestBody } from '../types'
it('uses the full native population and rejects an empty or zero price type',()=>{
  const dataset={DataSource:46,Groupings:[12,2,6].map(Type=>({Type,Name:String(Type)})),Measurements:[4,70,71].map(Type=>({Type,Name:String(Type)}))} as ReportDataset
  const request=nativePriceComparisonRequest({from:'2026-10-01',to:'2026-10-31'} as ReportRequestBody,dataset)
  expect(request.dataSource).toBe(46)
  expect(request.nativePriceComparison).toEqual({Version:2,PricingId:''})
  expect(request.sorted.Row.map(group=>group.type)).toEqual([12,2,6])
  expect(request).not.toHaveProperty('oneC')
  expect(nativePriceComparisonError(request.nativePriceComparison)).toBeTruthy()
  expect(nativePriceComparisonError({Version:1,PriceTypeId:'0'.repeat(32)})).toBeTruthy()
  expect(nativePriceComparisonError({Version:1,PriceTypeId:'1'.repeat(32)})).toBeNull()
})

it.each(['1','9007199254740993','9223372036854775807'])('accepts an exact native pricing identity %s',PricingId=>{
 expect(nativePriceComparisonError({Version:2,PricingId})).toBeNull()
 expect(nativePriceComparisonError({Version:2,PricingId,PriceTypeId:'1'.repeat(32)} as never)).toBeTruthy()
})
it.each(['0','01','+1','1.0','9223372036854775808',''])('rejects a noncanonical native pricing identity %s',PricingId=>{
 expect(nativePriceComparisonError({Version:2,PricingId})).toBeTruthy()
})

it.each([1,Number.MAX_SAFE_INTEGER+1,null,undefined,{},'-1',' 1','1 ','1e3'])('does not coerce an unproven native identity %s',id=>{
 expect(isNativePricingId(id)).toBe(false)
})
it('keeps saved v1 distinct from native v2 even when both fields are supplied',()=>{
 expect(nativePriceComparisonError({Version:1,PriceTypeId:'a'.repeat(32),PricingId:'1'} as never)).toBeTruthy()
 expect(nativePriceComparisonError({Version:1,PriceTypeId:'a'.repeat(32)})).toBeNull()
})
