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

export function EditDeliveryAddressModal({
  address,
  isSaving,
  onClose,
  onSave,
  opened,
}: EditDeliveryAddressModalProps) {
  const { t } = useI18n()
  const [city, setCity] = useState('')
  const [department, setDepartment] = useState('')
  const [value, setValue] = useState('')
  const [editedAddress, setEditedAddress] = useState<ShipmentDeliveryRecipientAddress | null>(null)

  if (opened && editedAddress !== address) {
    setEditedAddress(address)
    setCity(address?.City || '')
    setDepartment(address?.Department || '')
    setValue(address?.Value || '')
  }

  function handleSave() {
    onSave({ ...(address || {}), City: city, Department: department, Value: value })
  }

  return (
    <AppModal centered opened={opened} title={t('Адреса доставки')} onClose={onClose}>
      <Stack gap="sm">
        <TextInput label={t('Місто')} value={city} onChange={(event) => setCity(event.currentTarget.value)} />
        <TextInput
          label={t('Відділення')}
          value={department}
          onChange={(event) => setDepartment(event.currentTarget.value)}
        />
        <TextInput label={t('Адреса')} value={value} onChange={(event) => setValue(event.currentTarget.value)} />
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
