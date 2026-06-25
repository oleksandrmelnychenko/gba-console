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
  if (!score || score.applicable === false || score.score == null) {
    return (
      <Tooltip
        disabled={!score || score.applicable !== false}
        label={notApplicableLabel}
        openDelay={300}
        withArrow
      >
        <Text c="dimmed" size="xs">
          —
        </Text>
      </Tooltip>
    )
  }

  const value = Math.min(100, Math.max(0, score.score))

  return (
    <Tooltip label={`${score.score} / 100 · ${score.rating}`} openDelay={300} withArrow>
      <RingProgress
        label={
          <Text fw={700} size="xs" ta="center">
            {score.score}
          </Text>
        }
        roundCaps
        sections={[{ color: solvencyScoreColor(score), value }]}
        size={36}
        thickness={4}
      />
    </Tooltip>
  )
}
