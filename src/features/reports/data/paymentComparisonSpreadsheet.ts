import type { SpreadsheetCellValue, SpreadsheetReportHeader, SpreadsheetRow, SpreadsheetSheet } from '../types'
import { PAYMENT_COMPARISON_CAPTIONS, PAYMENT_COMPARISON_TITLE, PAYMENT_COMPARISON_PERCENTAGE_MAXIMUM, PAYMENT_COMPARISON_RESOURCE, paymentComparisonExactId } from './paymentComparison'
import { isComparisonDate } from './clientPeriodComparison'

export const PAYMENT_COMPARISON_EMPTY_STATE = 'Стан звіту: імпортованих платежів вибраного напряму в обох періодах немає'
export const PAYMENT_COMPARISON_NOTE_PREFIXES = ['Джерело:', 'Напрям платежів:', 'Час платежів:', 'Договори:', 'Валютні суми:', 'Невідомі значення:', 'Зміна платежів:', 'Обмеження відповідності:'] as const
const incomingNotes = ["Джерело: GBA, набір 21; поточні записані імпортовані платіжні документи, кожен документ враховано один раз.", "Напрям платежів: Надходження. Збережений знак суми не змінюється.", "Час платежів: два незалежні включні періоди київського календаря за підтвердженою датою документа. Перетин входить один раз до кожного періоду; це не час банківського виконання.", "Договори: валюта, клієнт і точний договір є окремими ознаками. Спільні назви або умови не об’єднують різні договори; непідтверджені прив’язки залишаються окремими рядками.", "Валютні суми: записані суми збережено до чотирьох десяткових знаків. Підсумок потребує однієї підтвердженої валюти в обох періодах; різні або невідомі валюти залишають усі його показники порожніми.", "Невідомі значення: непідтверджена сума залишає показник свого періоду порожнім. Відсутні платежі періоду дають нуль лише у непорожній групі з підтвердженою валютою та повним прочитанням.", "Зміна платежів: поточна сума мінус попередня; відносна зміна ділиться на попередню суму зі збереженням знака. Відомий попередній нуль дає 100 %, зокрема для двох нулів. Відсотки округлено до двох знаків, підсумки обчислено із сум.", "Обмеження відповідності: ручні документи, перекази, обміни валют і повна історія станів не включені. Курси та ціни договорів не застосовуються. Управлінська валюта, початкові права та числова відповідність регістрам 1С не підтверджені."] as const
export const paymentComparisonNotes = (direction: 1 | 2): string[] => incomingNotes.map((line,index) => index === 1 && direction === 2 ? line.replace('Надходження', 'Виплати') : line)
const attributionPrefixes = ['Валютні суми:', 'Зміна платежів:']
const longestCaptionsFirst = PAYMENT_COMPARISON_CAPTIONS.toSorted((a, b) => b.length - a.length)
const readTime = /^Час читання \(UTC\): (\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2}\.\d{3}) – (\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2}\.\d{3})$/
const text = (line: string) => line.startsWith('! ') ? line.slice(2) : line
const invalid = () => new Error('Некоректний файл порівняння платежів: потрібні два періоди, вісім пояснень і підтверджені валюти й формати показників. Файл не застосовано.')
export const isPaymentComparisonSheet = (sheet: SpreadsheetSheet | null): boolean => sheet?.header?.lines[0] === PAYMENT_COMPARISON_TITLE
export const paymentComparisonColumn = (caption: string | undefined): number => PAYMENT_COMPARISON_CAPTIONS.findIndex(item => item === caption?.split(' · ').at(-1))

function identityCaption(value: SpreadsheetCellValue | undefined): string | null | undefined {
  if (value === 'Невідомо') return null
  if (typeof value !== 'string') return undefined
  const match = value.match(/^.+ \[([1-9]\d*)\]$/u)
  return match ? paymentComparisonExactId({ Id: match[1] }) ?? undefined : undefined
}
const absent = (value: unknown) => value == null || value === ''

