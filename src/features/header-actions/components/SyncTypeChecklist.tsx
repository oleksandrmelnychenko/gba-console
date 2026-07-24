import { Checkbox, Divider, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { syncTypeOptions } from '../syncOptions'

type SyncTypeChecklistProps = {
  selectedTypes: Record<string, boolean>
  onChange: (key: string, checked: boolean) => void
}

export function SyncTypeChecklist({ selectedTypes, onChange }: SyncTypeChecklistProps) {
  const { t } = useI18n()
  const selectedCount = syncTypeOptions.filter((option) => selectedTypes[option.value]).length
  const isAllSelected = selectedCount === syncTypeOptions.length
  const isIndeterminate = selectedCount > 0 && !isAllSelected

  return (
    <div className="sync-type-checklist">
      <Checkbox
        checked={isAllSelected}
        indeterminate={isIndeterminate}
        label={t('Вибрати всі')}
        onChange={(event) => {
          for (const option of syncTypeOptions) {
            onChange(option.value, event.currentTarget.checked)
          }
        }}
      />
      <Divider my={8} />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={6}>
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
    </div>
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
