import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getOriginalCashAvailabilityCapability } from '../api/originalCashAvailabilityApi'
import { availabilityCapabilityFixture } from '../data/originalCashAvailability.fixtures'
import { availabilityDefinition, type AvailabilityCapability } from '../data/originalCashAvailability'
import type { ReportCatalogueEntry } from '../types'
import { OriginalCashAvailabilityCatalogueLaunch } from './OriginalCashAvailabilityCatalogueLaunch'
vi.mock('../api/originalCashAvailabilityApi', () => ({ getOriginalCashAvailabilityCapability: vi.fn() }))
vi.mock('./OriginalCashAvailabilityPanel', () => ({ OriginalCashAvailabilityPanel: () => <div>Форма доступних коштів</div> }))
const entry: ReportCatalogueEntry = { Id: `builtin:${availabilityDefinition.name}`, Name: availabilityDefinition.name, Title: '', Kind: 'builtin', Sources: [{ World: 'fenix', SourceId: availabilityDefinition.source, DefinitionSha256: availabilityDefinition.definition, Attributes: [] }] }
const launch = (enabled = true, caller: string | null = 'caller1', report = entry, worlds = ['fenix']) => <MantineProvider env="test"><I18nProvider><OriginalCashAvailabilityCatalogueLaunch report={report} worlds={worlds} enabled={enabled} disabled={false} callerKey={caller} /></I18nProvider></MantineProvider>
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear() })
it('exact original0742 opens existing modal shell only after own capability', async () => {
  vi.mocked(getOriginalCashAvailabilityCapability).mockResolvedValue(availabilityCapabilityFixture()); render(launch())
  await waitFor(() => expect((screen.getByRole('button', { name: 'Fenix · доступні кошти' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Fenix · доступні кошти' })); await screen.findByText('Форма доступних коштів')
})
it('no caller permission foreign definition or AMG cannot borrow capability or action', () => {
  const view = render(launch(false)); expect(getOriginalCashAvailabilityCapability).not.toHaveBeenCalled(); view.rerender(launch(true, null)); expect(getOriginalCashAvailabilityCapability).not.toHaveBeenCalled()
  view.rerender(launch(true, 'caller1', { ...entry, Id: 'builtin:ДенежныеСредства' })); expect(screen.queryByRole('button', { name: 'Fenix · доступні кошти' })).toBeNull()
  view.rerender(launch(true, 'caller1', entry, ['amg'])); expect(getOriginalCashAvailabilityCapability).not.toHaveBeenCalled()
})
it('caller change aborts old capability and prevents stale reopening of original form', async () => {
  let finish!: (value: AvailabilityCapability) => void; vi.mocked(getOriginalCashAvailabilityCapability).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValueOnce({ ...availabilityCapabilityFixture(), Executable: false })
  const view = render(launch()); await waitFor(() => expect(getOriginalCashAvailabilityCapability).toHaveBeenCalledTimes(1)); const signal = vi.mocked(getOriginalCashAvailabilityCapability).mock.calls[0][0]
  view.rerender(launch(true, 'caller2')); expect(signal?.aborted).toBe(true); await act(async () => { finish(availabilityCapabilityFixture()) })
  expect((screen.getByRole('button', { name: 'Fenix · доступні кошти' }) as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByText('Форма доступних коштів')).toBeNull()
})
