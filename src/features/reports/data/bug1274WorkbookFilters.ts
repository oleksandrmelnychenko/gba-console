import type { ReportDataset, ReportEntity, ReportFilterCondition, ReportSelection } from '../types'
import { datasetFilters } from './reportDatasets'
import { REPORT_FILTER_CONDITIONS } from './reportOptions'

export const SUPPLIER_WORKBOOK_FILE = 'ВП по постачальниках.xls'
export const VPARIVANIE_WORKBOOK_FILE = 'Впарювання.xls'

export const SUPPLIER_WORKBOOK_ORGANIZATIONS = [
  'ТОВ «АМГ «КОНКОРД»', 'Фенікс', 'ФОП Самолюк Алла Дмитрівна', 'ФОП Самолюк Юрій Миколайович',
] as const

export const SUPPLIER_WORKBOOK_SUPPLIERS = [
  'BENEFIT OTOMOTIV IC DIS TIC. LTD. STI,Туреччина',
  'YPS GLOBAL OTOMOTIV IC VE DIS TICARET A.S., TURKIYE',
  'ZHEJIANG VISUN AUTOMOTIVE CO., LTD., CHINA',
  'KARATAS OTOMOTIV - NECMI KARATAS, TURKIYE',
  'AYS FREN SISTEMLERI OTOMOTIV SAN.T IC.LTD.STI.',
  'GECGEL METAL DOKUM MAKINA OTOMOTIV SANAYI VE TICARETLTD.STI. TURKEY',
  'REMI IC VE DIS TIC.LTD.STI.',
  'IEX OTOMOTIV DIS TICARET LTD',
  'SOYLU EGZOZ YEDEK PARCA SAN. TIC.LTD.STI.',
  'AYDINSAN FREN CIRCIRLARI OTOMOTIV YED. PARСALARI IMALATI PAZ. VE SATIS SAN. VE TIC. LTD.STİ',
  'SOYLU EGZOZ VE OTOMOTİV A.S.',
  'AVA CEE Sp. z o.o.',
  'KOMMAR OTOMOTIV IC ve Dis Tic. Ltd., TURKIYE',
  'SMARTTECH OTOMOTIV VE TEKNOLOJI ANONIM SIRKETI //TEKOTO OTOMOTIV TIC.LTD.STI.// TURKEY',
  'Kurtsan Otomotiv San. ve Tic. A.Ş',
  'HOBIEX OTOMOTIV A.S.',
  'KALE OTO RADYATÖR SANAYİ VE TİC',
  'GOS OTOMOTIV A.S. TURKEY',
  'Kahveci Otomotiv San. Ve Tic. A.S.',
  'MAXI SUSPANSIYON DIS TICARET LTD. STI.',
  'SETFREN OTOMOTIV INS. MAK. TEKS. SAN. ve TIC. LTD. STI',
  'ELERTE POLAND SP. Z O. O.',
  'MWM Truck and Trailer Parts SP. Z.o.o',
  'LKV TEKNIK OTOMOTIV SANAYI IÇ ve DIŞ TIC. LTD. ŞT',
  'Aymeks Ic ve Dis Tic. Ltd. Sti.',
  'MAYER OTOMOTIV - Ensar MUZAFFER',
  'MAYER OTOMOTİV SANAYİ TİCARET LİMİTED ŞİRKETİ',
  'SAMPIYON FILTRE PAZARLAMA SAN.VE TIC. A.S',
  'ПЛА-ТАН І К ТОВ',
  'КРАФТ СП\tТОВ',
  'MEGAPARTS TEKNOLOJİ OTOMOTİV YEDEK PARÇA SAN. VE TİC. LTD. ŞTİ.',
  'BY AUTO PARTS DIS TİC. A.S',
  'BSS SUSPANSIYON DIS TICARET LIMITED SIRKETI',
  'NRSP OTOMOTIV NAK. TURZ. LTD. STI.',
  'TORK FREN YEDEK PARCA SANAYI VE TICARET LIMITED SIRKETI',
] as const

export const VPARIVANIE_WORKBOOK_GROUP = 'AL-KO'
export const VPARIVANIE_WORKBOOK_CUSTOMER = 'АФРАКО ТЗОВ'
export const VPARIVANIE_WORKBOOK_MANAGER = 'Крицький Олег Русланович'

