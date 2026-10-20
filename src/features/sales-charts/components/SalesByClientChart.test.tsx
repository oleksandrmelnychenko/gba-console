import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { getSalesByClient, searchSalesClients } from '../api/salesChartsApi'
import { SalesByClientChart } from './SalesByClientChart'

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../api/salesChartsApi', () => ({
  getSalesByClient: vi.fn(),
  searchSalesClients: vi.fn(),
}))

const searchSalesClientsMock = vi.mocked(searchSalesClients)
const getSalesByClientMock = vi.mocked(getSalesByClient)

function renderChart() {
  return render(
    <MantineProvider theme={theme}>
      <SalesByClientChart />
    </MantineProvider>,
  )
}

describe('SalesByClientChart client filter', () => {
  beforeEach(() => {
    searchSalesClientsMock.mockReset()
    getSalesByClientMock.mockReset()
    getSalesByClientMock.mockResolvedValue({})
  })

  it('lists server-matched clients once per name and loads the chosen client', async () => {
    searchSalesClientsMock.mockResolvedValue([
      { FullName: 'ТОВ "ТЕРМО-БУД"', NetUid: 'termo-1' },
      { FullName: 'ТОВ "ТЕРМО-БУД"', NetUid: 'termo-2' },
      { FullName: 'ТОВ "ЕР СІ ГРЕЙН"', NetUid: 'grain-1' },
    ])

    const user = userEvent.setup()
    renderChart()

    const select = screen.getByRole('combobox', { name: 'Клієнт' })
    await user.click(select)
    await user.type(select, '36606909')

    await waitFor(() => expect(searchSalesClientsMock).toHaveBeenCalledWith('36606909'))

    const grain = await screen.findByRole('option', { hidden: true, name: 'ТОВ "ЕР СІ ГРЕЙН"' })
    expect(screen.getAllByRole('option', { hidden: true, name: 'ТОВ "ТЕРМО-БУД"' })).toHaveLength(1)

    fireEvent.click(grain)

    await waitFor(() =>
      expect(getSalesByClientMock).toHaveBeenCalledWith(
        expect.objectContaining({ netId: 'grain-1' }),
      ),
    )
  })
})
