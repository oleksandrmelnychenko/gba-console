import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getOneCTurnoverSyncCatalog } from '../api/syncApi'
import { OneCTurnoverSyncPanel } from './OneCTurnoverSyncPanel'

vi.mock('../api/syncApi', () => ({ getOneCTurnoverSyncCatalog: vi.fn() }))
const load = vi.mocked(getOneCTurnoverSyncCatalog)
const organization = '11'.repeat(16)
const kind = '22'.repeat(16)
const catalog = { Organizations: [{ Id: organization, Name: 'Фенікс' }], ProductKinds: [{ Id: kind, Name: 'Товар' }] }
const props = { range: { from: '2026-08-01', to: '2026-08-31' }, types: ['6'], today: '2026-09-06', blocked: false, loading: false, onRun: vi.fn(async () => {}) }
function mount(overrides = {}) {
  return render(<MantineProvider env="test"><OneCTurnoverSyncPanel {...props} {...overrides} /></MantineProvider>)
}
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  load.mockReset(); props.onRun.mockClear(); load.mockResolvedValue(catalog)
})
afterEach(cleanup)

describe('consolidated report sync action', () => {
  it.each([{ mode: 'full' }, { source: 'amg' }, { visible: false }])('does not offer reporting outside an open daily Fenix context: %j', (context) => {
    mount(context)
    expect(screen.queryByLabelText('Звітні рухи 1С — окремий запуск Fenix')).toBeNull()
    expect(load).not.toHaveBeenCalled()
    expect(props.onRun).not.toHaveBeenCalled()
  })
  it('does not read source catalogs or start anything until explicitly enabled; aborts on close', async () => {
    const view = mount()
    expect(load).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Звітні рухи 1С — окремий запуск Fenix'))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    expect(props.onRun).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Завантажити звітні рухи 1С' }) as HTMLButtonElement).disabled).toBe(true)
    const signal = load.mock.calls[0][0]!
    view.unmount()
    expect(signal.aborted).toBe(true)
  })
  it('uses named source choices, asks confirmation and sends explicit filters only after confirmation', async () => {
    mount()
    fireEvent.click(screen.getByLabelText('Звітні рухи 1С — окремий запуск Fenix'))
    await waitFor(() => expect(screen.queryByText('Завантаження довідників Fenix…')).toBeNull())
    act(() => screen.getByRole('combobox', { name: 'Організації Fenix для звіту' }).focus())
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Організації Fenix для звіту' }), { key: 'ArrowDown', code: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: `Фенікс · ${organization}` }))
    act(() => screen.getByRole('combobox', { name: 'Вид номенклатури Fenix' }).focus())
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Вид номенклатури Fenix' }), { key: 'ArrowDown', code: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: `Товар · ${kind}` }))
    fireEvent.click(screen.getByLabelText('Виключити позиції з ознакою послуги'))
    fireEvent.click(screen.getByRole('button', { name: 'Завантажити звітні рухи 1С' }))
    expect(props.onRun).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити завантаження звітних рухів' }))
    await waitFor(() => expect(props.onRun).toHaveBeenCalledWith({ oneCOrganizationIds: [organization], oneCProductKindId: kind, oneCExcludeServices: false }))
  })
  it('shows failures and allows read-only retry without starting synchronization', async () => {
    load.mockRejectedValueOnce(new Error('Немає дозволу'))
    mount()
    fireEvent.click(screen.getByLabelText('Звітні рухи 1С — окремий запуск Fenix'))
    await screen.findByText('Немає дозволу')
    fireEvent.click(screen.getByRole('button', { name: 'Повторити' }))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    expect(props.onRun).not.toHaveBeenCalled()
  })
})
