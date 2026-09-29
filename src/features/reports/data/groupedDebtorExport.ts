import { formatGroupedDebtorMoney, GROUPED_DEBTOR_ROOT,
  type GroupedDebtorStatement } from './groupedDebtor'

export const GROUPED_DEBTOR_DRAFT_LABEL = 'Чернетка на поточних даних · не підтверджена форма 1С'

const headers = ['Організація / контрагент', 'Валюта', 'Початок', 'Надходження', 'Витрати', 'Кінець']
type PdfCell = { text?: string; bold?: boolean; fillColor?: string; colSpan?: number; alignment?: 'left' | 'right' }

export type GroupedDebtorExportLine = {
  kind: 'organization' | 'counterparty'
  cells: string[]
}

export function groupedDebtorExportLines(statement: GroupedDebtorStatement): GroupedDebtorExportLine[] {
  const lines: GroupedDebtorExportLine[] = []
  let previousOrganization = ''
  for (const row of statement.Rows) {
    const organization = `${row.OrganizationId}:${row.OrganizationNetUid}`
    if (organization !== previousOrganization) {
      lines.push({ kind: 'organization', cells: [row.OrganizationName, '', '', '', '', ''] })
      previousOrganization = organization
    }
    // Keep decimal money as strings: Excel numbers lose precision beyond 15 significant digits.
    lines.push({ kind: 'counterparty', cells: [row.CounterpartyName, row.CurrencyCode,
      row.Opening, row.Incoming, row.Outgoing, row.Closing] })
  }
  return lines
}

export function groupedDebtorXlsxRows(statement: GroupedDebtorStatement): string[][] {
  return [
    ['Дебіторка · усі покупці'],
    [GROUPED_DEBTOR_DRAFT_LABEL],
    [`Період: ${statement.From} — ${statement.To}`],
    [`Група «Покупці»: ${GROUPED_DEBTOR_ROOT}`],
    ['Валюта взаєморозрахунків; суми різних валют не підсумовуються. Суми збережено як точний десятковий текст.'],
    [],
    headers,
    ...groupedDebtorExportLines(statement).map(line => line.cells),
  ]
}

export function groupedDebtorPdfDefinition(statement: GroupedDebtorStatement) {
  const body: PdfCell[][] = [headers.map(text => ({ text, bold: true, fillColor: '#edf1f5' }))]
  for (const line of groupedDebtorExportLines(statement)) {
    if (line.kind === 'organization') {
      body.push([{ text: line.cells[0], bold: true, fillColor: '#f6f7f9', colSpan: 6 }, {}, {}, {}, {}, {}])
    } else {
      body.push(line.cells.map((text, index): PdfCell => ({
        text: index >= 2 ? formatGroupedDebtorMoney(text) : text,
        alignment: index >= 2 ? 'right' : 'left',
      })))
    }
  }
  return {
    pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 32],
    info: { title: `Дебіторка · ${GROUPED_DEBTOR_DRAFT_LABEL}` },
    content: [
      { text: 'Дебіторка · усі покупці', bold: true, fontSize: 14, margin: [0, 0, 0, 5] },
      { text: GROUPED_DEBTOR_DRAFT_LABEL, color: '#9a4d00', bold: true, margin: [0, 0, 0, 5] },
      { text: `Період: ${statement.From} — ${statement.To}`, margin: [0, 0, 0, 2] },
      { text: `Група «Покупці»: ${GROUPED_DEBTOR_ROOT}`, margin: [0, 0, 0, 2] },
      { text: 'Валюта взаєморозрахунків; суми різних валют не підсумовуються.', margin: [0, 0, 0, 10] },
      { table: { headerRows: 1, widths: [145, 42, '*', '*', '*', '*'], body },
        layout: 'lightHorizontalLines', fontSize: 8 },
      ...(statement.Rows.length === 0 ? [{ text: 'За повністю покритим періодом рядків немає.' }] : []),
    ],
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    footer: (currentPage: number, pageCount: number) => ({ text: `${GROUPED_DEBTOR_DRAFT_LABEL} · ${currentPage}/${pageCount}`,
      alignment: 'right', margin: [24, 0, 24, 0], fontSize: 7 }),
  }
}

export function groupedDebtorExportFileName(statement: GroupedDebtorStatement, extension: 'xlsx' | 'pdf'): string {
  return `debtor41-current-data-draft_${statement.From}_${statement.To}.${extension}`
}
