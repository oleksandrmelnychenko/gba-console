import { Alert, NumberInput, Text } from '@mantine/core'
import type { FormEvent } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentDetailSection } from '../../../shared/ui/document-detail/DocumentDetail'
import type { ExchangeRate } from '../types'
import { parseDateTimeInputValue, toDateTimeInputValue } from '../utils'
import { AppDateInput } from '../../../shared/ui/AppDateInput'

type CurrencyRatesUpdateFormProps = {
  id: string
  amountEntries: Array<{ key: string; rate: ExchangeRate }>
  formDate: Date
  formError: string | null
  isSaving: boolean
  onFormDateChange: (date: Date) => void
  onRateAmountChange: (key: string, value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  rateAmounts: Record<string, string>
}

export function CurrencyRatesUpdateForm({ id, amountEntries, formDate, formError, isSaving, onFormDateChange, onRateAmountChange, onSubmit, rateAmounts }: CurrencyRatesUpdateFormProps) {
  const { t } = useI18n()

  return (
    <form id={id} className="exchange-rates-form" onSubmit={onSubmit}>
      <DocumentDetailSection title={t('Оновлення курсу')} stacked>
        <Text size="xs" c="dimmed">{t('Вкажіть дату та нове значення')}</Text>
        <AppDateInput
          label={t('Дата створення')}
          type="datetime-local"
          autoFocus
          value={toDateTimeInputValue(formDate)}
          disabled={isSaving}
          onChange={(event) => onFormDateChange(parseDateTimeInputValue(event.currentTarget.value, formDate))}
        />
        <div className="exchange-rates-form-fields">
          {amountEntries.map(({ key, rate }) => (
            <NumberInput
              key={key}
              label={rate.Code}
              min={0}
              decimalScale={6}
              value={rateAmounts[key] || ''}
              disabled={isSaving}
              onChange={(value) => onRateAmountChange(key, String(value ?? ''))}
              className="exchange-rates-form-input"
            />
          ))}
        </div>
        {formError && <Alert color="red">{formError}</Alert>}
      </DocumentDetailSection>
    </form>
  )
}
