import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import { getSaleManagers } from '../../api/clientLookupsApi'
import type { Client, Manager } from '../../types'
import { ManagerPicker } from './ManagerPicker'

vi.mock('../../api/clientLookupsApi', () => ({
  getPurchaseManagers: vi.fn(),
  getSaleManagers: vi.fn(),
}))

const managers: Manager[] = [
  { Id: 7, NetUid: 'manager-7', LastName: 'Петренко', FirstName: 'Олена' },
  { Id: 8, NetUid: 'manager-8', LastName: 'Іваненко', FirstName: 'Іван' },
]

function renderPicker(props: Partial<Parameters<typeof ManagerPicker>[0]> = {}) {
  const client: Client = { NetUid: 'client-1', MainManagerId: 7, ClientManagers: [] }
  return render(
    <MantineProvider env="test" theme={theme}>
      <I18nProvider>
        <ManagerPicker client={client} role="buyer" onChange={vi.fn()} {...props} />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('main manager from the client card', () => {
  beforeEach(() => {
    vi.mocked(getSaleManagers).mockResolvedValue(managers)
  })

  it('makes another manager the main manager without touching the analysts', async () => {
    const onChange = vi.fn()
    const onSetMainManager = vi.fn().mockResolvedValue(undefined)
    renderPicker({ disabled: true, onChange, onSetMainManager })

    const actions = await screen.findAllByRole('button', { name: 'Зробити головним' })
    expect(actions).toHaveLength(1)
    fireEvent.click(actions[0])

    await waitFor(() => expect(onSetMainManager).toHaveBeenCalledWith(managers[1]))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows the server refusal and hides the action without edit rights', async () => {
    const onSetMainManager = vi.fn().mockRejectedValue(new Error('Картку клієнта змінено іншим запитом. Оновіть картку й повторіть.'))
    const view = renderPicker({ onSetMainManager })

    fireEvent.click(await screen.findByRole('button', { name: 'Зробити головним' }))

    expect(await screen.findByText('Картку клієнта змінено іншим запитом. Оновіть картку й повторіть.')).toBeTruthy()
    view.unmount()
    renderPicker({ mainManagerDisabled: true, onSetMainManager })
    await screen.findByText('Іваненко Іван')
    expect(screen.queryByRole('button', { name: 'Зробити головним' })).toBeNull()
  })
})
