import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { unconfirmedBatch } from '../../../shared/ui/product-movement-history/physicalQuantityExceptions.test-fixtures'
import { movementPreview } from '../data/currentVparivanieMovements.test-fixtures'
import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { currentVparivaniePreview } from '../data/currentVparivanie.test-fixtures'
import { analysisPreview } from '../data/currentVparivanieAnalysis.test-fixtures'
import { CURRENT_VPARIVANIE_PRODUCT_CAPTIONS } from '../data/currentVparivanie'
import { ReportInlinePreview } from './ReportInlinePreview'

it('shows the actual seven flat attributes and separate customer identities with one resource', () => {
  const preview = normalizeNativeReportPreview({ Preview: currentVparivaniePreview() })
  const view = render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
  for (const name of CURRENT_VPARIVANIE_PRODUCT_CAPTIONS) expect(screen.getByRole('columnheader', { name })).toBeTruthy()
  expect(screen.getAllByRole('columnheader', { name: 'Контрагенты' })).toHaveLength(2)
  expect(screen.getAllByRole('columnheader', { name: 'Одна назва / Результат' })).toHaveLength(2)
  expect(screen.getAllByRole('columnheader', { name: 'Результат' })).toHaveLength(2)
  const row = screen.getByRole('rowheader', { name: '0000123' }).closest('tr')!
  expect(within(row).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['', '-2', '—', '3,00000001'])
  expect(within(row).getAllByRole('rowheader')).toHaveLength(7)
  expect(view.container.querySelectorAll('script')).toHaveLength(0)
  expect(screen.getByText('<script>name</script>')).toBeTruthy()
  expect(screen.queryByText('Залишки на кінець періоду та період продажів')).toBeNull()
  expect(screen.queryByText(/на дату раніше 01\.01\.2025 вони порожні/)).toBeNull()
  expect(screen.queryByText(/Вибраний період стосується продажів/)).toBeNull()
  expect(screen.queryByText('Період розрахунку: 01.09.2026 — 27.09.2026')).toBeNull()
  expect(view.container.textContent).not.toContain('a'.repeat(64))
})

