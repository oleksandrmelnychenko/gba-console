import { Button, Stack } from '@mantine/core'
import { useEffect } from 'react'
import { formatLocalDateTime } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import type { CockpitTask } from '../types'
import { AppDateInput } from '../../../shared/ui/AppDateInput'

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
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Відкласти завдання')}</span>}
      onClose={() => {
        if (!saving) {
          onClose()
        }
      }}
    >
      <Stack className="app-compact-form" gap="md">
        <AppDateInput
          disabled={saving}
          label={t('Нагадати')}
          type="datetime-local"
          value={snoozeUntil}
          onChange={(event) => setSnoozeUntil(event.currentTarget.value)}
        />
        <AppModalFooter>
          <Button color="gray" disabled={saving} variant="default" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={!snoozeUntil}
            loading={saving}
            onClick={() => {
              if (task && snoozeUntil) {
                // The datetime-local value is Kyiv wall time with no offset; every hop
                // downstream (gba-server → gba-nba → Mongo) stores it verbatim as UTC,
                // so «нагадати о 09:00» used to wake at 12:00. Send a real instant.
                onSubmit(task, new Date(snoozeUntil).toISOString())
              }
            }}
          >
            {t('Відкласти')}
          </Button>
        </AppModalFooter>
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
