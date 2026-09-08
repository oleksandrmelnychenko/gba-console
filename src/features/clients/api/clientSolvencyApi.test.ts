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
    risk_90d: {
      horizon_days: 90,
      threshold_days: 90,
      band: 'medium',
      exposure_eur: 100.01,
      reason_code: 'current_debt',
    },
    forward_risk: null,
    forward_risk_status: 'not_applicable',
    forward_risk_reason: 'replaced_by_operational_90d',
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
    state_basis: 'current_observation',
    business_timezone: 'Europe/Kyiv',
    fx_date: '2026-07-25',
    window_months: 12,
    model_version: 'creditscore-v3',
  }
}

function charts() {
  return {
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
      score_sparkline_status: 'unavailable',
      score_sparkline_reason_code: 'historical_state_not_recorded',
      score_sparkline_reason: 'Історію оцінки не збережено. Поточні борги та умови договорів не відновлюють стан минулих місяців.',
      turnover_trend: [{ period: '2026-06', turnover_eur: 100.01 }],
      aging_over_time_heatmap: 'pending',
      source_history_start: '2025-01-01',
      effective_start: '2025-07-25',
      history_complete: true,
      as_of_date: '2026-07-25',
    state_basis: 'current_observation',
    business_timezone: 'Europe/Kyiv',
    fx_date: '2026-07-25',
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

  it('accepts the canonical client NetUID in a batch score', async () => {
    apiRequestMock.mockResolvedValueOnce({
      results: [score()],
      errors: [],
      count: 1,
      failed: 0,
    })

    await expect(getClientSolvencyScoresBatch([42])).resolves.toMatchObject({
      results: [{ client_id: 42, client_net_uid: CLIENT_NET_ID }],
    })
  })

  it('keeps chart money at cents and proves both turnover timelines are identical', async () => {
    apiRequestMock.mockResolvedValueOnce(charts())

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

  it('rejects a 90-day control whose band and monetary proof disagree', async () => {
    apiRequestMock.mockResolvedValueOnce({
      ...score(),
      risk_90d: {
        horizon_days: 90,
        threshold_days: 90,
        band: 'high',
        exposure_eur: 99.99,
        reason_code: 'will_cross_90_days',
      },
    })

    await expect(getClientSolvencyScore(CLIENT_NET_ID)).rejects.toBeInstanceOf(
      SolvencyContractError,
    )
  })
})


describe('current observation proof for every serving response', () => {
  beforeEach(() => apiRequestMock.mockReset())

  const invalidMetadata = [
    ['missing state basis', 'state_basis', undefined],
    ['historical state claim', 'state_basis', 'historical_snapshot'],
    ['missing timezone', 'business_timezone', undefined],
    ['different timezone', 'business_timezone', 'UTC'],
    ['legacy timezone alias', 'business_timezone', 'Europe/Kiev'],
    ['missing FX day', 'fx_date', undefined],
    ['different FX day', 'fx_date', '2026-07-24'],
    ['impossible FX day', 'fx_date', '2026-02-30'],
    ['timestamp FX value', 'fx_date', '2026-07-25T00:00:00Z'],
    ['missing observation day', 'as_of_date', undefined],
    ['null observation day', 'as_of_date', null],
    ['timestamp observation day', 'as_of_date', '2026-07-25T00:00:00Z'],
  ] as const

  it.each(invalidMetadata)('rejects %s in score, charts, and batch without repairing input', async (_label, field, value) => {
    const badScore: Record<string, unknown> = { ...score(), [field]: value }
    const badCharts: Record<string, unknown> = { ...charts(), [field]: value }
    if (value === undefined) {
      delete badScore[field]
      delete badCharts[field]
    }
    const original = structuredClone(badScore)
    apiRequestMock.mockResolvedValueOnce(badScore)
    await expect(getClientSolvencyScore(CLIENT_NET_ID)).rejects.toBeInstanceOf(SolvencyContractError)
    expect(badScore).toEqual(original)
    apiRequestMock.mockResolvedValueOnce(badCharts)
    await expect(getClientSolvencyCharts(42)).rejects.toBeInstanceOf(SolvencyContractError)
    apiRequestMock.mockResolvedValueOnce({ results: [badScore], errors: [], count: 1, failed: 0 })
    await expect(getClientSolvencyScoresBatch([42])).rejects.toBeInstanceOf(SolvencyContractError)
  })

  it('accepts a captured day independently of the browser clock, including true score zero', async () => {
    apiRequestMock.mockResolvedValueOnce({ ...score(), score: 0, rating: 'D', pd: 1, raw_score: 0 })
    await expect(getClientSolvencyScore(CLIENT_NET_ID)).resolves.toMatchObject({
      score: 0, as_of_date: '2026-07-25', fx_date: '2026-07-25', window_months: 12,
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/solvency/get', { query: { clientNetId: CLIENT_NET_ID } })
  })

  it.each([undefined, null, 0, 1, 11, 13, 60, 12.5, '12', true])('rejects score window %s, including batch', async (windowMonths) => {
    const value = { ...score(), window_months: windowMonths }
    apiRequestMock.mockResolvedValueOnce(value)
    await expect(getClientSolvencyScore(CLIENT_NET_ID)).rejects.toThrow('window_months')
    apiRequestMock.mockResolvedValueOnce({ results: [value], errors: [], count: 1, failed: 0 })
    await expect(getClientSolvencyScoresBatch([42])).rejects.toThrow('window_months')
  })

  it.each([1, 12, 60])('accepts chart transaction window %i without fabricating history', async (windowMonths) => {
    apiRequestMock.mockResolvedValueOnce({ ...charts(), window_months: windowMonths })
    await expect(getClientSolvencyCharts(42)).resolves.toMatchObject({ window_months: windowMonths, score_sparkline: [] })
    expect(apiRequestMock).toHaveBeenCalledWith('/solvency/charts', { query: { clientId: 42 } })
  })

  it.each([undefined, null, 0, -1, 61, 1.5, '12', true])('rejects chart transaction window %s', async (windowMonths) => {
    apiRequestMock.mockResolvedValueOnce({ ...charts(), window_months: windowMonths })
    await expect(getClientSolvencyCharts(42)).rejects.toThrow('window_months')
  })

  it.each([
    { score_sparkline: [{ period: '2026-06', score: 80 }] },
    { score_sparkline: [null] },
    { score_sparkline: undefined },
    { score_sparkline: null },
    { score_sparkline_status: undefined },
    { score_sparkline_status: 'available' },
    { score_sparkline_status: 'not_applicable' },
    { score_sparkline_reason_code: undefined },
    { score_sparkline_reason_code: 'client_not_buyer' },
    { score_sparkline_reason: undefined },
    { score_sparkline_reason: '   ' },
    { applicable: undefined },
    { applicable: 'true' },
    { applicable: false },
  ])('rejects unsupported history metadata %j without stripping the original series', async (overrides) => {
    const payload = { ...charts(), ...overrides }
    const original = structuredClone(payload)
    apiRequestMock.mockResolvedValueOnce(payload)
    await expect(getClientSolvencyCharts(42)).rejects.toBeInstanceOf(SolvencyContractError)
    expect(payload).toEqual(original)
  })

  it('accepts exact unavailable and nonbuyer pairs and retains the producer explanation', async () => {
    apiRequestMock.mockResolvedValueOnce(charts())
    await expect(getClientSolvencyCharts(42)).resolves.toMatchObject({
      applicable: true, score_sparkline: [], score_sparkline_status: 'unavailable',
      score_sparkline_reason_code: 'historical_state_not_recorded', score_sparkline_reason: charts().score_sparkline_reason,
    })
    const nonBuyer = {
      ...charts(), applicable: false, score_sparkline_status: 'not_applicable',
      score_sparkline_reason_code: 'client_not_buyer',
      score_sparkline_reason: 'Оцінка не застосовується: клієнт не має ролі покупця.',
    }
    apiRequestMock.mockResolvedValueOnce(nonBuyer)
    await expect(getClientSolvencyCharts(42)).resolves.toMatchObject(nonBuyer)
    apiRequestMock.mockResolvedValueOnce({ ...nonBuyer, score_sparkline: [{ period: '2026-06', score: 0 }] })
    await expect(getClientSolvencyCharts(42)).rejects.toThrow('score_sparkline')
  })

  it.each([true, false])('keeps null scores for insufficient/nonbuyer state (buyer %s)', async (applicable) => {
    apiRequestMock.mockResolvedValueOnce({
      ...score(), applicable, data_sufficiency: 'insufficient', score: null, rating: null,
      pd: null, raw_score: null, contributions: null, risk_90d: null, currency_breakdown: null,
    })
    await expect(getClientSolvencyScore(CLIENT_NET_ID)).resolves.toMatchObject({ applicable, score: null, pd: null, window_months: 12 })
  })
})
