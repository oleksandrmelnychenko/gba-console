import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import { getSupplyOrderSuppliers } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import { getBudgetCartPlan } from '../api/procurementApi'
import { BudgetCartTab } from './BudgetCartTab'

vi.mock('../../supply-ukraine-orders/api/supplyUkraineOrdersApi', () => ({
  getSupplyOrderSuppliers: vi.fn(),
}))

vi.mock('../api/procurementApi', () => ({
  getBudgetCartPlan: vi.fn(),
}))

describe('BudgetCartTab', () => {
  beforeEach(() => {
    vi.mocked(getSupplyOrderSuppliers).mockResolvedValue([])
    vi.mocked(getBudgetCartPlan).mockReset()
  })

  it('explains the next action and the selected optimization method', () => {
    render(
      <MantineProvider theme={theme}>
        <I18nProvider>
          <BudgetCartTab />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByText('План ще не сформовано')).not.toBeNull()
    expect(screen.getByText('50 000 EUR')).not.toBeNull()
    expect(
      screen.getByText('Швидкий метод спочатку бере позиції з найбільшою цінністю на 1 EUR'),
    ).not.toBeNull()
    expect(getBudgetCartPlan).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Оптимальний'))

    expect(
      screen.getByText(
        'Оптимальний метод порівнює комбінації всього набору, щоб краще використати бюджет',
      ),
    ).not.toBeNull()
  })
})
