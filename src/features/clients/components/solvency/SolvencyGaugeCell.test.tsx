import { describe, expect, it } from 'vitest'
import { renderWithMantine } from '../../../../test/renderWithMantine'
import type { SolvencyScore } from '../../solvencyTypes'
import { SolvencyGaugeCell } from './SolvencyGaugeCell'

function makeScore(overrides: Partial<SolvencyScore>): SolvencyScore {
  return {
    client_id: 1,
    applicable: true,
    score: 82,
    rating: 'A',
    sub_factors: {
      discipline: { value: 1, points: 10, weight: 0.3 },
      debt_load: { value: 1, points: 10, weight: 0.2 },
      activity: { value: 1, points: 10, weight: 0.2 },
      tenure: { value: 1, points: 10, weight: 0.15 },
      return_quality: { value: 1, points: 10, weight: 0.15 },
    },
    caps_applied: [],
    debt_load_source: 'debt_table',
    raw_score: 82,
    currency_breakdown: null,
    as_of_date: null,
    window_months: 12,
    model_version: 'v1',
    ...overrides,
  }
}

const NA_LABEL = 'Оцінка незастосовна — не покупець'

describe('SolvencyGaugeCell', () => {
  it('renders an em-dash and no gauge when the score is not applicable', () => {
    const score = makeScore({
      applicable: false,
      score: null,
      rating: null,
      sub_factors: null,
      raw_score: null,
    })

    const { getByText, container } = renderWithMantine(
      <SolvencyGaugeCell notApplicableLabel={NA_LABEL} score={score} />,
    )

    expect(getByText('—')).toBeTruthy()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('renders an em-dash and no gauge when the score is missing', () => {
    const { getByText, container } = renderWithMantine(
      <SolvencyGaugeCell notApplicableLabel={NA_LABEL} score={undefined} />,
    )

    expect(getByText('—')).toBeTruthy()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('renders a gauge (svg) and the score value when applicable', () => {
    const { getByText, container } = renderWithMantine(
      <SolvencyGaugeCell notApplicableLabel={NA_LABEL} score={makeScore({ score: 82 })} />,
    )

    expect(getByText('82')).toBeTruthy()
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
