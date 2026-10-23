import { useI18n } from '../../../shared/i18n/useI18n'

import { formatGeographyMoney } from '../data/salesGeographyPresentation'

export function GeographyAmount({ value, known }: { value: number | null; known: number }) {
  const { t } = useI18n()
  return (
    <span className="sales-geography-amount app-money">
      {value === null ? (
        <>
          <span>{t('Не визначено')}</span>
          <small>
            {t('Відомо')}: {formatGeographyMoney(known)}
          </small>
        </>
      ) : (
        formatGeographyMoney(value)
      )}
    </span>
  )
}
