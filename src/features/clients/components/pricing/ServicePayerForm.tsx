import { Button, Group, Stack, Textarea, TextInput } from '@mantine/core'
import { IconCheck, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { ServicePayer } from '../../types'

const EMPTY_NET_UID = '00000000-0000-0000-0000-000000000000'

export type ServicePayerFormValues = {
  LastName: string
  FirstName: string
  MiddleName: string
  MobilePhone: string
  PaymentAddress: string
  PaymentCard: string
  Comment: string
}

export type ServicePayerFormProps = {
  payer?: ServicePayer | null
  disabled?: boolean
  onSubmit: (payer: ServicePayer) => void
  onDelete?: (payer: ServicePayer) => void
  onCancel?: () => void
}

function toFormValues(payer?: ServicePayer | null): ServicePayerFormValues {
  return {
    LastName: payer?.LastName || '',
    FirstName: payer?.FirstName || '',
    MiddleName: payer?.MiddleName || '',
    MobilePhone: payer?.MobilePhone || '',
    PaymentAddress: payer?.PaymentAddress || '',
    PaymentCard: payer?.PaymentCard || '',
    Comment: payer?.Comment || '',
  }
}

export function ServicePayerForm({
  payer,
  disabled = false,
  onSubmit,
  onDelete,
  onCancel,
}: ServicePayerFormProps) {
  const { t } = useI18n()
  const isEdit = Boolean(payer && (payer.Id || payer.NetUid))
  const [values, setValues] = useState<ServicePayerFormValues>(() => toFormValues(payer))
  const [showErrors, setShowErrors] = useState(false)
  const [prevPayer, setPrevPayer] = useState(payer)

  if (payer !== prevPayer) {
    setPrevPayer(payer)
    setValues(toFormValues(payer))
    setShowErrors(false)
  }

  const lastNameError = !values.LastName.trim() ? '*' : undefined
  const paymentCardError = !values.PaymentCard.trim() ? '*' : undefined
  const isValid = !lastNameError && !paymentCardError

  function update<K extends keyof ServicePayerFormValues>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit() {
    if (!isValid) {
      setShowErrors(true)
      return
    }

    onSubmit({
      ...(payer || {}),
      Id: payer?.Id ?? 0,
      NetUid: payer?.NetUid ?? EMPTY_NET_UID,
      ServiceType: payer?.ServiceType ?? 0,
      LastName: values.LastName.trim(),
      FirstName: values.FirstName.trim(),
      MiddleName: values.MiddleName.trim(),
      MobilePhone: values.MobilePhone.trim(),
      PaymentAddress: values.PaymentAddress.trim(),
      PaymentCard: values.PaymentCard.trim(),
      Comment: values.Comment.trim(),
    })
  }

  return (
    <Stack gap="md">
      <TextInput
        error={showErrors ? lastNameError : undefined}
        label={t('Прізвище')}
        maxLength={30}
        required
        value={values.LastName}
        onChange={(event) => update('LastName', event.currentTarget.value)}
      />
      <TextInput
        label={t("Ім'я")}
        maxLength={30}
        value={values.FirstName}
        onChange={(event) => update('FirstName', event.currentTarget.value)}
      />
      <TextInput
        label={t('По батькові')}
        maxLength={30}
        value={values.MiddleName}
        onChange={(event) => update('MiddleName', event.currentTarget.value)}
      />
      <TextInput
        label={t('Мобільний телефон')}
        maxLength={30}
        value={values.MobilePhone}
        onChange={(event) => update('MobilePhone', event.currentTarget.value)}
      />
      <TextInput
        label={t('Адреса оплати')}
        maxLength={100}
        value={values.PaymentAddress}
        onChange={(event) => update('PaymentAddress', event.currentTarget.value)}
      />
      <TextInput
        error={showErrors ? paymentCardError : undefined}
        label={t('Платіжна картка')}
        maxLength={100}
        required
        value={values.PaymentCard}
        onChange={(event) => update('PaymentCard', event.currentTarget.value)}
      />
      <Textarea
        autosize
        label={t('Коментар')}
        maxLength={100}
        minRows={2}
        value={values.Comment}
        onChange={(event) => update('Comment', event.currentTarget.value)}
      />

      <Group justify="space-between">
        <div>
          {isEdit && onDelete && (
            <Button
              color="red"
              disabled={disabled}
              leftSection={<IconTrash size={16} />}
              variant="light"
              onClick={() => payer && onDelete(payer)}
            >
              {t('Видалити')}
            </Button>
          )}
        </div>
        <Group gap="sm">
          {onCancel && (
            <Button color="gray" disabled={disabled} variant="subtle" onClick={onCancel}>
              {t('Скасувати')}
            </Button>
          )}
          <Button
            color="violet"
            disabled={disabled}
            leftSection={<IconCheck size={16} />}
            onClick={handleSubmit}
          >
            {isEdit ? t('Зберегти') : t('Додати')}
          </Button>
        </Group>
      </Group>
    </Stack>
  )
}
