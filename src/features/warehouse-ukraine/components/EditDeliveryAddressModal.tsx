import { Button, Group, Stack, TextInput } from '@mantine/core'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { ShipmentDeliveryRecipientAddress } from '../shipmentTypes'

type EditDeliveryAddressModalProps = {
  opened: boolean
  address: ShipmentDeliveryRecipientAddress | null
  isSaving: boolean
  onClose: () => void
  onSave: (address: ShipmentDeliveryRecipientAddress) => void
}

type AddressDraft = {
  city: string
  department: string
  value: string
  editedAddress: ShipmentDeliveryRecipientAddress | null
}

export function EditDeliveryAddressModal({
  address,
  isSaving,
  onClose,
  onSave,
  opened,
}: EditDeliveryAddressModalProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<AddressDraft>({
    city: '',
    department: '',
    value: '',
    editedAddress: null,
  })
  const hasDraft = opened && draft.editedAddress === address
  const city = hasDraft ? draft.city : address?.City || ''
  const department = hasDraft ? draft.department : address?.Department || ''
  const value = hasDraft ? draft.value : address?.Value || ''

  function handleSave() {
    onSave({ ...(address || {}), City: city, Department: department, Value: value })
  }

  return (
    <AppModal centered opened={opened} title={t('Адреса доставки')} onClose={onClose}>
      <Stack gap="sm">
        <TextInput
          label={t('Місто')}
          value={city}
          onChange={(event) =>
            setDraft({ city: event.currentTarget.value, department, value, editedAddress: address })
          }
        />
        <TextInput
          label={t('Відділення')}
          value={department}
          onChange={(event) =>
            setDraft({ city, department: event.currentTarget.value, value, editedAddress: address })
          }
        />
        <TextInput
          label={t('Адреса')}
          value={value}
          onChange={(event) =>
            setDraft({ city, department, value: event.currentTarget.value, editedAddress: address })
          }
        />
        <Group justify="flex-end" gap="sm">
          <Button color="gray" variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button loading={isSaving} onClick={handleSave}>
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
