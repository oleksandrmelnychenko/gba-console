import { Button, Group, Stack, Text } from '@mantine/core'
import { Plus } from 'lucide-react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type {
  MergedService,
  NewMergedServiceFormValues,
  ProtocolUser,
  SupplyPaymentTask,
} from '../types'
import { buildUkraineMergedServiceFromForm } from '../buildUkraineMergedService'
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
      await onCreateService(buildUkraineMergedServiceFromForm(values), values.files)
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
    <Stack className="supply-payment-section" gap="md">
      <Group justify="space-between" align="center">
        <Text className="app-section-title" fw={600} size="sm">
          {t('Об’єднаний сервіс')}
        </Text>
        {permissions.canCreateService && (
          <Button className="supply-payment-action-button" color={CREATE_ACTION_COLOR} leftSection={<Plus size={16} />} variant="light" onClick={() => setNewOpen(true)}>
            {t('Додати')}
          </Button>
        )}
      </Group>

      {visibleServices.length === 0 ? (
        <Text className="supply-payment-empty-state">
          {t('Об’єднаний сервіс')}: 0
        </Text>
      ) : (
        <Stack gap="md">
          {visibleServices.map((service) => (
            <MergedServiceCard
              key={service.NetUid || service.Id}
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
