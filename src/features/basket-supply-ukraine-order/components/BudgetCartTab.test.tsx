import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { theme } from '../../../shared/theme/theme'
import { getBudgetCartSuppliers } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import { getBudgetCartPlan } from '../api/procurementApi'
import { BudgetCartTab } from './BudgetCartTab'

const canMock = vi.fn<(permissionKey: string) => boolean>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: canMock, isLoading: false }),
}))

vi.mock('../../supply-ukraine-orders/api/supplyUkraineOrdersApi', () => ({
  getBudgetCartSuppliers: vi.fn(),
}))

vi.mock('../api/procurementApi', () => ({
  getBudgetCartPlan: vi.fn(),
}))

describe('BudgetCartTab', () => {
  beforeEach(() => {
    canMock.mockImplementation(
      (permissionKey) => permissionKey === PermissionKeys.SystemPages.BudgetCart.View,
    )
    vi.mocked(getBudgetCartSuppliers).mockResolvedValue([])
    vi.mocked(getBudgetCartPlan).mockReset()
  })

  it('does not mount supplier or optimization requests without budget-cart page access', () => {
    canMock.mockReturnValue(false)

    render(
      <MantineProvider env="test" theme={{ ...theme, respectReducedMotion: true }}>
        <MemoryRouter>
          <I18nProvider>
            <BudgetCartTab />
          </I18nProvider>
        </MemoryRouter>
      </MantineProvider>,
    )

    expect(screen.getByText('Недостатньо прав для перегляду бюджетного кошика')).not.toBeNull()
    expect(getBudgetCartSuppliers).not.toHaveBeenCalled()
    expect(getBudgetCartPlan).not.toHaveBeenCalled()
  })

  it('explains the next action and the selected optimization method', () => {
    render(
      <MantineProvider env="test" theme={{ ...theme, respectReducedMotion: true }}>
        <MemoryRouter>
          <I18nProvider>
            <BudgetCartTab />
          </I18nProvider>
        </MemoryRouter>
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

  it('replaces zero summaries with one actionable empty result', async () => {
    vi.mocked(getBudgetCartPlan).mockResolvedValue({
      as_of_date: '2026-07-25',
      source_history_start: '2025-01-01',
      effective_start: '2025-07-25',
      effective_history_days: 365,
      history_complete: true,
      history_not_applicable: ['inventory', 'reservations'],
      budget_eur: 50_000,
      budget_used_eur: 0,
      deferred_count: 0,
      duplicate_supplier_options_removed: 0,
      is_truncated: false,
      item_count: 0,
      items: [],
      method_used: 'greedy',
      model_version: 'test',
      priced_cost_eur: 0,
      selected_count: 0,
      total_cost_eur: 0,
      total_item_count: 0,
      total_suggested_qty: 0,
      unpriced_item_count: 0,
      value_captured_eur: 0,
    })

    render(
      <MantineProvider env="test" theme={{ ...theme, respectReducedMotion: true }}>
        <MemoryRouter>
          <I18nProvider>
            <BudgetCartTab />
          </I18nProvider>
        </MemoryRouter>
      </MantineProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Сформувати план' }))

    await waitFor(() => {
      expect(screen.getByText('Закупівля на цю дату не потрібна')).not.toBeNull()
    })

    expect(
      screen.getByText(
        'Поточні запаси покривають прогнозований попит. Можна змінити дату або вибрати товари вручну.',
      ),
    ).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Відкрити конструктор закупівель' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Перерахувати план' })).not.toBeNull()
    expect(screen.queryByText('Результат оптимізації')).toBeNull()
    expect(screen.queryByText('Дата зрізу', { selector: '.procure-workspace-state__fact span' })).toBeNull()
  })
})
