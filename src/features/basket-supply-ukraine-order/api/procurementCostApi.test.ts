import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getBudgetCartPlan, getProducerPlan, getPurchaseCockpitCharts } from './procurementApi'
import producer from './cost-fixtures/producer.json'
import cart from './cost-fixtures/cart.json'
import budget from './cost-fixtures/budget.json'
import charts from './cost-fixtures/charts.json'
import { procurementLoadError } from '../procurementLoadError'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
it('accepts current Python producer/cart/charts proofs while preserving unknown profit and factual zero', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce(producer).mockResolvedValueOnce(cart).mockResolvedValueOnce(charts)
  const plan = await getProducerPlan(7)
  expect(plan.items[0].unit_cost_eur).toBe(0)
  expect(plan.items[0].cost_provenance.budget_eligible).toBe(true)
  expect(plan.items.map(item => item.unit_margin_eur)).toEqual([null, null, null, null, null])
  expect(plan.history_scope).toBe('demand')
  expect(plan.history_not_applicable).toContain('purchase_costs')
  const basket = await getBudgetCartPlan({ budgetEur: 0, method: 'greedy' })
  expect(basket.value_captured_eur).toBeNull()
  expect(basket.budget_objective).toBeNull()
  expect(basket.items[2].unit_cost_eur).toBe(10)
  expect(basket.items[2].cost_provenance.budget_eligible).toBe(false)
  const dashboard = await getPurchaseCockpitCharts({ topN: 2 })
  expect(dashboard.cost_observation_manifest).toEqual(plan.cost_observation_manifest)
  expect(dashboard.cost_totals_certified).toBe(false)
})
it('accepts dimensionless selected-line urgency including a verified zero-cost positive quantity', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce(budget)
  const plan = await getBudgetCartPlan({ budgetEur: budget.budget_eur!, method: 'greedy' })
  expect(plan.budget_objective).toBe('urgency_weighted_lines')
  expect(plan.budget_score).toBe(1)
  expect(plan.items.filter(item => item.within_budget).map(item => [item.product_id, item.line_cost_eur])).toEqual([[1, 0]])
  expect(plan.value_captured_eur).toBeNull()
})
it.each(['unit_margin_eur', 'value_density'] as const)('rejects invented %s before exposing a producer plan', async field => {
  const raw = structuredClone(producer); Object.assign(raw.items[0], { [field]: 0 })
  vi.mocked(apiRequest).mockResolvedValueOnce(raw)
  await expect(getProducerPlan(7)).rejects.toThrow('cannot produce profit or ROI')
})
it('rejects a fabricated financial objective even when legacy value zero looks harmless', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...budget, value_captured_eur: 0 })
  await expect(getBudgetCartPlan({ budgetEur: budget.budget_eur!, method: 'greedy' })).rejects.toThrow('must remain null')
})

it.each([0, 3])('preserves a zero-demand %s row but refuses its promotion into the budget', async index => {
  const raw = structuredClone(producer), item = raw.items[index]
  item.suggested_qty = 0; item.line_cost_eur = 0; item.budget_priority_weight = 0
  item.cost_provenance.budget_eligible = false
  item.cost_provenance.budget_exclusion_reasons.push('no_positive_suggested_quantity')
  vi.mocked(apiRequest).mockResolvedValueOnce(raw)
  expect((await getProducerPlan(7)).items[index].cost_provenance.budget_eligible).toBe(false)
  item.budget_priority_weight = 1
  vi.mocked(apiRequest).mockResolvedValueOnce(raw)
  await expect(getProducerPlan(7)).rejects.toThrow('budget_priority_weight')
})

it('refuses unexplained blanks and a false certified claim on the full chart context', async () => {
  const raw = structuredClone(producer)
  raw.items[0].line_cost_eur = null
  vi.mocked(apiRequest).mockResolvedValueOnce(raw)
  await expect(getProducerPlan(7)).rejects.toThrow('blank amount must match exact line precision')
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...charts, cost_totals_certified: true })
  await expect(getPurchaseCockpitCharts({ topN: 2 })).rejects.toThrow('manual tax basis cannot certify')
})

