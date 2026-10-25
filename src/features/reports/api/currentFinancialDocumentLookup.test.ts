import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { searchCurrentFinancialDocuments } from './currentFinancialDocumentLookup'
import { FINANCIAL_DOCUMENT_LOOKUP } from '../data/currentFinancialDocumentFilter'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
const params = { value: ' 42 ', offset: 0, limit: 30 }
const row = (kind = 'sale', id = '9007199254740993') => ({ id: `${kind}:${id}`, name: `Документ ${kind}`, data: JSON.stringify({ kind, id }) })
it('uses the bounded dedicated route and keeps same numeric IDs in different document kinds distinct', async () => {
  const signal = new AbortController().signal; vi.mocked(apiRequest).mockResolvedValue([row(), row('return')])
  expect(await searchCurrentFinancialDocuments('2026-10-16', '2026-10-20', params, signal)).toEqual([
    { Id: 'sale:9007199254740993', Name: 'Документ sale', documentRef: { kind: 'sale', id: '9007199254740993' } },
    { Id: 'return:9007199254740993', Name: 'Документ return', documentRef: { kind: 'return', id: '9007199254740993' } },
  ])
  expect(apiRequest).toHaveBeenCalledExactlyOnceWith(FINANCIAL_DOCUMENT_LOOKUP, { query: {
    from: '2026-10-16', to: '2026-10-20', value: '42', offset: 0, limit: 30,
  }, signal })
})
it.each([[{ ...row(), id: 'return:9007199254740993' }], [row(), row()], [{ ...row(), data: '{"kind":"sale","id":9007199254740993}' }],
  [{ ...row(), data: '{"kind":"sale","id":"42","id":"9007199254740993"}' }], [{ ...row(), name: '' }],
].map(rows => [rows]))('refuses conflicting, duplicate or lossy lookup records %#', async rows => {
  vi.mocked(apiRequest).mockResolvedValue(rows)
  await expect(searchCurrentFinancialDocuments('2026-10-16', '2026-10-16', params)).rejects.toThrow('некоректні або неоднозначні')
})
it.each([['2026-02-30', '2026-03-01'], ['2026-10-20', '2026-10-16'], ['2026-01-01', '2026-03-04']])('refuses invalid or unbounded dates before network %#', async (from, to) => {
  await expect(searchCurrentFinancialDocuments(from, to, params)).rejects.toThrow('період')
  expect(apiRequest).not.toHaveBeenCalled()
})
