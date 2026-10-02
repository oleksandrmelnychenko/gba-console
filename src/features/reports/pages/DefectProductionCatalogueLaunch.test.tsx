import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getDefectProductionCapabilities } from '../api/defectProductionApi'
import { defectProductionCapability, defectProductionCatalogueEntry } from '../data/defectProduction.test-fixtures'
import { DefectProductionCatalogueLaunch } from './DefectProductionCatalogueLaunch'
vi.mock('../api/defectProductionApi', () => ({ getDefectProductionCapabilities: vi.fn() }))
const open = vi.fn(() => true)
beforeEach(() => { open.mockClear(); vi.mocked(getDefectProductionCapabilities).mockReset() })
function launcher(enabled = true, callerKey = 'owner-a') {
  return <MantineProvider env="test"><I18nProvider><DefectProductionCatalogueLaunch report={defectProductionCatalogueEntry()}
    enabled={enabled} disabled={false} callerKey={callerKey} onOpen={open} /></I18nProvider></MantineProvider>
}
it('opens the current OUR variant only after an exact executable capability', async () => {
  vi.mocked(getDefectProductionCapabilities).mockResolvedValue(defectProductionCapability()); render(launcher())
  const button = screen.getByRole('button', { name: 'Відкрити звіт браку' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(defectProductionCapability()); expect(getDefectProductionCapabilities).toHaveBeenCalledWith('owner-a', expect.any(AbortSignal))
})
it('does not read without permission and never turns an unavailable runtime flag on', async () => {
  const capability = defectProductionCapability(); capability.RuntimeImplemented = false
  vi.mocked(getDefectProductionCapabilities).mockResolvedValue(capability); const view = render(launcher(false))
  expect(getDefectProductionCapabilities).not.toHaveBeenCalled(); view.rerender(launcher())
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити звіт браку' })); expect(open).not.toHaveBeenCalled(); expect(capability.RuntimeImplemented).toBe(false)
})
it('aborts old-owner capability and ignores its late executable response', async () => {
  let resolve!: (value: ReturnType<typeof defectProductionCapability>) => void
  vi.mocked(getDefectProductionCapabilities).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    .mockResolvedValueOnce({ ...defectProductionCapability(), RuntimeImplemented: false })
  const view = render(launcher()), signal = vi.mocked(getDefectProductionCapabilities).mock.calls[0][1]
  view.rerender(launcher(true, 'owner-b')); expect(signal.aborted).toBe(true)
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.'); await act(async () => { resolve(defectProductionCapability()) })
  expect((screen.getByRole('button', { name: 'Відкрити звіт браку' }) as HTMLButtonElement).disabled).toBe(true); expect(open).not.toHaveBeenCalled()
})
it('offers an explicit capability retry after failure and rejects the wrong Source definition', async () => {
  const invalid=defectProductionCapability();Reflect.set(invalid.SourceIdentity,'DefinitionSha256','wrong')
  vi.mocked(getDefectProductionCapabilities).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(invalid)
  render(launcher()); fireEvent.click(await screen.findByRole('button', { name: 'Повторити' }))
  await waitFor(() => expect(getDefectProductionCapabilities).toHaveBeenCalledTimes(2))
  expect((screen.getByRole('button', { name: 'Відкрити звіт браку' }) as HTMLButtonElement).disabled).toBe(true)
})

it('never launches a matching title with a different original identity or conflicting retained definition',()=>{
  const report=defectProductionCatalogueEntry();report.Sources[0].DefinitionSha256='wrong'
  render(<MantineProvider env="test"><I18nProvider><DefectProductionCatalogueLaunch report={report} enabled disabled={false} callerKey="owner-a" onOpen={open}/></I18nProvider></MantineProvider>)
  expect(screen.queryByRole('button',{name:'Відкрити звіт браку'})).toBeNull();expect(getDefectProductionCapabilities).not.toHaveBeenCalled()
})
it('clears an executable capability immediately when permission is revoked',async()=>{
  vi.mocked(getDefectProductionCapabilities).mockResolvedValue(defectProductionCapability());const view=render(launcher())
  const button=screen.getByRole('button',{name:'Відкрити звіт браку'});await waitFor(()=>expect((button as HTMLButtonElement).disabled).toBe(false))
  view.rerender(launcher(false));expect((button as HTMLButtonElement).disabled).toBe(true);fireEvent.click(button);expect(open).not.toHaveBeenCalled()
})

it('does not load a capability when the catalogue has no action to open its original form',()=>{
  render(<MantineProvider env="test"><I18nProvider><DefectProductionCatalogueLaunch report={defectProductionCatalogueEntry()} enabled disabled={false} callerKey="owner-a"/></I18nProvider></MantineProvider>)
  expect(getDefectProductionCapabilities).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Відкрити звіт браку'})).toBeNull()
})
