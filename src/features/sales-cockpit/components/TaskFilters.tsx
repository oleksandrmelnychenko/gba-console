import { Select } from '@mantine/core'
import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { CockpitTaskType, CockpitUrgency } from '../types'

const TASK_TYPE_OPTIONS: { value: CockpitTaskType; label: string }[] = [
  { value: 'manual', label: 'Від керівника' },
  { value: 'reorder_due', label: 'Час повторного замовлення' },
  { value: 'debt_followup', label: 'Контроль заборгованості' },
  { value: 'cross_sell', label: 'Крос-продаж' },
  { value: 'churn_winback', label: 'Повернення клієнта' },
  { value: 'new_client_activation', label: 'Активація нового клієнта' },
]

const URGENCY_OPTIONS: { value: CockpitUrgency; label: string }[] = [
  { value: 'critical', label: 'Критично' },
  { value: 'high', label: 'Високий' },
  { value: 'normal', label: 'Звичайний' },
  { value: 'low', label: 'Низький' },
]

export function TaskFilters({
  taskType,
  urgency,
  onTaskTypeChange,
  onUrgencyChange,
}: {
  taskType: CockpitTaskType | null
  urgency: CockpitUrgency | null
  onTaskTypeChange: (value: CockpitTaskType | null) => void
  onUrgencyChange: (value: CockpitUrgency | null) => void
}) {
  const { t } = useI18n()
  const taskTypeData = useMemo(
    () => TASK_TYPE_OPTIONS.map((option) => ({ value: option.value, label: t(option.label) })),
    [t],
  )
  const urgencyData = useMemo(
    () => URGENCY_OPTIONS.map((option) => ({ value: option.value, label: t(option.label) })),
    [t],
  )

  return (
    <div className="app-filter-control-group">
      <Select
        clearable
        data={taskTypeData}
        label={t('Тип завдання')}
        placeholder={t('Усі типи')}
        value={taskType}
        w={180}
        onChange={(value) => onTaskTypeChange((value as CockpitTaskType | null) ?? null)}
      />
      <Select
        clearable
        data={urgencyData}
        label={t('Терміновість')}
        placeholder={t('Будь-яка')}
        value={urgency}
        w={140}
        onChange={(value) => onUrgencyChange((value as CockpitUrgency | null) ?? null)}
      />
    </div>
  )
}
