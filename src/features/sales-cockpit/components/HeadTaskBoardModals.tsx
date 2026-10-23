import { Button, Stack, Text, Textarea } from '@mantine/core'
import { Ban, Save } from 'lucide-react'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import type { HeadTask } from '../types'

function taskCaption(task: HeadTask | null, fallback: string): string {
  if (!task) {
    return fallback
  }

  const client = task.ClientName?.trim()

  return `${task.Title?.trim() || fallback}${client ? ` — ${client}` : ''}`
}

// Head → manager comment on any board task (the nba side lets the head note any task).
export function BoardNoteModal({
  task,
  saving = false,
  onClose,
  onSubmit,
}: {
  task: HeadTask | null
  saving?: boolean
  onClose: () => void
  onSubmit: (task: HeadTask, text: string) => void
}) {
  const { t } = useI18n()
  const [text, setText] = useValueState('')

  useEffect(() => {
    setText('')
  }, [setText, task?.TaskKey])

  const trimmedText = text.trim()

  return (
    <AppModal
      opened={Boolean(task)}
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Коментар керівника')}</span>}
      onClose={() => {
        if (!saving) {
          onClose()
        }
      }}
    >
      <Stack className="app-compact-form" gap={10}>
        <Text size="sm">{taskCaption(task, t('Завдання'))}</Text>

        {(task?.Notes.length ?? 0) > 0 && (
          <Stack gap={4}>
            <Text className="app-section-title" fw={600} size="xs">
              {t('Історія нотаток')}
            </Text>
            {task?.Notes.map((note) => (
              <Text
                key={`${note.AuthorId ?? 'system'}-${note.CreatedAt ?? ''}-${note.Text ?? ''}`}
                size="xs"
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {note.AuthorName ? <strong>{note.AuthorName}: </strong> : null}
                {note.Text}
              </Text>
            ))}
          </Stack>
        )}

        <Textarea
          autosize
          disabled={saving}
          label={t('Коментар')}
          minRows={2}
          placeholder={t('Що менеджеру варто врахувати?')}
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
        />

        <AppModalFooter>
          <Button color="gray" disabled={saving} variant="default" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button
            leftSection={<Save size={16} />}
            color={CREATE_ACTION_COLOR}
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
        </AppModalFooter>
      </Stack>
    </AppModal>
  )
}

// Head cancels their own manual (head-assigned) task.
export function BoardCancelModal({
  task,
  saving = false,
  onClose,
  onSubmit,
}: {
  task: HeadTask | null
  saving?: boolean
  onClose: () => void
  onSubmit: (task: HeadTask, reason: string | null) => void
}) {
  const { t } = useI18n()
  const [reason, setReason] = useValueState('')

  useEffect(() => {
    setReason('')
  }, [setReason, task?.TaskKey])

  const trimmedReason = reason.trim()

  return (
    <AppModal
      opened={Boolean(task)}
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Скасувати задачу')}</span>}
      onClose={() => {
        if (!saving) {
          onClose()
        }
      }}
    >
      <Stack className="app-compact-form" gap={10}>
        <Text size="sm">{taskCaption(task, t('Завдання'))}</Text>

        <Textarea
          autosize
          disabled={saving}
          label={t('Причина (необовʼязково)')}
          minRows={2}
          placeholder={t('Чому задача скасовується?')}
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
        />

        <AppModalFooter>
          <Button color="gray" disabled={saving} variant="default" onClick={onClose}>
            {t('Назад')}
          </Button>
          <Button
            leftSection={<Ban size={16} />}
            color="red"
            loading={saving}
            onClick={() => {
              if (task) {
                onSubmit(task, trimmedReason || null)
              }
            }}
          >
            {t('Скасувати задачу')}
          </Button>
        </AppModalFooter>
      </Stack>
    </AppModal>
  )
}
