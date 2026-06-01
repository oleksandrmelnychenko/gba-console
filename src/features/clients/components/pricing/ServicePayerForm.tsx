import { Button, Group, Stack, Textarea, TextInput } from '@mantine/core'
import { IconCheck, IconTrash } from '@tabler/icons-react'
import { useRef, useState } from 'react'
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

type ServicePayerFormErrors = Partial<Record<'LastName' | 'PaymentCard', string>>

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

function validateFormValues(values: ServicePayerFormValues): ServicePayerFormErrors {
  return {
    LastName: !values.LastName.trim() ? '*' : undefined,
    PaymentCard: !values.PaymentCard.trim() ? '*' : undefined,
  }
}

function hasFormErrors(errors: ServicePayerFormErrors): boolean {
  return Boolean(errors.LastName || errors.PaymentCard)
}

function getPayerFormKey(payer?: ServicePayer | null): string {
  if (!payer) {
    return 'new'
  }

  const identity =
    payer.NetUid && payer.NetUid !== EMPTY_NET_UID
      ? `net:${payer.NetUid}`
      : typeof payer.Id === 'number' && payer.Id > 0
        ? `id:${payer.Id}`
        : 'draft'

  return [
    identity,
    payer.Id ?? '',
    payer.NetUid ?? '',
    payer.ServiceType ?? '',
    payer.LastName ?? '',
    payer.FirstName ?? '',
    payer.MiddleName ?? '',
    payer.MobilePhone ?? '',
    payer.PaymentAddress ?? '',
    payer.PaymentCard ?? '',
    payer.Comment ?? '',
  ].join('|')
}

export function ServicePayerForm(props: ServicePayerFormProps) {
  return <ServicePayerFormFields key={getPayerFormKey(props.payer)} {...props} />
}

function ServicePayerFormFields({
  payer,
  disabled = false,
  onSubmit,
  onDelete,
  onCancel,
}: ServicePayerFormProps) {
  const { t } = useI18n()
  const isEdit = Boolean(payer && (payer.Id || payer.NetUid))
  const initialValues = toFormValues(payer)
  const valuesRef = useRef<ServicePayerFormValues>(initialValues)
  const [errors, setErrors] = useState<ServicePayerFormErrors>({})

  function update<K extends keyof ServicePayerFormValues>(key: K, value: string) {
    valuesRef.current = { ...valuesRef.current, [key]: value }
    setErrors((current) => (hasFormErrors(current) ? validateFormValues(valuesRef.current) : current))
  }

  function handleSubmit() {
    const nextErrors = validateFormValues(valuesRef.current)

    if (hasFormErrors(nextErrors)) {
      setErrors(nextErrors)
      return
    }

    const values = valuesRef.current

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
        defaultValue={initialValues.LastName}
        disabled={disabled}
        error={errors.LastName}
        label={t('Прізвище')}
        maxLength={30}
        required
        onChange={(event) => update('LastName', event.currentTarget.value)}
      />
      <TextInput
        defaultValue={initialValues.FirstName}
        disabled={disabled}
        label={t("Ім'я")}
        maxLength={30}
        onChange={(event) => update('FirstName', event.currentTarget.value)}
      />
      <TextInput
        defaultValue={initialValues.MiddleName}
        disabled={disabled}
        label={t('По батькові')}
        maxLength={30}
        onChange={(event) => update('MiddleName', event.currentTarget.value)}
      />
      <TextInput
        defaultValue={initialValues.MobilePhone}
        disabled={disabled}
        label={t('Мобільний телефон')}
        maxLength={30}
        onChange={(event) => update('MobilePhone', event.currentTarget.value)}
      />
      <TextInput
        defaultValue={initialValues.PaymentAddress}
        disabled={disabled}
        label={t('Адреса оплати')}
        maxLength={100}
        onChange={(event) => update('PaymentAddress', event.currentTarget.value)}
      />
      <TextInput
        defaultValue={initialValues.PaymentCard}
        disabled={disabled}
        error={errors.PaymentCard}
        label={t('Платіжна картка')}
        maxLength={100}
        required
        onChange={(event) => update('PaymentCard', event.currentTarget.value)}
      />
      <Textarea
        autosize
        defaultValue={initialValues.Comment}
        disabled={disabled}
        label={t('Коментар')}
        maxLength={100}
        minRows={2}
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
