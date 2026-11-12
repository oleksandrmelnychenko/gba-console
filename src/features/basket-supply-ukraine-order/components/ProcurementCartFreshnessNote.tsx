import { Text } from '@mantine/core'
import { KYIV_TIME_ZONE } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { CartPlan } from '../procurementTypes'

type ProcurementCartFreshnessNoteProps = {
  className?: string
  plan: Pick<CartPlan, 'built_at' | 'stale'>
}

const kyivTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  timeZone: KYIV_TIME_ZONE,
})

export function ProcurementCartFreshnessNote({ className, plan }: ProcurementCartFreshnessNoteProps) {
  const { t } = useI18n()

  if (!plan.stale) {
    return null
  }

  const builtAt = plan.built_at ? new Date(plan.built_at) : null
  const time = builtAt && !Number.isNaN(builtAt.getTime()) ? kyivTimeFormatter.format(builtAt) : null

  return (
    <Text c="dimmed" className={className} size="xs">
      {time ? t('Дані на {time}, оновлюються', { time }) : t('Дані оновлюються')}
    </Text>
  )
}
