import { Badge, Card, Group, Stack, Text } from '@mantine/core'
import { CheckCircle2 } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { CockpitTask } from '../types'
import { CockpitTaskSkeleton } from './CockpitTaskSkeleton'
import { TaskCard } from './TaskCard'

type CockpitTaskListProps = {
  isLoading: boolean
  pendingTaskKey: string | null
  tasks: CockpitTask[]
  title?: string
  onAddNote: (task: CockpitTask) => void
  onDismiss: (task: CockpitTask) => void
  onDone: (task: CockpitTask) => void
  onSnooze: (task: CockpitTask) => void
  onTakeInProgress: (task: CockpitTask) => void
}

export function CockpitTaskList({
  isLoading,
  pendingTaskKey,
  tasks,
  title,
  onAddNote,
  onDismiss,
  onDone,
  onSnooze,
  onTakeInProgress,
}: CockpitTaskListProps) {
  const { t } = useI18n()

  return (
    <Card className="app-section-card cockpit-task-list" withBorder radius="md">
      <Stack gap="md">
        <Group justify="space-between" gap="sm">
          <Text className="app-section-title" fw={600} size="sm">
            {t(title ?? 'Поточні завдання')}
          </Text>
          <Badge className="app-role-pill is-gray" variant="light">
            {tasks.length}
          </Badge>
        </Group>

        {isLoading ? (
          <CockpitTaskSkeleton label={t('Завантаження завдань')} />
        ) : tasks.length === 0 ? (
          <div className="cockpit-task-empty" role="status">
            <span className="cockpit-task-empty__icon" aria-hidden="true">
              <CheckCircle2 size={20} />
            </span>
            <Stack gap={2}>
              <Text fw={600}>{t('Активних завдань немає')}</Text>
              <Text c="dimmed" size="xs">
                {t('Змініть фільтри або згенеруйте нову AI-чергу')}
              </Text>
            </Stack>
          </div>
        ) : (
          <Stack gap="sm">
            {tasks.map((task) => (
              <TaskCard
                key={task.task_key}
                pending={pendingTaskKey === task.task_key}
                task={task}
                onAddNote={onAddNote}
                onDismiss={onDismiss}
                onDone={onDone}
                onSnooze={onSnooze}
                onTakeInProgress={onTakeInProgress}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  )
}
