import { Alert, Tabs } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import {
  createProductIncomeFromItem,
  createProductIncomeFromItems,
  createProductTransferFromItem,
  createProductTransferFromItems,
  getReconciliationStorages,
} from '../api/actReconciliationsApi'
import type { ActReconciliationItem, ReconciliationStorageOption } from '../types'
import { ProductPlacementForm, type ProductPlacementFormValues } from './ProductPlacementForm'
import { ShiftForm, type ShiftFormValues } from './ShiftForm'

export type ActionTarget =
  | { mode: 'single'; item: ActReconciliationItem }
  | { mode: 'multi'; items: ActReconciliationItem[] }

export function ActReconciliationActionsModal({
  organizationNetId,
  target,
  opened,
  onClose,
  onApplied,
}: {
  organizationNetId: string
  target: ActionTarget | null
  opened: boolean
  onClose: () => void
  onApplied: () => void
}) {
  const { t } = useI18n()
  const [storages, setStorages] = useValueState<ReconciliationStorageOption[]>([])
  const [storagesLoading, setStoragesLoading] = useValueState(false)
  const [storagesError, setStoragesError] = useValueState<string | null>(null)
  const [isSubmitting, setSubmitting] = useValueState(false)
  const [submitError, setSubmitError] = useValueState<string | null>(null)

  useEffect(() => {
    if (!opened) {
      return
    }

    let cancelled = false
    setStoragesLoading(true)
    setStoragesError(null)

    async function loadStorages() {
      try {
        const nextStorages = await getReconciliationStorages(organizationNetId)

        if (!cancelled) {
          setStorages(nextStorages)
        }
      } catch (loadError) {
        if (!cancelled) {
          setStorages([])
          setStoragesError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити склади'))
        }
      } finally {
        if (!cancelled) {
          setStoragesLoading(false)
        }
      }
    }

    void loadStorages()

    return () => {
      cancelled = true
    }
  }, [opened, organizationNetId, setStorages, setStoragesError, setStoragesLoading, t])

  useEffect(() => {
    if (!opened) {
      setSubmitError(null)
      setSubmitting(false)
    }
  }, [opened, setSubmitError, setSubmitting])

  const singleItem = target?.mode === 'single' ? target.item : null
  const maxAvailableQty = singleItem?.QtyDifference

  async function runSubmit(action: () => Promise<void>) {
    setSubmitting(true)
    setSubmitError(null)

    try {
      await action()

      notifications.show({ color: 'green', message: t('Операцію виконано') })
      onApplied()
      onClose()
    } catch (actionError) {
      setSubmitError(actionError instanceof Error ? actionError.message : t('Не вдалося виконати операцію'))
    } finally {
      setSubmitting(false)
    }
  }

  function handlePlacementSubmit(values: ProductPlacementFormValues) {
    if (!target) {
      return
    }

    if (target.mode === 'single') {
      void runSubmit(() =>
        createProductIncomeFromItem({
          cellNumber: values.cellNumber,
          comment: values.comment,
          fromDate: values.fromDate,
          itemNetId: target.item.NetUid || '',
          qty: values.qty,
          rowNumber: values.rowNumber,
          storageNetId: values.storageNetId,
          storageNumber: values.storageNumber,
        }),
      )
      return
    }

    void runSubmit(() =>
      createProductIncomeFromItems(
        {
          comment: values.comment,
          fromDate: values.fromDate,
          storageNetId: values.storageNetId,
        },
        target.items.map((item) => ({ ...item, Reason: values.reason, ToOperationQty: item.QtyDifference })),
      ),
    )
  }

  function handleShiftSubmit(values: ShiftFormValues) {
    if (!target) {
      return
    }

    if (target.mode === 'single') {
      void runSubmit(() =>
        createProductTransferFromItem({
          cellNumber: values.cellNumber,
          comment: values.comment,
          fromDate: values.fromDate,
          fromStorageNetId: values.fromStorageNetId,
          itemNetId: target.item.NetUid || '',
          organizationNetId,
          qty: values.qty,
          reason: values.reason,
          rowNumber: values.rowNumber,
          storageNumber: values.storageNumber,
          toStorageNetId: values.toStorageNetId,
        }),
      )
      return
    }

    void runSubmit(() =>
      createProductTransferFromItems(
        {
          comment: values.comment,
          fromDate: values.fromDate,
          fromStorageNetId: values.fromStorageNetId,
          organizationNetId,
          toStorageNetId: values.toStorageNetId,
        },
        target.items.map((item) => ({ ...item, Reason: values.reason, ToOperationQty: item.QtyDifference })),
      ),
    )
  }

  return (
    <AppModal centered opened={opened} size="lg" title={getModalTitle(target, t)} onClose={onClose}>
      {(storagesError || submitError) && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} mb="sm" variant="light">
          {submitError || storagesError}
        </Alert>
      )}
      <Tabs defaultValue="placement" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="placement">{t('Оприходування')}</Tabs.Tab>
          <Tabs.Tab value="shift">{t('Переміщення')}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="placement">
          <ProductPlacementForm
            isSubmitting={isSubmitting}
            maxAvailableQty={maxAvailableQty}
            storages={storages}
            storagesLoading={storagesLoading}
            onSubmit={handlePlacementSubmit}
          />
        </Tabs.Panel>
        <Tabs.Panel value="shift">
          <ShiftForm
            isSubmitting={isSubmitting}
            maxAvailableQty={maxAvailableQty}
            storages={storages}
            storagesLoading={storagesLoading}
            onSubmit={handleShiftSubmit}
          />
        </Tabs.Panel>
      </Tabs>
    </AppModal>
  )
}

function getModalTitle(target: ActionTarget | null, t: (key: string) => string): string {
  if (target?.mode === 'single') {
    return target.item.Product?.VendorCode || t('Дія')
  }

  return t('Обробити')
}