it('shows an unknown customer only in the customer arm, never in stock or sales headers', () => {
  const source = currentVparivaniePreview()
  source.Columns[3].Values[1].Identity.Kind = 'null'
  source.Columns[3].Values[1].Identity.Value = null
  source.Columns[3].Values[1].Caption = 'Не вказано'
  const preview = normalizeNativeReportPreview({ Preview: source })
  render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
  expect(screen.getAllByRole('columnheader', { name: 'Результат' })).toHaveLength(2)
  expect(screen.getByRole('columnheader', { name: 'Не вказано / Результат' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Одна назва / Результат' })).toBeTruthy()
})

it('shows physical movement columns with explicit incomplete history rather than reassuring zeros', () => {
  const source = movementPreview()
  source.CurrentVparivanieMovements.ProductCoverage[0].Reasons.push('MultipleSourceWorldsWithoutPhysicalOwnership')
  const preview = normalizeNativeReportPreview({ Preview: source })
  render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
  expect(screen.getByRole('columnheader', { name: 'Прихід' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Розхід' })).toBeTruthy()
  expect(screen.queryByText(/Неповне підтвердження руху/)).toBeNull()
  expect(screen.queryByText(/щоб не подвоїти рух/)).toBeNull()
  const row = screen.getByRole('rowheader', { name: '0000123' }).closest('tr')!
  expect(within(row).getAllByRole('cell').slice(-2).map(cell => cell.textContent)).toEqual(['—', '—'])
})

it.each([true, false])('shows known incoming=%s separately from the unconfirmed opposite direction', incomingKnown => {
  const source = movementPreview()
  Object.assign(source.CurrentVparivanieMovements.ProductCoverage[0], {
    IncomingComplete: incomingKnown, OutgoingComplete: !incomingKnown, Reasons: ['UnconfirmedBatch'],
  })
  source.Cells[incomingKnown ? 4 : 5].Value = { Kind: 'decimal', Value: '12.5', Provenance: 'producerCell' }
  const preview = normalizeNativeReportPreview({ Preview: { ...source,
    PhysicalQuantityExceptions: [{ ...unconfirmedBatch, ProductId: 123, Direction: incomingKnown ? 'Outgoing' : 'Incoming' }],
  } })
  render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
  const row = screen.getByRole('rowheader', { name: '0000123' }).closest('tr')!
  expect(within(row).getAllByRole('cell').slice(-2).map(cell => cell.textContent)).toEqual(incomingKnown ? ['12,5', '—'] : ['—', '12,5'])
  expect(screen.getByText('Партію не підтверджено: 1 рядок')).toBeTruthy()
  expect(document.body.textContent).not.toContain('ВО-00041')
  expect(screen.queryByText(/Неповне підтвердження руху/)).toBeNull()
})

it('prints grouped analysis quantities without padded decimals', () => {
  const source = analysisPreview()
  source.Cells[0].Value.Value = '56.00000000'
  const semantics = { kind: 'quantity', currencyPolicy: 'notApplicable', unitPolicy: 'sourceStorageUnit', aggregation: 'sumWithinCompatibleUnit',
    scalable: false, defaultDecimalPlaces: 8, defaultMinimumDecimalPlaces: 0 }
  const preview = normalizeNativeReportPreview({ Preview: { ...source, valueSemantics: [{ columnSourceIndex: 0, measureType: 83, semantics }] } })
  const view = render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
  expect([...view.container.querySelectorAll('tbody td')].map(cell => cell.textContent)).toEqual(['56'])
  source.Cells[0].Value.Value = '3.00000001'
  view.rerender(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: { ...source,
    valueSemantics: [{ columnSourceIndex: 0, measureType: 83, semantics }] } })} /></I18nProvider></MantineProvider>)
  expect([...view.container.querySelectorAll('tbody td')].map(cell => cell.textContent)).toEqual(['3,00000001'])
})

it('names a product without its internal key and qualifies only names the row path cannot tell apart', () => {
  const key = (Value: string) => ({ Kind: 'text', Value, Provenance: 'rowAxisKey' })
  const rows = (articles: readonly string[]) => articles.map((article, index) => ({ Ordinal: index, SourceIndex: index, Values: [
    { Caption: article, Identity: key(`text:${article}`) }, { Caption: 'Амортизатор подвески', Identity: key(`product:${38700635 + index}`) }] }))
  const show = (articles: readonly string[]) => {
    const source = analysisPreview()
    const preview = normalizeNativeReportPreview({ Preview: { ...source, Request: { ...source.Request, RowGroupings: ['Артикул', 'Товар'] },
      RowSchema: [{ Identity: 'Article', Caption: 'Артикул' }, { Identity: 'Product', Caption: 'Товар' }], Rows: rows(articles),
      Page: { ...source.Page, TotalVisibleRows: 2, ReturnedRows: 2 } } })
    const view = render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
    const text = [...view.container.querySelectorAll('tbody th')].map(cell => cell.textContent)
    view.unmount()
    return text
  }
  expect(show(['900013-AL', '900104-AL'])).toEqual(['900013-AL', 'Амортизатор подвески', '900104-AL', 'Амортизатор подвески'])
  expect(show(['900013-AL', '900013-AL']).filter(text => text?.startsWith('Амортизатор')))
    .toEqual(['Амортизатор подвески [38700635]', 'Амортизатор подвески [38700636]'])
})

it('leaves the not-applicable buyer level out of the stock column header', () => {
  const source = analysisPreview()
  source.ColumnSchema = [{ Identity: 'CurrentVparivanieGroup', Caption: 'Показник' }, { Identity: 'CurrentVparivanieCounterparty', Caption: 'Покупець (деталізація)' },
    { Identity: '$measureGroup', Caption: 'Показник' }, { Identity: '$measure', Caption: 'Показник' }]
  source.Columns = [{ Ordinal: 0, SourceIndex: 0, Values: [{ Caption: 'Залишки', Identity: { Kind: 'signedInteger', Value: '1', Provenance: 'columnAxisKey' } },
    { Caption: 'Не застосовується', Identity: { Kind: 'text', Value: 'analysis:na', Provenance: 'columnAxisKey' } }, { Caption: 'Результат' }, { Caption: 'Результат' }] }]
  const view = render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: source })} /></I18nProvider></MantineProvider>)
  const headers = [...view.container.querySelectorAll('thead th')].map(cell => `${cell.textContent} ${cell.getAttribute('aria-label') ?? ''}`)
  expect(headers.join('|')).not.toContain('Не застосовується')
  expect(headers.some(header => header.includes('Залишки'))).toBe(true)
})
