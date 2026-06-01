import { Group, TextInput } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'

export type PlacementValues = {
  cellNumber: string
  rowNumber: string
  storageNumber: string
}

export function PlacementFields({
  required,
  values,
  onChange,
}: {
  required?: boolean
  values: PlacementValues
  onChange: (next: PlacementValues) => void
}) {
  const { t } = useI18n()
  const requiredError = required ? t('Заповніть поле') : null

  return (
    <Group grow gap="sm" wrap="nowrap" align="flex-start">
      <TextInput
        error={required && !values.storageNumber ? requiredError : null}
        label={t('Склад')}
        required={required}
        value={values.storageNumber}
        onChange={(event) => onChange({ ...values, storageNumber: event.currentTarget.value })}
      />
      <TextInput
        error={required && !values.rowNumber ? requiredError : null}
        label={t('Ряд')}
        required={required}
        value={values.rowNumber}
        onChange={(event) => onChange({ ...values, rowNumber: event.currentTarget.value })}
      />
      <TextInput
        error={required && !values.cellNumber ? requiredError : null}
        label={t('Полиця')}
        required={required}
        value={values.cellNumber}
        onChange={(event) => onChange({ ...values, cellNumber: event.currentTarget.value })}
      />
    </Group>
  )
}
