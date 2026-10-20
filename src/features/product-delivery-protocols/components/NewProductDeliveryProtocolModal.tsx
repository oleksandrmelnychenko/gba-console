import { Alert, Button, Card, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core'
import { CircleAlert, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { isBusinessOrganizationVisible } from '../../client-resources/clientResourcePolicies'
import { formatLocalDateTime, formatLocalInputDateTime } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import type { CreateProtocolPayload, ProtocolOrganization } from '../types'
import { SupplyTransportationType } from '../types'
import './new-product-delivery-protocol-modal.css'

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
  fromDate: string
  organizationId: string | null
  submitted: boolean
  transportationType: string
}

function createInitialFormState(): NewProductDeliveryProtocolFormState {
  return {
    comment: '',
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
      className="new-product-delivery-protocol-modal"
      opened={opened}
      size={640}
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
  const { comment, fromDate, organizationId, submitted, transportationType } = form

  const organizationOptions = useMemo(
    () =>
      organizations.filter(isBusinessOrganizationVisible).reduce<{ label: string; value: string }[]>((options, organization) => {
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
      FromDate: formatLocalInputDateTime(fromDate),
      Organization: organization,
      TransportationType: Number(transportationType) as SupplyTransportationType,
    })
  }

  return (
    <Stack gap={12}>
      {(createError || organizationsError) && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {createError || organizationsError}
        </Alert>
      )}

      <Card withBorder padding="sm" radius="md">
        <Stack gap={12}>
          <Select
            searchable
            classNames={{
              input: 'new-protocol-combobox-input',
              dropdown: 'new-protocol-combobox-dropdown',
              option: 'new-protocol-combobox-option',
            }}
            data={organizationOptions}
            error={organizationMissing ? t('Вкажіть організацію') : undefined}
            label={t('Організація')}
            nothingFoundMessage={t('Нічого не знайдено')}
            placeholder={t('Організація')}
            value={organizationId}
            onChange={(value) => setForm((current) => ({ ...current, organizationId: value }))}
          />

          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing={12}>
            <Select
              allowDeselect={false}
              classNames={{
                input: 'new-protocol-combobox-input',
                dropdown: 'new-protocol-combobox-dropdown',
                option: 'new-protocol-combobox-option',
              }}
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
          </SimpleGrid>

          <Textarea
            autosize
            label={t('Коментар')}
            minRows={2}
            value={comment}
            onChange={(event) => { const nextValue = event.currentTarget.value; setForm((current) => ({ ...current, comment: nextValue })) }}
          />
        </Stack>
      </Card>
      <AppModalFooter>
        <Button color="gray" disabled={isCreating} variant="default" onClick={onClose}>
          {t('Скасувати')}
        </Button>
        <Button color={CREATE_ACTION_COLOR} leftSection={<Plus size={16} />} loading={isCreating} onClick={handleSubmit}>
          {t('Створити')}
        </Button>
      </AppModalFooter>
    </Stack>
  )
}
