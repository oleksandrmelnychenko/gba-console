import { Alert, Button, Group, Select, Stack, Textarea, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { CreateProtocolPayload, ProtocolOrganization } from '../types'
import { SupplyTransportationType } from '../types'

export type NewProductDeliveryProtocolModalProps = {
  createError: string | null
  isCreating: boolean
  opened: boolean
  organizations: ProtocolOrganization[]
  organizationsError: string | null
  onClose: () => void
  onCreate: (payload: CreateProtocolPayload) => void
}

export function NewProductDeliveryProtocolModal({
  createError,
  isCreating,
  opened,
  organizations,
  organizationsError,
  onClose,
  onCreate,
}: NewProductDeliveryProtocolModalProps) {
  const { t } = useI18n()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [transportationType, setTransportationType] = useState<string>(String(SupplyTransportationType.Vehicle))
  const [fromDate, setFromDate] = useState(formatLocalDate(new Date()))
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [wasOpened, setWasOpened] = useState(opened)

  if (opened !== wasOpened) {
    setWasOpened(opened)

    if (opened) {
      setOrganizationId(null)
      setTransportationType(String(SupplyTransportationType.Vehicle))
      setFromDate(formatLocalDate(new Date()))
      setComment('')
      setSubmitted(false)
    }
  }

  const organizationOptions = useMemo(
    () =>
      organizations
        .filter((organization) => organization.NetUid || organization.Id)
        .map((organization) => ({
          label: organization.Name || organization.FullName || String(organization.NetUid || organization.Id),
          value: String(organization.NetUid || organization.Id),
        })),
    [organizations],
  )

  const transportationOptions = useMemo(
    () => [
      { label: t('Поставка вантажівкою'), value: String(SupplyTransportationType.Vehicle) },
      { label: t('Поставка кораблем'), value: String(SupplyTransportationType.Ship) },
      { label: t('Доставка літаком'), value: String(SupplyTransportationType.Plane) },
    ],
    [t],
  )

  const organizationMissing = submitted && !organizationId
  const dateMissing = submitted && !fromDate

  function handleSubmit() {
    setSubmitted(true)

    const organization = organizations.find(
      (candidate) => String(candidate.NetUid || candidate.Id) === organizationId,
    )

    if (!organization || !fromDate) {
      return
    }

    onCreate({
      Comment: comment.trim() || undefined,
      FromDate: fromDate,
      Organization: organization,
      TransportationType: Number(transportationType) as SupplyTransportationType,
    })
  }

  return (
    <AppModal centered opened={opened} size="md" title={`${t('Додати')} ${t('Протокол доставки товару').toLowerCase()}`} onClose={onClose}>
      <Stack gap="md">
        {(createError || organizationsError) && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {createError || organizationsError}
          </Alert>
        )}

        <Select
          searchable
          data={organizationOptions}
          error={organizationMissing ? t('Вкажіть організацію') : undefined}
          label={t('Організація')}
          nothingFoundMessage={t('Нічого не знайдено')}
          placeholder={t('Організація')}
          value={organizationId}
          onChange={setOrganizationId}
        />

        <Group grow align="start">
          <Select
            allowDeselect={false}
            data={transportationOptions}
            label={t('Тип')}
            value={transportationType}
            onChange={(value) => setTransportationType(value || String(SupplyTransportationType.Vehicle))}
          />
          <TextInput
            error={dateMissing ? t('Вкажіть дату') : undefined}
            label={t('Від якої дати')}
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.currentTarget.value)}
          />
        </Group>

        <Textarea
          autosize
          label={t('Коментар')}
          minRows={2}
          value={comment}
          onChange={(event) => setComment(event.currentTarget.value)}
        />

        <Group justify="flex-end" gap="sm">
          <Button color="gray" disabled={isCreating} variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="violet" loading={isCreating} onClick={handleSubmit}>
            {t('Створити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
