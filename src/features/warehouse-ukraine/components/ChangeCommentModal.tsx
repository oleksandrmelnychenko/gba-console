import { Alert, Button, Group, Stack, Textarea } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'

type ChangeCommentModalProps = {
  opened: boolean
  comment: string
  isSaving: boolean
  onClose: () => void
  onSave: (comment: string) => void
}

type CommentDraft = {
  value: string
  touched: boolean
  trackedComment: string | null
}

export function ChangeCommentModal({ comment, isSaving, onClose, onSave, opened }: ChangeCommentModalProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<CommentDraft>({
    value: '',
    touched: false,
    trackedComment: null,
  })
  const hasDraft = opened && draft.trackedComment === comment
  const value = hasDraft ? draft.value : comment || ''
  const touched = hasDraft ? draft.touched : false
  const error = !value.trim() ? t('Поле - обов’язкове') : null

  function handleSave() {
    setDraft({ value, touched: true, trackedComment: comment })

    if (error) {
      return
    }

    onSave(value)
  }

  return (
    <AppModal centered opened={opened} title={t('Зміна коментара')} onClose={onClose}>
      <Stack gap="sm">
        <Textarea
          autosize
          label={t('Коментар')}
          minRows={3}
          value={value}
          onChange={(event) => setDraft({ value: event.currentTarget.value, touched, trackedComment: comment })}
        />
        {touched && error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}
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
