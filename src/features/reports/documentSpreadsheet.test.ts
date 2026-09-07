import { describe, expect, it } from 'vitest'
import { buildSheetExportRows, buildSpreadsheetSheet, calculateTotals, detectDelimiter, filterSheetRows, getAdditiveColumns, getSpreadsheetNumberFormatter, isCurrentReportSheet, isCurrentStockSheet, parseDelimitedText } from './spreadsheet'
import { buildSpreadsheetChartData } from './data/spreadsheetChartData'
import { debtHeaderLines, debtWorkbookRows, supplierReturnHeaderLines, supplierReturnWorkbookRows } from './data/documentSpreadsheet.test-fixtures'
import { buildSpreadsheetCsv } from './utils'

describe('recorded returns and currency-aware current debt workbooks', () => {
  it('keeps debt currencies and exact agreements as axes, formats money from 2 to14 decimals and leaves unknown totals blank',()=>{
    const sheet=buildSpreadsheetSheet('Report',debtWorkbookRows)
    expect(sheet.header?.lines).toEqual(debtHeaderLines)
    expect(isCurrentReportSheet(sheet)).toBe(true);expect(isCurrentStockSheet(sheet)).toBe(false)
    const rows=sheet.rows.filter(row=>row.kind==='data')
    expect(rows.map(row=>row.cells[3])).toEqual([0,0.12345678901234,1e-14,null])
    expect(getSpreadsheetNumberFormatter(sheet,3)?.format(0)).toBe('0,00')
    expect(getSpreadsheetNumberFormatter(sheet,3)?.format(1e-14)).toBe('0,00000000000001')
    expect(getSpreadsheetNumberFormatter(sheet,2)).toBeUndefined()
    expect(calculateTotals(rows,getAdditiveColumns(sheet))).toEqual([null,null,null,null])
    expect(filterSheetRows(sheet,'','2027-01-01','2027-01-02')).toEqual(sheet.rows)
    const chart=buildSpreadsheetChartData(sheet,sheet.rows,3)
    expect(chart.points.map(point=>point.value)).toEqual([0,0.12345678901234,1e-14,null]);expect(chart.unknownCount).toBe(1)
    const csv=buildSpreadsheetCsv(buildSheetExportRows(sheet,sheet.rows))
    expect(csv).toContain('0.00000000000001');expect(csv).toContain('0.12345678901234')
    expect(csv).toContain('0.00');expect(csv).not.toContain('1e-14')
    const imported=buildSpreadsheetSheet('CSV',parseDelimitedText(csv,detectDelimiter(csv)),'flat')
    expect(imported.header?.lines).toEqual(sheet.header?.lines);expect(imported.rows).toEqual(sheet.rows.map(row=>({...row,cells:row.cells.map(cell=>cell??'')})))
  })
  it('keeps return mode, period and coverage notes with eight-decimal quantity through filtered CSV and charts',()=>{
    const sheet=buildSpreadsheetSheet('Report',supplierReturnWorkbookRows)
    expect(sheet.header?.lines).toEqual(supplierReturnHeaderLines);expect(isCurrentReportSheet(sheet)).toBe(false)
    const rows=filterSheetRows(sheet,'[','','')
    expect(rows).toHaveLength(3);expect(rows.every(row=>row.kind==='data')).toBe(true)
    expect(getSpreadsheetNumberFormatter(sheet,3)?.format(1e-8)).toBe('0,00000001')
    expect(getSpreadsheetNumberFormatter(sheet,3)?.format(0)).toBe('0')
    expect(buildSpreadsheetChartData(sheet,sheet.rows,3).points.map(point=>point.value)).toEqual([0,1e-8,null])
    const csv=buildSpreadsheetCsv(buildSheetExportRows(sheet,rows))
    expect(csv).toContain('0.00000001');expect(csv).not.toContain('1e-8')
    const imported=buildSpreadsheetSheet('CSV',parseDelimitedText(csv,detectDelimiter(csv)),'flat')
    expect(imported.header?.lines).toEqual(supplierReturnHeaderLines);expect(imported.rows).toEqual(rows.map(row=>({...row,cells:row.cells.map(cell=>cell??'')})))
    expect(calculateTotals(imported.rows,getAdditiveColumns(imported))).toEqual([null,null,null,null])
  })
  it('requires the declared supplier-return period before identifying its native workbook',()=>{
    expect(buildSpreadsheetSheet('Report',supplierReturnWorkbookRows.filter((_,index)=>index!==1)).header).toBeNull()
    expect(buildSpreadsheetSheet('Report',supplierReturnWorkbookRows.map((row,index)=>index===1?['Період: довільний текст']:row)).header).toBeNull()
  })
  it('requires exact current-debt metadata and refuses unrelated titles or adjacent nonmetadata cells',()=>{
    for(const rows of [debtWorkbookRows.map((row,index)=>index===0?['Звіт боргу користувача']:row),
      debtWorkbookRows.filter((_,index)=>index!==1),debtWorkbookRows.filter((_,index)=>index!==2),
      debtWorkbookRows.map((row,index)=>index===1?['Період: 01.06.2026 – 30.06.2026']:row),
      debtWorkbookRows.map((row,index)=>index===0?[row[0],'інше значення']:row)]) expect(buildSpreadsheetSheet('Report',rows).header).toBeNull()
    const flat=buildSheetExportRows(buildSpreadsheetSheet('Report',debtWorkbookRows),[])
    flat[0][1]=flat[0][0]
    expect(buildSpreadsheetSheet('CSV',flat,'flat').header).toBeNull()
  })
})
