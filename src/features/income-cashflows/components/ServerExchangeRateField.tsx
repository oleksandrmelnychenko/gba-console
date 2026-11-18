import { TextInput } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { COMMERCIAL_RATE_LABEL } from '../../../shared/money/exchangeRateLabels'
import { formatServerExchangeRate } from './serverExchangeRate'

export interface ServerExchangeRateFieldProps {
  /** System rate the form looked up for the payment date (0 when unknown or the currencies are equal). */
  value: number | null | undefined
  className?: string
}

/**
 * «Курс» of an income cash order.
 *
 * The server always converts a new income order at the system rate of the payment
 * date (a rate typed by the user is discarded on create), so the field is read-only:
 * it shows that rate instead of accepting a value that would be silently replaced.
 */
export function ServerExchangeRateField({ className, value }: ServerExchangeRateFieldProps) {
  const { t } = useI18n()

  return (
    <TextInput
      className={className}
      description={t('На дату оплати; за ним оплата зараховується в договір')}
      label={t(COMMERCIAL_RATE_LABEL)}
      readOnly
      value={formatServerExchangeRate(value)}
      variant="filled"
    />
  )
}
