import { expect, it } from 'vitest'
import { effectiveConstructorNumberPresentation, formatReportDecimal, type ReportValueSemantics } from './reportNumberPresentation'
import { nativeConstructorMeasureGroupLabel } from './reportOptions'
it.each([['NativeSalesNet','sales'],['NativeSalesNet','grossProfit'],['NativePurchases',undefined],['NativeCustomerGroupComparison',undefined],['NativeStockPeriod',undefined],['NativePriceComparison',undefined]])('uses metadata defaults for applied%s/%s only',(source,profile)=>{
 expect(effectiveConstructorNumberPresentation(source,profile)).toEqual({version:1,moneyScale:1})
})
it.each([['NativeSalesNet',undefined],['NativeSalesNet','unknown'],['NativeCurrentVparivanie',undefined],[undefined,undefined]])('keeps omitted formatting legacy for%s/%s',(source,profile)=>{
 expect(effectiveConstructorNumberPresentation(source,profile)).toBeUndefined()
 const explicit={version:1,moneyScale:1,decimalPlacesByKind:{quantity:2}}as const;expect(effectiveConstructorNumberPresentation(source,profile,explicit)).toBe(explicit)
})
const semantics=(kind:'quantity'|'money'|'percent'):ReportValueSemantics=>({kind,currencyPolicy:kind==='money'?'EUR':'notApplicable',unitPolicy:kind==='percent'?'percentAlreadyMultipliedBy100':'confirmedCompatibleUnit',aggregation:kind==='percent'?'recomputeFromBase':'sum',scalable:kind==='money',defaultDecimalPlaces:kind==='quantity'?3:2,defaultMinimumDecimalPlaces:kind==='quantity'?0:2})
it.each([
 ['quantity','27.0000000000000000000000','27'],['quantity','4.8060000000000000000000','4,806'],['quantity','0.0000000000000000000000','0'],
 ['quantity','-4.8060000000000000000000','-4,806'],['money','12.3450000000000000000000','12,35'],['percent','12.3450000000000000000000','12,35'],
]as const)('formats exact%s decimal%s as%s without a float',(kind,raw,expected)=>{
 expect(formatReportDecimal(raw,semantics(kind),effectiveConstructorNumberPresentation('NativePurchases',undefined)!)).toBe(expected)
})
it('honors explicit two-place quantity while preserving raw strings and unconfigured money defaults',()=>{
 const raw='4.8060000000000000000000',explicit={version:1,moneyScale:1,decimalPlacesByKind:{quantity:2}}as const,before=JSON.stringify(explicit)
 expect(formatReportDecimal(raw,semantics('quantity'),effectiveConstructorNumberPresentation('NativePurchases',undefined,explicit)!)).toBe('4,81')
 expect(formatReportDecimal('27',semantics('quantity'),explicit)).toBe('27,00');expect(formatReportDecimal('12.3',semantics('money'),explicit)).toBe('12,30');expect(raw).toBe('4.8060000000000000000000');expect(JSON.stringify(explicit)).toBe(before)
})
it('retains existing customer comparison quantity8/min8 metadata rather than imposing quantity3',()=>{
 expect(formatReportDecimal('27.0000000000000000000000',{...semantics('quantity'),defaultDecimalPlaces:8,defaultMinimumDecimalPlaces:8},effectiveConstructorNumberPresentation('NativeCustomerGroupComparison',undefined)!)).toBe('27,00000000')
})
it('names the purchase money tree by explicit source and leaves other roots unchanged',()=>{
 expect(nativeConstructorMeasureGroupLabel(3,'SalesValue')).toBe('Вартість закупівлі')
 for(const source of [2,44,45,46])expect(nativeConstructorMeasureGroupLabel(source,'SalesValue')).toBeUndefined()
 expect(nativeConstructorMeasureGroupLabel(35,'SalesValue')).toBe('Продажі');expect(nativeConstructorMeasureGroupLabel(3,'Cost')).toBeUndefined()
})
