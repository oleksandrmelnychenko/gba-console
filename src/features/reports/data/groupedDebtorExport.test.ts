import { expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import pdfMake from 'pdfmake/build/pdfmake'
import vfs from 'pdfmake/build/vfs_fonts'
import { GROUPED_DEBTOR_ROOT, type GroupedDebtorStatement } from './groupedDebtor'
import { GROUPED_DEBTOR_DRAFT_LABEL, groupedDebtorExportFileName, groupedDebtorExportLines,
  groupedDebtorPdfDefinition, groupedDebtorXlsxRows } from './groupedDebtorExport'

const uid = '00000000-0000-0000-0000-000000000001'
const statement: GroupedDebtorStatement = {
  From: '2025-09-01', To: '2025-09-02', BuyerRootSourceId: GROUPED_DEBTOR_ROOT,
  CurrencyBasis: 'SettlementCurrency', Rows: [
    { OrganizationId: '9007199254740993', OrganizationNetUid: uid, OrganizationName: 'Організація А',
      CounterpartyId: '20', CounterpartyNetUid: uid, CounterpartyName: 'Покупець',
      CurrencyId: '40', CurrencyNetUid: uid, CurrencyCode: '980',
      Opening: '1234567890123456789012345.67', Incoming: '0.00', Outgoing: '5.50',
      Closing: '1234567890123456789012340.17', Agreements: [] },
    { OrganizationId: '9007199254740993', OrganizationNetUid: uid, OrganizationName: 'Організація А',
      CounterpartyId: '21', CounterpartyNetUid: uid, CounterpartyName: 'Інший покупець',
      CurrencyId: '41', CurrencyNetUid: uid, CurrencyCode: '978',
      Opening: '-10.00', Incoming: '3.25', Outgoing: '0.00', Closing: '-6.75', Agreements: [] },
    { OrganizationId: '11', OrganizationNetUid: uid, OrganizationName: 'Організація Б',
      CounterpartyId: '22', CounterpartyNetUid: uid, CounterpartyName: 'Покупець',
      CurrencyId: '40', CurrencyNetUid: uid, CurrencyCode: '980',
      Opening: '0.00', Incoming: '0.00', Outgoing: '0.00', Closing: '0.00', Agreements: [] },
  ],
}

it('exports the complete typed rows grouped by organization, with exact decimal text and no cross-currency total', () => {
  const lines = groupedDebtorExportLines(statement)
  expect(lines.map(line => line.kind)).toEqual([
    'organization', 'counterparty', 'counterparty', 'organization', 'counterparty',
  ])
  expect(lines[1].cells).toEqual(['Покупець', '980', '1234567890123456789012345.67', '0.00', '5.50',
    '1234567890123456789012340.17'])
  expect(lines[2].cells).toEqual(['Інший покупець', '978', '-10.00', '3.25', '0.00', '-6.75'])
  expect(groupedDebtorExportFileName(statement, 'xlsx')).toBe('debtor41-current-data-draft_2025-09-01_2025-09-02.xlsx')

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(groupedDebtorXlsxRows(statement)), 'Дебіторка')
  const binary = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const decoded = XLSX.read(binary, { type: 'array' }).Sheets['Дебіторка']
  expect(decoded.A2.v).toBe(GROUPED_DEBTOR_DRAFT_LABEL)
  expect(decoded.C9).toMatchObject({ t: 's', v: '1234567890123456789012345.67' })
  expect(decoded.C10).toMatchObject({ t: 's', v: '-10.00' })
  expect(decoded.C12).toMatchObject({ t: 's', v: '0.00' })
  expect(XLSX.utils.sheet_to_json(decoded, { header: 1 }).length).toBe(12)
})

it('generates a real Unicode PDF with the same group and currency rows and a visible draft label', async () => {
  const definition = groupedDebtorPdfDefinition(statement)
  expect(definition.pageOrientation).toBe('landscape')
  const content = definition.content as Array<{ text?: string; table?: { body: Array<Array<{ text?: string }>> } }>
  expect(content[1].text).toBe(GROUPED_DEBTOR_DRAFT_LABEL)
  const body = content[5].table?.body
  expect(body?.map(row => row[0].text)).toEqual([
    'Організація / контрагент', 'Організація А', 'Покупець', 'Інший покупець', 'Організація Б', 'Покупець',
  ])
  expect(body?.[2].map(cell => cell.text)).toEqual([
    'Покупець', '980', '1 234 567 890 123 456 789 012 345,67', '0,00', '5,50',
    '1 234 567 890 123 456 789 012 340,17',
  ])
  expect(body?.[3].map(cell => cell.text)).toEqual(['Інший покупець', '978', '−10,00', '3,25', '0,00', '−6,75'])
  const bytes = await new Promise<Uint8Array>(resolve => pdfMake.createPdf(definition, undefined, undefined, vfs)
    .getBuffer(resolve))
  expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe('%PDF-')
  expect(bytes.length).toBeGreaterThan(5000)
})

it('keeps empty certified statements exportable without invented totals', () => {
  const empty = { ...statement, Rows: [] }
  expect(groupedDebtorXlsxRows(empty)).toHaveLength(7)
  const content = groupedDebtorPdfDefinition(empty).content as Array<{ text?: string; table?: { body: unknown[] } }>
  expect(content[5].table?.body).toHaveLength(1)
  expect(content[6].text).toBe('За повністю покритим періодом рядків немає.')
})
