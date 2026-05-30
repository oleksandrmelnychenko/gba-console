import { Button, Group, Stack, TextInput } from '@mantine/core'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { ShipmentDeliveryRecipient } from '../shipmentTypes'

type EditDeliveryRecipientModalProps = {
  opened: boolean
  recipient: ShipmentDeliveryRecipient | null
  isSaving: boolean
  onClose: () => void
  onSave: (recipient: ShipmentDeliveryRecipient) => void
}

export function EditDeliveryRecipientModal({
  isSaving,
  onClose,
  onSave,
  opened,
  recipient,
}: EditDeliveryRecipientModalProps) {
  const { t } = useI18n()
  const [fullName, setFullName] = useState('')
  const [mobilePhone, setMobilePhone] = useState('')
  const [editedRecipient, setEditedRecipient] = useState<ShipmentDeliveryRecipient | null>(null)

  if (opened && editedRecipient !== recipient) {
    setEditedRecipient(recipient)
    setFullName(recipient?.FullName || '')
    setMobilePhone(recipient?.MobilePhone || '')
  }

  function handleSave() {
    onSave({ ...(recipient || {}), FullName: fullName, MobilePhone: mobilePhone })
  }

  return (
    <AppModal centered opened={opened} title={t('Одержувач')} onClose={onClose}>
      <Stack gap="sm">
        <TextInput
          label={t("Повне ім'я")}
          value={fullName}
          onChange={(event) => setFullName(event.currentTarget.value)}
        />
        <TextInput
          label={t('Мобільний телефон')}
          value={mobilePhone}
          onChange={(event) => setMobilePhone(event.currentTarget.value)}
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
