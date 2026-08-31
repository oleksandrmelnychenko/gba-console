import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as XLSX from 'xlsx'

// BUG-1141 recorder attachment references a browser-local C:\fakepath file.
// These are the exact columns and rows exercised by that recording, recovered
// from the uploaded invoice document persisted by DEV on 2026-08-31.
const SAMPIYON_ROWS: Array<Array<string | number | null>> = [
  ['№\nз/п', '№ в МД', '№ в інв.', 'Артикул', 'Код товару', 'Вага брутто', 'Вага нетто', 'Ціна', 'Кіл-ть', 'Митна вартість', 'Мито', 'ПДВ', 'Собівартість'],
  [9, 1, null, 'CR0017-SF', '8421310000', 203.52, 174.24, 16.49, 48, 30957.93, 0, 6191.59, 37149.52],
  [10, 1, null, 'CR0018-SF', '8421310000', 248.22, 214.2, 14.52, 63, 35907.61, 0, 7181.52, 43089.13],
  [11, 1, null, 'CR0037-SF', '8421310000', 4.8, 3, 6, 6, 1363.67, 0, 272.73, 1636.4],
  [12, 1, null, 'CR0039-SF', '8421310000', 41.76, 36.56, 18.48, 8, 5819.61, 0, 1163.92, 6983.53],
  [13, 1, null, 'CR0041-SF', '8421310000', 10.83, 6.84, 6.92, 10, 2637.24, 0, 527.45, 3164.69],
  [14, 1, null, 'CR0041/0042-SF', '8421310000', 6.62, 4.62, 12.9, 5, 2423.54, 0, 484.71, 2908.25],
  [15, 1, null, 'CR0042-SF', '8421310000', 5.696, 3.84, 5.5, 16, 3273.33, 0, 654.67, 3928],
  [16, 1, null, 'CR0055-SF', '8421310000', 50.92, 41.52, 14.3, 20, 10960.9, 0, 2192.18, 13153.08],
  [17, 1, null, 'CR0061L-SF', '8421310000', 33.3, 26.5, 16.2, 10, 6252.99, 0, 1250.6, 7503.59],
  [18, 1, null, 'CR0065-SF', '8421310000', 303.1, 260.4, 18, 70, 49073.31, 0, 9814.66, 58887.97],
  [19, 1, null, 'CR0067-SF', '8421310000', 323.84, 274.16, 16.11, 92, 57398.83, 0, 11479.77, 68878.6],
  [20, 1, null, 'CR0068-SF', '8421310000', 10.08, 7.33, 7.75, 10, 2933.17, 0, 586.63, 3519.8],
  [21, 1, null, 'CR0075-SF', '8421310000', 23.317, 19.04, 15.12, 7, 4100.82, 0, 820.16, 4920.98],
  [22, 1, null, 'CR0078-SF', '8421310000', 164.52, 133.32, 18, 40, 27955.49, 0, 5591.1, 33546.59],
  [23, 1, null, 'CR0124-SF', '8421310000', 40.3, 34.2, 17.73, 10, 6881.92, 0, 1376.38, 8258.3],
  [24, 1, null, 'CR0125L-SF', '8421310000', 126.4, 122.68, 19.9, 40, 30354.07, 0, 6070.81, 36424.88],
  [25, 1, null, 'CR0137-SF', '8421310000', 144.396, 122.556, 15.04, 42, 24526.86, 0, 4905.37, 29432.23],
  [26, 1, null, 'CR0137FR-SF', '8421310000', 79.419, 67.459, 20.57, 23, 18083.95, 0, 3616.79, 21700.74],
  [27, 1, null, 'CR0167-SF', '8421310000', 256.8, 214.8, 19.66, 60, 45673.62, 0, 9134.72, 54808.34],
  [28, 1, null, 'CR0189-SF', '8421310000', 92.961, 73.821, 16.24, 33, 20514.61, 0, 4102.92, 24617.53],
  [29, 1, null, 'CR0189KIT-SF', '8421310000', 32.73, 28.1, 22.76, 10, 8645.17, 0, 1729.03, 10374.2],
  [30, 1, null, 'CR0216-SF', '8421310000', 15.12, 12.294, 11.61, 6, 2696.76, 0, 539.35, 3236.11],
  [31, 1, null, 'CR0221-SF', '8421310000', 12.8, 10.808, 15.8, 4, 2437.54, 0, 487.51, 2925.05],
]

export function createBug1141SampiyonWorkbook(): { cleanup: () => void; filePath: string } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gba-bug-1141-sampiyon-'))
  const filePath = path.join(directory, 'BUG-1141-SAMPIYON.xlsx')
  const sheet = XLSX.utils.aoa_to_sheet(SAMPIYON_ROWS)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Лист1')
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer
  fs.writeFileSync(filePath, buffer)

  return {
    cleanup: () => fs.rmSync(directory, { force: true, recursive: true }),
    filePath,
  }
}
