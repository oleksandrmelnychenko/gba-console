import { expect, it } from 'vitest'
import { nativePriceComparisonError, nativePriceComparisonRequest } from './nativePriceComparison'
import type { ReportDataset, ReportRequestBody } from '../types'
it('uses the full native population and rejects an empty or zero price type',()=>{
  const dataset={DataSource:46,Groupings:[12,2,6].map(Type=>({Type,Name:String(Type)})),Measurements:[4,70,71].map(Type=>({Type,Name:String(Type)}))} as ReportDataset
  const request=nativePriceComparisonRequest({from:'2026-10-01',to:'2026-10-31'} as ReportRequestBody,dataset)
  expect(request.dataSource).toBe(46)
  expect(request.sorted.Row.map(group=>group.type)).toEqual([12,2,6])
  expect(request).not.toHaveProperty('oneC')
  expect(nativePriceComparisonError(request.nativePriceComparison)).toBeTruthy()
  expect(nativePriceComparisonError({Version:1,PriceTypeId:'0'.repeat(32)})).toBeTruthy()
  expect(nativePriceComparisonError({Version:1,PriceTypeId:'1'.repeat(32)})).toBeNull()
})
