import { Card, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { CockpitTask } from '../types'
import { CockpitTaskSkeleton } from './CockpitTaskSkeleton'
import { TaskCard } from './TaskCard'

type CockpitTaskListProps = {
  isLoading: boolean
  pendingTaskKey: string | null
  tasks: CockpitTask[]
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
  onAddNote,
  onDismiss,
  onDone,
  onSnooze,
  onTakeInProgress,
}: CockpitTaskListProps) {
  const { t } = useI18n()

  if (isLoading) {
    return <CockpitTaskSkeleton label={t('Завантаження завдань')} />
  }

  if (tasks.length === 0) {
    return (
      <Card withBorder radius="md" padding="xl">
        <Text c="dimmed" fw={600} ta="center">
          {t('Активних завдань немає')}
        </Text>
      </Card>
    )
  }

  return (
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
  )
}
