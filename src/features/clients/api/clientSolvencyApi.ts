import { apiRequest } from '../../../shared/api/apiClient'
import type { SolvencyCharts, SolvencyScore } from '../solvencyTypes'

export async function getClientSolvencyScore(
  clientNetId: string,
  signal?: AbortSignal,
): Promise<SolvencyScore> {
  return apiRequest<SolvencyScore>('/solvency/get', {
    query: {
      clientNetId,
    },
    ...(signal ? { signal } : {}),
  })
}

export async function getClientSolvencyCharts(
  clientId: number,
  signal?: AbortSignal,
): Promise<SolvencyCharts> {
  return apiRequest<SolvencyCharts>('/solvency/charts', {
    query: {
      clientId,
    },
    ...(signal ? { signal } : {}),
  })
}

export async function getClientSolvencyScoresBatch(
  clientIds: number[],
  signal?: AbortSignal,
): Promise<{ results: SolvencyScore[] }> {
  return apiRequest<{ results: SolvencyScore[] }>('/solvency/scores/batch', {
    method: 'POST',
    body: clientIds,
    ...(signal ? { signal } : {}),
  })
}
