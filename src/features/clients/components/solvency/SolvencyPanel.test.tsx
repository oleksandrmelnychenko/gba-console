import { MantineProvider } from '@mantine/core'
import { render, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import type { SolvencyCharts, SolvencyScore } from '../../solvencyTypes'

const getClientSolvencyScore = vi.fn()
const getClientSolvencyCharts = vi.fn()

vi.mock('../../api/clientSolvencyApi', () => ({
  getClientSolvencyScore: (...args: unknown[]) => getClientSolvencyScore(...args),
  getClientSolvencyCharts: (...args: unknown[]) => getClientSolvencyCharts(...args),
}))

import { SolvencyPanel } from './SolvencyPanel'

function renderPanel(ui: ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MantineProvider theme={theme}>
        <I18nProvider>{children}</I18nProvider>
      </MantineProvider>
    ),
  })
}

const notApplicableScore: SolvencyScore = {
  client_id: 7,
  client_net_uid: null,
  applicable: false,
  score: null,
  rating: null,
  risk_90d: null,
  forward_risk_status: 'not_applicable',
  forward_risk_reason: 'client has no buyer role',
  sub_factors: null,
  caps_applied: [],
  debt_load_source: 'debt_table',
  raw_score: null,
  currency_breakdown: null,
  source_history_start: '2025-01-01',
  effective_start: '2025-01-01',
  history_complete: false,
  as_of_date: '2025-01-01',
  state_basis: 'current_observation',
  business_timezone: 'Europe/Kyiv',
  fx_date: '2025-01-01',
  window_months: 12,
  model_version: 'v1',
}

const v3Score: SolvencyScore = {
  client_id: 411780,
  client_net_uid: '11111111-1111-1111-1111-111111111111',
  applicable: true,
  score: 46,
  rating: 'D',
  pd: 0.649,
  contributions: [
    { feature: 'n_open_debt_lines', value: 3, points: 3.77 },
    { feature: 'months_with_debt_last12', value: 12, points: 1.02 },
    { feature: 'turnover_eur_12mo', value: 90000, points: -2.4 },
    { feature: 'overdue_eur_180plus', value: 0, points: 0 },
  ],
  risk_90d: {
    horizon_days: 90,
    threshold_days: 90,
    band: 'critical',
    exposure_eur: 12345.67,
    reason_code: 'already_90_plus',
  },
  forward_risk: null,
  forward_risk_status: 'not_applicable',
  forward_risk_reason: 'replaced_by_operational_90d',
  sub_factors: null,
  caps_applied: [],
  debt_load_source: null,
  raw_score: null,
  currency_breakdown: null,
  source_history_start: '2025-01-01',
  effective_start: '2025-06-25',
  history_complete: true,
  as_of_date: '2026-06-25',
  state_basis: 'current_observation',
  business_timezone: 'Europe/Kyiv',
  fx_date: '2026-06-25',
  window_months: 12,
  model_version: 'creditscore-v3',
}

afterEach(() => {
  getClientSolvencyScore.mockReset()
  getClientSolvencyCharts.mockReset()
})

