import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getMoneyFlowCapability } from '../api/originalMoneyFlowAnalysisApi'
import { moneyFlowCapability } from '../testing/originalMoneyFlowAnalysisFixtures'
import type { MoneyFlowCapability } from '../data/originalMoneyFlowAnalysis'
import type { ReportCatalogueEntry } from '../types'
import { OriginalMoneyFlowAnalysisCatalogueLaunch } from './OriginalMoneyFlowAnalysisCatalogueLaunch'
vi.mock('../api/originalMoneyFlowAnalysisApi', () => ({ getMoneyFlowCapability: vi.fn() }))
vi.mock('./OriginalMoneyFlowAnalysisPanel', () => ({ OriginalMoneyFlowAnalysisPanel: () => <div>Own 9e7d default panel</div> }))
const entry: ReportCatalogueEntry = { Id: 'builtin:АнализДвиженияДенежныхСредств', Name: 'АнализДвиженияДенежныхСредств', Title: '', Kind: 'builtin',
  Sources: [{ World: 'fenix', SourceId: moneyFlowCapability.SourceId, DefinitionSha256: moneyFlowCapability.DefinitionSha256, Attributes: [] }] }
const launch = (report = entry, allowed = true, caller: string | null = 'caller1', worlds = ['fenix']) => <MantineProvider env="test"><I18nProvider>
  <OriginalMoneyFlowAnalysisCatalogueLaunch report={report} worlds={worlds} enabled={allowed} disabled={false} callerKey={caller} />
</I18nProvider></MantineProvider>
it('exact own default launches only after its Source/definition-bound capability', async () => {
  vi.clearAllMocks(); vi.mocked(getMoneyFlowCapability).mockResolvedValue(moneyFlowCapability); render(launch())
  await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · Аналіз руху коштів' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Fenix · Аналіз руху коштів' })); await screen.findByText('Own 9e7d default panel')
})
it('AMG alias, ecd83 pivot and changed definition cannot borrow this launch', () => {
  vi.clearAllMocks(); const view = render(launch(entry, true, 'caller1', ['amg'])); expect(getMoneyFlowCapability).not.toHaveBeenCalled()
  view.rerender(launch({ ...entry, Id: 'builtin:ДвиженияДенежныхСредств' })); expect(getMoneyFlowCapability).not.toHaveBeenCalled()
  view.rerender(launch({ ...entry, Sources: [{ ...entry.Sources[0], DefinitionSha256: 'f'.repeat(64) }] })); expect(getMoneyFlowCapability).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Fenix · Аналіз руху коштів' })).toBeNull()
})
it('permission denial and absent caller cause no capability request', () => {
  vi.clearAllMocks(); const view = render(launch(entry, false)); expect(getMoneyFlowCapability).not.toHaveBeenCalled()
  view.rerender(launch(entry, true, null)); expect(getMoneyFlowCapability).not.toHaveBeenCalled()
})
it('aborts capability work on caller replacement and rejects late original capability', async () => {
  vi.clearAllMocks(); let finish!: (value: MoneyFlowCapability) => void
  vi.mocked(getMoneyFlowCapability).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const view = render(launch()); await waitFor(() => expect(getMoneyFlowCapability).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(getMoneyFlowCapability).mock.calls[0][0]; view.rerender(launch(entry, true, null)); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(moneyFlowCapability) }); expect((screen.getByRole('button', { name: 'Fenix · Аналіз руху коштів' }) as HTMLButtonElement).disabled).toBe(true)
})
