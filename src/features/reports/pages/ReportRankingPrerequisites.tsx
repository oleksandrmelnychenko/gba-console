import { Button, Group } from '@mantine/core'
import type { RankingKind, RankingPrerequisites } from './reportRankingReadiness'

type Props = RankingPrerequisites & {
  kind: RankingKind
  disabled: boolean
  onConfigureGrouping?: () => void
  onConfigureMeasures?: () => void
}

export function ReportRankingPrerequisites({ kind, needsGrouping, needsMeasure, disabled,
  onConfigureGrouping, onConfigureMeasures }: Props) {
  const actions = [
    { needed: needsGrouping, onClick: onConfigureGrouping, label: `Налаштувати групування для ${kind}` },
    { needed: needsMeasure, onClick: onConfigureMeasures, label: `Налаштувати показники для ${kind}` },
  ].filter(action => action.needed && action.onClick)
  if (!actions.length) return null
  return <Group className="reports-constructor-rule-actions" gap="xs">
    {actions.map(action => <Button key={action.label} type="button" variant="default" size="compact-sm"
      disabled={disabled} onClick={action.onClick}>{action.label}</Button>)}
  </Group>
}