/** The source21 writer emits every leaf axis explicitly and two distinct subtotal levels. */
export function buildPaymentComparisonBodyRows(rows: SpreadsheetCellValue[][]): SpreadsheetRow[] {
  return rows.flatMap<SpreadsheetRow>(cells => {
    if (cells.every(absent)) return []
    const [currency, client, contract] = cells
    // Recognize leaves by all three explicit identities before reserved subtotal captions.
    if ([currency, client, contract].every(value => identityCaption(value) !== undefined)) return [{ kind: 'data', cells }]
    if (currency === 'Загальний підсумок' && absent(client) && absent(contract)) return [{ kind: 'total', cells }]
    if (typeof currency === 'string' && currency.startsWith('Підсумок: ') && identityCaption(currency.slice('Підсумок: '.length)) !== undefined
      && absent(client) && absent(contract)) return [{ kind: 'subtotal', cells }]
    if (identityCaption(currency) !== undefined && typeof client === 'string' && client.startsWith('Підсумок: ')
      && identityCaption(client.slice('Підсумок: '.length)) !== undefined && absent(contract)) return [{ kind: 'subtotal', cells }]
    throw invalid()
  })
}

export function validatePaymentComparisonAttribution(rows: SpreadsheetCellValue[][], format: 'workbook' | 'flat'): void {
  const title = String(rows[0]?.[0] ?? '').trim()
  // Ordinary CSV only declares columns on its first row. Native files place
  // metadata before the first blank separator, then one/two column-header rows.
  // Business labels in a legacy report body must not turn it into source21.
  const metadata = rows.slice(0, 6).some(row => /^(?:Поточний період:|Рядки:|Час читання \(UTC\):)/.test(String(row[0] ?? '')))
  const separator = metadata ? rows.findIndex(row => row.every(cell => cell == null || String(cell).trim() === '')) : -1
  const axisHeader = metadata ? rows.findIndex(row => row[0] === 'Валюта рахунку' && row[1] === 'Клієнт' && row[2] === 'Договір') : -1
  const headerEnd = separator >= 0 ? separator + (format === 'flat' ? 2 : 3) : axisHeader >= 0 ? axisHeader + 1 : 1
  const marked = rows.slice(0, headerEnd).some(row => row.some(cell => typeof cell === 'string' && (
    PAYMENT_COMPARISON_CAPTIONS.some(caption => cell === caption || cell === `${PAYMENT_COMPARISON_RESOURCE} · ${caption}`)
    || attributionPrefixes.some(prefix => text(cell).startsWith(prefix)))))
  if (marked && title !== PAYMENT_COMPARISON_TITLE) throw invalid()
}

function orderedPeriod(line: string, prefix: string): boolean {
  const match = line.slice(prefix.length).trim().match(/^(\d{2})\.(\d{2})\.(\d{4}) – (\d{2})\.(\d{2})\.(\d{4})$/)
  if (!match) return false
  const from = `${match[3]}-${match[2]}-${match[1]}`, to = `${match[6]}-${match[5]}-${match[4]}`
  return isComparisonDate(from) && isComparisonDate(to) && from <= to
}

/** The last caption contains a comma: only whole known captions delimit the selected measure list. */
function selectedCaptions(value: string): string[] | null {
  const result: string[] = [], used = new Set<string>()
  let remaining = value
  while (remaining) {
    const caption = longestCaptionsFirst.find(item => remaining === item || remaining.startsWith(`${item}, `))
    if (!caption || used.has(caption)) return null
    result.push(caption)
    used.add(caption)
    remaining = remaining.slice(caption.length).replace(/^, /, '')
  }
  return result.length ? result : null
}

export function validatePaymentComparisonHeader(title: string, header: SpreadsheetReportHeader | null): void {
  if (title !== PAYMENT_COMPARISON_TITLE) return
  const lines = header?.lines.map(text)
  if (!lines || header!.columnGroupings.length || JSON.stringify(header!.rowGroupings) !== JSON.stringify(['Валюта рахунку', 'Клієнт', 'Договір'])
    || ['Період:', 'Поточний стан:'].some(prefix => lines.some(line => line.startsWith(prefix)))) throw invalid()
  for (const prefix of ['Поточний період:', 'Період порівняння:']) {
    const matches = lines.filter(line => line.startsWith(prefix))
    if (matches.length !== 1 || !orderedPeriod(matches[0], prefix)) throw invalid()
  }
  const readLines = lines.filter(line => line.startsWith('Час читання (UTC):')), match = readLines[0]?.match(readTime)
  if (readLines.length !== 1 || !match) throw invalid()
  const start = `${match[3]}-${match[2]}-${match[1]}T${match[4]}Z`, end = `${match[7]}-${match[6]}-${match[5]}T${match[8]}Z`
  if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || start > end
    || new Date(start).toISOString() !== start || new Date(end).toISOString() !== end) throw invalid()
  const lineSet = new Set(lines)
  if (![1, 2].some(direction => paymentComparisonNotes(direction as 1 | 2).every(note => lineSet.has(note)))) throw invalid()
  const measureLine = lines.find(line => line.startsWith('Показники:'))
  if (!measureLine || !['Рядки:', 'Колонки:', 'Показники:', 'Фільтри:'].every(prefix => lines.filter(line => line.startsWith(prefix)).length === 1)
    || !selectedCaptions(measureLine.slice('Показники:'.length).trim())
    || !PAYMENT_COMPARISON_NOTE_PREFIXES.every(prefix => {
      const matches = lines.filter(line => line.startsWith(prefix))
      return matches.length === 1 && matches[0].slice(prefix.length).trim().length > 0
    })) throw invalid()
}

