import { Divider, SimpleGrid, Stack, TextInput } from '@mantine/core'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { Client } from '../../types'
import type { ClientFieldErrors, ClientFormRole } from './GeneralInfoFields'

export type ContactInfoFieldsProps = {
  client: Client
  role: ClientFormRole
  errors?: ClientFieldErrors
  onChange: <K extends keyof Client>(key: K, value: Client[K]) => void
}

export function ContactInfoFields({ client, errors, role, onChange }: ContactInfoFieldsProps) {
  const { t } = useI18n()

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
        <TextInput
          error={errors?.EmailAddress}
          label="Email"
          maxLength={100}
          value={client.EmailAddress || ''}
          onChange={(event) => onChange('EmailAddress', event.currentTarget.value)}
        />
        {role.isBuyer && (
          <TextInput
            error={errors?.ICQ}
            label="ICQ"
            maxLength={20}
            value={client.ICQ || ''}
            onChange={(event) => onChange('ICQ', event.currentTarget.value)}
          />
        )}
        <TextInput
          error={errors?.FaxNumber}
          label={t('Факс')}
          maxLength={20}
          value={client.FaxNumber || ''}
          onChange={(event) => onChange('FaxNumber', event.currentTarget.value)}
        />
        <TextInput
          label={t('Телефон')}
          value={client.ClientNumber || ''}
          onChange={(event) => onChange('ClientNumber', event.currentTarget.value)}
        />
        {role.isBuyer && (
          <TextInput
            error={errors?.SMSNumber}
            label={t('Телефон для SMS')}
            maxLength={20}
            value={client.SMSNumber || ''}
            onChange={(event) => onChange('SMSNumber', event.currentTarget.value)}
          />
        )}
        {role.isProvider && (
          <TextInput
            label={t("Ім'я")}
            value={client.SupplierName || ''}
            onChange={(event) => onChange('SupplierName', event.currentTarget.value)}
          />
        )}
      </SimpleGrid>

      {role.isBuyer && (
        <>
          <Divider />
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
            <TextInput
              error={errors?.AccountantNumber}
              label={t('Телефон бухгалтера')}
              maxLength={20}
              value={client.AccountantNumber || ''}
              onChange={(event) => onChange('AccountantNumber', event.currentTarget.value)}
            />
            <TextInput
              error={errors?.DirectorNumber}
              label={t('Телефон директора')}
              maxLength={20}
              value={client.DirectorNumber || ''}
              onChange={(event) => onChange('DirectorNumber', event.currentTarget.value)}
            />
            <TextInput
              error={errors?.Manager}
              label={t('Директор')}
              maxLength={250}
              value={client.Manager || ''}
              onChange={(event) => onChange('Manager', event.currentTarget.value)}
            />
          </SimpleGrid>
          <Divider />
        </>
      )}

      <SimpleGrid cols={{ base: 1, md: role.isBuyer ? 3 : 1 }} spacing="sm">
        {role.isBuyer && (
          <TextInput
            error={errors?.DeliveryAddress}
            label={t('Адреса доставки')}
            maxLength={500}
            value={client.DeliveryAddress || ''}
            onChange={(event) => onChange('DeliveryAddress', event.currentTarget.value)}
          />
        )}
        {role.isBuyer && (
          <TextInput
            error={errors?.LegalAddress}
            label={t('Юридична адреса')}
            maxLength={500}
            value={client.LegalAddress || ''}
            onChange={(event) => onChange('LegalAddress', event.currentTarget.value)}
          />
        )}
        <TextInput
          error={errors?.ActualAddress}
          label={t('Фактична адреса')}
          maxLength={500}
          value={client.ActualAddress || ''}
          onChange={(event) => onChange('ActualAddress', event.currentTarget.value)}
        />
      </SimpleGrid>
    </Stack>
  )
}
