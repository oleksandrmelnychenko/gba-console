import { Button, Group, Stack, Text } from '@mantine/core'
import type { RankingKind, RankingPrerequisites } from './reportRankingReadiness'

type Props = RankingPrerequisites & {
  kind: RankingKind
  reasonId: string
  disabled: boolean
  onConfigureGrouping?: () => void
  onConfigureMeasures?: () => void
}

export function ReportRankingPrerequisites({ kind, reasonId, reasons, needsGrouping, needsMeasure, disabled,
  onConfigureGrouping, onConfigureMeasures }: Props) {
  const actions = [
    { needed: needsGrouping, onClick: onConfigureGrouping, label: `Налаштувати групування для ${kind}` },
    { needed: needsMeasure, onClick: onConfigureMeasures, label: `Налаштувати показники для ${kind}` },
  ].filter(action => action.needed && action.onClick)
  if (!reasons && !actions.length) return null
  return <Stack gap="xs">
    {reasons ? <Text id={reasonId} size="xs" c="dimmed">{reasons}</Text> : null}
    {actions.length > 0 ? <Group className="reports-constructor-rule-actions" gap="xs">
      {actions.map(action => <Button key={action.label} type="button" variant="default" size="compact-sm"
        disabled={disabled} onClick={action.onClick}>{action.label}</Button>)}
    </Group> : null}
  </Stack>
}
