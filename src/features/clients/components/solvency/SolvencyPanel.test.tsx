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
})
