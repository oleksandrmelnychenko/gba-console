import { Button, Checkbox, Group, NumberInput, Stack, Text } from '@mantine/core'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import type { CockpitTask } from '../types'

export function DoneModal({
  task,
  saving = false,
  onClose,
  onSubmit,
}: {
  task: CockpitTask | null
  saving?: boolean
  onClose: () => void
  onSubmit: (task: CockpitTask, outcome: { sold: boolean; amount: number | null }) => void
}) {
  const { t } = useI18n()
  const [sold, setSold] = useValueState(true)
  const [amount, setAmount] = useValueState<number | string>('')

  useEffect(() => {
    setSold(true)
    setAmount('')
  }, [setAmount, setSold, task?.task_key])

  return (
    <AppModal
      opened={Boolean(task)}
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Завершити завдання')}</span>}
      onClose={() => {
        if (!saving) {
          onClose()
        }
      }}
    >
      <Stack gap="md">
        {task?.client_name && (
          <Text c="dimmed" size="sm">
            {task.client_name}
          </Text>
        )}
        <Checkbox
          checked={sold}
          disabled={saving}
          label={t('Продаж відбувся')}
          onChange={(event) => setSold(event.currentTarget.checked)}
        />
        {sold && (
          <NumberInput
            allowNegative={false}
            decimalScale={2}
            disabled={saving}
            label={t('Сума продажу')}
            min={0}
            placeholder={t('Введіть суму')}
            value={amount}
            onChange={setAmount}
          />
        )}
        <Group justify="flex-end">
          <Button color="gray" disabled={saving} variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color={CREATE_ACTION_COLOR} loading={saving} onClick={() => task && onSubmit(task, { amount: toAmount(amount), sold })}>
            {t('Підтвердити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function toAmount(value: number | string): number | null {
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}
