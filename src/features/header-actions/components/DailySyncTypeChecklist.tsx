import { Checkbox, Divider, SimpleGrid } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { allDailySyncTypes, dailySyncTypeOptions } from '../syncOptions'

type DailySyncTypeChecklistProps = {
  selectedTypes: string[]
  onChange: (types: string[]) => void
}

export function DailySyncTypeChecklist({ selectedTypes, onChange }: DailySyncTypeChecklistProps) {
  const { t } = useI18n()
  const selectedTypeSet = new Set(selectedTypes)
  const isAllSelected = allDailySyncTypes.every((type) => selectedTypeSet.has(type))
  const isIndeterminate = allDailySyncTypes.some((type) => selectedTypeSet.has(type)) && !isAllSelected

  return (
    <div className="daily-sync-types">
      <Checkbox
        checked={isAllSelected}
        indeterminate={isIndeterminate}
        label={t('Вибрати всі')}
        onChange={(event) => onChange(event.currentTarget.checked ? [...allDailySyncTypes] : [])}
      />
      <Divider my={8} />
      <Checkbox.Group value={selectedTypes} onChange={onChange}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={6}>
          {dailySyncTypeOptions.map((option) => (
            <Checkbox key={option.value} value={option.value} label={t(option.label)} />
          ))}
        </SimpleGrid>
      </Checkbox.Group>
    </div>
  )
}
