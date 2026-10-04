import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readDebt } from '../api/originalCounterpartyDebtApi'
import { debtCapability, debtResponse, emptyDebt, org1, party1 } from '../testing/counterpartyDebtFixtures'
import { debtRequest, normalizeDebt, type DebtResult } from '../data/originalCounterpartyDebt'
import { OriginalCounterpartyDebtPanel } from './OriginalCounterpartyDebtPanel'
vi.mock('../api/originalCounterpartyDebtApi', () => ({ readDebt: vi.fn() }))
const panel = (caller = 'caller1', allowed = true) => <MantineProvider env="test"><I18nProvider><OriginalCounterpartyDebtPanel
  capability={debtCapability} callerKey={caller} canGenerate={allowed} initialAsOf="2026-09-15T10:20:30" /></I18nProvider></MantineProvider>
it('screen preserves organization before counterparty, unknown rows and default one resource', async () => {
  vi.clearAllMocks(); vi.mocked(readDebt).mockResolvedValue(debtResponse()); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findAllByText('Підсумок організації')
  expect(screen.getAllByRole('columnheader').map(e => e.textContent)).toContain('Управлінська сума')
  expect(screen.queryByRole('columnheader', { name: 'Записана сума взаєморозрахунків' })).toBeNull()
  expect(screen.getByText('Назва контрагента недоступна')).not.toBeNull()
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(false)
})
it('actual active organization and party controls remain clearable after a genuinely admitted complete empty response', async () => {
  vi.clearAllMocks(); vi.mocked(readDebt).mockImplementation(async request => normalizeDebt({ ...debtResponse(), AsOf: request.AsOf, DebtSwitch: request.DebtSwitch, IncludeSettlement: request.IncludeSettlement, Organizations: [...request.Organizations], Counterparties: [...request.Counterparties] }, request))
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Організації' }) as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('combobox', { name: 'Організації' })); fireEvent.click(await screen.findByRole('option', { name: 'Наша організація' }))
  fireEvent.click(screen.getByRole('combobox', { name: 'Контрагенти' })); fireEvent.click(await screen.findByRole('option', { name: 'Наш контрагент' }))
  vi.mocked(readDebt).mockImplementation(async request => normalizeDebt({ ...emptyDebt(), AsOf: request.AsOf, DebtSwitch: request.DebtSwitch, IncludeSettlement: request.IncludeSettlement, Organizations: [...request.Organizations], Counterparties: [...request.Counterparties] }, request))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('У повністю перевіреному зрізі рядків немає.')
  for (const label of ['Організації', 'Контрагенти']) expect((screen.getByRole('combobox', { name: label }) as HTMLInputElement).disabled).toBe(false)
  expect(vi.mocked(readDebt).mock.calls[1][0]).toMatchObject({ Organizations: [org1], Counterparties: [party1] })
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Організації' }), { key: 'Backspace' })
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Контрагенти' }), { key: 'Backspace' })
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readDebt).toHaveBeenCalledTimes(3))
  expect(vi.mocked(readDebt).mock.calls[2][0]).toMatchObject({ Organizations: [], Counterparties: [] })
  expect(screen.queryByText(org1)).toBeNull(); expect(screen.queryByText(party1)).toBeNull()
})
it('optional raw resource and explicit sign selector invalidate an old result before next request', async () => {
  vi.clearAllMocks(); vi.mocked(readDebt).mockImplementation(async request => normalizeDebt({ ...debtResponse(request.IncludeSettlement), DebtSwitch: request.DebtSwitch }, request))
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findAllByText('Підсумок організації')
  fireEvent.click(screen.getByRole('checkbox', { name: 'Додаткова сума взаєморозрахунків' }))
  expect(screen.queryByText('Підсумок організації')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByRole('columnheader', { name: 'Записана сума взаєморозрахунків' })
  expect(vi.mocked(readDebt).mock.calls[1][0].IncludeSettlement).toBe(true)
})
it('incomplete normal prefix gives exact month dependency and disables every export', async () => {
  vi.clearAllMocks(); const r = { ...emptyDebt(), Available: false, NormalInputsComplete: false, Code: 'original_counterparty_debt_month_publication_unavailable', Totals: null,
    InputWitnessSha256: null, ResultSha256: null, Dependency: { OpeningRegister: 0 as const, MovementBranch: 0 as const, RequestedEndpoint: debtResponse().AsOf, MissingMonth: '2026-09' } }
  vi.mocked(readDebt).mockResolvedValue(normalizeDebt(r, debtRequest(debtCapability, r.AsOf))); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText(/Не всі місячні рухи взаєморозрахунків/)
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(true)
})
it('caller replacement aborts original request and rejects late rows and choices', async () => {
  vi.clearAllMocks(); let complete!: (r: DebtResult) => void; vi.mocked(readDebt).mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readDebt).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readDebt).mock.calls[0][1]; view.rerender(panel('caller2')); expect(signal?.aborted).toBe(true)
  await act(async () => { complete(debtResponse()) }); expect(screen.queryByText('Підсумок організації')).toBeNull()
  expect((screen.getByRole('combobox', { name: 'Організації' }) as HTMLInputElement).disabled).toBe(true)
})
it('permission loss clears rows and forbids API or exports', async () => {
  vi.clearAllMocks(); vi.mocked(readDebt).mockResolvedValue(debtResponse()); const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findAllByText('Підсумок організації')
  view.rerender(panel('caller1', false)); expect(screen.queryByText('Підсумок організації')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readDebt).toHaveBeenCalledTimes(1)
})
