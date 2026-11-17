import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getSyncDocuments } from '../api/balancesApi'
import { BalancesPage } from './BalancesPage'

vi.mock('../api/balancesApi', () => ({ getSyncDocuments: vi.fn() }))

afterEach(cleanup)

describe('sync documents empty state', () => {
  it('says that no documents were found instead of «Відсутній»', async () => {
    vi.mocked(getSyncDocuments).mockResolvedValue({ items: [], totalQty: 0 })
    render(
      <MantineProvider env="test">
        <I18nProvider>
          <MemoryRouter>
            <BalancesPage />
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )

    expect(await screen.findByText('Документів не знайдено')).toBeTruthy()
  })
})
