import { Alert, Text } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { displayCalendarDate } from '../data/salesGeographyPresentation'
import type { SalesGeographySummary } from '../types'

const asOfFormatter = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv',
  dateStyle: 'short',
  timeStyle: 'short',
})

export function GeographyContext({ summary }: { summary: SalesGeographySummary }) {
  const { t } = useI18n()
  return (
    <div className="sales-geography-context">
      {summary.Metric === 'sales' ? (
        <SalesContext summary={summary} />
      ) : (
        <>
          <Text size="sm" fw={600}>
            {t('Увесь поточний борг, включно з непростроченим')}
          </Text>
          <Text size="xs" c="dimmed">
            {t(
              'Поточні додатні залишки боргу. EUR визначено за історичними даними документа. Область — поточний регіон клієнта.',
            )}
          </Text>
        </>
      )}
      <Text size="xs" c="dimmed">
        {t('Розраховано')}: {asOfFormatter.format(new Date(summary.AsOfUtc))} ({t('Київ')})
      </Text>
      {summary.UnresolvedAmountCount > 0 && (
        <Alert color="yellow" icon={<CircleAlert size={16} />}>
          {t('Повну суму в EUR не визначено')}: {summary.UnresolvedAmountCount}{' '}
          {t(summary.UnresolvedUnit === 'debts' ? 'боргів' : 'рядків документів')}.{' '}
          {t('Відомий підсумок є частковим і не замінює повної суми.')}
        </Alert>
      )}
    </div>
  )
}

function SalesContext({ summary }: { summary: SalesGeographySummary }) {
  const { t } = useI18n()
  const beforeAvailable = summary.From && summary.AvailableFrom && summary.From < summary.AvailableFrom
  return (
    <>
      {summary.From && summary.To && (
        <Text size="sm" fw={600}>
          {`${t('Період')}: ${displayCalendarDate(summary.From)} — ${displayCalendarDate(summary.To)} (${t('включно, Київ')})`}
        </Text>
      )}
      <Text size="xs" c="dimmed">
        {t('Підтверджені накладні мінус активні повернення, з ПДВ. Область — поточний регіон клієнта.')}
      </Text>
      <Text size="xs" c="dimmed">
        {summary.AvailableFrom
          ? `${t('Наявна історія з')}: ${displayCalendarDate(summary.AvailableFrom)}. ${t('Раніші документи не враховано.')}`
          : t('У завантаженій історії немає документів продажу або повернення.')}
        {summary.LatestDocumentDate &&
          ` ${t('Останній документ')}: ${displayCalendarDate(summary.LatestDocumentDate)}.`}
      </Text>
      {!summary.ImportCompletenessConfirmed && (
        <Text size="xs" c="dimmed">
          {t(
            'Повноту завантаження історії не підтверджено. Дати першого й останнього документа не гарантують наявності всіх документів між ними.',
          )}
        </Text>
      )}
      {beforeAvailable && (
        <Alert color="yellow" icon={<CircleAlert size={16} />}>
          {t('Обраний період починається раніше наявної історії. Підсумок охоплює лише завантажені документи.')}
        </Alert>
      )}
    </>
  )
}
