import { Text } from '@mantine/core'
import type { AiHistoryLineage } from './aiHistoryLineage'

type AiHistoryLineageNoteProps = {
  lineage: AiHistoryLineage
}

export function AiHistoryLineageNote({ lineage }: AiHistoryLineageNoteProps) {
  return (
    <Text c="dimmed" size="xs">
      Дані джерела з {formatDate(lineage.source_history_start)} · розрахунок з{' '}
      {formatDate(lineage.effective_start)}
      {!lineage.history_complete && ' · скорочене історичне вікно'}
    </Text>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('uk-UA').format(new Date(`${value}T00:00:00Z`))
}
