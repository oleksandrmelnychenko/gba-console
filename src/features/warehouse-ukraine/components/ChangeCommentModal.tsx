import { Alert, Button, Stack, Textarea } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'

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
      <Stack className="app-compact-form" gap="sm">
        <Textarea
          autosize
          label={t('Коментар')}
          minRows={3}
          value={value}
          onChange={(event) => setDraft({ value: event.currentTarget.value, touched, trackedComment: comment })}
        />
        {touched && error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}
        <AppModalFooter>
          <Button color="gray" variant="default" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button loading={isSaving} onClick={handleSave}>
            {t('Зберегти')}
          </Button>
        </AppModalFooter>
      </Stack>
    </AppModal>
  )
}
