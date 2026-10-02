import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getCurrentLiquidityCapabilities } from '../api/currentLiquidityApi'
import { currentLiquidityCapability, currentLiquidityCatalogueEntry } from '../data/currentLiquidity.test-fixtures'
import { CurrentLiquidityCatalogueLaunch } from './CurrentLiquidityCatalogueLaunch'
vi.mock('../api/currentLiquidityApi', () => ({ getCurrentLiquidityCapabilities: vi.fn() }))
const open = vi.fn(() => true)
beforeEach(() => { open.mockClear(); vi.mocked(getCurrentLiquidityCapabilities).mockReset() })
function launcher(enabled = true, callerKey = 'owner-a') {
  return <MantineProvider env="test"><I18nProvider><CurrentLiquidityCatalogueLaunch report={currentLiquidityCatalogueEntry()}
    enabled={enabled} disabled={false} callerKey={callerKey} onOpen={open} /></I18nProvider></MantineProvider>
}
it('opens the current OUR variant only after an exact executable capability', async () => {
  vi.mocked(getCurrentLiquidityCapabilities).mockResolvedValue(currentLiquidityCapability()); render(launcher())
  const button = screen.getByRole('button', { name: 'Відкрити звіт поточної ліквідності' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(currentLiquidityCapability()); expect(getCurrentLiquidityCapabilities).toHaveBeenCalledWith('owner-a', expect.any(AbortSignal))
})
it('does not read without permission and never turns an unavailable runtime flag on', async () => {
  const capability = currentLiquidityCapability(); capability.RuntimeImplemented = false
  vi.mocked(getCurrentLiquidityCapabilities).mockResolvedValue(capability); const view = render(launcher(false))
  expect(getCurrentLiquidityCapabilities).not.toHaveBeenCalled(); view.rerender(launcher())
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити звіт поточної ліквідності' })); expect(open).not.toHaveBeenCalled(); expect(capability.RuntimeImplemented).toBe(false)
})
it('aborts old-owner capability and ignores its late executable response', async () => {
  let resolve!: (value: ReturnType<typeof currentLiquidityCapability>) => void
  vi.mocked(getCurrentLiquidityCapabilities).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    .mockResolvedValueOnce({ ...currentLiquidityCapability(), RuntimeImplemented: false })
  const view = render(launcher()), signal = vi.mocked(getCurrentLiquidityCapabilities).mock.calls[0][1]
  view.rerender(launcher(true, 'owner-b')); expect(signal.aborted).toBe(true)
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.'); await act(async () => { resolve(currentLiquidityCapability()) })
  expect((screen.getByRole('button', { name: 'Відкрити звіт поточної ліквідності' }) as HTMLButtonElement).disabled).toBe(true); expect(open).not.toHaveBeenCalled()
})
it('offers an explicit capability retry after failure and rejects the wrong Source definition', async () => {
  const invalid=currentLiquidityCapability();Reflect.set(invalid.SourceIdentity,'DefinitionSha256','wrong')
  vi.mocked(getCurrentLiquidityCapabilities).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(invalid)
  render(launcher()); fireEvent.click(await screen.findByRole('button', { name: 'Повторити' }))
  await waitFor(() => expect(getCurrentLiquidityCapabilities).toHaveBeenCalledTimes(2))
  expect((screen.getByRole('button', { name: 'Відкрити звіт поточної ліквідності' }) as HTMLButtonElement).disabled).toBe(true)
})

it('never launches a matching title with a different original identity or conflicting retained definition',()=>{
  const report=currentLiquidityCatalogueEntry();report.Sources[0].DefinitionSha256='wrong'
  render(<MantineProvider env="test"><I18nProvider><CurrentLiquidityCatalogueLaunch report={report} enabled disabled={false} callerKey="owner-a" onOpen={open}/></I18nProvider></MantineProvider>)
  expect(screen.queryByRole('button',{name:'Відкрити звіт поточної ліквідності'})).toBeNull();expect(getCurrentLiquidityCapabilities).not.toHaveBeenCalled()
})
it('clears an executable capability immediately when permission is revoked',async()=>{
  vi.mocked(getCurrentLiquidityCapabilities).mockResolvedValue(currentLiquidityCapability());const view=render(launcher())
  const button=screen.getByRole('button',{name:'Відкрити звіт поточної ліквідності'});await waitFor(()=>expect((button as HTMLButtonElement).disabled).toBe(false))
  view.rerender(launcher(false));expect((button as HTMLButtonElement).disabled).toBe(true);fireEvent.click(button);expect(open).not.toHaveBeenCalled()
})

it('does not load a capability when the catalogue has no action to open its original form',()=>{
  render(<MantineProvider env="test"><I18nProvider><CurrentLiquidityCatalogueLaunch report={currentLiquidityCatalogueEntry()} enabled disabled={false} callerKey="owner-a"/></I18nProvider></MantineProvider>)
  expect(getCurrentLiquidityCapabilities).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Відкрити звіт поточної ліквідності'})).toBeNull()
})

it('invalidates a same-owner retained definition change and admits only the new server binding', async () => {
  const report = currentLiquidityCatalogueEntry(), previous = currentLiquidityCapability(), next = currentLiquidityCapability()
  next.SourceIdentity.DefinitionSha256 = 'e'.repeat(64)
  let oldDone!: (value: ReturnType<typeof currentLiquidityCapability>) => void
  vi.mocked(getCurrentLiquidityCapabilities).mockImplementationOnce(() => new Promise(resolve => { oldDone = resolve })).mockResolvedValueOnce(next)
  const renderLaunch = () => <MantineProvider env="test"><I18nProvider><CurrentLiquidityCatalogueLaunch report={report}
    enabled disabled={false} callerKey="owner-a" onOpen={open} /></I18nProvider></MantineProvider>
  const view = render(renderLaunch()), oldSignal = vi.mocked(getCurrentLiquidityCapabilities).mock.calls[0][1]
  report.Sources[0].DefinitionSha256 = next.SourceIdentity.DefinitionSha256; view.rerender(renderLaunch())
  expect(oldSignal.aborted).toBe(true)
  const button = screen.getByRole('button', { name: 'Відкрити звіт поточної ліквідності' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); await act(async () => { oldDone(previous) })
  fireEvent.click(button); expect(open).toHaveBeenCalledWith(next); expect(getCurrentLiquidityCapabilities).toHaveBeenCalledTimes(2)
})
