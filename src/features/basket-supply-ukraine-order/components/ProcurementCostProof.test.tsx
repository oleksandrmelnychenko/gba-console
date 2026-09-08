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
