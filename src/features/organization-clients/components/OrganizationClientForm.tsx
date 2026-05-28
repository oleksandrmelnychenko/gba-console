import { NumberInput, SimpleGrid, TextInput } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { OrganizationClient } from '../types'
import { normalizeNumberInput } from '../utils'

type OrganizationClientFormProps = {
  client: OrganizationClient
  disabled?: boolean
  onFieldChange: <K extends keyof OrganizationClient>(key: K, value: OrganizationClient[K]) => void
}

export function OrganizationClientForm({ client, disabled = false, onFieldChange }: OrganizationClientFormProps) {
  const { t } = useI18n()

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
      <TextInput
        disabled={disabled}
        label={t('Повна назва')}
        maxLength={200}
        required
        value={client.FullName || ''}
        onChange={(event) => onFieldChange('FullName', event.currentTarget.value)}
      />
      <TextInput
        disabled={disabled}
        label="NIP"
        maxLength={20}
        required
        value={client.NIP || ''}
        onChange={(event) => onFieldChange('NIP', event.currentTarget.value)}
      />
      <NumberInput
        decimalScale={2}
        disabled={disabled}
        label={t('Маржа')}
        min={0}
        required
        value={client.MarginAmount ?? ''}
        onChange={(value) => onFieldChange('MarginAmount', normalizeNumberInput(value))}
      />
      <TextInput
        disabled={disabled}
        label={t('Адреса')}
        maxLength={50}
        required
        value={client.Address || ''}
        onChange={(event) => onFieldChange('Address', event.currentTarget.value)}
      />
      <TextInput
        disabled={disabled}
        label={t('Країна')}
        maxLength={50}
        required
        value={client.Country || ''}
        onChange={(event) => onFieldChange('Country', event.currentTarget.value)}
      />
      <TextInput
        disabled={disabled}
        label={t('Місто')}
        maxLength={50}
        required
        value={client.City || ''}
        onChange={(event) => onFieldChange('City', event.currentTarget.value)}
      />
    </SimpleGrid>
  )
}
