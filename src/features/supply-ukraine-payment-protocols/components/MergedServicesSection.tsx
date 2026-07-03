import { Button, Group, Stack, Text } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type {
  MergedService,
  NewMergedServiceFormValues,
  ProtocolUser,
  SupplyInformationTask,
  SupplyPaymentTask,
} from '../types'
import { MergedServiceCard } from './MergedServiceCard'
import { NewMergedServiceForm } from './NewMergedServiceForm'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'

type AddPaymentTaskValues = {
  comment: string
  payToDate: Date | null
  responsible: ProtocolUser | null
}

export type MergedServicePermissions = {
  canCreatePaymentTask: boolean
  canCreateService: boolean
  canRemovePaymentTask: boolean
  canRemoveService: boolean
}

function buildServiceFromForm(values: NewMergedServiceFormValues): MergedService {
  const service: MergedService = {
    AccountingGrossPrice: Number(values.grossPriceAccounting) || 0,
    AccountingVatPercent: Number(values.percentAccounting) || 0,
    ConsumableProduct: values.consumableProduct,
    FromDate: values.fromDate ? values.fromDate.toISOString() : undefined,
    GrossPrice: Number(values.grossPrice) || 0,
    IsIncludeAccountingValue: values.isIncludeAccountingValue,
    Name: values.name,
    Number: values.invoiceNumber,
    SupplyOrganization: values.supplyOrganization,
    SupplyOrganizationAgreement: values.agreement,
    VatPercent: Number(values.percent) || 0,
  }

  if (values.exchangeRate && Number(values.exchangeRate) > 0) {
    service.ExchangeRate = Number(values.exchangeRate)
  }

  if (values.accountingExchangeRate && Number(values.accountingExchangeRate) > 0) {
    service.AccountingExchangeRate = Number(values.accountingExchangeRate)
  }

  if (values.isSupplyInformationTask) {
    const informationTask: SupplyInformationTask = {
      Comment: values.supplyInformationTaskComment,
      GrossPrice: Number(values.supplyInformationTaskGrossPrice) || 0,
    }
    service.SupplyInformationTask = informationTask
  }

  if (Number(values.grossPrice) > 0) {
    service.ActProvidingService = {}
  }

  if (Number(values.grossPriceAccounting) > 0) {
    service.AccountingActProvidingService = {}
  }

  const paymentTask: SupplyPaymentTask = {
    Comment: values.comment,
    PayToDate: values.payToDate ? values.payToDate.toISOString() : undefined,
    User: values.responsibleForPayment,
  }

  if (Number(values.grossPrice) > 0) {
    service.SupplyPaymentTask = paymentTask
  }

  if (Number(values.grossPriceAccounting) > 0) {
    service.AccountingPaymentTask = paymentTask
  }

  return service
}

export function MergedServicesSection({
  isSaving,
  onAddPaymentTask,
  onCreateService,
  onRemovePaymentTask,
  onRemoveService,
  permissions,
  services,
  users,
}: {
  isSaving: boolean
  onAddPaymentTask: (service: MergedService, values: AddPaymentTaskValues, isAccounting: boolean) => Promise<void>
  onCreateService: (service: MergedService, documents: File[]) => Promise<void>
  onRemovePaymentTask: (service: MergedService, task: SupplyPaymentTask) => Promise<void>
  onRemoveService: (service: MergedService) => Promise<void>
  permissions: MergedServicePermissions
  services: MergedService[]
  users: ProtocolUser[]
}) {
  const { t } = useI18n()
  const [isNewOpen, setNewOpen] = useValueState(false)
  const [removeTarget, setRemoveTarget] = useValueState<MergedService | null>(null)

  const visibleServices = services.filter((service) => !service.Deleted)

  async function handleNewSubmit(values: NewMergedServiceFormValues) {
    try {
      await onCreateService(buildServiceFromForm(values), values.files)
      setNewOpen(false)
    } catch {
      // Parent renders the action error; keep the drawer open so the user does not lose form context.
    }
  }

  async function handleRemoveConfirm() {
    if (!removeTarget) {
      return
    }

    try {
      await onRemoveService(removeTarget)
      setRemoveTarget(null)
    } catch {
      // Parent renders the action error; keep the confirmation open on failure.
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text fw={700} size="lg">
          {t('Об’єднаний сервіс')}
        </Text>
        {permissions.canCreateService && (
          <Button color={CREATE_ACTION_COLOR} leftSection={<IconPlus size={16} />} variant="light" onClick={() => setNewOpen(true)}>
            {t('Додати')}
          </Button>
        )}
      </Group>

      {visibleServices.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('Об’єднаний сервіс')}: 0
        </Text>
      ) : (
        <Stack gap="md">
          {visibleServices.map((service, index) => (
            <MergedServiceCard
              key={service.NetUid || index}
              isSaving={isSaving}
              permissions={permissions}
              service={service}
              users={users}
              onAddPaymentTask={onAddPaymentTask}
              onRemovePaymentTask={(target, task) => void onRemovePaymentTask(target, task)}
              onRemoveService={(target) => setRemoveTarget(target)}
            />
          ))}
        </Stack>
      )}

      <NewMergedServiceForm
        isSaving={isSaving}
        opened={isNewOpen}
        onClose={() => setNewOpen(false)}
        onSubmit={handleNewSubmit}
      />

      <AppModal centered opened={Boolean(removeTarget)} title={t('Видалити')} onClose={() => setRemoveTarget(null)}>
        <Stack gap="md">
          <Text size="sm">{t('Ви впевнені, що хочете видалити?')}</Text>
          <Group justify="flex-end" gap="sm">
            <Button color="gray" disabled={isSaving} variant="light" onClick={() => setRemoveTarget(null)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" loading={isSaving} onClick={handleRemoveConfirm}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}
