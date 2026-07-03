import { Button, Group, Stack, TextInput } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import { useState } from 'react'
import { AppModal } from '../../../../shared/ui/AppModal'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'

export type NewDeliveryRecipientModalProps = {
  opened: boolean
  isSaving?: boolean
  onClose: () => void
  onSave: (name: string) => void
}

export function NewDeliveryRecipientModal({
  opened,
  isSaving = false,
  onClose,
  onSave,
}: NewDeliveryRecipientModalProps) {
  const { t } = useI18n()

  function handleClose() {
    if (isSaving) {
      return
    }

    onClose()
  }

  return (
    <AppModal
      centered
      closeOnClickOutside={!isSaving}
      opened={opened}
      title={t('Отримувач')}
      onClose={handleClose}
    >
      {opened && (
        <NewDeliveryRecipientForm
          isSaving={isSaving}
          onClose={handleClose}
          onSave={onSave}
        />
      )}
    </AppModal>
  )
}

function NewDeliveryRecipientForm({
  isSaving,
  onClose,
  onSave,
}: {
  isSaving: boolean
  onClose: () => void
  onSave: (name: string) => void
}) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const trimmedName = name.trim()

  function handleSave() {
    if (!trimmedName || isSaving) {
      return
    }

    onSave(trimmedName)
  }

  return (
    <Stack gap="md">
      <TextInput
        disabled={isSaving}
        label={t("Ім'я")}
        maxLength={100}
        value={name}
        onChange={(event) => setName(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            handleSave()
          }
        }}
      />

      <Group justify="flex-end">
        <Button color="gray" disabled={isSaving} variant="subtle" onClick={onClose}>
          {t('Скасувати')}
        </Button>
        <Button
          color={CREATE_ACTION_COLOR}
          disabled={!trimmedName}
          leftSection={<IconCheck size={16} />}
          loading={isSaving}
          onClick={handleSave}
        >
          {t('Створити')}
        </Button>
      </Group>
    </Stack>
  )
}
