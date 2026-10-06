import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getOriginalStockAvailabilityCapability } from '../api/originalStockAvailabilityApi'
import { stockCapabilityFixture } from '../data/originalStockAvailability.fixtures'
import { stockDefinition, type StockCapability } from '../data/originalStockAvailability'
import type { ReportCatalogueEntry } from '../types'
import { OriginalStockAvailabilityCatalogueLaunch } from './OriginalStockAvailabilityCatalogueLaunch'
vi.mock('../api/originalStockAvailabilityApi', () => ({ getOriginalStockAvailabilityCapability: vi.fn() }))
vi.mock('./OriginalStockAvailabilityPanel', () => ({ OriginalStockAvailabilityPanel: () => <div>Форма доступності товарів</div> }))
const report: ReportCatalogueEntry = { Id: `builtin:${stockDefinition.name}`, Name: stockDefinition.name, Title: '', Kind: 'builtin', Sources: [{ World: 'fenix', SourceId: stockDefinition.source, DefinitionSha256: stockDefinition.definition, Attributes: [] }] }
const launch = (enabled = true, caller: string | null = 'callerA', entry = report, worlds = ['fenix']) => <MantineProvider env="test"><I18nProvider><OriginalStockAvailabilityCatalogueLaunch report={entry} worlds={worlds} enabled={enabled} disabled={false} callerKey={caller} /></I18nProvider></MantineProvider>
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear() })
it('original14 opens the existing shared shell after exact capability despite unproven optional sync flags', async () => {
  vi.mocked(getOriginalStockAvailabilityCapability).mockResolvedValue(stockCapabilityFixture()); render(launch())
  await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · доступність товарів на складах' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Fenix · доступність товарів на складах' })); await screen.findByText('Форма доступності товарів')
})
it('no caller permission foreign identity or AMG cannot borrow availability action', () => {
  const view = render(launch(false)); expect(getOriginalStockAvailabilityCapability).not.toHaveBeenCalled(); view.rerender(launch(true, null)); expect(getOriginalStockAvailabilityCapability).not.toHaveBeenCalled()
  view.rerender(launch(true, 'callerA', { ...report, Id: 'builtin:ТоварыНаСкладах' })); expect(screen.queryByRole('button', { name: 'Fenix · доступність товарів на складах' })).toBeNull()
  view.rerender(launch(true, 'callerA', report, ['amg'])); expect(getOriginalStockAvailabilityCapability).not.toHaveBeenCalled()
})
it('caller change aborts original pending capability and late response cannot restore old form', async () => {
  let finish!: (value: StockCapability) => void
  vi.mocked(getOriginalStockAvailabilityCapability).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValueOnce({ ...stockCapabilityFixture(), Executable: false })
  const view = render(launch()); await waitFor(() => expect(getOriginalStockAvailabilityCapability).toHaveBeenCalledTimes(1)); const signal = vi.mocked(getOriginalStockAvailabilityCapability).mock.calls[0][0]
  view.rerender(launch(true, 'callerB')); expect(signal?.aborted).toBe(true); await act(async () => finish(stockCapabilityFixture()))
  expect((screen.getByRole('button', { name: 'Fenix · доступність товарів на складах' }) as HTMLButtonElement).disabled).toBe(true)
})
