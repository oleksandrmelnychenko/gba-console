import { formatUnitCost } from '../procurementMoneyFormat'
import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import { getBudgetCartPlan } from '../api/procurementApi'
import budget from '../api/cost-fixtures/budget.json'
import { BudgetCartSummary } from './BudgetCartSummary'
import { BudgetCartTable } from './BudgetCartTable'
import { ProcurementCostProof, ProcurementCostSnapshot } from './ProcurementCostProof'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
async function planFixture() {
  vi.mocked(apiRequest).mockResolvedValueOnce(structuredClone(budget))
  return getBudgetCartPlan({ budgetEur: budget.budget_eur!, method: 'greedy' })
}

it('shows factual zero, partial historical median and manual/unavailable cost as distinct table states', async () => {
  const plan = await planFixture()
  const names = ['Verified zero', 'Verified positive', 'Partial observations', 'Buyer estimate', 'Unknown cost']
  const { container } = render(<MantineProvider theme={theme}><I18nProvider>
    <BudgetCartTable items={plan.items.map((item, index) => ({ ...item, product_name: names[index] }))} producerNameById={new Map()} />
  </I18nProvider></MantineProvider>)
  const rows = [...container.querySelectorAll('tbody tr')]
  const zero = rows.find(row => row.textContent?.includes(names[0]))!
  const unknown = rows.find(row => row.textContent?.includes(names[4]))!
  expect(within(zero as HTMLElement).getAllByText('0,00').length).toBe(2)
  expect(within(unknown as HTMLElement).queryByText('0,00')).toBeNull()
  expect(within(unknown as HTMLElement).getByText('Виключено')).not.toBeNull()
  const partial = rows.find(row => row.textContent?.includes(names[2]))! as HTMLElement
  expect(within(partial).getByText('10,00')).not.toBeNull()
  expect(within(partial).getAllByText('Неповне покриття').length).toBeGreaterThan(0)
  expect(within(partial).getByText('Виключено')).not.toBeNull()
  expect(screen.queryByText('Цінність/€')).toBeNull()
})

it('explains exact observation scope, manual tax uncertainty and dimensionless budget without future profit claims', async () => {
  const plan = await planFixture()
  render(<MantineProvider theme={theme}><I18nProvider>
    <BudgetCartSummary plan={plan} financials={{ selectedProducerCount: 1 }} splitSlices={[]} utilization={0} />
    <ProcurementCostSnapshot context={plan} />
    <ProcurementCostProof item={plan.items[3]} />
  </I18nProvider></MantineProvider>)
  const score = screen.getByText('Бал терміновості').parentElement!
  expect(score.textContent).toBe('Бал терміновості1')
  expect(score.textContent).not.toContain('€')
  expect(screen.queryByText('Цінність під ризиком (EUR)')).toBeNull()
  expect(screen.queryByText('Потенційна виручка (EUR)')).toBeNull()
  expect(screen.getByText(/Оцінка містить ручні значення/)).not.toBeNull()
  expect(screen.getByText(/автоматичний бюджет його не використовує/)).not.toBeNull()
  expect(screen.getByText(/Чернетка замовлення використовує власні договірні умови/)).not.toBeNull()
  const component = plan.cost_observation_manifest.components[0]
  expect(screen.getByText(`Час читання UTC: ${component.observation_started_at_utc} — ${component.observation_completed_at_utc}`)).not.toBeNull()
})

it('retains small manual estimates and the recorded scalar zero in unit price formatting', () => {
  expect(formatUnitCost(0)).toBe('0,00')
  expect(formatUnitCost(.0000001)).toBe('0,0000001')
  expect(formatUnitCost(1e-21)).toBe('1e-21')
  expect(formatUnitCost(Number.MIN_VALUE)).toBe('5e-324')
})

it('keeps compact cost uncertainty and historical comparison without exposing technical identifiers', async () => {
  const plan = await planFixture()
  const item = {
    ...plan.items[2],
    cost_provenance: {
      ...plan.items[2].cost_provenance,
      current_unit_ids: [987654321],
      supplier_client_agreement_ids: [876543210],
      component_refs: ['private-snapshot-ref'],
      reason_counts: [{ reason: 'private_raw_reason', count: 1 }],
      budget_exclusion_reasons: ['private_raw_reason'],
    },
    cheaper_alt: {
      producer_id: 765432109,
      cost_eur: 4,
      cost_provenance: plan.items[1].cost_provenance,
      comparison_basis: 'historical_net_goods' as const,
    },
  }
  const { container } = render(<MantineProvider theme={theme}>
    <ProcurementCostSnapshot context={plan} compact />
    <ProcurementCostProof item={item} compact />
  </MantineProvider>)
  expect(screen.getByText('Неповне покриття').className).toContain('app-table-chip-label')
  expect(screen.getByText(/Відомо лише частину вартості/)).not.toBeNull()
  expect(screen.getByText(/не включено до автоматичного бюджету/)).not.toBeNull()
  expect(screen.getByText(/Маржа та очікуваний прибуток не розраховані/)).not.toBeNull()
  expect(screen.getByText(/Є ручні оцінки з непідтвердженим складом податків/)).not.toBeNull()
  expect(screen.getByText(/без ПДВ, доставки та мита; не поточна ціна/)).not.toBeNull()
  expect(screen.getByText(/Це минулі надходження, а не поточна пропозиція/)).not.toBeNull()
  expect(screen.getByText('EUR').closest('.app-table-chip')?.className).toContain('is-source')
  for (const hidden of ['987654321', '876543210', '765432109', 'private-snapshot-ref', 'private_raw_reason', 'Канонічне значення', 'Час читання UTC']) {
    expect(container.textContent).not.toContain(hidden)
  }
  for (const component of plan.cost_observation_manifest.components) {
    expect(container.textContent).not.toContain(component.component_id)
  }
  expect(container.querySelector('details')).toBeNull()
})

it('does not turn unavailable compact cost into zero and keeps buyer tax uncertainty', async () => {
  const plan = await planFixture()
  const { container, rerender } = render(<MantineProvider theme={theme}>
    <ProcurementCostProof item={plan.items[4]} compact />
  </MantineProvider>)
  expect(screen.getByText('Підтвердженої ціни немає.')).not.toBeNull()
  expect(container.textContent).not.toContain('0,00')
  rerender(<MantineProvider theme={theme}><ProcurementCostProof item={plan.items[3]} compact /></MantineProvider>)
  expect(screen.getByText(/Ручна оцінка закупівельника; склад податків не підтверджено/)).not.toBeNull()
  expect(screen.getByText(/не включено до автоматичного бюджету/)).not.toBeNull()
})
