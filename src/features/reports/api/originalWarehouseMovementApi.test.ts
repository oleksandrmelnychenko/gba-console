import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getMovementCapability, getMovementPublications, readMovement } from './originalWarehouseMovementApi'
import { movementCapability } from '../data/originalWarehouseMovement.test-fixtures'
import { normalizeMovementPublications, type MovementRequest } from '../data/originalWarehouseMovement'
import publications from '../data/originalWarehouseMovement.publications.http-fixture.json'
import result from '../data/originalWarehouseMovement.nonzero.http-fixture.json'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
it('uses existing report permission routes and validates actual serializer response before returning it', async () => {
  const signal = new AbortController().signal
  vi.mocked(apiRequest).mockResolvedValueOnce(movementCapability).mockResolvedValueOnce(publications).mockResolvedValueOnce(result)
  expect(await getMovementCapability(signal)).toEqual(movementCapability)
  const scopes = await getMovementPublications(signal)
  const request: MovementRequest = { Version: 1, World: 'fenix', From: result.scope.from, Through: result.scope.through, Article: result.scope.article, Warehouses: result.scope.warehouses }
  expect((await readMovement(request, scopes[0], signal)).Totals?.Closing).toBe('25.000')
  expect(apiRequest).toHaveBeenNthCalledWith(1, '/report/originals/warehouse-movement/capabilities?world=fenix', { signal })
  expect(apiRequest).toHaveBeenNthCalledWith(2, '/report/originals/warehouse-movement/publications', { signal })
  expect(apiRequest).toHaveBeenNthCalledWith(3, '/report/originals/warehouse-movement/preview', { method: 'POST', body: request, signal, dedupe: false })
})
it('rejects stale publication capture and unsupported source capability', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...movementCapability, World: 'amg' })
  await expect(getMovementCapability()).rejects.toThrow()
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...result, capture: { ...result.capture, manifestSha256: 'b'.repeat(64) } })
  const request: MovementRequest = { Version: 1, World: 'fenix', From: result.scope.from, Through: result.scope.through, Article: result.scope.article, Warehouses: result.scope.warehouses }
  await expect(readMovement(request, normalizeMovementPublications(publications)[0])).rejects.toThrow()
})
