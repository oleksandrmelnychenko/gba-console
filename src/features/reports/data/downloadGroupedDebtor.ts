import type { GroupedDebtorStatement } from './groupedDebtor'
import { groupedDebtorExportFileName, groupedDebtorPdfDefinition, groupedDebtorXlsxRows } from './groupedDebtorExport'

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function downloadGroupedDebtorXlsx(statement: GroupedDebtorStatement): Promise<void> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet(groupedDebtorXlsxRows(statement))
  sheet['!cols'] = [{ wch: 36 }, { wch: 10 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 }]
  sheet['!freeze'] = { xSplit: 0, ySplit: 7 }
  XLSX.utils.book_append_sheet(workbook, sheet, 'Дебіторка')
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  downloadBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    groupedDebtorExportFileName(statement, 'xlsx'))
}

export async function downloadGroupedDebtorPdf(statement: GroupedDebtorStatement): Promise<void> {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
    import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts'),
  ])
  const blob = await new Promise<Blob>(resolve => {
    pdfMake.createPdf(groupedDebtorPdfDefinition(statement), undefined, undefined, vfs).getBlob(resolve)
  })
  downloadBlob(blob, groupedDebtorExportFileName(statement, 'pdf'))
}
