import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getPlannedCashCapabilities } from '../api/plannedCashApi'
import { plannedCashCapability, plannedCashCatalogueEntry, plannedCashKinds } from '../data/plannedCash.test-fixtures'
import { PlannedCashCatalogueLaunch } from './PlannedCashCatalogueLaunch'
vi.mock('../api/plannedCashApi', () => ({ getPlannedCashCapabilities: vi.fn() }))
const open = vi.fn(() => true)
beforeEach(() => { open.mockClear(); vi.mocked(getPlannedCashCapabilities).mockReset() })
function launcher(enabled = true, callerKey = 'owner-a') {
  return <MantineProvider env="test"><I18nProvider><PlannedCashCatalogueLaunch report={plannedCashCatalogueEntry()}
    enabled={enabled} disabled={false} callerKey={callerKey} onOpen={open} /></I18nProvider></MantineProvider>
}
it('opens the current OUR variant only after an exact executable capability', async () => {
  vi.mocked(getPlannedCashCapabilities).mockResolvedValue(plannedCashCapability()); render(launcher())
  const button = screen.getByRole('button', { name: 'Відкрити звіт планування коштів' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(plannedCashCapability()); expect(getPlannedCashCapabilities).toHaveBeenCalledWith('CalendarPayouts', 'owner-a', expect.any(AbortSignal))
})
it('does not read without permission and never turns an unavailable runtime flag on', async () => {
  const capability = plannedCashCapability(); capability.RuntimeImplemented = false
  vi.mocked(getPlannedCashCapabilities).mockResolvedValue(capability); const view = render(launcher(false))
  expect(getPlannedCashCapabilities).not.toHaveBeenCalled(); view.rerender(launcher())
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити звіт планування коштів' })); expect(open).not.toHaveBeenCalled(); expect(capability.RuntimeImplemented).toBe(false)
})
it('aborts old-owner capability and ignores its late executable response', async () => {
  let resolve!: (value: ReturnType<typeof plannedCashCapability>) => void
  vi.mocked(getPlannedCashCapabilities).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    .mockResolvedValueOnce({ ...plannedCashCapability(), RuntimeImplemented: false })
  const view = render(launcher()), signal = vi.mocked(getPlannedCashCapabilities).mock.calls[0][2]
  view.rerender(launcher(true, 'owner-b')); expect(signal.aborted).toBe(true)
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.'); await act(async () => { resolve(plannedCashCapability()) })
  expect((screen.getByRole('button', { name: 'Відкрити звіт планування коштів' }) as HTMLButtonElement).disabled).toBe(true); expect(open).not.toHaveBeenCalled()
})
it('offers an explicit capability retry after failure and rejects the wrong Source definition', async () => {
  const invalid=plannedCashCapability();Reflect.set(invalid.SourceIdentity,'DefinitionSha256','wrong')
  vi.mocked(getPlannedCashCapabilities).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(invalid)
  render(launcher()); fireEvent.click(await screen.findByRole('button', { name: 'Повторити' }))
  await waitFor(() => expect(getPlannedCashCapabilities).toHaveBeenCalledTimes(2))
  expect((screen.getByRole('button', { name: 'Відкрити звіт планування коштів' }) as HTMLButtonElement).disabled).toBe(true)
})

it('never launches a matching title with a different original identity or conflicting retained definition',()=>{
  const report=plannedCashCatalogueEntry();report.Sources[0].DefinitionSha256='wrong'
  render(<MantineProvider env="test"><I18nProvider><PlannedCashCatalogueLaunch report={report} enabled disabled={false} callerKey="owner-a" onOpen={open}/></I18nProvider></MantineProvider>)
  expect(screen.queryByRole('button',{name:'Відкрити звіт планування коштів'})).toBeNull();expect(getPlannedCashCapabilities).not.toHaveBeenCalled()
})
it('clears an executable capability immediately when permission is revoked',async()=>{
  vi.mocked(getPlannedCashCapabilities).mockResolvedValue(plannedCashCapability());const view=render(launcher())
  const button=screen.getByRole('button',{name:'Відкрити звіт планування коштів'});await waitFor(()=>expect((button as HTMLButtonElement).disabled).toBe(false))
  view.rerender(launcher(false));expect((button as HTMLButtonElement).disabled).toBe(true);fireEvent.click(button);expect(open).not.toHaveBeenCalled()
})

it('does not load a capability when the catalogue has no action to open its original form',()=>{
  render(<MantineProvider env="test"><I18nProvider><PlannedCashCatalogueLaunch report={plannedCashCatalogueEntry()} enabled disabled={false} callerKey="owner-a"/></I18nProvider></MantineProvider>)
  expect(getPlannedCashCapabilities).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Відкрити звіт планування коштів'})).toBeNull()
})

it('invalidates a same-owner retained definition change and admits only the new server binding', async () => {
  const report = plannedCashCatalogueEntry(), previous = plannedCashCapability(), next = plannedCashCapability()
  next.SourceIdentity.DefinitionSha256 = 'e'.repeat(64)
  let oldDone!: (value: ReturnType<typeof plannedCashCapability>) => void
  vi.mocked(getPlannedCashCapabilities).mockImplementationOnce(() => new Promise(resolve => { oldDone = resolve })).mockResolvedValueOnce(next)
  const renderLaunch = () => <MantineProvider env="test"><I18nProvider><PlannedCashCatalogueLaunch report={report}
    enabled disabled={false} callerKey="owner-a" onOpen={open} /></I18nProvider></MantineProvider>
  const view = render(renderLaunch()), oldSignal = vi.mocked(getPlannedCashCapabilities).mock.calls[0][2]
  report.Sources[0].DefinitionSha256 = next.SourceIdentity.DefinitionSha256; view.rerender(renderLaunch())
  expect(oldSignal.aborted).toBe(true)
  const button = screen.getByRole('button', { name: 'Відкрити звіт планування коштів' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); await act(async () => { oldDone(previous) })
  fireEvent.click(button); expect(open).toHaveBeenCalledWith(next); expect(getPlannedCashCapabilities).toHaveBeenCalledTimes(2)
})

it.each(plannedCashKinds)('binds %s to its own original capability without guessing a scenario', async kind => {
  vi.mocked(getPlannedCashCapabilities).mockResolvedValue(plannedCashCapability(kind))
  render(<MantineProvider env="test"><I18nProvider><PlannedCashCatalogueLaunch report={plannedCashCatalogueEntry(kind)} enabled disabled={false} callerKey="owner-a" onOpen={open} /></I18nProvider></MantineProvider>)
  const button = screen.getByRole('button', { name: 'Відкрити звіт планування коштів' }); await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button); expect(open).toHaveBeenCalledWith(plannedCashCapability(kind)); expect(getPlannedCashCapabilities).toHaveBeenCalledWith(kind, 'owner-a', expect.any(AbortSignal))
})
