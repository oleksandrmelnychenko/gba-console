import { Button, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core'
import { Save } from 'lucide-react'
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
  onFormDateChange,
  onRateAmountChange,
  onSubmit,
  rateAmounts,
}: CurrencyRatesUpdateFormProps) {
  const { t } = useI18n()

  return (
    <form className="exchange-rates-form" onSubmit={onSubmit}>
      <Stack gap="sm">
        <TextInput
          label={t('Дата створення')}
          type="datetime-local"
          value={toDateTimeInputValue(formDate)}
          onChange={(event) => onFormDateChange(parseDateTimeInputValue(event.currentTarget.value, formDate))}
        />
        <Group gap="xs" wrap="wrap">
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
        </Group>
        {formError && (
          <Text size="sm" c="red">
            {formError}
          </Text>
        )}
        <Button type="submit" color={CREATE_ACTION_COLOR} loading={isSaving} leftSection={<Save size={16} strokeWidth={1.8} />}>
          {t('Зберегти')}
        </Button>
      </Stack>
    </form>
  )
}
