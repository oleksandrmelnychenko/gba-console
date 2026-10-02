import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getInventoryTurnoverCapabilities } from '../api/inventoryTurnoverApi'
import { inventoryTurnoverCapability, inventoryTurnoverCatalogueEntry } from '../data/inventoryTurnover.test-fixtures'
import { InventoryTurnoverCatalogueLaunch } from './InventoryTurnoverCatalogueLaunch'
vi.mock('../api/inventoryTurnoverApi', () => ({ getInventoryTurnoverCapabilities: vi.fn() }))
const open = vi.fn(() => true)
beforeEach(() => { open.mockClear(); vi.mocked(getInventoryTurnoverCapabilities).mockReset() })
function launcher(enabled = true, callerKey = 'owner-a') {
  return <MantineProvider env="test"><I18nProvider><InventoryTurnoverCatalogueLaunch report={inventoryTurnoverCatalogueEntry()}
    enabled={enabled} disabled={false} callerKey={callerKey} onOpen={open} /></I18nProvider></MantineProvider>
}
it('opens the current OUR variant only after an exact executable capability', async () => {
  vi.mocked(getInventoryTurnoverCapabilities).mockResolvedValue(inventoryTurnoverCapability()); render(launcher())
  const button = screen.getByRole('button', { name: 'Відкрити звіт оборачуваності запасів' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(inventoryTurnoverCapability()); expect(getInventoryTurnoverCapabilities).toHaveBeenCalledWith('owner-a', expect.any(AbortSignal))
})
it('does not read without permission and never turns an unavailable runtime flag on', async () => {
  const capability = inventoryTurnoverCapability(); capability.RuntimeImplemented = false
  vi.mocked(getInventoryTurnoverCapabilities).mockResolvedValue(capability); const view = render(launcher(false))
  expect(getInventoryTurnoverCapabilities).not.toHaveBeenCalled(); view.rerender(launcher())
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити звіт оборачуваності запасів' })); expect(open).not.toHaveBeenCalled(); expect(capability.RuntimeImplemented).toBe(false)
})
it('aborts old-owner capability and ignores its late executable response', async () => {
  let resolve!: (value: ReturnType<typeof inventoryTurnoverCapability>) => void
  vi.mocked(getInventoryTurnoverCapabilities).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    .mockResolvedValueOnce({ ...inventoryTurnoverCapability(), RuntimeImplemented: false })
  const view = render(launcher()), signal = vi.mocked(getInventoryTurnoverCapabilities).mock.calls[0][1]
  view.rerender(launcher(true, 'owner-b')); expect(signal.aborted).toBe(true)
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.'); await act(async () => { resolve(inventoryTurnoverCapability()) })
  expect((screen.getByRole('button', { name: 'Відкрити звіт оборачуваності запасів' }) as HTMLButtonElement).disabled).toBe(true); expect(open).not.toHaveBeenCalled()
})
it('offers an explicit capability retry after failure and rejects the wrong Source definition', async () => {
  const invalid=inventoryTurnoverCapability();Reflect.set(invalid.SourceIdentity,'DefinitionSha256','wrong')
  vi.mocked(getInventoryTurnoverCapabilities).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(invalid)
  render(launcher()); fireEvent.click(await screen.findByRole('button', { name: 'Повторити' }))
  await waitFor(() => expect(getInventoryTurnoverCapabilities).toHaveBeenCalledTimes(2))
  expect((screen.getByRole('button', { name: 'Відкрити звіт оборачуваності запасів' }) as HTMLButtonElement).disabled).toBe(true)
})

it('never launches a matching title with a different original identity or conflicting retained definition',()=>{
  const report=inventoryTurnoverCatalogueEntry();report.Sources[0].DefinitionSha256='wrong'
  render(<MantineProvider env="test"><I18nProvider><InventoryTurnoverCatalogueLaunch report={report} enabled disabled={false} callerKey="owner-a" onOpen={open}/></I18nProvider></MantineProvider>)
  expect(screen.queryByRole('button',{name:'Відкрити звіт оборачуваності запасів'})).toBeNull();expect(getInventoryTurnoverCapabilities).not.toHaveBeenCalled()
})
it('clears an executable capability immediately when permission is revoked',async()=>{
  vi.mocked(getInventoryTurnoverCapabilities).mockResolvedValue(inventoryTurnoverCapability());const view=render(launcher())
  const button=screen.getByRole('button',{name:'Відкрити звіт оборачуваності запасів'});await waitFor(()=>expect((button as HTMLButtonElement).disabled).toBe(false))
  view.rerender(launcher(false));expect((button as HTMLButtonElement).disabled).toBe(true);fireEvent.click(button);expect(open).not.toHaveBeenCalled()
})

it('does not load a capability when the catalogue has no action to open its original form',()=>{
  render(<MantineProvider env="test"><I18nProvider><InventoryTurnoverCatalogueLaunch report={inventoryTurnoverCatalogueEntry()} enabled disabled={false} callerKey="owner-a"/></I18nProvider></MantineProvider>)
  expect(getInventoryTurnoverCapabilities).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Відкрити звіт оборачуваності запасів'})).toBeNull()
})

it('invalidates a same-owner retained definition change and admits only the new server binding', async () => {
  const report = inventoryTurnoverCatalogueEntry(), previous = inventoryTurnoverCapability(), next = inventoryTurnoverCapability()
  next.SourceIdentity.DefinitionSha256 = 'e'.repeat(64)
  let oldDone!: (value: ReturnType<typeof inventoryTurnoverCapability>) => void
  vi.mocked(getInventoryTurnoverCapabilities).mockImplementationOnce(() => new Promise(resolve => { oldDone = resolve })).mockResolvedValueOnce(next)
  const renderLaunch = () => <MantineProvider env="test"><I18nProvider><InventoryTurnoverCatalogueLaunch report={report}
    enabled disabled={false} callerKey="owner-a" onOpen={open} /></I18nProvider></MantineProvider>
  const view = render(renderLaunch()), oldSignal = vi.mocked(getInventoryTurnoverCapabilities).mock.calls[0][1]
  report.Sources[0].DefinitionSha256 = next.SourceIdentity.DefinitionSha256; view.rerender(renderLaunch())
  expect(oldSignal.aborted).toBe(true)
  const button = screen.getByRole('button', { name: 'Відкрити звіт оборачуваності запасів' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); await act(async () => { oldDone(previous) })
  fireEvent.click(button); expect(open).toHaveBeenCalledWith(next); expect(getInventoryTurnoverCapabilities).toHaveBeenCalledTimes(2)
})
