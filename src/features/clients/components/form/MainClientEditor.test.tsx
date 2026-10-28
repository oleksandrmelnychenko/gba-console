import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import { getRootClientBySubClientNetId } from '../../api/clientCabinetApi'
import { getClientsForRegistry, getSuppliers } from '../../api/clientsApi'
import type { Client } from '../../types'
import { MainClientEditor } from './MainClientEditor'
import { isMainClientCandidate } from './mainClientCandidate'

vi.mock('../../api/clientCabinetApi', () => ({
  getRootClientBySubClientNetId: vi.fn(),
}))

vi.mock('../../api/clientsApi', () => ({
  getClientsForRegistry: vi.fn(),
  getSuppliers: vi.fn(),
}))

const subClient: Client = {
  NetUid: 'sub-client',
  FullName: 'Філія',
  MainClientId: 20,
  IsSubClient: true,
  Updated: '2026-10-27T10:00:00Z',
}

const rootClient: Client = { NetUid: 'root-client', FullName: 'ТОВ «Корінь»' }

function renderEditor(props: Partial<Parameters<typeof MainClientEditor>[0]> = {}) {
  return render(
    <MantineProvider env="test" theme={theme}>
      <I18nProvider>
        <MainClientEditor
          client={subClient}
          isProvider={false}
          onSetMainClient={vi.fn().mockResolvedValue(undefined)}
          {...props}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('main client editor on the client card', () => {
  beforeEach(() => {
    vi.mocked(getRootClientBySubClientNetId).mockReset()
    vi.mocked(getClientsForRegistry).mockReset()
    vi.mocked(getSuppliers).mockReset()
    vi.mocked(getRootClientBySubClientNetId).mockResolvedValue({ RootClient: rootClient } as Client)
  })

  it('shows the current main client and clears it', async () => {
    const onSetMainClient = vi.fn().mockResolvedValue(undefined)
    renderEditor({ onSetMainClient })

    expect(await screen.findByText('ТОВ «Корінь»')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Відʼєднати від головного клієнта' }))

    await waitFor(() => expect(onSetMainClient).toHaveBeenCalledWith(null))
    expect(getRootClientBySubClientNetId).toHaveBeenCalledWith('sub-client')
  })

  it('searches buyers after a pause, offers only top-level clients and assigns the chosen one', async () => {
    vi.mocked(getClientsForRegistry).mockResolvedValue([
      { NetUid: 'other-root', FullName: 'ТОВ «Інший корінь»', USREOU: '12345678' },
      { NetUid: 'nested', FullName: 'Чужа філія', IsSubClient: true, MainClientId: 30 },
      { NetUid: 'sub-client', FullName: 'Філія' },
    ])
    const onSetMainClient = vi.fn().mockResolvedValue(undefined)
    renderEditor({ client: { ...subClient, MainClientId: null, IsSubClient: false }, onSetMainClient })

    expect(screen.getByText('Не призначено')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Пошук головного клієнта'), { target: { value: 'корінь' } })

    const assign = await screen.findByRole('button', { name: 'Зробити головним' }, { timeout: 3000 })
    expect(getClientsForRegistry).toHaveBeenCalledTimes(1)
    expect(vi.mocked(getClientsForRegistry).mock.calls[0][0]).toEqual({ value: 'корінь', limit: 20, offset: 0 })
    expect(getSuppliers).not.toHaveBeenCalled()
    expect(screen.queryByText('Чужа філія')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Зробити головним' })).toHaveLength(1)

    fireEvent.click(assign)
    await waitFor(() => expect(onSetMainClient).toHaveBeenCalledWith('other-root'))
  })

  it('searches suppliers for a provider and shows the server refusal', async () => {
    vi.mocked(getSuppliers).mockResolvedValue([{ NetUid: 'supplier-root', FullName: 'Постачальник' }])
    const onSetMainClient = vi.fn().mockRejectedValue(
      new Error('Головним клієнтом постачальника може бути лише постачальник.'),
    )
    renderEditor({ client: { ...subClient, MainClientId: null, IsSubClient: false }, isProvider: true, onSetMainClient })

    fireEvent.change(screen.getByLabelText('Пошук головного клієнта'), { target: { value: 'пост' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Зробити головним' }, { timeout: 3000 }))

    expect(await screen.findByText('Головним клієнтом постачальника може бути лише постачальник.')).toBeTruthy()
    expect(getClientsForRegistry).not.toHaveBeenCalled()
  })

  it('only explains the 1C lock for an imported client before cutover', async () => {
    renderEditor({ lockedReason: 'Клієнт імпортований з 1С: до переходу на GBA його головного клієнта змінюють в 1С.' })

    expect(await screen.findByText('ТОВ «Корінь»')).toBeTruthy()
    expect(screen.getByText('Клієнт імпортований з 1С: до переходу на GBA його головного клієнта змінюють в 1С.')).toBeTruthy()
    expect(screen.queryByLabelText('Пошук головного клієнта')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Відʼєднати від головного клієнта' })).toBeNull()
  })

  it('treats only live top-level clients other than the card as candidates', () => {
    expect(isMainClientCandidate({ NetUid: 'a' }, 'b')).toBe(true)
    expect(isMainClientCandidate({ NetUid: 'b' }, 'b')).toBe(false)
    expect(isMainClientCandidate({ NetUid: 'a', IsTradePoint: true }, 'b')).toBe(false)
    expect(isMainClientCandidate({ NetUid: 'a', MainClientId: 5 }, 'b')).toBe(false)
    expect(isMainClientCandidate({ NetUid: 'a', Deleted: true }, 'b')).toBe(false)
    expect(isMainClientCandidate({}, 'b')).toBe(false)
  })
})
