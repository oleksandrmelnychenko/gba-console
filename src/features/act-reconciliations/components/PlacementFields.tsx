import { Group, TextInput } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'

export type PlacementValues = {
  cellNumber: string
  rowNumber: string
  storageNumber: string
}

export function PlacementFields({
  values,
  onChange,
}: {
  values: PlacementValues
  onChange: (next: PlacementValues) => void
}) {
  const { t } = useI18n()

  return (
    <Group grow gap="sm" wrap="nowrap">
      <TextInput
        label={t('Склад')}
        value={values.storageNumber}
        onChange={(event) => onChange({ ...values, storageNumber: event.currentTarget.value })}
      />
      <TextInput
        label={t('Ряд')}
        value={values.rowNumber}
        onChange={(event) => onChange({ ...values, rowNumber: event.currentTarget.value })}
      />
      <TextInput
        label={t('Полиця')}
        value={values.cellNumber}
        onChange={(event) => onChange({ ...values, cellNumber: event.currentTarget.value })}
      />
    </Group>
  )
}
