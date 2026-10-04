import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readStatement } from '../api/originalCounterpartyStatementApi'
import { emptyStatement, missingStatement, statementAgreement, statementCapability, statementOrg, statementParty, statementResponse } from '../testing/counterpartyStatementFixtures'
import { normalizeStatement, statementRequest, type StatementResult } from '../data/originalCounterpartyStatement'
import { OriginalCounterpartyStatementPanel } from './OriginalCounterpartyStatementPanel'
vi.mock('../api/originalCounterpartyStatementApi', () => ({ readStatement: vi.fn() }))
const panel = (caller = 'caller1', allowed = true) => <MantineProvider env="test"><I18nProvider><OriginalCounterpartyStatementPanel
  capability={statementCapability} callerKey={caller} canGenerate={allowed} initialFrom="2026-09-10" initialThrough="2026-09-12" /></I18nProvider></MantineProvider>
it('screen keeps organization party agreement hierarchy and every signed default8 resource cell', async () => {
  vi.clearAllMocks(); vi.mocked(readStatement).mockResolvedValue(statementResponse()); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findAllByText('Підсумок контрагента'); expect(screen.getByText('Наш договір')).not.toBeNull()
  expect(screen.getAllByRole('columnheader').filter(e => e.closest('thead'))).toHaveLength(11)
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(false)
})
it('actual three selected typed controls retain human captions and can all clear after an admitted complete empty response', async () => {
  vi.clearAllMocks(); vi.mocked(readStatement).mockImplementation(async request => normalizeStatement({ ...statementResponse(), ...request }, request))
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Договори' }) as HTMLInputElement).disabled).toBe(false))
  for (const [field, name] of [['Організації', 'Наша організація'], ['Контрагенти', 'Наш контрагент'], ['Договори', 'Наш договір']]) {
    fireEvent.click(screen.getByRole('combobox', { name: field })); fireEvent.click(await screen.findByRole('option', { name }))
  }
  vi.mocked(readStatement).mockImplementation(async request => normalizeStatement({ ...emptyStatement(), ...request }, request))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('У повністю перевіреному зрізі рядків немає.')
  expect(vi.mocked(readStatement).mock.calls[1][0]).toMatchObject({ Organizations: [statementOrg], Counterparties: [statementParty], Agreements: [statementAgreement] })
  for (const field of ['Організації', 'Контрагенти', 'Договори']) {
    expect((screen.getByRole('combobox', { name: field }) as HTMLInputElement).disabled).toBe(false)
    fireEvent.keyDown(screen.getByRole('combobox', { name: field }), { key: 'Backspace' })
  }
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readStatement).toHaveBeenCalledTimes(3))
  expect(vi.mocked(readStatement).mock.calls[2][0]).toMatchObject({ Organizations: [], Counterparties: [], Agreements: [] })
  expect(screen.queryByText(statementAgreement)).toBeNull()
})
it('incomplete document month refuses every export and shows the exact missing normal dependency', async () => {
  vi.clearAllMocks(); const r = missingStatement(); vi.mocked(readStatement).mockResolvedValue(normalizeStatement(r, statementRequest(statementCapability, r.From, r.Through)))
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText(/Повний початковий залишок і всі місячні рухи/)
  expect(screen.getByText(/2026-09/)).not.toBeNull()
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(true)
})
it('explicit period edit invalidates old resources before a new request and clears out-of-scope choices', async () => {
  vi.clearAllMocks(); vi.mocked(readStatement).mockResolvedValue(statementResponse()); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findAllByText('Підсумок організації'); fireEvent.change(screen.getByLabelText('Кінець періоду (включно)'), { target: { value: '2026-09-11' } })
  expect(screen.queryByText('Підсумок організації')).toBeNull(); expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('combobox', { name: 'Договори' }) as HTMLInputElement).disabled).toBe(true)
})
it('caller replacement aborts the exact original request and ignores late resource rows and chooser data', async () => {
  vi.clearAllMocks(); let complete!: (result: StatementResult) => void; vi.mocked(readStatement).mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readStatement).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readStatement).mock.calls[0][1]; view.rerender(panel('caller2')); expect(signal?.aborted).toBe(true)
  await act(async () => { complete(statementResponse()) }); expect(screen.queryByText('Підсумок організації')).toBeNull()
  expect((screen.getByRole('combobox', { name: 'Договори' }) as HTMLInputElement).disabled).toBe(true)
})
it('permission loss removes the completed result and prevents generation or export', async () => {
  vi.clearAllMocks(); vi.mocked(readStatement).mockResolvedValue(statementResponse()); const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findAllByText('Підсумок організації'); view.rerender(panel('caller1', false)); expect(screen.queryByText('Підсумок організації')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readStatement).toHaveBeenCalledTimes(1)
})
