import { RingProgress, Text, Tooltip } from '@mantine/core'
import type { SolvencyScore } from '../../solvencyTypes'

const SOLVENCY_RATING_COLOR: Record<string, string> = {
  A: 'green',
  B: 'teal',
  C: 'yellow',
  D: 'red',
}

function solvencyScoreColor(score: SolvencyScore): string {
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

type SolvencyGaugeCellProps = {
  notApplicableLabel: string
  score?: SolvencyScore
}

export function SolvencyGaugeCell({ notApplicableLabel, score }: SolvencyGaugeCellProps) {
  const notApplicable = score?.applicable === false
  const hasScore = Boolean(score) && !notApplicable && score?.score != null
  const value = hasScore ? Math.min(100, Math.max(0, score?.score ?? 0)) : 0
  const tooltipLabel = hasScore ? `${score?.score} / 100 · ${score?.rating}` : notApplicableLabel
  // Keep the Tooltip target a single stable <div> so the cell never swaps its
  // root element type as scores load in (which crashed React's reconciler with
  // a removeChild error in the pinned column).
  return (
    <Tooltip disabled={!hasScore && !notApplicable} label={tooltipLabel} openDelay={300} withArrow>
      <div
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
          <Text c="dimmed" size="xs">
            —
          </Text>
        )}
      </div>
    </Tooltip>
  )
}
