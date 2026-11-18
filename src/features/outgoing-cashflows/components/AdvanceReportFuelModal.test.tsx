import { MantineProvider } from '@mantine/core'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { searchCompanyCarsForAdvanceReportEdit } from '../../company-cars/api/companyCarsApi'
import { searchPaymentCostMovements } from '../../consumable-orders/api/consumableOrdersApi'
import { AdvanceReportFuelModal } from './AdvanceReportFuelModal'

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <div>{children}</div> : null,
  AppModalFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../../company-cars/api/companyCarsApi', () => ({
  searchCompanyCarsForAdvanceReportEdit: vi.fn(),
}))

vi.mock('../../consumable-orders/api/consumableOrdersApi', () => ({
  searchPaymentCostMovements: vi.fn(),
}))

vi.mock('../api/advanceReportApi', () => ({
  calculateAdvanceReportCompanyCarFueling: vi.fn(),
  searchAdvanceReportSupplyOrganizations: vi.fn(async () => []),
}))

function renderModal() {
  render(
    <MantineProvider>
      <I18nProvider>
        <AdvanceReportFuelModal opened outcomeOrder={{ Amount: 300, NetUid: 'order-1' }} onAdd={vi.fn()} onClose={vi.fn()} />
      </I18nProvider>
    </MantineProvider>,
  )
}

// fin-23: «Автомобіль компанії» showed «Нічого не знайдено» until a character was typed, and the
// amount fields showed «50.5» / «33.67» with a dot.
describe('advance report fuel line', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => {}
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(searchPaymentCostMovements).mockResolvedValue([])
    vi.mocked(searchCompanyCarsForAdvanceReportEdit).mockResolvedValue([
      { Id: 1, NetUid: 'car-1', LicensePlate: 'AA0001QA' } as never,
    ])
  })

  it('loads the company cars when the modal opens, without typing', async () => {
    renderModal()

    await waitFor(() => expect(searchCompanyCarsForAdvanceReportEdit).toHaveBeenCalledWith(''), { timeout: 2000 })
  })

  it('shows typed and calculated amounts with a decimal comma', async () => {
    const user = userEvent.setup()
    renderModal()

    const price = screen.getByLabelText('Ціна за літр') as HTMLInputElement
    await user.type(price, '50,5')
    await act(async () => {})

    expect(price.value).toBe('50,5')
    const fuel = screen.getByLabelText('Кількість пального') as HTMLInputElement
    await user.type(fuel, '4')
    const vat = screen.getByLabelText('ПДВ %') as HTMLInputElement
    await user.type(vat, '20')
    await act(async () => {})

    expect((screen.getByLabelText('Загальна сума з ПДВ') as HTMLInputElement).value).toBe('202')
    expect((screen.getByLabelText('Сума ПДВ') as HTMLInputElement).value).toBe('33,67')
  })
})
