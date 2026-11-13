import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import { fixtureCostContext, fixtureNoBudget } from '../procurementCostTestFixtures'
import type { CartPlan } from '../procurementTypes'
import { BudgetCartSummary } from './BudgetCartSummary'

function plan(overrides: Partial<CartPlan> = {}): CartPlan {
  return {
    as_of_date: '2026-07-25',
    source_history_start: '2025-01-01',
    effective_start: '2025-07-25',
    effective_history_days: 365,
    history_complete: true,
    history_not_applicable: ['inventory', 'reservations', 'purchase_costs'],
    ...fixtureCostContext(),
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
    ...fixtureNoBudget,
    ...overrides,
  }
}

function renderSummary(value: CartPlan) {
  return render(<MantineProvider theme={theme}><I18nProvider>
    <BudgetCartSummary financials={{ selectedProducerCount: 1 } as never} plan={value} splitSlices={[]} utilization={0} />
  </I18nProvider></MantineProvider>)
}

describe('BudgetCartSummary', () => {
  it('says the receipt-based amount covers only lines that enter the budget', () => {
    renderSummary(plan({ estimated_total_cost_eur: 1500, certified_cost_eur: 1200, uncertified_cost_eur: 300, unestimated_item_count: 2 }))

    const hint = screen.getByText(/Оцінка всього плану/).closest('.budget-cart-summary__metric')?.getAttribute('title')?.replace(/\u00a0/g, ' ')
    expect(hint).toContain('За надходженнями, без ПДВ — лише рядки, що входять у бюджет: €1 200,00')
    expect(hint).toContain('Решта рядків: поза бюджетом або за останнім документом постачання, ПДВ не підтверджено: €300,00')
    expect(hint).toContain('Без оцінки: 2 позиції')
  })

  it('renders without the estimate fields of an older service', () => {
    renderSummary(plan())

    expect(screen.queryByText(/Оцінка всього плану/)).toBeNull()
    expect(screen.getByText('Результат оптимізації')).not.toBeNull()
  })
})
