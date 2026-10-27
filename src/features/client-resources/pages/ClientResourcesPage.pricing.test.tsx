import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { ClientResourcePricing } from '../types'
import { ClientResourcesPage } from './ClientResourcesPage'

const {
  getBasePricingsMock,
  getCurrenciesMock,
  getPricingTypesMock,
  getPricingsMock,
  updatePricingMock,
} = vi.hoisted(() => ({
  getBasePricingsMock: vi.fn(),
  getCurrenciesMock: vi.fn(),
  getPricingTypesMock: vi.fn(),
  getPricingsMock: vi.fn(),
  updatePricingMock: vi.fn(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: () => true,
    cannot: () => false,
    isLoading: false,
    permissions: [],
  }),
}))

vi.mock('../api/clientResourcesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/clientResourcesApi')>()

  return {
    ...actual,
    getClientResourceBasePricings: getBasePricingsMock,
    getClientResourceCurrencies: getCurrenciesMock,
    getClientResourcePricingTypes: getPricingTypesMock,
    getClientResourcePricings: getPricingsMock,
    updateClientResourcePricing: updatePricingMock,
  }
})

const sourcePricing: ClientResourcePricing = {
  BasePricingId: 10,
  Currency: { Code: 'EUR', Id: 2, Name: 'Євро' },
  CurrencyId: 2,
  ExtraCharge: 10,
  ForVat: false,
  Id: 20,
  IsSourceManaged: true,
  Name: 'ЦО1',
  NetUid: 'pricing-co1',
  PriceType: { Id: 3, Name: 'Розрахункова' },
  PriceTypeId: 3,
  SourceDefinitions: [
    { BasePricingId: 10, CalculatedExtraCharge: 12, ExtraCharge: 12, ForVat: false, ImportedForAmg: true },
    { BasePricingId: 10, CalculatedExtraCharge: 10, ExtraCharge: 10, ForVat: false, ImportedForAmg: false },
  ],
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/clients/resources/pricing']}>
          <Routes>
            <Route path="/clients/resources/:step" element={<ClientResourcesPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

async function openEditor(name: string) {
  fireEvent.click((await screen.findAllByLabelText(name))[0])
  return screen.findByRole('dialog')
}

beforeEach(() => {
  getBasePricingsMock.mockReset().mockResolvedValue([{ Id: 10, Name: 'ЦР', NetUid: 'pricing-cr' }])
  getCurrenciesMock.mockReset().mockResolvedValue([{ Code: 'EUR', Id: 2, Name: 'Євро' }])
  getPricingTypesMock.mockReset().mockResolvedValue([{ Id: 3, Name: 'Розрахункова' }])
  getPricingsMock.mockReset().mockResolvedValue([sourcePricing])
  updatePricingMock.mockReset().mockResolvedValue(sourcePricing)
})

describe('ClientResourcesPage source-managed pricing', () => {
  it('shows both world markups and saves an AMG markup edit before cutover', async () => {
    renderPage()

    expect(await screen.findByText('Контех 10%')).toBeTruthy()
    expect(screen.getByText('AMG 12%')).toBeTruthy()
    expect(screen.getByText('1С')).toBeTruthy()

    const editor = await openEditor('Редагувати націнку')
    expect(within(editor).getByText('Націнки задаються окремо для Контех і AMG')).toBeTruthy()
    expect((within(editor).getByRole('textbox', { name: /Назва/ }) as HTMLInputElement).disabled).toBe(true)
    const amg = within(editor).getByRole('spinbutton', { name: 'Націнка AMG, %' }) as HTMLInputElement
    expect(amg.disabled).toBe(false)
    expect((within(editor).getByRole('spinbutton', { name: 'Націнка Контех, %' }) as HTMLInputElement).disabled).toBe(false)
    expect((within(editor).getByRole('checkbox', { name: 'Для ПДВ AMG' }) as HTMLInputElement).disabled).toBe(true)

    fireEvent.change(amg, { target: { value: '15' } })
    fireEvent.click(within(editor).getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(updatePricingMock).toHaveBeenCalledTimes(1))
    const payload = updatePricingMock.mock.calls[0][0] as ClientResourcePricing
    expect(payload.ExtraCharge).toBe(10)
    expect(payload.SourceDefinitions).toEqual([
      { BasePricingId: 10, CalculatedExtraCharge: 10, ExtraCharge: 10, ForVat: false, ImportedForAmg: false },
      { BasePricingId: 10, CalculatedExtraCharge: 12, ExtraCharge: 15, ForVat: false, ImportedForAmg: true },
    ])
  })

  it('unlocks the shared and per-world fields once GBA owns pricing', async () => {
    getPricingsMock.mockResolvedValue([{ ...sourcePricing, SourceFieldsEditable: true }])
    renderPage()

    expect(await screen.findByText('AMG 12%')).toBeTruthy()
    expect(screen.queryByText('1С')).toBeNull()

    const editor = await openEditor('Редагувати правило')
    expect(within(editor).getByText('Націнки, базові ціни й ПДВ задаються окремо для Контех і AMG')).toBeTruthy()
    const name = within(editor).getByRole('textbox', { name: /Назва/ }) as HTMLInputElement
    expect(name.disabled).toBe(false)
    fireEvent.change(name, { target: { value: 'ЦО1 GBA' } })
    fireEvent.click(within(editor).getByRole('checkbox', { name: 'Для ПДВ Контех' }))
    fireEvent.click(within(editor).getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(updatePricingMock).toHaveBeenCalledTimes(1))
    const payload = updatePricingMock.mock.calls[0][0] as ClientResourcePricing
    expect(payload.Name).toBe('ЦО1 GBA')
    expect(payload.SourceDefinitions?.find((definition) => !definition.ImportedForAmg)?.ForVat).toBe(true)
    expect(payload.SourceDefinitions?.find((definition) => definition.ImportedForAmg)?.ForVat).toBe(false)
  })
})
