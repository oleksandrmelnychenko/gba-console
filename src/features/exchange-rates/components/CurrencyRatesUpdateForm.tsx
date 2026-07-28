import { Button, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core'
import { Save, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ExchangeRate } from '../types'
import { parseDateTimeInputValue, toDateTimeInputValue } from '../utils'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'

type CurrencyRatesUpdateFormProps = {
  amountEntries: Array<{ key: string; rate: ExchangeRate }>
  formDate: Date
  formError: string | null
  isSaving: boolean
  onCancel: () => void
  onFormDateChange: (date: Date) => void
  onRateAmountChange: (key: string, value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  rateAmounts: Record<string, string>
}

export function CurrencyRatesUpdateForm({
  amountEntries,
  formDate,
  formError,
  isSaving,
  onCancel,
  onFormDateChange,
  onRateAmountChange,
  onSubmit,
  rateAmounts,
}: CurrencyRatesUpdateFormProps) {
  const { t } = useI18n()

  return (
    <form className="exchange-rates-form" onSubmit={onSubmit}>
      <Stack gap={10}>
        <Stack gap={2} className="exchange-rates-form-heading">
          <Text className="exchange-rates-form-title">{t('Оновлення курсу')}</Text>
          <Text className="exchange-rates-form-hint">{t('Вкажіть дату та нове значення')}</Text>
        </Stack>
        <div className="exchange-rates-form-fields">
          <TextInput
            label={t('Дата створення')}
            type="datetime-local"
            value={toDateTimeInputValue(formDate)}
            onChange={(event) => onFormDateChange(parseDateTimeInputValue(event.currentTarget.value, formDate))}
          />
          {amountEntries.map(({ key, rate }) => (
            <NumberInput
              key={key}
              label={rate.Code}
              min={0}
              decimalScale={6}
              value={rateAmounts[key] || ''}
              onChange={(value) => onRateAmountChange(key, String(value ?? ''))}
              className="exchange-rates-form-input"
            />
          ))}
        </div>
        {formError && (
          <Text c="red" className="exchange-rates-form-error">
            {formError}
          </Text>
        )}
        <Group gap="xs" wrap="nowrap" className="exchange-rates-form-actions">
          <Button
            type="button"
            variant="default"
            color="gray"
            disabled={isSaving}
            leftSection={<X size={14} strokeWidth={1.8} />}
            onClick={onCancel}
            className="exchange-rates-form-cancel"
          >
            {t('Скасувати')}
          </Button>
          <Button
            type="submit"
            color={CREATE_ACTION_COLOR}
            loading={isSaving}
            leftSection={<Save size={14} strokeWidth={1.8} />}
            className="exchange-rates-form-submit"
          >
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