describe('SolvencyPanel', () => {
  it('renders the not-a-buyer N/A state and no charts when applicable is false', async () => {
    getClientSolvencyScore.mockResolvedValue(notApplicableScore)
    getClientSolvencyCharts.mockResolvedValue(null)

    const { findByText, container } = renderPanel(<SolvencyPanel clientNetId="abc" />)

    expect(await findByText(/не покупець/i)).toBeTruthy()

    await waitFor(() => {
      expect(container.querySelector('.mantine-RingProgress-root')).toBeNull()
    })
    expect(getClientSolvencyCharts).not.toHaveBeenCalled()
  })

  it('renders the v3 score, contributions and exact 90-day debt control', async () => {
    getClientSolvencyScore.mockResolvedValue(v3Score)
    getClientSolvencyCharts.mockRejectedValue(new Error('no charts'))

    const { findByText, queryByText } = renderPanel(<SolvencyPanel clientNetId="abc" />)

    // does NOT fall into the not-a-buyer N/A state
    expect(queryByText(/не покупець/i)).toBeNull()
    // score gauge value, band, a contribution label and the operational debt control are present
    expect(await findByText('46')).toBeTruthy()
    expect(await findByText(/Відкритих боргових позицій/i)).toBeTruthy()
    expect(await findByText(/критичний/i)).toBeTruthy()
    expect(await findByText(/Борг уже прострочений понад 90 днів/i)).toBeTruthy()
    expect(await findByText(/12.*345,67 EUR/i)).toBeTruthy()
    // Current-state PD remains; the retired forward PD is no longer shown.
    expect(await findByText(/PD 64,9\s%/)).toBeTruthy()
    expect(queryByText(/99\.7%/)).toBeNull()
  })

  it('explains a policy rating and does not repeat its code as a cap badge', async () => {
    getClientSolvencyScore.mockResolvedValue({
      ...v3Score,
      score: 0,
      rating: 'D',
      pd: 1,
      contributions: [],
      caps_applied: ['hopeless_debt_role'],
      policy_reason_code: 'hopeless_debt_role',
      policy_reason: 'Клієнт у групі безнадійної заборгованості',
    })
    getClientSolvencyCharts.mockRejectedValue(new Error('no charts'))

    const { findByText, queryByText } = renderPanel(<SolvencyPanel clientNetId="abc" />)

    expect(await findByText('Клієнт у групі безнадійної заборгованості')).toBeTruthy()
    expect(await findByText('D')).toBeTruthy()
    expect(queryByText('hopeless_debt_role')).toBeNull()
  })

  it('shows source-bounded insufficient data and does not request charts', async () => {
    getClientSolvencyScore.mockResolvedValue({
      ...v3Score,
      score: null,
      rating: null,
      pd: null,
      contributions: null,
      risk_90d: null,
      forward_risk: null,
      forward_risk_status: 'not_applicable',
      forward_risk_reason: 'no available evidence',
      data_sufficiency: 'insufficient',
      data_sufficiency_reason: 'no available evidence',
    })

    const { findByText, queryByText } = renderPanel(
      <SolvencyPanel clientNetId="abc" />,
    )

    expect(await findByText(/Недостатньо даних для оцінки/i)).toBeTruthy()
    expect(await findByText(/01\.01\.2025/)).toBeTruthy()
    expect(queryByText('46')).toBeNull()
    expect(getClientSolvencyCharts).not.toHaveBeenCalled()
  })

  it('shows a clear fallback while 90-day control is not calculated', async () => {
    getClientSolvencyScore.mockResolvedValue({
      ...v3Score,
      risk_90d: null,
    })
    getClientSolvencyCharts.mockRejectedValue(new Error('no charts'))

    const { findByText } = renderPanel(<SolvencyPanel clientNetId="abc" />)

    expect(await findByText(/контроль ще не розрахований/i)).toBeTruthy()
  })

  it('color-codes risk-increasing vs risk-reducing contributions by sign and drops zero-point ones', async () => {
    getClientSolvencyScore.mockResolvedValue(v3Score)
    getClientSolvencyCharts.mockRejectedValue(new Error('no charts'))

    const { findByText, queryByText } = renderPanel(<SolvencyPanel clientNetId="abc" />)

    // risk-reducing (negative points) renders as a signed value without a leading '+'
    const reducing = await findByText('-2,4')
    expect(reducing).toBeTruthy()
    // risk-increasing (positive points) keeps the leading '+'
    expect(await findByText('+3,8')).toBeTruthy()
    // zero-point contribution is filtered out of the drivers list
    expect(queryByText(/Прострочено 180\+ днів/i)).toBeNull()
  })
})


