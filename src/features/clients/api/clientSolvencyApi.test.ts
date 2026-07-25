import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  getClientSolvencyCharts,
  getClientSolvencyScore,
  getClientSolvencyScoresBatch,
  SolvencyContractError,
} from './clientSolvencyApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)
const CLIENT_NET_ID = '11111111-1111-1111-1111-111111111111'

function score(clientId = 42, clientNetUid: string | null = CLIENT_NET_ID) {
  return {
    client_id: clientId,
    client_net_uid: clientNetUid,
    applicable: true,
    score: 80,
    rating: 'B',
    pd: 0.2,
    contributions: [{ feature: 'turnover_eur_12mo', value: 1234.56, points: -2.4 }],
    forward_risk: { band: 'low', pd: 0.1 },
    forward_risk_status: 'available',
    forward_risk_reason: null,
    sub_factors: null,
    caps_applied: [],
    debt_load_source: null,
    raw_score: 80,
    currency_breakdown: [
      { currency_id: 1, turnover_eur: 1234.56, exposure_eur: 100.01 },
    ],
    data_sufficiency: 'ok',
    data_sufficiency_reason: null,
    source_history_start: '2025-01-01',
    effective_start: '2025-07-25',
    history_complete: true,
    as_of_date: '2026-07-25',
    window_months: 12,
    model_version: 'creditscore-v3',
  }
}

describe('clientSolvencyApi canonical AI contract', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('requires the single-score response to echo the requested NetUID', async () => {
    apiRequestMock.mockResolvedValueOnce(score())

    await expect(getClientSolvencyScore(CLIENT_NET_ID)).resolves.toMatchObject({
      client_id: 42,
      client_net_uid: CLIENT_NET_ID,
      currency_breakdown: [
        { currency_id: 1, turnover_eur: 1234.56, exposure_eur: 100.01 },
      ],
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/solvency/get', {
      query: { clientNetId: CLIENT_NET_ID },
    })

    apiRequestMock.mockResolvedValueOnce(score(42, '22222222-2222-2222-2222-222222222222'))
    await expect(getClientSolvencyScore(CLIENT_NET_ID)).rejects.toBeInstanceOf(SolvencyContractError)
  })

  it('validates exact batch counts, complete identity partition, and cent money', async () => {
    apiRequestMock.mockResolvedValueOnce({
      results: [score(42, null)],
      errors: [{ client_id: 43, error: 'not_a_buyer' }],
      count: 1,
      failed: 1,
    })

    await expect(getClientSolvencyScoresBatch([42, 43])).resolves.toMatchObject({
      count: 1,
      failed: 1,
      results: [{ client_id: 42, client_net_uid: null }],
      errors: [{ client_id: 43, error: 'not_a_buyer' }],
    })

    const fractionalMoney = score(42, null)
    fractionalMoney.currency_breakdown[0].turnover_eur = 1.001
    apiRequestMock.mockResolvedValueOnce({
      results: [fractionalMoney],
      errors: [],
      count: 1,
      failed: 0,
    })
    await expect(getClientSolvencyScoresBatch([42])).rejects.toBeInstanceOf(SolvencyContractError)

    apiRequestMock.mockResolvedValueOnce({
      results: [score(42, null)],
      errors: [],
      count: 0,
      failed: 0,
    })
    await expect(getClientSolvencyScoresBatch([42])).rejects.toBeInstanceOf(SolvencyContractError)
  })

  it('keeps chart money at cents and proves both turnover timelines are identical', async () => {
    apiRequestMock.mockResolvedValueOnce({
      client_id: 42,
      applicable: true,
      limit_utilization_gauge: {
        value: 0.5,
        threshold_soft: 0.9,
        threshold_hard: 1,
        label: 'limit_utilization',
      },
      payment_discipline_donut: [],
      open_invoice_aging_bars: [{ bucket: '0-30', count: 1, amount_eur: 10.01 }],
      turnover_vs_exposure: [{ period: '2026-06', turnover_eur: 100.01, exposure_eur: 10.01 }],
      score_sparkline: [],
      turnover_trend: [{ period: '2026-06', turnover_eur: 100.01 }],
      aging_over_time_heatmap: 'pending',
      source_history_start: '2025-01-01',
      effective_start: '2025-07-25',
      history_complete: true,
      as_of_date: '2026-07-25',
      window_months: 12,
      model_version: 'creditscore-v3',
    })

    await expect(getClientSolvencyCharts(42)).resolves.toMatchObject({
      client_id: 42,
      turnover_vs_exposure: [{ period: '2026-06', turnover_eur: 100.01, exposure_eur: 10.01 }],
      turnover_trend: [{ period: '2026-06', turnover_eur: 100.01 }],
    })
  })

  it('rejects inverted or malformed history coverage metadata', async () => {
    apiRequestMock.mockResolvedValueOnce({
      ...score(),
      effective_start: '2024-12-31',
    })
    await expect(getClientSolvencyScore(CLIENT_NET_ID)).rejects.toBeInstanceOf(
      SolvencyContractError,
    )

    apiRequestMock.mockResolvedValueOnce({
      ...score(),
      source_history_start: '2025-02-31',
    })
    await expect(getClientSolvencyScore(CLIENT_NET_ID)).rejects.toBeInstanceOf(
      SolvencyContractError,
    )
  })

  it('rejects a fabricated score when data is insufficient', async () => {
    apiRequestMock.mockResolvedValueOnce({
      ...score(),
      data_sufficiency: 'insufficient',
    })

    await expect(getClientSolvencyScore(CLIENT_NET_ID)).rejects.toBeInstanceOf(
      SolvencyContractError,
    )
  })

  it('requires an explicit reason when the 6-month model returns no risk', async () => {
    apiRequestMock.mockResolvedValueOnce({
      ...score(),
      forward_risk: null,
      forward_risk_status: 'model_unavailable',
      forward_risk_reason: null,
    })

    await expect(getClientSolvencyScore(CLIENT_NET_ID)).rejects.toBeInstanceOf(
      SolvencyContractError,
    )
  })
})
