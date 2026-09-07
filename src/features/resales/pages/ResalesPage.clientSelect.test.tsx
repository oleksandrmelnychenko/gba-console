import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { searchResaleClients } from '../api/resalesApi'
import { ResaleClientSelect } from './ResalesPage'

vi.mock('../api/resalesApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/resalesApi')>(),
  searchResaleClients: vi.fn(),
}))

const searchResaleClientsMock = vi.mocked(searchResaleClients)

function renderClientSelect() {
  render(
    <MantineProvider env="test">
      <I18nProvider>
        <ResaleClientSelect
          label="Клієнт"
          selectedClient={null}
          onSelectClient={vi.fn()}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('ResaleClientSelect', () => {
  beforeEach(() => {
    searchResaleClientsMock.mockReset()
    searchResaleClientsMock.mockImplementation(async (value) => value === '7'
      ? [{ FullName: 'Клієнт Альфа', NetUid: 'client-alpha' }]
      : [])
  })

  it('shows server results found by a client field that is not part of the option label', async () => {
    const user = userEvent.setup()
    renderClientSelect()

    await user.type(screen.getByRole('combobox', { name: 'Клієнт' }), '7')

    await waitFor(() => {
      expect(searchResaleClientsMock).toHaveBeenCalledWith('7', expect.any(AbortSignal))
    })
    expect(await screen.findByText('Клієнт Альфа')).not.toBeNull()
    expect(screen.queryByText('Клієнтів не знайдено')).toBeNull()
  })

  it('does not retain clients from an older search when the server returns no matches', async () => {
    const user = userEvent.setup()
    renderClientSelect()

    const clientSelect = screen.getByRole('combobox', { name: 'Клієнт' })
    await user.type(clientSelect, '7')
    expect(await screen.findByText('Клієнт Альфа')).not.toBeNull()

    await user.clear(clientSelect)
    await user.type(clientSelect, 'missing')

    await waitFor(() => {
      expect(searchResaleClientsMock).toHaveBeenCalledWith('missing', expect.any(AbortSignal))
      expect(screen.queryByText('Клієнт Альфа')).toBeNull()
    })
    expect(await screen.findByText('Клієнтів не знайдено')).not.toBeNull()
  })
})
