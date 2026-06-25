import { MantineProvider } from '@mantine/core'
import { render, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import type { SolvencyScore } from '../../solvencyTypes'

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
  applicable: false,
  score: null,
  rating: null,
  sub_factors: null,
  caps_applied: [],
  debt_load_source: 'debt_table',
  raw_score: null,
  currency_breakdown: null,
  as_of_date: null,
  window_months: 0,
  model_version: 'v1',
}

const v3Score: SolvencyScore = {
  client_id: 411780,
  applicable: true,
  score: 46,
  rating: 'D',
  pd: 0.649,
  contributions: [
    { feature: 'n_open_debt_lines', value: 3, points: 3.77 },
    { feature: 'months_with_debt_last12', value: 12, points: 1.02 },
  ],
  forward_risk: { band: 'very_high', pd: 0.997 },
  sub_factors: null,
  caps_applied: [],
  debt_load_source: null,
  raw_score: null,
  currency_breakdown: null,
  as_of_date: '2026-06-25',
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

  it('renders the v3 score, contributions and forward badge when sub_factors is null', async () => {
    getClientSolvencyScore.mockResolvedValue(v3Score)
    getClientSolvencyCharts.mockRejectedValue(new Error('no charts'))

    const { findByText, queryByText } = renderPanel(<SolvencyPanel clientNetId="abc" />)

    // does NOT fall into the not-a-buyer N/A state
    expect(queryByText(/не покупець/i)).toBeNull()
    // score gauge value, band, a contribution label and the forward-risk badge are present
    expect(await findByText('46')).toBeTruthy()
    expect(await findByText(/Відкритих боргових позицій/i)).toBeTruthy()
    expect(await findByText(/дуже високий/i)).toBeTruthy()
  })
})
