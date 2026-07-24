import { ActionIcon, Button, Card, SegmentedControl, Text, TextInput, Tooltip } from '@mantine/core'
import { RefreshCw, RotateCcw, Sparkles } from 'lucide-react'
import { AiFeatureBadge } from '../../../shared/ai/AiFeatureBadge'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
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
  hasActiveFilters: boolean
  isLoading: boolean
  isRegenerating: boolean
  onTaskTypeChange: (value: CockpitTaskType | null) => void
  onUrgencyChange: (value: CockpitUrgency | null) => void
  onDayFilterChange: (value: CockpitDayFilter) => void
  onAsOfDateChange: (value: string | undefined) => void
  onRegenerate: () => void
  onReload: () => void
  onReset: () => void
}

export function CockpitToolbar({
  taskType,
  urgency,
  dayFilter,
  asOfDate,
  todayCount,
  visibleCount,
  hasActiveFilters,
  isLoading,
  isRegenerating,
  onTaskTypeChange,
  onUrgencyChange,
  onDayFilterChange,
  onAsOfDateChange,
  onRegenerate,
  onReload,
  onReset,
}: CockpitToolbarProps) {
  const { t } = useI18n()

  return (
    <Card className="app-filter-card cockpit-toolbar-card" withBorder radius="md" padding={0}>
      <div className="app-filter-bar cockpit-command-bar">
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
        <div className="app-filter-field cockpit-day-filter-field">
          <span className="app-filter-label">{t('Період')}</span>
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
        </div>
        <div className="app-filter-actions cockpit-command-actions">
          <AiFeatureBadge size="sm" tooltip={t('AI-сервіс завдань продажів')} />
          <Text className="cockpit-toolbar-count">
            {t('Завдань')}: <strong>{visibleCount}</strong>
          </Text>
          <Tooltip label={t('Скинути фільтри')}>
            <ActionIcon
              aria-label={t('Скинути фільтри')}
              disabled={!hasActiveFilters}
              size={34}
              variant="light"
              onClick={onReset}
            >
              <RotateCcw size={17} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Оновити')}>
            <ActionIcon aria-label={t('Оновити')} loading={isLoading} size={34} variant="light" onClick={onReload}>
              <RefreshCw size={18} />
            </ActionIcon>
          </Tooltip>
          <Button
            color={CREATE_ACTION_COLOR}
            leftSection={<Sparkles size={16} />}
            loading={isRegenerating}
            onClick={onRegenerate}
          >
            {t('Згенерувати завдання')}
          </Button>
        </div>
      </div>
    </Card>
  )
}
