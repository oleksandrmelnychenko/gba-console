import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getAnalysisHierarchyPage, getAnalysisHierarchyStatus } from './currentVparivanieAnalysisApi'
vi.mock('../../../shared/api/apiClient', async original => ({ ...await original<typeof import('../../../shared/api/apiClient')>(), apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
const FOLDER = 'A0000000000000000000000000000001'
const node = (id = `fenix:${FOLDER}`, data = `{"kind":"counterpartyGroup","world":"fenix","id":"${FOLDER}"}`) =>
  ({ id, name: 'Київ', path: 'Покупці / Київ', data, hasChildren: true })

it('reads one lazy folder level with exact typed identities and paths', async () => {
  api.mockResolvedValueOnce({ kind: 'counterpartyGroup', parentId: 'fenix:8AB2005056C0000811DEFC4535BB4D40', items: [node()], hasMore: false })
  const page = await getAnalysisHierarchyPage('counterpartyGroup', 'fenix:8AB2005056C0000811DEFC4535BB4D40', 0, 50, '')
  expect(api).toHaveBeenCalledWith('/report/datasets/current-vparivanie/analysis/hierarchy', expect.objectContaining({
    query: { kind: 'counterpartyGroup', parentId: 'fenix:8AB2005056C0000811DEFC4535BB4D40', offset: 0, limit: 50, value: '' } }))
  expect(page.items).toEqual([{ id: `fenix:${FOLDER}`, name: 'Київ', path: 'Покупці / Київ', hasChildren: true,
    data: { kind: 'counterpartyGroup', world: 'fenix', id: FOLDER } }])
})

it.each([
  [{ kind: 'warehouseGroup', parentId: null, items: [node()], hasMore: false }],
  [{ kind: 'counterpartyGroup', parentId: 'fenix:x', items: [node()], hasMore: false }],
  [{ kind: 'counterpartyGroup', parentId: null, items: [node('fenix:XYZ')], hasMore: false }],
  [{ kind: 'counterpartyGroup', parentId: null, items: [node(`amg:${FOLDER}`)], hasMore: false }],
  [{ kind: 'counterpartyGroup', parentId: null, items: [node(undefined, `{"kind":"counterpartyGroup","world":"fenix","id":"${FOLDER}","x":1}`)], hasMore: false }],
  [{ kind: 'counterpartyGroup', parentId: null, items: [node(), node()], hasMore: false }],
  [{ kind: 'counterpartyGroup', parentId: null, items: [], hasMore: true }],
])('refuses an inconsistent hierarchy page %#', async body => {
  api.mockResolvedValueOnce(body)
  await expect(getAnalysisHierarchyPage('counterpartyGroup', null, 0, 50, '')).rejects.toThrow()
})

it('maps the hierarchy status to per-kind reasons and refuses malformed status', async () => {
  api.mockResolvedValueOnce({ version: 1, kinds: [
    { kind: 'productGroup', available: true, unavailabilityReason: null },
    { kind: 'counterpartyGroup', available: true, unavailabilityReason: null },
    { kind: 'warehouseGroup', available: false, unavailabilityReason: 'Папки складів ще не захоплені.' }] })
  expect(await getAnalysisHierarchyStatus()).toEqual({ productGroup: null, counterpartyGroup: null, warehouseGroup: 'Папки складів ще не захоплені.' })
  expect(api).toHaveBeenCalledWith('/report/datasets/current-vparivanie/analysis/hierarchy-status', expect.anything())
  api.mockResolvedValueOnce({ version: 1, kinds: [{ kind: 'warehouseGroup', available: false, unavailabilityReason: null }] })
  await expect(getAnalysisHierarchyStatus()).rejects.toThrow()
  api.mockResolvedValueOnce({ version: 2, kinds: [] })
  await expect(getAnalysisHierarchyStatus()).rejects.toThrow()
})
