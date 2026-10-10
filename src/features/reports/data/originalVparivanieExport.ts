import { matrixQuantity, type MatrixResult } from './originalVparivanie'

export function matrixExportError(result: MatrixResult): string | null {
  return !result.Available || !result.SourceParityVerified || !result.OriginalFullTaskAccepted
    ? 'Матриця ще не пройшла повну звірку з 1С.' : null
}
export function originalMatrixCells(result: MatrixResult): (string | null)[][] {
  const error = matrixExportError(result); if (error) throw new Error(error)
  return [
    ['Номенклатура', ...result.Columns.map(column => column.Caption)],
    [null, ...result.Columns.map(column => column.RegionCode)],
    [null, ...result.Columns.map(column => column.MeasureCaption)],
    ...result.Rows.map(row => [row.Caption, ...row.Values]),
  ]
}
const metadata = (result: MatrixResult) => [['Матриця товарів Fenix'], [`Група: ${result.GroupCaption ?? ''}`], [`Період: ${result.From} — ${result.Through}`]]
export function originalMatrixCsv(result: MatrixResult): string {
  const safe = (value: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(value) ? `'${value}` : value
  const quote = (value: string | null) => `"${(value ?? '').replaceAll('"', '""')}"`
  const rows = [...metadata(result).map(row => row.map(safe)), ...originalMatrixCells(result).map((row, index) => row.map((cell, column) => cell === null ? null : index < 3 || column === 0 ? safe(cell) : matrixQuantity(cell)))]
  return '\ufeff' + rows.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}
/** Excel keeps at most 15 significant numeric digits. Larger quantities remain exact text. */
export function matrixExcelQuantity(value: string): { t: 'n'; v: number; z: string } | { t: 's'; v: string } {
  matrixQuantity(value)
  const [whole, fraction = ''] = value.split('.')
  const significant = (whole.replace('-', '') + fraction).replace(/^0+/, '').replace(/0+$/, '')
  const canonical = value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '').replace(/^-0$/, '0')
  const numeric = Number(value)
  return significant.length <= 15 && String(numeric) === canonical
    ? { t: 'n', v: numeric, z: fraction ? `0.${'0'.repeat(fraction.length)}` : '0' }
    : { t: 's', v: value }
}
export async function originalMatrixXlsx(result: MatrixResult): Promise<Blob> {
  const rows = originalMatrixCells(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  let textQuantities = false
  result.Rows.forEach((row, rowIndex) => row.Values.forEach((value, columnIndex) => {
    if (value === null) return
    const cell = matrixExcelQuantity(value)
    textQuantities ||= cell.t === 's'
    sheet[XLSX.utils.encode_cell({ r: rowIndex + 3, c: columnIndex + 1 })] = cell
  }))
  sheet['!cols'] = [{ wch: 48 }, ...result.Columns.map(() => ({ wch: 18 }))]
  XLSX.utils.book_append_sheet(book, sheet, 'Матриця')
  const details = metadata(result)
  if (textQuantities) details.push(['Кількості, що перевищують точність чисел Excel, збережено текстом без округлення.'])
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(details), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
