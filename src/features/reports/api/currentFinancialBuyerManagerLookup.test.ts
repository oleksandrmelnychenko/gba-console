import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { searchCurrentFinancialBuyerManagers } from './currentFinancialBuyerManagerLookup'
import { FINANCIAL_BUYER_MANAGER_LOOKUP } from '../data/currentFinancialBuyerManagerFilter'
import { managerId, unassignedManagerId } from '../data/currentFinancialBuyerManagerFilter.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
const params = { value: '  Менеджер  ', offset: 0, limit: 30 }
const row = (id = managerId, name = 'Менеджер [42]') => ({ id, name, data: JSON.stringify({ Id: id }) })
it('uses directory lookup without dates and preserves exact SQL bytes plus server-provided unassigned', async () => {
  const signal = new AbortController().signal
  vi.mocked(apiRequest).mockResolvedValue([row(), row(unassignedManagerId, 'Без основного менеджера покупця')])
  expect(await searchCurrentFinancialBuyerManagers(params, signal)).toEqual([
    { Id: managerId, Name: 'Менеджер [42]', buyerManagerRef: { Id: managerId } },
    { Id: unassignedManagerId, Name: 'Без основного менеджера покупця', buyerManagerRef: { Id: unassignedManagerId } },
  ])
  expect(apiRequest).toHaveBeenCalledExactlyOnceWith(FINANCIAL_BUYER_MANAGER_LOOKUP, { query: { value: 'Менеджер', offset: 0, limit: 30 }, signal })
})
it.each([[row(), row()], [{ ...row(), id: managerId.toLowerCase() }], [{ ...row(), data: JSON.stringify({ Id: unassignedManagerId }) }],
  [{ ...row(), data: JSON.stringify({ Id: managerId, Name: 'wrapper' }) }], [{ ...row(), name: '' }], [{ ...row(), data: { Id: managerId } }],
].map(rows => [rows]))('refuses ambiguous, mismatched or noncanonical lookup DTO %#', async rows => {
  vi.mocked(apiRequest).mockResolvedValue(rows)
  await expect(searchCurrentFinancialBuyerManagers(params)).rejects.toThrow('некоректних або неоднозначних')
})
it.each([{ ...params, limit: 51 }, { ...params, offset: -1 }, { ...params, offset: 10001 }, { ...params, value: 'x'.repeat(121) }])('rejects unbounded searches before network %#', async invalid => {
  await expect(searchCurrentFinancialBuyerManagers(invalid)).rejects.toThrow('пошук')
  expect(apiRequest).not.toHaveBeenCalled()
})

it('does not invent unassigned when the directory has no matching row', async () => {
  vi.mocked(apiRequest).mockResolvedValue([])
  await expect(searchCurrentFinancialBuyerManagers(params)).resolves.toEqual([])
})