export const SUPPLIER_WORKBOOK_FILTERS_NOTICE = `Застосовано відбори книги: організації ${SUPPLIER_WORKBOOK_ORGANIZATIONS.join(', ')} (ФОП Пархоменко не синхронізується в GBA), ${SUPPLIER_WORKBOOK_SUPPLIERS.length} постачальників зі збереженого налаштування 1С «OV» та група «Покупці» Fenix. Їх можна змінити у формі.`
export const VPARIVANIE_WORKBOOK_FILTERS_NOTICE = `Застосовано відбори книги: група товару ${VPARIVANIE_WORKBOOK_GROUP}, покупець ${VPARIVANIE_WORKBOOK_CUSTOMER}, основний менеджер покупця ${VPARIVANIE_WORKBOOK_MANAGER}. Їх можна змінити у формі.`

export type WorkbookLookup = (dataSource: number, field: number, value: string) => Promise<ReportEntity[]>

export type ResolvedWorkbookFilters = {
  fileName: string
  selections: ReportSelection[]
  unresolved: string[]
}

type Target = { field: number; condition: ReportFilterCondition; names: readonly string[]; listQuery?: string }

const EQUALS = REPORT_FILTER_CONDITIONS.find(condition => condition.Type === 0)!
const IN_LIST = REPORT_FILTER_CONDITIONS.find(condition => condition.Type === 2)!
const IN_GROUP: ReportFilterCondition = { Type: 6, Name: 'У групі' }
const LOOKUP_CONCURRENCY = 6

function targets(fileName: string): Target[] {
  if (fileName === SUPPLIER_WORKBOOK_FILE) return [
    { field: 0, condition: IN_LIST, names: SUPPLIER_WORKBOOK_ORGANIZATIONS, listQuery: '' },
    { field: 17, condition: IN_LIST, names: SUPPLIER_WORKBOOK_SUPPLIERS },
  ]
  if (fileName === VPARIVANIE_WORKBOOK_FILE) return [
    { field: 4, condition: IN_GROUP, names: [VPARIVANIE_WORKBOOK_GROUP] },
    { field: 5, condition: EQUALS, names: [VPARIVANIE_WORKBOOK_CUSTOMER] },
    { field: 60, condition: EQUALS, names: [VPARIVANIE_WORKBOOK_MANAGER] },
  ]
  return []
}

export function resolvesWorkbookFilters(fileName: string): boolean {
  return targets(fileName).length > 0
}

export function workbookCaption(value: string): string {
  return value.replace(/\s*\[(?:id=)?\d+\]\s*$/i, '').replace(/\s+/g, ' ').trim()
}

function searchText(name: string): string {
  return name.split('\t')[0].trim().slice(0, 120)
}

function exactMatch(entities: readonly ReportEntity[], name: string): ReportEntity | null {
  const wanted = workbookCaption(name)
  const matches = entities.filter(entity => typeof entity.Name === 'string' && workbookCaption(entity.Name) === wanted)
  return matches.length === 1 && matches[0].Id !== undefined && matches[0].Id !== null ? matches[0] : null
}

async function mapLimited<T, R>(items: readonly T[], limit: number, map: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await map(items[index])
    }
  }))
  return results
}

/** Resolves the printed workbook filters to current local identities by their stable 1C names. */
export async function resolveBug1274WorkbookFilters(fileName: string, dataset: ReportDataset,
  lookup: WorkbookLookup): Promise<ResolvedWorkbookFilters> {
  const fields = new Map(datasetFilters(dataset).map(option => [option.field.Type, option.field]))
  const selections: ReportSelection[] = []
  const unresolved: string[] = []
  for (const target of targets(fileName)) {
    const field = fields.get(target.field)
    if (!field) {
      unresolved.push(...target.names.map(workbookCaption))
      continue
    }
    const found = target.listQuery !== undefined
      ? await lookup(dataset.DataSource, target.field, target.listQuery)
        .then(entities => target.names.map(name => exactMatch(entities, name)), () => target.names.map(() => null))
      : await mapLimited(target.names, LOOKUP_CONCURRENCY, name => lookup(dataset.DataSource, target.field, searchText(name))
        .then(entities => exactMatch(entities, name), () => null))
    const values = found.flatMap(entity => entity ? [{ Data: entity, Name: String(entity.Name), Value: 0 }] : [])
    unresolved.push(...target.names.filter((_, index) => !found[index]).map(workbookCaption))
    if (values.length && (target.condition.Type === 2 || values.length === 1))
      selections.push({ IsChecked: true, SelectedField: { ...field }, FilterCondition: { ...target.condition }, Values: values })
  }
  return { fileName, selections, unresolved }
}

export function workbookFiltersNotice(resolved: ResolvedWorkbookFilters | undefined): string {
  if (!resolved || !resolved.unresolved.length) return ''
  return ` Не знайдено однозначно в GBA, тому не застосовано: ${resolved.unresolved.join('; ')}.`
}
