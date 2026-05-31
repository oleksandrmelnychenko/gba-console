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

export function ChangeCommentModal({ comment, isSaving, onClose, onSave, opened }: ChangeCommentModalProps) {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)
  const [trackedComment, setTrackedComment] = useState<string | null>(null)

  if (opened && trackedComment !== comment) {
    setTrackedComment(comment)
    setValue(comment || '')
    setTouched(false)
  }

  const error = !value.trim() ? t('Поле - обов’язкове') : null

  function handleSave() {
    setTouched(true)

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
          onChange={(event) => setValue(event.currentTarget.value)}
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