it('retains a known unit median when its exact cent extension cannot survive the numeric wire', async () => {
  const raw = structuredClone(producer), item = raw.items[1]
  item.unit_cost_eur = 999999999.0001; item.suggested_qty = 999999.99; item.line_cost_eur = null
  item.cost_provenance.canonical_unit_cost_eur = '999999999.0001'
  item.cost_provenance.budget_eligible = false
  item.cost_provenance.budget_exclusion_reasons = ['line_amount_precision_unsupported']
  vi.mocked(apiRequest).mockResolvedValueOnce(raw)
  const result = (await getProducerPlan(7)).items[1]
  expect(result.unit_cost_eur).toBe(999999999.0001)
  expect(result.line_cost_eur).toBeNull()
  expect(result.cost_provenance.budget_eligible).toBe(false)
})

it.each(['cost_observation_manifest', 'history_scope'])('refuses legacy plans missing %s instead of supplying a fallback', async field => {
  const raw: Record<string, unknown> = structuredClone(producer)
  delete raw[field]
  vi.mocked(apiRequest).mockResolvedValueOnce(raw)
  await expect(getProducerPlan(7)).rejects.toThrow(field)
  expect(raw).not.toHaveProperty(field)
})

it('preserves the smallest positive buyer float and its full invariant decimal without granting receipt eligibility', async () => {
  const raw = structuredClone(producer), item = raw.items[3]
  item.unit_cost_eur = Number.MIN_VALUE; item.line_cost_eur = 0
  item.cost_provenance.canonical_unit_cost_eur = `0.${'0'.repeat(323)}5`
  vi.mocked(apiRequest).mockResolvedValueOnce(raw)
  const result = (await getProducerPlan(7)).items[3]
  expect(result.unit_cost_eur).toBe(Number.MIN_VALUE)
  expect(result.cost_provenance.canonical_unit_cost_eur).toHaveLength(326)
  expect(result.cost_provenance.budget_eligible).toBe(false)
})

it.each([[98, true], [98.0001, false], [0, true], [100, false]])('compares historical alternative %s to base 100 using exact two-percent boundary', async (cost, accepted) => {
  const raw = structuredClone(producer), item = raw.items[1]
  Object.assign(item, { cheaper_alt: { producer_id: 8, cost_eur: cost, comparison_basis: 'historical_net_goods',
    cost_provenance: { ...item.cost_provenance, canonical_unit_cost_eur: cost.toFixed(4) } } })
  vi.mocked(apiRequest).mockResolvedValueOnce(raw)
  const result = getProducerPlan(7)
  if (accepted) expect((await result).items[1].cheaper_alt?.cost_eur).toBe(cost)
  else await expect(result).rejects.toThrow('two percent')
})

it('rejects historical comparisons attached to a buyer-supplied base', async () => {
  const raw = structuredClone(producer)
  Object.assign(raw.items[3], { cheaper_alt: { producer_id: 8, cost_eur: 0, comparison_basis: 'historical_net_goods',
    cost_provenance: raw.items[0].cost_provenance } })
  vi.mocked(apiRequest).mockResolvedValueOnce(raw)
  await expect(getProducerPlan(7)).rejects.toThrow('needs usable receipt costs')
})

it('keeps source-not-ready as an unavailable response with retry guidance, never an empty plan', async () => {
  const failure = Object.assign(new Error('cart_business_data_not_ready'), { status: 503 })
  vi.mocked(apiRequest).mockRejectedValueOnce(failure)
  await expect(getBudgetCartPlan({ budgetEur: 0, method: 'greedy' })).rejects.toBe(failure)
  expect(procurementLoadError(failure, 'fallback', value => value)).toBe('Підтверджені дані для плану поки недоступні. Повторіть запит.')
})

it('rejects a rounded budget echo and a cent spend above the exact fractional ceiling', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...budget, budget_eur: .3 })
  await expect(getBudgetCartPlan({ budgetEur: .2999, method: 'greedy' })).rejects.toThrow('budget_eur')
  const raw = structuredClone(budget)
  raw.budget_eur = .2999; raw.budget_used_eur = .3
  raw.items[0].suggested_qty = 1; raw.items[0].unit_cost_eur = .3; raw.items[0].line_cost_eur = .3
  raw.items[0].cost_provenance.canonical_unit_cost_eur = '0.3000'
  raw.total_suggested_qty = 161; raw.priced_cost_eur = 4440.3
  vi.mocked(apiRequest).mockResolvedValueOnce(raw)
  await expect(getBudgetCartPlan({ budgetEur: .2999, method: 'greedy' })).rejects.toThrow('budget_used_eur')
})
