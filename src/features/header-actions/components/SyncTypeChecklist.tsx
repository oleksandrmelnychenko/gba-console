import { Checkbox, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { syncTypeOptions } from '../syncOptions'

type SyncTypeChecklistProps = {
  selectedTypes: Record<string, boolean>
  onChange: (key: string, checked: boolean) => void
}

export function SyncTypeChecklist({ selectedTypes, onChange }: SyncTypeChecklistProps) {
  const { t } = useI18n()

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={6} className="sync-type-checklist">
      {syncTypeOptions.map((option) => (
        <Tooltip
          key={option.value}
          label={<SyncTypeDetails details={option.details} />}
          multiline
          position="right"
          withArrow
          openDelay={250}
        >
          <Checkbox
            checked={selectedTypes[option.value] || false}
            label={t(option.label)}
            onChange={(event) => onChange(option.value, event.currentTarget.checked)}
          />
        </Tooltip>
      ))}
    </SimpleGrid>
  )
}

function SyncTypeDetails({ details }: { details: string[] }) {
  const { t } = useI18n()

  return (
    <Stack gap={2}>
      {details.map((item) => (
        <Text key={item} size="xs">
          {t(item)}
        </Text>
      ))}
    </Stack>
  )
}
