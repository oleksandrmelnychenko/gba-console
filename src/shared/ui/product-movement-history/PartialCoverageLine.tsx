import { Text } from '@mantine/core'
import { useI18n } from '../../i18n/useI18n'
import { physicalCoverageIntervals, type PhysicalCoverage } from './physicalCoverage'

export const PARTIAL_COVERAGE_LINE = 'Рух товару за частину періоду недоступний'

export function PartialCoverageLine({ coverage }: { coverage: readonly PhysicalCoverage[] | null | undefined }) {
  const { t } = useI18n()
  if (!coverage?.length || !physicalCoverageIntervals(coverage).length) return null
  return <Text size="sm" c="orange.8" role="status">{t(PARTIAL_COVERAGE_LINE)}</Text>
}
