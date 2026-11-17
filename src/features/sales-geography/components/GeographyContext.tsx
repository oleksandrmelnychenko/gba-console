import { Alert } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { SalesGeographySummary } from '../types'

// Only actionable warnings; the period, scope and freshness captions were
// removed as noise (the period is already set by the toolbar control).
export function GeographyContext({ summary }: { summary: SalesGeographySummary }) {
  const { t } = useI18n()
  const beforeAvailable =
    summary.Metric === 'sales' && summary.From && summary.AvailableFrom && summary.From < summary.AvailableFrom
  if (!beforeAvailable && summary.UnresolvedAmountCount <= 0) return null
  return (
    <div className="sales-geography-context">
      {beforeAvailable && (
        <Alert color="yellow" icon={<CircleAlert size={16} />}>
          {t('Обраний період починається раніше наявної історії. Підсумок охоплює лише завантажені документи.')}
        </Alert>
      )}
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
