import { RingProgress, Text, Tooltip } from '@mantine/core'
import type { SolvencyScoreSlim } from '../../solvencyTypes'

const SOLVENCY_RATING_COLOR: Record<string, string> = {
  A: 'green',
  B: 'teal',
  C: 'yellow',
  D: 'red',
}

function solvencyScoreColor(score: GaugeScore): string {
  const rating = score.rating
  const ratingColor = rating ? SOLVENCY_RATING_COLOR[rating] : undefined
  if (ratingColor) {
    return ratingColor
  }

  const value = score.score ?? 0

  if (value >= 70) {
    return 'green'
  }

  if (value >= 40) {
    return 'yellow'
  }

  return 'red'
}

type GaugeScore = Pick<SolvencyScoreSlim, 'applicable' | 'score' | 'rating'> & {
  data_sufficiency?: 'insufficient' | 'ok' | null
  policy_reason?: string | null
}

type SolvencyGaugeCellProps = {
  notApplicableLabel: string
  unavailableLabel?: string
  score?: GaugeScore
}

export function SolvencyGaugeCell({ notApplicableLabel, score, unavailableLabel }: SolvencyGaugeCellProps) {
  const notApplicable = score?.applicable === false
  const insufficientData = score?.data_sufficiency === 'insufficient'
  const hasScore = Boolean(score) && !notApplicable && !insufficientData && score?.score != null
  const value = hasScore ? Math.min(100, Math.max(0, score?.score ?? 0)) : 0
  const tooltipLabel = hasScore
    ? [`${score?.score} / 100`, score?.rating, score?.policy_reason].filter(Boolean).join(' · ')
    : insufficientData
      ? 'Недостатньо даних для оцінки'
      : notApplicable
        ? notApplicableLabel
        : unavailableLabel ?? 'Оцінку не обчислено'
  // Keep the Tooltip target a single stable <div> so the cell never swaps its
  // root element type as scores load in (which crashed React's reconciler with
  // a removeChild error in the pinned column).
  return (
    <Tooltip label={tooltipLabel} openDelay={300} withArrow>
      <div
        role="img"
        aria-label={tooltipLabel}
        style={{
          alignItems: 'center',
          display: 'inline-flex',
          height: 36,
          justifyContent: 'center',
          width: 36,
        }}
      >
        {hasScore && score ? (
          <RingProgress
            label={
              <Text fw={500} fz={10} ta="center">
                {score.score}
              </Text>
            }
            roundCaps
            sections={[{ color: solvencyScoreColor(score), value }]}
            size={36}
            thickness={3}
          />
        ) : (
          // Not computed (no data / not applicable / score pending) — the neutral
          // gray ring keeps the column readable instead of bare dashes.
          <RingProgress
            label={
              <Text c="dimmed" fw={500} fz={10} ta="center">
                –
              </Text>
            }
            sections={[{ color: 'gray.4', value: 100 }]}
            size={36}
            thickness={3}
          />
        )}
      </div>
    </Tooltip>
  )
}
