import { ActionIcon, Anchor, Badge, Button, Card, Group, Stack, Text, Tooltip } from '@mantine/core'
import { Check, CircleDashed, Clock, Mail, MessageCircle, MessageSquarePlus, Phone, Play, X } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { WhyThisTask } from './WhyThisTask'
import type { CockpitTask, CockpitTaskType, CockpitUrgency } from '../types'

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

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
  onTakeInProgress,
  onDone,
  onSnooze,
  onDismiss,
  onAddNote,
  pending = false,
}: {
  task: CockpitTask
  onTakeInProgress: (task: CockpitTask) => void
  onDone: (task: CockpitTask) => void
  onSnooze: (task: CockpitTask) => void
  onDismiss: (task: CockpitTask) => void
  onAddNote: (task: CockpitTask) => void
  pending?: boolean
}) {
  const { t } = useI18n()
  const phone = task.contact?.phone?.trim()
  const email = task.contact?.email?.trim()
  const viber = task.contact?.viber?.trim()
  const notesCount = task.notes?.length ?? 0
  const isInProgress = task.status === 'in_progress'
  const canTakeInProgress = task.status === 'open' || task.status === 'snoozed'
  const inProgressLabel = isInProgress ? inProgressBadgeLabel(task.in_progress_since, t) : ''
  const expectedValue = typeof task.expected_value === 'number' ? task.expected_value : null
  const pOutcome = typeof task.p_outcome === 'number' ? task.p_outcome : null

  return (
    <Card className={`cockpit-task is-${task.urgency ?? 'normal'}`} padding="md" radius="md" withBorder>
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
              {isInProgress && (
                <Badge color="orange" leftSection={<CircleDashed size={12} />} variant="light">
                  {inProgressLabel}
                </Badge>
              )}
            </Group>
            <Text className="cockpit-task-title">{task.title || t('Завдання')}</Text>
            {task.client_name && <Text className="cockpit-task-client">{task.client_name}</Text>}
          </Stack>

          <Group gap={4} wrap="nowrap">
            {phone && (
              <Tooltip label={`${t('Подзвонити')}: ${phone}`}>
                <ActionIcon color="green" component="a" href={`tel:${phone}`} variant="light">
                  <Phone size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            {email && (
              <Tooltip label={`${t('Написати')}: ${email}`}>
                <ActionIcon color="blue" component="a" href={`mailto:${email}`} variant="light">
                  <Mail size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            {viber && (
              <Tooltip label={`Viber: ${viber}`}>
                <ActionIcon color="orange" component="a" href={`viber://chat?number=${viber}`} variant="light">
                  <MessageCircle size={18} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>

        {task.reason && <Text className="cockpit-task-reason">{task.reason}</Text>}

        {(expectedValue !== null || pOutcome !== null) && (
          <Group gap="xs" wrap="nowrap">
            {expectedValue !== null && (
              <Text className="cockpit-task-ev" size="xs">
                {t('Очікувана цінність')}: {formatMoney(expectedValue)}
              </Text>
            )}
            {pOutcome !== null && (
              <Badge color="teal" size="sm" variant="light">
                {t('шанс')} {formatPercent(pOutcome)}
              </Badge>
            )}
          </Group>
        )}

        <WhyThisTask task={task} />

        {notesCount > 0 && (
          <Anchor component="button" size="xs" type="button" onClick={() => onAddNote(task)}>
            {t('Нотатки')}: {notesCount}
          </Anchor>
        )}

        <Group gap="xs" justify="flex-end">
          {canTakeInProgress && (
            <Button
              color="orange"
              disabled={pending}
              leftSection={<Play size={16} />}
              size="xs"
              onClick={() => onTakeInProgress(task)}
            >
              {t('Взяти в роботу')}
            </Button>
          )}
          <Button color="green" leftSection={<Check size={16} />} size="xs" variant={canTakeInProgress ? 'light' : 'filled'} onClick={() => onDone(task)}>
            {t('Виконано')}
          </Button>
          <Button color="gray" leftSection={<Clock size={16} />} size="xs" variant="light" onClick={() => onSnooze(task)}>
            {t('Відкласти')}
          </Button>
          <Button color="blue" leftSection={<MessageSquarePlus size={16} />} size="xs" variant="outline" onClick={() => onAddNote(task)}>
            {t('Нотатка')}
          </Button>
          <Button color="red" leftSection={<X size={16} />} size="xs" variant="subtle" onClick={() => onDismiss(task)}>
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

function inProgressBadgeLabel(since: string | null | undefined, t: (key: string) => string): string {
  const elapsed = formatElapsed(since)
  return elapsed ? `${t('в роботі')} ${elapsed}` : t('В роботі')
}

// Reads in_progress_since defensively — the backend field may be absent for now,
// in which case we just show "В роботі" without an elapsed counter.
function formatElapsed(since: string | null | undefined): string | null {
  if (!since) {
    return null
  }

  const start = Date.parse(since)
  if (Number.isNaN(start)) {
    return null
  }

  const diffMs = Date.now() - start
  if (diffMs < 0) {
    return null
  }

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) {
    return `${minutes} хв`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} год`
  }

  const days = Math.floor(hours / 24)
  return `${days} дн`
}

function formatMoney(value: number): string {
  return `€${moneyFormatter.format(value)}`
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}