describe('current-state display', () => {
  const explanation = 'Історію оцінки не збережено. Поточні борги та умови договорів не відновлюють стан минулих місяців.'
  const currentCharts: SolvencyCharts = {
    client_id: v3Score.client_id,
    applicable: true,
    state_basis: 'current_observation',
    business_timezone: 'Europe/Kyiv',
    as_of_date: v3Score.as_of_date,
    fx_date: v3Score.fx_date,
    window_months: 12,
    source_history_start: v3Score.source_history_start,
    effective_start: v3Score.effective_start,
    history_complete: true,
    model_version: v3Score.model_version,
    limit_utilization_gauge: { value: 0, threshold_soft: 0.9, threshold_hard: 1, label: 'limit_utilization' },
    payment_discipline_donut: [],
    open_invoice_aging_bars: [],
    turnover_vs_exposure: [],
    turnover_trend: [],
    score_sparkline: [],
    score_sparkline_status: 'unavailable',
    score_sparkline_reason_code: 'historical_state_not_recorded',
    score_sparkline_reason: explanation,
    aging_over_time_heatmap: 'pending',
  }

  it.each([0, 46])('shows true score %i and the explicit history reason without technical metadata or a sparkline', async (value) => {
    getClientSolvencyScore.mockResolvedValue({ ...v3Score, score: value })
    getClientSolvencyCharts.mockResolvedValue(currentCharts)
    const { findByText, queryByText, container } = renderPanel(<SolvencyPanel clientNetId="abc" />)
    expect(await findByText(String(value))).toBeTruthy()
    expect(await findByText(explanation)).toBeTruthy()
    expect(queryByText(/Оцінка за поточними записами станом на/)).toBeNull()
    expect(queryByText(/Версія моделі/)).toBeNull()
    expect(queryByText(/Курс валют на/)).toBeNull()
    expect(await findByText(/Вікно операцій.*12/)).toBeTruthy()
    expect(await findByText('0 %')).toBeTruthy()
    expect(container.querySelector('.mantine-Sparkline-root')).toBeNull()
  })

  function gaugeCharts(gauge: SolvencyCharts['limit_utilization_gauge']): SolvencyCharts {
    return { ...currentCharts, limit_utilization_gauge: gauge }
  }

  async function renderGauge(gauge: SolvencyCharts['limit_utilization_gauge']) {
    getClientSolvencyScore.mockResolvedValue(v3Score)
    getClientSolvencyCharts.mockResolvedValue(gaugeCharts(gauge))
    const view = renderPanel(<SolvencyPanel clientNetId="abc" />)
    await view.findByText('Використання ліміту', { selector: '.client-section-title' })
    return view
  }

  it('shows «Ліміт не встановлено» instead of a percent when the client has no credit limit', async () => {
    const { getByText, queryByText, queryByRole } = await renderGauge({
      value: null, status: 'no_limit', debt_amount: null, limit_amount: null, currency_id: null,
      threshold_soft: 0.9, threshold_hard: 1, label: 'no_credit_limit',
    })
    expect(getByText('Ліміт не встановлено')).toBeTruthy()
    expect(queryByText(/^\d+(,\d)?\s%$/)).toBeNull()
    expect(queryByText(/Поріг/)).toBeNull()
    expect(queryByRole('progressbar', { name: 'Використання ліміту' })).toBeNull()
  })

  it('keeps the not-applicable wording when the gauge is not applicable', async () => {
    const { container, queryByText, queryByRole } = await renderGauge({
      value: null, status: 'not_applicable', threshold_soft: 0.9, threshold_hard: 1, label: 'limit_utilization',
    })
    expect(container.querySelector('[data-gauge-state="not_applicable"]')?.textContent)
      .toBe('не покупець — оцінка платоспроможності незастосовна')
    expect(queryByText('Ліміт не встановлено')).toBeNull()
    expect(queryByRole('progressbar', { name: 'Використання ліміту' })).toBeNull()
  })

  it('prints the real over-limit percent in the over-limit colour and caps the bar at 100', async () => {
    const { container, getByText, getByRole } = await renderGauge({
      value: 4.4, status: 'ok', debt_amount: 44000.5, limit_amount: 10000, currency_id: 2,
      threshold_soft: 0.9, threshold_hard: 1, label: 'limit_utilization',
    })
    const percent = getByText('440 %')
    expect(percent.getAttribute('data-gauge-zone')).toBe('over')
    expect(percent.style.getPropertyValue('--text-color') || percent.getAttribute('style')).toContain('orange')
    expect(getByRole('progressbar', { name: 'Використання ліміту' }).getAttribute('aria-valuenow')).toBe('100')
    expect(container.querySelector('.client-solvency-gauge-debt')?.textContent?.replace(/\s/g, ' '))
      .toBe('борг 44 000,50 із ліміту 10 000,00')
  })

  it('formats a regular percent with at most one decimal and no over-limit colour', async () => {
    const { container, getByText, getByRole } = await renderGauge({
      value: 0.4567, status: 'ok', debt_amount: 456.7, limit_amount: 1000, currency_id: 2,
      threshold_soft: 0.9, threshold_hard: 1, label: 'limit_utilization',
    })
    const percent = getByText('45,7 %')
    expect(percent.getAttribute('data-gauge-zone')).toBe('green')
    expect(percent.getAttribute('style') ?? '').not.toContain('orange')
    expect(getByRole('progressbar', { name: 'Використання ліміту' }).getAttribute('aria-valuenow')).toBe('45.67')
    expect(container.querySelector('.client-solvency-gauge-debt')?.textContent?.replace(/\s/g, ' '))
      .toBe('борг 456,70 із ліміту 1 000,00')
  })

  it('names the agreement currency on the debt line when the client agreements resolve it', async () => {
    getClientSolvencyScore.mockResolvedValue(v3Score)
    getClientSolvencyCharts.mockResolvedValue(gaugeCharts({
      value: 0.541, status: 'ok', debt_amount: 5410.21, limit_amount: 10000, currency_id: 2,
      threshold_soft: 0.9, threshold_hard: 1, label: 'limit_utilization',
    }))
    const { container, findByText } = renderPanel(<SolvencyPanel clientNetId="abc" currencyCodes={{ 2: 'UAH' }} />)
    await findByText('Використання ліміту', { selector: '.client-section-title' })
    expect(container.querySelector('.client-solvency-gauge-debt')?.textContent?.replace(/\s/g, ' '))
      .toBe('борг 5 410,21 UAH із ліміту 10 000,00 UAH')
  })

  it('shows the percent without a debt line when an older server omits the new fields', async () => {
    const { container, getByText } = await renderGauge({
      value: 0.5, threshold_soft: 0.9, threshold_hard: 1, label: 'limit_utilization',
    })
    expect(getByText('50 %')).toBeTruthy()
    expect(getByText(/Поріг/).textContent).toBe('Поріг: 90\u00a0% / 100\u00a0%')
    expect(container.querySelector('.client-solvency-gauge-debt')).toBeNull()
  })

  it('shows a dash, not 0 %, when an older server sends a null value without a status', async () => {
    const { container, queryByText } = await renderGauge({
      value: null, threshold_soft: 0.9, threshold_hard: 1, label: 'limit_utilization',
    })
    expect(container.querySelector('[data-gauge-state="unknown"]')?.textContent).toBe('—')
    expect(queryByText('0 %')).toBeNull()
    expect(queryByText('Ліміт не встановлено')).toBeNull()
  })

  it('reads the no-limit label from an older server that drops the status', async () => {
    const { getByText, queryByText } = await renderGauge({
      value: null, threshold_soft: 0.9, threshold_hard: 1, label: 'no_credit_limit',
    })
    expect(getByText('Ліміт не встановлено')).toBeTruthy()
    expect(queryByText('0 %')).toBeNull()
  })

  it('keeps a valid current score when chart contract fails and does not repair history for display', async () => {
    getClientSolvencyScore.mockResolvedValue(v3Score)
    getClientSolvencyCharts.mockRejectedValue(new Error('Некоректна відповідь AI Solvency (charts.score_sparkline): historical scores are not recorded'))
    const { findByText, queryByText, container } = renderPanel(<SolvencyPanel clientNetId="abc" />)
    expect(await findByText('46')).toBeTruthy()
    expect(await findByText('Графіки платоспроможності недоступні. Спробуйте пізніше.')).toBeTruthy()
    expect(queryByText(explanation)).toBeNull()
    expect(container.querySelector('.mantine-Sparkline-root')).toBeNull()
  })

  it('clears the previous score when a subsequent client response lacks current-state proof', async () => {
    getClientSolvencyScore.mockResolvedValueOnce(v3Score)
    getClientSolvencyCharts.mockResolvedValueOnce(currentCharts)
    const { findByText, queryByText, rerender } = renderPanel(<SolvencyPanel clientNetId="abc" />)
    expect(await findByText('46')).toBeTruthy()
    getClientSolvencyScore.mockRejectedValueOnce(new Error('Некоректна відповідь AI Solvency (score.state_basis): must equal current_observation'))
    rerender(<SolvencyPanel clientNetId="other" />)
    expect(await findByText('Оцінка платоспроможності недоступна')).toBeTruthy()
    expect(await findByText('Дані недоступні. Спробуйте пізніше.')).toBeTruthy()
    expect(queryByText('46')).toBeNull()
    expect(queryByText(explanation)).toBeNull()
    expect(getClientSolvencyCharts).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['already_90_plus', 'critical', 'прострочено понад 90 днів:'],
    ['will_cross_90_days', 'high', 'прострочено від 1 до 90 днів:'],
    ['current_debt', 'medium', 'загальний борг:'],
  ] as const)('names the 90-day amount by what it contains for %s', async (reasonCode, band, label) => {
    getClientSolvencyScore.mockResolvedValue({
      ...v3Score,
      risk_90d: { horizon_days: 90, threshold_days: 90, band, exposure_eur: 12345.67, reason_code: reasonCode },
    })
    getClientSolvencyCharts.mockResolvedValue(null)
    const { container, findByText } = renderPanel(<SolvencyPanel clientNetId="abc" />)
    expect(await findByText(/12.*345,67 EUR/)).toBeTruthy()
    expect(container.querySelector('.client-solvency-risk-amount')?.textContent?.replace(/\s/g, ' '))
      .toBe(`${label} 12 345,67 EUR`)
  })

  it.each([
    [{ total_debt_eur: 5000, overdue_1_90_eur: 1200.5, overdue_91_plus_eur: 300 }, 'critical', 'already_90_plus', 300,
      ['загальний борг 5 000,00 EUR', 'прострочено 1–90 днів 1 200,50 EUR', 'понад 90 днів 300,00 EUR']],
    [{ total_debt_eur: 5000, overdue_1_90_eur: 0, overdue_91_plus_eur: 300 }, 'critical', 'already_90_plus', 300,
      ['загальний борг 5 000,00 EUR', 'прострочено понад 90 днів 300,00 EUR']],
    [{ total_debt_eur: 5000, overdue_1_90_eur: 1200.5, overdue_91_plus_eur: 0 }, 'high', 'will_cross_90_days', 1200.5,
      ['загальний борг 5 000,00 EUR', 'прострочено 1–90 днів 1 200,50 EUR']],
    [{ total_debt_eur: 5000, overdue_1_90_eur: 0, overdue_91_plus_eur: 0 }, 'medium', 'current_debt', 5000,
      ['загальний борг 5 000,00 EUR']],
    [{ total_debt_eur: 0, overdue_1_90_eur: 0, overdue_91_plus_eur: 0 }, 'low', 'no_debt', 0, []],
  ] as const)('shows total, 1–90 and 90+ debt the same way in every band %#', async (amounts, band, reasonCode, exposure, expected) => {
    getClientSolvencyScore.mockResolvedValue({
      ...v3Score,
      risk_90d: { horizon_days: 90, threshold_days: 90, band, exposure_eur: exposure, reason_code: reasonCode, ...amounts },
    })
    getClientSolvencyCharts.mockResolvedValue(null)
    const { container, findByText } = renderPanel(<SolvencyPanel clientNetId="abc" />)
    await findByText('Контроль боргу на 90 днів:')
    await waitFor(() => expect(container.querySelector('.client-solvency-risk .mantine-Badge-root')).toBeTruthy())
    const shown = Array.from(container.querySelectorAll('.client-solvency-risk-amount'))
      .map((node) => node.textContent?.replace(/\s/g, ' '))
    expect(shown).toEqual(expected)
  })

  it('captions debt lines outside the donut window and warns about unconverted debt only when present', async () => {
    getClientSolvencyScore.mockResolvedValue({
      ...v3Score,
      unconverted_debt: [{ currency_id: 7, currency: 'PLN', lines: 2, amount: 1310.5 }],
    })
    getClientSolvencyCharts.mockResolvedValue({ ...currentCharts, donut_outside_window_lines: 3 })
    const first = renderPanel(<SolvencyPanel clientNetId="abc" />)
    await first.findByText('Платіжна дисципліна')
    expect(first.container.querySelector('.client-solvency-donut-outside')?.textContent)
      .toBe('ще 3 документи боргу за продажами, старшими за 12 міс.')
    expect(first.container.querySelector('.client-solvency-unconverted')?.textContent?.replace(/\s/g, ' '))
      .toContain('Борг без курсу до EUR не входить до жодної суми в EUR: 1 310,50 PLN (2 док.)')
    first.unmount()

    getClientSolvencyScore.mockResolvedValue(v3Score)
    getClientSolvencyCharts.mockResolvedValue(currentCharts)
    const second = renderPanel(<SolvencyPanel clientNetId="abc" />)
    await second.findByText('Платіжна дисципліна')
    expect(second.container.querySelector('.client-solvency-donut-outside')).toBeNull()
    expect(second.container.querySelector('.client-solvency-unconverted')).toBeNull()
  })

  it('states the turnover basis and explains the limit amounts once per block', async () => {
    const { getByText, queryByText } = await renderGauge({
      value: 0.4567, status: 'ok', debt_amount: 456.7, limit_amount: 1000, currency_id: 2,
      threshold_soft: 0.9, threshold_hard: 1, label: 'limit_utilization',
    })
    expect(getByText('Оборот, EUR з ПДВ')).toBeTruthy()
    expect(getByText(/повернення не віднято/)).toBeTruthy()
    expect(getByText(/Суми у валюті договору, з ПДВ/)).toBeTruthy()
    expect(getByText('Прострочені рахунки, документів')).toBeTruthy()
    expect(queryByText('Оборот, EUR')).toBeNull()
  })
})
