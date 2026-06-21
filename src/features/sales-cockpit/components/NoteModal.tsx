import { Button, Divider, Group, Stack, Text, Textarea } from '@mantine/core'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { CockpitTask } from '../types'

const noteDateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' })

function formatNoteDate(value: string): string {
  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? value : noteDateFormatter.format(parsed)
}

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
        {(task?.notes?.length ?? 0) > 0 && (
          <Stack gap="xs">
            <Text c="dimmed" fw={600} size="xs" tt="uppercase">
              {t('Історія нотаток')}
            </Text>
            {task?.notes?.map((note, index) => (
              <Stack gap={2} key={`${note.created_at ?? ''}-${index}`}>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {note.text}
                </Text>
                {note.created_at && (
                  <Text c="dimmed" size="xs">
                    {formatNoteDate(note.created_at)}
                  </Text>
                )}
              </Stack>
            ))}
            <Divider />
          </Stack>
        )}
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
