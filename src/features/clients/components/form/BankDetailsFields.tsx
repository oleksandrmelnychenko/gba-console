import { Card, Group, SimpleGrid, Stack, Select, Text, TextInput } from '@mantine/core'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { Client, ClientBankDetails, Currency } from '../../types'
import type { ClientFormErrors } from './validateClientForm'

export type BankDetailsFieldsProps = {
  client: Client
  currencies: Currency[]
  errors?: ClientFormErrors
  sourceManaged?: boolean
  onBankFieldChange: (key: 'BankAndBranch' | 'Swift' | 'BranchCode' | 'BankAddress', value: string) => void
  onAccountNumberChange: (value: string) => void
  onAccountNumberCurrencyChange: (currency: Currency | null) => void
  onIbanNumberChange: (value: string) => void
  onIbanNumberCurrencyChange: (currency: Currency | null) => void
}

export function BankDetailsFields(props: BankDetailsFieldsProps) {
  const { t } = useI18n()
  const bankDetails: ClientBankDetails = props.client.ClientBankDetails || {}
  const currencyOptions = props.currencies.map((currency) => ({
    value: String(currency.Id),
    label: currency.Name || '',
  }))

  return (
    <Card className="app-section-card" withBorder radius="md" padding="md">
      <Stack gap="md">
        <Text className="client-section-title" fw={600}>{t('Банківські реквізити')}</Text>

        <TextInput
          disabled={props.sourceManaged}
          label={t('Банк та відділення')}
          value={bankDetails.BankAndBranch || ''}
          onChange={(event) => props.onBankFieldChange('BankAndBranch', event.currentTarget.value)}
        />

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <TextInput
            disabled={props.sourceManaged}
            error={props.errors?.BankAccountNumber}
            inputMode="numeric"
            label={t('Номер рахунку')}
            maxLength={40}
            value={bankDetails.AccountNumber?.AccountNumber || ''}
            onChange={(event) => props.onAccountNumberChange(event.currentTarget.value)}
          />
          <Select
            clearable
            disabled={props.sourceManaged}
            searchable
            data={currencyOptions}
            error={props.errors?.BankAccountCurrency}
            label={t('Валюта рахунку')}
            placeholder={t('Оберіть валюту')}
            value={bankDetails.AccountNumber?.Currency?.Id != null ? String(bankDetails.AccountNumber.Currency.Id) : null}
            onChange={(value) => {
              const next = props.currencies.find((currency) => String(currency.Id) === value) || null
              props.onAccountNumberCurrencyChange(next)
            }}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <TextInput
            disabled={props.sourceManaged}
            error={props.errors?.BankIban}
            label="IBAN"
            maxLength={42}
            value={bankDetails.ClientBankDetailIbanNo?.IBANNO || ''}
            onChange={(event) => props.onIbanNumberChange(event.currentTarget.value)}
          />
          <Select
            clearable
            disabled={props.sourceManaged}
            searchable
            data={currencyOptions}
            error={props.errors?.BankIbanCurrency}
            label={t('Валюта IBAN')}
            placeholder={t('Оберіть валюту')}
            value={
              bankDetails.ClientBankDetailIbanNo?.Currency?.Id != null
                ? String(bankDetails.ClientBankDetailIbanNo.Currency.Id)
                : null
            }
            onChange={(value) => {
              const next = props.currencies.find((currency) => String(currency.Id) === value) || null
              props.onIbanNumberCurrencyChange(next)
            }}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <TextInput
            error={props.errors?.BankSwift}
            label="SWIFT"
            maxLength={11}
            value={bankDetails.Swift || ''}
            onChange={(event) => props.onBankFieldChange('Swift', event.currentTarget.value)}
          />
          <TextInput
            label={t('Код відділення')}
            value={bankDetails.BranchCode || ''}
            onChange={(event) => props.onBankFieldChange('BranchCode', event.currentTarget.value)}
          />
        </SimpleGrid>

        <Group grow>
          <TextInput
            label={t('Адреса банку')}
            value={bankDetails.BankAddress || ''}
            onChange={(event) => props.onBankFieldChange('BankAddress', event.currentTarget.value)}
          />
        </Group>
      </Stack>
    </Card>
  )
}
