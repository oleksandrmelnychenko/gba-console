import { Group, Text } from '@mantine/core'
import { Info } from 'lucide-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getClientRegionManualEditNote } from '../../clientRegionManualEdit'
import type { ClientRegionManualEdit } from '../../types'

export function RegionManualEditNote({ edit }: { edit?: ClientRegionManualEdit | null }) {
  const { t } = useI18n()

  if (!edit) {
    return null
  }

  return (
    <Group data-testid="client-region-manual-edit" gap={6} wrap="nowrap" align="flex-start">
      <Info aria-hidden size={14} style={{ flex: '0 0 auto', marginTop: 2 }} />
      <Text c="dimmed" size="xs">{getClientRegionManualEditNote(edit, t)}</Text>
    </Group>
  )
}
