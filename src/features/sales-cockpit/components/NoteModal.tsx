import { Button, Group, Stack, Textarea } from '@mantine/core'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { CockpitTask } from '../types'

export function NoteModal({
  task,
  saving = false,
  onClose,
  onSubmit,
}: {
  task: CockpitTask | null
  saving?: boolean
  onClose: () => void
  onSubmit: (task: CockpitTask, text: string) => void
}) {
  const { t } = useI18n()
  const [text, setText] = useValueState('')

  useEffect(() => {
    setText('')
  }, [setText, task?.task_key])

  const trimmedText = text.trim()

  return (
    <AppModal
      opened={Boolean(task)}
      title={t('Додати нотатку')}
      onClose={() => {
        if (!saving) {
          onClose()
        }
      }}
    >
      <Stack gap="md">
        <Textarea
          autosize
          disabled={saving}
          label={t('Нотатка')}
          minRows={3}
          placeholder={t('Введіть текст нотатки')}
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button color="gray" disabled={saving} variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button
            disabled={!trimmedText}
            loading={saving}
            onClick={() => {
              if (task && trimmedText) {
                onSubmit(task, trimmedText)
              }
            }}
          >
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
