import { ActionIcon, Card, SegmentedControl, Text, TextInput, Tooltip } from '@mantine/core'
import { RefreshCw, Sparkles } from 'lucide-react'
import { AiFeatureBadge } from '../../../shared/ai/AiFeatureBadge'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { CockpitTaskType, CockpitUrgency } from '../types'
import { TaskFilters } from './TaskFilters'

export type CockpitDayFilter = 'all' | 'today'

type CockpitToolbarProps = {
  taskType: CockpitTaskType | null
  urgency: CockpitUrgency | null
  dayFilter: CockpitDayFilter
  asOfDate?: string
  todayCount: number
  visibleCount: number
  isLoading: boolean
  isRegenerating: boolean
  onTaskTypeChange: (value: CockpitTaskType | null) => void
  onUrgencyChange: (value: CockpitUrgency | null) => void
  onDayFilterChange: (value: CockpitDayFilter) => void
  onAsOfDateChange: (value: string | undefined) => void
  onRegenerate: () => void
  onReload: () => void
}

export function CockpitToolbar({
  taskType,
  urgency,
  dayFilter,
  asOfDate,
  todayCount,
  visibleCount,
  isLoading,
  isRegenerating,
  onTaskTypeChange,
  onUrgencyChange,
  onDayFilterChange,
  onAsOfDateChange,
  onRegenerate,
  onReload,
}: CockpitToolbarProps) {
  const { t } = useI18n()

  return (
    <Card className="app-filter-card cockpit-toolbar-card" withBorder radius="md" padding={0}>
      <div className="app-filter-bar cockpit-command-bar">
        <AiFeatureBadge size="sm" tooltip={t('AI-сервіс завдань продажів')} />
        <TextInput
          className="cockpit-date-filter"
          label={t('Дата зрізу')}
          type="date"
          value={asOfDate ?? ''}
          w={170}
          onChange={(event) => onAsOfDateChange(event.currentTarget.value || undefined)}
        />
        <TaskFilters
          taskType={taskType}
          urgency={urgency}
          onTaskTypeChange={onTaskTypeChange}
          onUrgencyChange={onUrgencyChange}
        />
        <SegmentedControl
          className="cockpit-day-filter"
          data={[
            { label: t('Усі'), value: 'all' },
            { label: `${t('Сьогодні')} (${todayCount})`, value: 'today' },
          ]}
          size="sm"
          value={dayFilter}
          onChange={(value) => onDayFilterChange(value as CockpitDayFilter)}
        />
        <div className="app-filter-actions cockpit-command-actions">
          <Text className="cockpit-toolbar-count">
            {t('Завдань')}: <strong>{visibleCount}</strong>
          </Text>
          <Tooltip label={t('Згенерувати завдання')}>
            <ActionIcon
              aria-label={t('Згенерувати завдання')}
              loading={isRegenerating}
              size={34}
              variant="light"
              onClick={onRegenerate}
            >
              <Sparkles size={17} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Оновити')}>
            <ActionIcon aria-label={t('Оновити')} loading={isLoading} size={34} variant="light" onClick={onReload}>
              <RefreshCw size={18} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>
    </Card>
  )
}
