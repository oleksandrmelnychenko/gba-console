import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getIncompleteSaleByNetUid } from '../api/onlineShopClientsApi'
import { RetailIncompleteSalePage } from './RetailIncompleteSalePage'

vi.mock('../api/onlineShopClientsApi', () => ({ getIncompleteSaleByNetUid: vi.fn() }))

function renderSale(netUid: string) {
  render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/clients-online-shop/incomplete-sale/${netUid}`]}>
          <Routes>
            <Route path="/clients-online-shop/incomplete-sale/:netUid" element={<RetailIncompleteSalePage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getIncompleteSaleByNetUid).mockReset()
})

it('says «Продаж не знайдено» for the empty GUID without asking the server', async () => {
  renderSale('00000000-0000-0000-0000-000000000000')
  expect(await screen.findByText('Продаж не знайдено')).toBeTruthy()
  expect(getIncompleteSaleByNetUid).not.toHaveBeenCalled()
})

it('maps the server «Sale identity is required.» answer to «Продаж не знайдено»', async () => {
  vi.mocked(getIncompleteSaleByNetUid).mockRejectedValue(new ApiError('Sale identity is required.', 400, null))
  renderSale('11111111-1111-4111-8111-111111111111')
  expect(await screen.findByText('Продаж не знайдено')).toBeTruthy()
  expect(screen.queryByText('Sale identity is required.')).toBeNull()
})
