import { Button, Group, Stack, Text } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { useAuth } from '../../auth/useAuth'
import type {
  CalculateMergedServiceInvoiceItem,
  MergedService,
  NewMergedServiceFormValues,
  ProtocolDetail,
  SupplyExtraChargeType,
  SupplyInformationTask,
  SupplyInvoice,
  SupplyInvoiceMergedService,
  SupplyPaymentTask,
} from '../detailTypes'
import { AssignInvoicesToMergedServicePanel } from './AssignInvoicesToMergedServicePanel'
import { CalculateMergedServicesPanel } from './CalculateMergedServicesPanel'
import { MergedServiceEditCard, type MergedServiceEditFiles } from './MergedServiceEditCard'
import { MergedServiceViewCard } from './MergedServiceViewCard'
import { NewMergedServiceForm } from './NewMergedServiceForm'

const ADD_MERGED_SERVICE_PERMISSION = 'ProductDeliveryProtocols_unified_services_AddBtn_PKEY'

export type SaveMergedServicePayload = {
  files: {
    accountDocuments?: File[]
    accountingTaskDocuments?: File[]
    actDocuments?: File[]
    documents?: File[]
    taskDocuments?: File[]
  }
  service: MergedService
}

export type CalculateMergedServicePayload = {
  extraChargeType: SupplyExtraChargeType
  invoices: SupplyInvoiceMergedService[]
  isAuto: boolean
  serviceNetId: string
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
      FromDate: values.payToDate ? values.payToDate.toISOString() : undefined,
      GrossPrice: Number(values.supplyInformationTaskGrossPrice) || 0,
      User: values.supplyInformationTaskUser,
    }
    service.SupplyInformationTask = informationTask
    service.AccountingSupplyCostsWithinCountry = Number(values.supplyInformationTaskGrossPrice) || 0
  }

  if (Number(values.grossPrice) > 0) {
    service.ActProvidingService = {}
  }

  if (Number(values.grossPriceAccounting) > 0 && values.actDocuments.length > 0) {
    service.AccountingActProvidingService = {}
  }

  if (values.createTask) {
    const task: SupplyPaymentTask = {
      Comment: values.taskComment,
      PayToDate: values.taskPayToDate ? values.taskPayToDate.toISOString() : undefined,
      User: values.taskUser,
    }
    service.SupplyPaymentTask = task
  }

  if (values.createAccountingTask) {
    const accountingTask: SupplyPaymentTask = {
      Comment: values.accountingTaskComment,
      PayToDate: values.accountingTaskPayToDate ? values.accountingTaskPayToDate.toISOString() : undefined,
      User: values.accountingTaskUser,
    }
    service.AccountingPaymentTask = accountingTask
  }

  return service
}

export function MergedServicesSection({
  protocol,
  canEdit,
  isSaving,
  onAssignServiceInvoices,
  onCalculate,
  onRemoveService,
  onSaveService,
}: {
  canEdit: boolean
  isSaving: boolean
  onAssignServiceInvoices: (service: MergedService, invoices: SupplyInvoice[]) => Promise<void>
  onCalculate: (payload: CalculateMergedServicePayload) => Promise<void>
  onRemoveService: (service: MergedService) => Promise<void>
  onSaveService: (payload: SaveMergedServicePayload) => Promise<void>
  protocol: ProtocolDetail
}) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const [isNewOpen, setNewOpen] = useValueState(false)
  const [editService, setEditService] = useValueState<MergedService | null>(null)
  const [calculateService, setCalculateService] = useValueState<MergedService | null>(null)
  const [assignService, setAssignService] = useValueState<MergedService | null>(null)
  const [removeTarget, setRemoveTarget] = useValueState<MergedService | null>(null)

  const services = protocol.MergedServices || []
  const canAddService = canEdit && hasPermission(ADD_MERGED_SERVICE_PERMISSION)

  async function handleNewSubmit(values: NewMergedServiceFormValues) {
    await onSaveService({
      files: {
        accountDocuments: values.accountDocuments,
        accountingTaskDocuments: values.accountingTaskFiles,
        actDocuments: values.actDocuments,
        documents: values.files,
        taskDocuments: values.taskFiles,
      },
      service: buildServiceFromForm(values),
    })
    setNewOpen(false)
  }

  async function handleEditSave(service: MergedService, files: MergedServiceEditFiles) {
    await onSaveService({
      files: {
        accountDocuments: files.accountDocuments,
        accountingTaskDocuments: files.accountingTaskDocuments,
        actDocuments: files.actDocuments,
        documents: files.files,
        taskDocuments: files.taskDocuments,
      },
      service,
    })
    setEditService(null)
  }

  async function handleCalculate(payload: {
    extraChargeType: SupplyExtraChargeType
    isAuto: boolean
    items: CalculateMergedServiceInvoiceItem[]
  }) {
    if (!calculateService?.NetUid) {
      return
    }

    await onCalculate({
      extraChargeType: payload.extraChargeType,
      invoices: payload.items.map((item) => ({
        ...item.entity,
        AccountingValue: Number(item.accountingValue) || 0,
        Value: Number(item.value) || 0,
      })),
      isAuto: payload.isAuto,
      serviceNetId: calculateService.NetUid,
    })
    setCalculateService(null)
  }

  async function handleAssign(invoices: SupplyInvoice[]) {
    if (!assignService) {
      return
    }

    await onAssignServiceInvoices(assignService, invoices)
    setAssignService(null)
  }

  async function handleRemoveConfirm() {
    if (!removeTarget) {
      return
    }

    await onRemoveService(removeTarget)
    setRemoveTarget(null)
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text fw={700}>{t('Об’єднані сервіси')}</Text>
        {canAddService && (
          <Button color="violet" leftSection={<IconPlus size={16} />} variant="light" onClick={() => setNewOpen(true)}>
            {t('Додати')}
          </Button>
        )}
      </Group>

      {services.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('Об’єднані сервіси')}: 0
        </Text>
      ) : (
        <Stack gap="md">
          {services.map((service) => (
            <MergedServiceViewCard
              key={service.NetUid}
              canEdit={canEdit}
              service={service}
              onAssignInvoices={() => setAssignService(service)}
              onCalculate={() => setCalculateService(service)}
              onEdit={() => setEditService(service)}
              onRemove={() => setRemoveTarget(service)}
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

      {editService && (
        <MergedServiceEditCard
          isSaving={isSaving}
          opened={Boolean(editService)}
          service={editService}
          onClose={() => setEditService(null)}
          onSave={handleEditSave}
        />
      )}

      {calculateService && (
        <CalculateMergedServicesPanel
          isSaving={isSaving}
          opened={Boolean(calculateService)}
          service={calculateService}
          onClose={() => setCalculateService(null)}
          onSubmit={handleCalculate}
        />
      )}

      {assignService && (
        <AssignInvoicesToMergedServicePanel
          isSaving={isSaving}
          opened={Boolean(assignService)}
          service={assignService}
          onAssign={handleAssign}
          onClose={() => setAssignService(null)}
        />
      )}

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
