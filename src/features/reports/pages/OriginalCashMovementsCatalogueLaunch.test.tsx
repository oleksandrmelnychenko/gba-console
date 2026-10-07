import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getCashMovementsCapability } from '../api/originalCashMovementsApi'
import { cashMovementsCapability } from '../testing/originalCashMovementsFixtures'
import type { CashMovementsCapability } from '../data/originalCashMovements'
import type { ReportCatalogueEntry } from '../types'
import { OriginalCashMovementsCatalogueLaunch } from './OriginalCashMovementsCatalogueLaunch'
vi.mock('../api/originalCashMovementsApi', () => ({ getCashMovementsCapability: vi.fn() }))
vi.mock('./OriginalCashMovementsPanel', () => ({ OriginalCashMovementsPanel: () => <div>Own ecd83 default panel</div> }))
const entry: ReportCatalogueEntry = { Id: 'builtin:ДвиженияДенежныхСредств', Name: 'ДвиженияДенежныхСредств', Title: '', Kind: 'builtin',
  Sources: [{ World: 'fenix', SourceId: cashMovementsCapability.SourceId, DefinitionSha256: cashMovementsCapability.DefinitionSha256, Attributes: [] }] }
const launch = (report = entry, allowed = true, caller: string | null = 'caller1', worlds = ['fenix']) => <MantineProvider env="test"><I18nProvider>
  <OriginalCashMovementsCatalogueLaunch report={report} worlds={worlds} enabled={allowed} disabled={false} callerKey={caller} />
</I18nProvider></MantineProvider>
it('exact retained ecd83 catalogue entry opens its own complete default after own capability', async () => {
  vi.clearAllMocks(); vi.mocked(getCashMovementsCapability).mockResolvedValue(cashMovementsCapability); render(launch())
  await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · Рухи коштів' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Fenix · Рухи коштів' })); await screen.findByText('Own ecd83 default panel')
})
it('foreign world, definition and similarly named legacy original cannot borrow this launch', () => {
  vi.clearAllMocks(); const view = render(launch(entry, true, 'caller1', ['amg'])); expect(getCashMovementsCapability).not.toHaveBeenCalled()
  view.rerender(launch({ ...entry, Id: 'builtin:ДвижениеДенежныхСредств' })); expect(getCashMovementsCapability).not.toHaveBeenCalled()
  view.rerender(launch({ ...entry, Sources: [{ ...entry.Sources[0], DefinitionSha256: 'f'.repeat(64) }] })); expect(getCashMovementsCapability).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Fenix · Рухи коштів' })).toBeNull()
})
it('permission denial and missing caller perform no capability I/O and keep the button closed', () => {
  vi.clearAllMocks(); const view = render(launch(entry, false)); expect(getCashMovementsCapability).not.toHaveBeenCalled()
  view.rerender(launch(entry, true, null)); expect(getCashMovementsCapability).not.toHaveBeenCalled()
  expect((screen.getByRole('button', { name: 'Fenix · Рухи коштів' }) as HTMLButtonElement).disabled).toBe(true)
})
it('caller change cancels capability loading and cannot enable a stale capability', async () => {
  vi.clearAllMocks(); let complete!: (value: CashMovementsCapability) => void
  vi.mocked(getCashMovementsCapability).mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const view = render(launch()); await waitFor(() => expect(getCashMovementsCapability).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(getCashMovementsCapability).mock.calls[0][0]; view.rerender(launch(entry, true, null)); expect(signal?.aborted).toBe(true)
  await act(async () => { complete(cashMovementsCapability) }); expect((screen.getByRole('button', { name: 'Fenix · Рухи коштів' }) as HTMLButtonElement).disabled).toBe(true)
})
