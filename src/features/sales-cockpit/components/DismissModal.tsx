import { Button, Chip, Group, Stack, Text, Textarea } from '@mantine/core'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { CockpitTask } from '../types'

const QUICK_REASONS = ['Не актуально', 'Клієнт відмовився', 'Дублює іншу задачу']

export function DismissModal({
  task,
  saving = false,
  onClose,
  onSubmit,
}: {
  task: CockpitTask | null
  saving?: boolean
  onClose: () => void
  onSubmit: (task: CockpitTask, reason: string | null) => void
}) {
  const { t } = useI18n()
  const [reason, setReason] = useValueState('')

  useEffect(() => {
    setReason('')
  }, [setReason, task?.task_key])

  const isManual = task?.task_type === 'manual'
  const trimmedReason = reason.trim()

  return (
    <AppModal
      opened={Boolean(task)}
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Позначити як неактуальну')}</span>}
      onClose={() => {
        if (!saving) {
          onClose()
        }
      }}
    >
      <Stack gap="md">
        <Text size="sm">
          {task?.title || t('Завдання')}
          {task?.client_name ? ` — ${task.client_name}` : ''}
        </Text>

        {isManual && (
          <Text c="dimmed" size="xs">
            {t('Це задача від керівника — коментар допоможе йому зрозуміти причину.')}
          </Text>
        )}

        <Group gap="xs">
          {QUICK_REASONS.map((quick) => (
            <Chip
              checked={trimmedReason === quick}
              key={quick}
              size="xs"
              onChange={() => setReason(trimmedReason === quick ? '' : quick)}
            >
              {t(quick)}
            </Chip>
          ))}
        </Group>

        <Textarea
          autosize
          disabled={saving}
          label={t('Причина (необовʼязково)')}
          minRows={2}
          placeholder={t('Чому задача не актуальна?')}
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
        />

        <Group justify="flex-end">
          <Button color="gray" disabled={saving} variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button
            color="red"
            loading={saving}
            onClick={() => {
              if (task) {
                onSubmit(task, trimmedReason || null)
              }
            }}
          >
            {t('Не актуально')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
