import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ReportInlinePreview } from './ReportInlinePreview'
import type { NativeReportPreview, NativeReportPreviewRequest } from '../data/nativeReportPreview'
const scalar=(Value:string|null)=>({Kind:Value===null?'null':'decimal',Value,Provenance:'producerCell'})
function fixture():NativeReportPreview {
 const Request:NativeReportPreviewRequest={DataSource:'NativePurchases',IsCurrentSnapshot:false,ObservationStartedAtUtc:null,ObservationCompletedAtUtc:null,HasPeriod:true,PeriodFrom:'01.09.2026',PeriodTo:'31.10.2026',ComparisonPeriodFrom:null,ComparisonPeriodTo:null,RowGroupings:['Місяць','Товар'],ColumnGroupings:[],Measures:['Кількість','Вага нетто','Вартість'],Filters:[],IgnoredFilters:[],Notes:[]}
 const rows=[['27.0000000000000000000000','4.8060000000000000000000','12.3456'],['0.0000000000000000000000','0','0'],['1',null,null]]
 const values=(row:number,raw:(string|null)[])=>raw.map((value,col)=>({RowSourceIndex:row,ColumnSourceIndex:col,Value:scalar(value)}))
 return {Version:1,ResultSha256:'a'.repeat(64),PresentationOnly:true,Request,Page:{Offset:0,Limit:50,ReturnedRows:3,TotalVisibleRows:3,HasMore:false},RowSchema:[{Caption:'Місяць'},{Caption:'Товар'}],ColumnSchema:[{Caption:'Показник'}],Rows:['A','B','C'].map((name,index)=>({Ordinal:index,SourceIndex:index,Values:[{Caption:index<2?'09.2026':'10.2026'},{Caption:name}]})),Columns:['Кількість','Вага нетто','Вартість'].map((Caption,index)=>({Ordinal:index,SourceIndex:index,Values:[{Caption}]})),Cells:rows.flatMap((row,index)=>values(index,row)),Totals:{State:'materialized',Groups:[{Level:0,RowSourceIndex:0,RowCount:2,Values:values(0,rows[0])},{Level:0,RowSourceIndex:2,RowCount:1,Values:values(2,rows[2])}],Values:values(-1,['28',null,null])},valueSemantics:[0,96,2].map((field,index)=>({columnSourceIndex:index,measureType:field,semantics:{kind:field===2?'money':'quantity',currencyPolicy:field===2?'EUR':'notApplicable',unitPolicy:field===96?'kilogram':'confirmedCompatibleUnit',aggregation:'sum',scalable:field===2,defaultDecimalPlaces:field===2?2:3,defaultMinimumDecimalPlaces:field===2?2:0}}))}
}
afterEach(cleanup)
it('formats purchase leaves subtotal grand and zero from metadata while cache DTO bytes stay unchanged',()=>{
 const preview=fixture(),before=JSON.stringify(preview);render(<MantineProvider><I18nProvider><ReportInlinePreview preview={preview}/></I18nProvider></MantineProvider>)
 const row=screen.getByRole('rowheader',{name:'A'}).closest('tr')!;expect(within(row).getAllByRole('cell').map(cell=>cell.textContent)).toEqual(['27','4,806','12,35'])
 const subtotal=screen.getByRole('rowheader',{name:'Підсумок: 09.2026'}).closest('tr')!;expect(within(subtotal).getAllByRole('cell').map(cell=>cell.textContent)).toEqual(['27','4,806','12,35'])
 const zero=screen.getByRole('rowheader',{name:'B'}).closest('tr')!;expect(within(zero).getAllByRole('cell').map(cell=>cell.textContent)).toEqual(['0','0','0,00'])
 const grand=screen.getByRole('rowheader',{name:'Загальний підсумок'}).closest('tr')!;expect(within(grand).getAllByRole('cell').map(cell=>cell.textContent)).toEqual(['28','—','—'])
 expect(JSON.stringify(preview)).toBe(before);expect(preview.numberPresentation).toBeUndefined()
})
it('applied explicitquantity2 wins for leaf and cached totals without rewriting values',()=>{
 const preview=fixture();preview.numberPresentation={version:1,moneyScale:1,decimalPlacesByKind:{quantity:2}};const before=JSON.stringify(preview)
 const view=render(<MantineProvider><I18nProvider><ReportInlinePreview preview={preview}/></I18nProvider></MantineProvider>);const row=screen.getByRole('rowheader',{name:'A'}).closest('tr')!;expect(within(row).getAllByRole('cell').map(cell=>cell.textContent)).toEqual(['27,00','4,81','12,35'])
 view.rerender(<MantineProvider><I18nProvider><ReportInlinePreview preview={structuredClone(preview)}/></I18nProvider></MantineProvider>);const subtotal=screen.getByRole('rowheader',{name:'Підсумок: 09.2026'}).closest('tr')!;expect(within(subtotal).getAllByRole('cell').map(cell=>cell.textContent)).toEqual(['27,00','4,81','12,35']);expect(JSON.stringify(preview)).toBe(before)
})
it('preserves NULL zero and negative-red classification independently from exact display rounding',()=>{
 const preview=fixture();preview.Cells[1].Value=scalar('-4.8060000000000000000000');preview.constructorPresentation={version:1,negativeRed:true,grandTotals:true}
 render(<MantineProvider><I18nProvider><ReportInlinePreview preview={preview}/></I18nProvider></MantineProvider>);const weight=within(screen.getByRole('rowheader',{name:'A'}).closest('tr')!).getByText('-4,806');expect(weight.classList.contains('is-negative')).toBe(true)
 expect(within(screen.getByRole('rowheader',{name:'C'}).closest('tr')!).getAllByText('—')).toHaveLength(2)
})
