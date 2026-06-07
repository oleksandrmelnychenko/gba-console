import { Button, Group, Stack, TextInput } from '@mantine/core'
import { useEffect } from 'react'
import { formatLocalDateTime } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { CockpitTask } from '../types'

export function SnoozeModal({
  task,
  saving = false,
  onClose,
  onSubmit,
}: {
  task: CockpitTask | null
  saving?: boolean
  onClose: () => void
  onSubmit: (task: CockpitTask, snoozeUntil: string) => void
}) {
  const { t } = useI18n()
  const [snoozeUntil, setSnoozeUntil] = useValueState(getDefaultSnoozeUntil)

  useEffect(() => {
    setSnoozeUntil(getDefaultSnoozeUntil())
  }, [setSnoozeUntil, task?.task_key])

  return (
    <AppModal
      opened={Boolean(task)}
      title={t('Відкласти завдання')}
      onClose={() => {
        if (!saving) {
          onClose()
        }
      }}
    >
      <Stack gap="md">
        <TextInput
          disabled={saving}
          label={t('Нагадати')}
          type="datetime-local"
          value={snoozeUntil}
          onChange={(event) => setSnoozeUntil(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button color="gray" disabled={saving} variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button
            disabled={!snoozeUntil}
            loading={saving}
            onClick={() => {
              if (task && snoozeUntil) {
                onSubmit(task, snoozeUntil)
              }
            }}
          >
            {t('Відкласти')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function getDefaultSnoozeUntil(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setSeconds(0, 0)

  return formatLocalDateTime(date).slice(0, 16)
}
