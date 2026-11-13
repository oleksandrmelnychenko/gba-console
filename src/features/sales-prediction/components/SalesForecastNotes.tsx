import { Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'

export const FLAT_RUN_RATE = 'flat_run_rate'

export function ForecastHorizonShapeNote({ horizonShape }: { horizonShape?: string | null }) {
  const { t } = useI18n()
  if (horizonShape !== FLAT_RUN_RATE) return null
  return (
    <Text c="dimmed" data-testid="forecast-horizon-shape" size="xs">
      {t('Прогноз — рівень поточного темпу продажів на кожен місяць (без сезонності й тренду)')}
    </Text>
  )
}

export function ForecastPairCaveat() {
  const { t } = useI18n()
  return (
    <Text c="dimmed" data-testid="forecast-pair-caveat" size="xs">
      {t('Прогноз для пари «клієнт + товар» — орієнтир зверху: на перевірці він завищував продажі на 22–28 %')}
    </Text>
  )
}
