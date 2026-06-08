import { Alert, Button, FileInput, Group, Select, Stack, Textarea, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { formatLocalDateTime, formatLocalInputDateTime } from '../../../shared/date/dateTime'
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

type NewProductDeliveryProtocolFormState = {
  comment: string
  documents: File[]
  fromDate: string
  organizationId: string | null
  submitted: boolean
  transportationType: string
}

function createInitialFormState(): NewProductDeliveryProtocolFormState {
  return {
    comment: '',
    documents: [],
    fromDate: formatLocalDateTime(new Date()).slice(0, 16),
    organizationId: null,
    submitted: false,
    transportationType: String(SupplyTransportationType.Vehicle),
  }
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

  return (
    <AppModal
      centered
      opened={opened}
      size="md"
      title={`${t('Додати')} ${t('Протокол доставки товару').toLowerCase()}`}
      onClose={onClose}
    >
      {opened ? (
        <NewProductDeliveryProtocolForm
          createError={createError}
          isCreating={isCreating}
          organizations={organizations}
          organizationsError={organizationsError}
          onClose={onClose}
          onCreate={onCreate}
        />
      ) : null}
    </AppModal>
  )
}

function NewProductDeliveryProtocolForm({
  createError,
  isCreating,
  organizations,
  organizationsError,
  onClose,
  onCreate,
}: Omit<NewProductDeliveryProtocolModalProps, 'opened'>) {
  const { t } = useI18n()
  const [form, setForm] = useState(createInitialFormState)
  const { comment, documents, fromDate, organizationId, submitted, transportationType } = form

  const organizationOptions = useMemo(
    () =>
      organizations.reduce<{ label: string; value: string }[]>((options, organization) => {
        if (organization.NetUid || organization.Id) {
          options.push({
            label: organization.Name || organization.FullName || String(organization.NetUid || organization.Id),
            value: String(organization.NetUid || organization.Id),
          })
        }

        return options
      }, []),
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
    setForm((current) => ({ ...current, submitted: true }))

    const organization = organizations.find(
      (candidate) => String(candidate.NetUid || candidate.Id) === organizationId,
    )

    if (!organization || !fromDate) {
      return
    }

    onCreate({
      Comment: comment.trim() || undefined,
      Documents: documents,
      FromDate: formatLocalInputDateTime(fromDate),
      Organization: organization,
      TransportationType: Number(transportationType) as SupplyTransportationType,
    })
  }

  return (
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
        onChange={(value) => setForm((current) => ({ ...current, organizationId: value }))}
      />

      <Group grow align="start">
        <Select
          allowDeselect={false}
          data={transportationOptions}
          label={t('Тип')}
          value={transportationType}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              transportationType: value || String(SupplyTransportationType.Vehicle),
            }))
          }
        />
        <TextInput
          error={dateMissing ? t('Вкажіть дату') : undefined}
          label={t('Від якої дати')}
          type="datetime-local"
          value={fromDate}
          onChange={(event) => { const nextValue = event.currentTarget.value; setForm((current) => ({ ...current, fromDate: nextValue })) }}
        />
      </Group>

      <Textarea
        autosize
        label={t('Коментар')}
        minRows={2}
        value={comment}
        onChange={(event) => { const nextValue = event.currentTarget.value; setForm((current) => ({ ...current, comment: nextValue })) }}
      />

      <FileInput
        clearable
        disabled={isCreating}
        label={t('Документи')}
        multiple
        placeholder={t('Додати файли')}
        value={documents}
        onChange={(files) => setForm((current) => ({ ...current, documents: files || [] }))}
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
  )
}
