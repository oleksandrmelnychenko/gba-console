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

type RecipientDraft = {
  fullName: string
  mobilePhone: string
  editedRecipient: ShipmentDeliveryRecipient | null
}

export function EditDeliveryRecipientModal({
  isSaving,
  onClose,
  onSave,
  opened,
  recipient,
}: EditDeliveryRecipientModalProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<RecipientDraft>({
    fullName: '',
    mobilePhone: '',
    editedRecipient: null,
  })
  const hasDraft = opened && draft.editedRecipient === recipient
  const fullName = hasDraft ? draft.fullName : recipient?.FullName || ''
  const mobilePhone = hasDraft ? draft.mobilePhone : recipient?.MobilePhone || ''

  function handleSave() {
    onSave({ ...(recipient || {}), FullName: fullName, MobilePhone: mobilePhone })
  }

  return (
    <AppModal centered opened={opened} title={t('Одержувач')} onClose={onClose}>
      <Stack gap="sm">
        <TextInput
          label={t("Повне ім'я")}
          value={fullName}
          onChange={(event) =>
            setDraft({ fullName: event.currentTarget.value, mobilePhone, editedRecipient: recipient })
          }
        />
        <TextInput
          label={t('Мобільний телефон')}
          value={mobilePhone}
          onChange={(event) =>
            setDraft({ fullName, mobilePhone: event.currentTarget.value, editedRecipient: recipient })
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