/** Currency-qualified raw contributors are absent from the file. Never recompute deltas, ratios or rollups from published rounded values. */
export function validatePaymentComparisonSheet(sheet: SpreadsheetSheet): SpreadsheetSheet {
  if (!isPaymentComparisonSheet(sheet)) return sheet
  const width = sheet.header!.rowGroupings.length
  const columns = sheet.columns.slice(width).map(paymentComparisonColumn)
  const measureLine = sheet.header!.lines.map(text).find(line => line.startsWith('Показники:'))
  const declared = measureLine ? selectedCaptions(measureLine.slice('Показники:'.length).trim()) : null
  if (!declared || !columns.length || columns.some(index => index < 0) || new Set(columns).size !== columns.length
    || sheet.columns[0] !== 'Валюта рахунку' || sheet.columns[1] !== 'Клієнт' || sheet.columns[2] !== 'Договір'
    || columns.length !== declared.length || columns.some((index, position) => PAYMENT_COMPARISON_CAPTIONS[index] !== declared[position]
      || sheet.columns[width + position] !== `${PAYMENT_COMPARISON_RESOURCE} · ${PAYMENT_COMPARISON_CAPTIONS[index]}`)) throw invalid()
  for (const row of sheet.rows) {
    if (row.cells.length > sheet.columns.length) throw invalid()
    for (const offset of columns.keys()) {
      const cell = row.cells[width + offset]
      if (cell === null || cell === '' || cell === undefined) continue
      if (typeof cell !== 'number' || !Number.isFinite(cell)) throw invalid()
      if ((columns[offset] === 3 && Math.abs(cell) > PAYMENT_COMPARISON_PERCENTAGE_MAXIMUM) || Number(cell.toFixed(columns[offset] === 3 ? 2 : 4)) !== cell) throw invalid()
    }
    validatePublishedDerivatives(columns, row.cells.slice(width))
    const currency = typeof row.cells[0] === 'string' && row.kind === 'subtotal' && row.cells[0].startsWith('Підсумок: ')
      ? row.cells[0].slice('Підсумок: '.length) : row.cells[0]
    if (row.kind !== 'total' && identityCaption(currency) === null && row.cells.slice(width).some(value => !absent(value))) throw invalid()
  }
  const states = sheet.header!.lines.filter(line => line.startsWith('Стан звіту:'))
  const totals = sheet.rows.filter(row => row.kind === 'total')
  if (totals.length > 1) throw invalid()
  const currencies = new Set<string | null | undefined>()
  for (const row of sheet.rows) if (row.kind === 'data') currencies.add(identityCaption(row.cells[0]))
  if ((currencies.has(null) || currencies.size > 1) && totals.some(row => row.cells.slice(width).some(value => !absent(value)))) throw invalid()
  if (states.length && (states.length !== 1 || states[0] !== PAYMENT_COMPARISON_EMPTY_STATE || sheet.rows.length)) throw invalid()
  if (!states.length && !sheet.rows.some(row => row.kind === 'data') && totals.length) throw invalid()
  return sheet
}

function validatePublishedDerivatives(columns: number[], values: unknown[]): void {
  const current = values[columns.indexOf(0)], previous = values[columns.indexOf(1)]
  const derived = [2, 3].filter(kind => columns.includes(kind))
  if ((columns.includes(0) && absent(current)) || (columns.includes(1) && absent(previous))) {
    if (derived.some(kind => !absent(values[columns.indexOf(kind)]))) throw invalid()
  } else if (columns.includes(0) && columns.includes(1) && derived.some(kind => absent(values[columns.indexOf(kind)]))) throw invalid()
  if (derived.length === 2 && absent(values[columns.indexOf(2)]) !== absent(values[columns.indexOf(3)])) throw invalid()
}
