import { Alert, Text } from '@mantine/core'
import { useI18n } from '../../i18n/useI18n'
import { physicalCoverageIntervals, type PhysicalCoverage } from './physicalCoverage'

export function PhysicalCoverageNotice({ coverage }: { coverage: readonly PhysicalCoverage[] }) {
  const { t } = useI18n()
  const intervals = physicalCoverageIntervals(coverage)
  if (!intervals.length) return null
  return <Alert color="yellow" title={t('Імпортована історія не покриває весь вибраний період')}>
    <Text size="sm">{intervals.length === 1
      ? t('Імпортований рух доступний за період:')
      : t('Періоди імпортованої історії відрізняються за складами:')} {intervals.join('; ')}.</Text>
    <Text size="sm">{t('За межами підтвердженого періоду складу показано лише рух, створений у GBA. Відсутність рядків не означає відсутність руху.')}</Text>
  </Alert>
}
