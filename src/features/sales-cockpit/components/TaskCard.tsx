import { ActionIcon, Anchor, Badge, Button, Card, Group, Stack, Text, Tooltip } from '@mantine/core'
import {
  IconCheck,
  IconClock,
  IconMail,
  IconMessageCircle,
  IconMessagePlus,
  IconPhone,
  IconX,
} from '@tabler/icons-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { WhyThisTask } from './WhyThisTask'
import type { CockpitTask, CockpitTaskType, CockpitUrgency } from '../types'

const URGENCY_COLOR: Record<CockpitUrgency, string> = {
  critical: 'red',
  high: 'orange',
  normal: 'blue',
  low: 'gray',
}

const URGENCY_LABEL: Record<CockpitUrgency, string> = {
  critical: 'Критично',
  high: 'Високий',
  normal: 'Звичайний',
  low: 'Низький',
}

const TASK_TYPE_LABEL: Record<CockpitTaskType, string> = {
  reorder_due: 'Час повторного замовлення',
  debt_followup: 'Контроль заборгованості',
  cross_sell: 'Крос-продаж',
  churn_winback: 'Повернення клієнта',
  new_client_activation: 'Активація нового клієнта',
}

export function TaskCard({
  task,
  onDone,
  onSnooze,
  onDismiss,
  onAddNote,
}: {
  task: CockpitTask
  onDone: (task: CockpitTask) => void
  onSnooze: (task: CockpitTask) => void
  onDismiss: (task: CockpitTask) => void
  onAddNote: (task: CockpitTask) => void
}) {
  const { t } = useI18n()
  const phone = task.contact?.phone?.trim()
  const email = task.contact?.email?.trim()
  const viber = task.contact?.viber?.trim()
  const notesCount = task.notes?.length ?? 0

  return (
    <Card padding="md" radius="md" withBorder>
      <Stack gap="sm">
        <Group align="flex-start" gap="sm" justify="space-between" wrap="nowrap">
          <Stack gap={4}>
            <Group gap="xs" wrap="nowrap">
              <Badge color={urgencyColor(task.urgency)} variant="filled">
                {urgencyLabel(task.urgency, t)}
              </Badge>
              {task.task_type && (
                <Badge color="gray" variant="light">
                  {taskTypeLabel(task.task_type, t)}
                </Badge>
              )}
              {task.sla_breached && (
                <Badge color="red" variant="light">
                  {t('Прострочено SLA')}
                </Badge>
              )}
            </Group>
            <Text fw={600}>{task.title || t('Завдання')}</Text>
            {task.client_name && (
              <Text c="dimmed" size="sm">
                {task.client_name}
              </Text>
            )}
          </Stack>

          <Group gap={4} wrap="nowrap">
            {phone && (
              <Tooltip label={`${t('Подзвонити')}: ${phone}`}>
                <ActionIcon color="green" component="a" href={`tel:${phone}`} variant="light">
                  <IconPhone size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            {email && (
              <Tooltip label={`${t('Написати')}: ${email}`}>
                <ActionIcon color="blue" component="a" href={`mailto:${email}`} variant="light">
                  <IconMail size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            {viber && (
              <Tooltip label={`Viber: ${viber}`}>
                <ActionIcon color="grape" component="a" href={`viber://chat?number=${viber}`} variant="light">
                  <IconMessageCircle size={18} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>

        {task.reason && (
          <Text size="sm">{task.reason}</Text>
        )}

        <WhyThisTask task={task} />

        {notesCount > 0 && (
          <Anchor component="button" size="xs" type="button" onClick={() => onAddNote(task)}>
            {t('Нотатки')}: {notesCount}
          </Anchor>
        )}

        <Group gap="xs" justify="flex-end">
          <Button color="green" leftSection={<IconCheck size={16} />} size="xs" onClick={() => onDone(task)}>
            {t('Виконано')}
          </Button>
          <Button color="gray" leftSection={<IconClock size={16} />} size="xs" variant="light" onClick={() => onSnooze(task)}>
            {t('Відкласти')}
          </Button>
          <Button color="blue" leftSection={<IconMessagePlus size={16} />} size="xs" variant="light" onClick={() => onAddNote(task)}>
            {t('Нотатка')}
          </Button>
          <Button color="red" leftSection={<IconX size={16} />} size="xs" variant="subtle" onClick={() => onDismiss(task)}>
            {t('Відхилити')}
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}

function urgencyColor(urgency?: CockpitUrgency): string {
  return urgency ? URGENCY_COLOR[urgency] : 'blue'
}

function urgencyLabel(urgency: CockpitUrgency | undefined, t: (key: string) => string): string {
  return t(urgency ? URGENCY_LABEL[urgency] : URGENCY_LABEL.normal)
}

function taskTypeLabel(taskType: CockpitTaskType, t: (key: string) => string): string {
  return t(TASK_TYPE_LABEL[taskType])
}
