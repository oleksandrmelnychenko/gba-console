import { Alert, NumberInput, Table, Tabs, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import {
  getActionQuantityLimit,
  getDefaultActionQuantity,
  resolveActionToOperationQty,
  validateActionQuantity,
  type ActionQuantityValidationReason,
} from '../actReconciliationActionQuantity'
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
  const [quantityDrafts, setQuantityDrafts] = useValueState<Record<string, string>>({})

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

  const singleItem = target?.mode === 'single' ? target.item : null
  const maxAvailableQty = singleItem?.QtyDifference
  const previewState = useMemo(
    () => (target?.mode === 'multi' ? getQuantityPreviewState(target.items, quantityDrafts) : null),
    [quantityDrafts, target],
  )

  useEffect(() => {
    if (!opened || target?.mode !== 'multi') {
      setQuantityDrafts({})
      return
    }

    setQuantityDrafts(buildInitialQuantityDrafts(target.items))
  }, [opened, setQuantityDrafts, target])

  async function runSubmit(action: () => Promise<void>) {
    setSubmitting(true)
    setSubmitError(null)

    try {
      await action()

      notifications.show({ color: 'green', message: t('Операцію виконано') })
      onApplied()
      handleClose()
    } catch (actionError) {
      setSubmitError(actionError instanceof Error ? actionError.message : t('Не вдалося виконати операцію'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setSubmitError(null)
    setSubmitting(false)
    onClose()
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
          reason: values.reason,
          rowNumber: values.rowNumber,
          storageNetId: values.storageNetId,
          storageNumber: values.storageNumber,
        }),
      )
      return
    }

    if (previewState && !previewState.canSubmit) {
      return
    }

    void runSubmit(() =>
      createProductIncomeFromItems(
        {
          comment: values.comment,
          fromDate: values.fromDate,
          storageNetId: values.storageNetId,
        },
        target.items.map((item, index) => ({
          ...item,
          Reason: values.reason,
          ToOperationQty: resolveActionToOperationQty(item, quantityDrafts[getItemKey(item, index)]),
        })),
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

    if (previewState && !previewState.canSubmit) {
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
        target.items.map((item, index) => ({
          ...item,
          Reason: values.reason,
          ToOperationQty: resolveActionToOperationQty(item, quantityDrafts[getItemKey(item, index)]),
        })),
      ),
    )
  }

  return (
    <AppModal centered opened={opened} size="lg" title={getModalTitle(target, t)} onClose={handleClose}>
      {(storagesError || submitError) && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} mb="sm" variant="light">
          {submitError || storagesError}
        </Alert>
      )}
      {target?.mode === 'multi' && (
        <ActionQuantityPreview
          disabled={isSubmitting}
          items={target.items}
          quantityDrafts={quantityDrafts}
          validationByKey={previewState?.validationByKey || {}}
          onQuantityChange={(item, value) =>
            setQuantityDrafts((current) => ({ ...current, [getItemKey(item, target.items.indexOf(item))]: value }))
          }
        />
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
            submitDisabled={previewState ? !previewState.canSubmit : false}
            storages={storages}
            storagesLoading={storagesLoading}
            onSubmit={handlePlacementSubmit}
          />
        </Tabs.Panel>
        <Tabs.Panel value="shift">
          <ShiftForm
            isSubmitting={isSubmitting}
            maxAvailableQty={maxAvailableQty}
            submitDisabled={previewState ? !previewState.canSubmit : false}
            storages={storages}
            storagesLoading={storagesLoading}
            onSubmit={handleShiftSubmit}
          />
        </Tabs.Panel>
      </Tabs>
    </AppModal>
  )
}

function ActionQuantityPreview({
  disabled,
  items,
  quantityDrafts,
  validationByKey,
  onQuantityChange,
}: {
  disabled: boolean
  items: ActReconciliationItem[]
  quantityDrafts: Record<string, string>
  validationByKey: Record<string, ActionQuantityValidationReason | null>
  onQuantityChange: (item: ActReconciliationItem, value: string) => void
}) {
  const { t } = useI18n()

  return (
    <>
      <Text fw={600} mb="xs" size="sm">
        {t('Кількість до операції')}
      </Text>
      <Table.ScrollContainer mah={260} mb="md" minWidth={640}>
        <Table highlightOnHover verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={52}>#</Table.Th>
              <Table.Th>{t('Код товару')}</Table.Th>
              <Table.Th>{t('Назва товару')}</Table.Th>
              <Table.Th ta="right" w={110}>
                {t('Різниця')}
              </Table.Th>
              <Table.Th w={150}>{t('К-сть')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item, index) => {
              const itemKey = getItemKey(item, index)
              const limit = getActionQuantityLimit(item)
              const validationReason = validationByKey[itemKey]
              const isEditable = limit !== undefined && limit > 0

              return (
                <Table.Tr key={itemKey}>
                  <Table.Td>{index + 1}</Table.Td>
                  <Table.Td>
                    <Text fw={600} size="sm">
                      {displayValue(item.Product?.VendorCode)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text lineClamp={2} size="sm">
                      {displayValue(item.Product?.NameUA || item.Product?.Name)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text c={item.NegativeDifference ? 'red' : 'teal'} fw={600} size="sm">
                      {item.NegativeDifference ? '-' : '+'} {displayValue(limit)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      allowNegative={false}
                      clampBehavior="none"
                      disabled={disabled || !isEditable}
                      error={validationReason ? getQuantityError(validationReason, limit, t) : null}
                      hideControls
                      max={limit}
                      min={1}
                      size="xs"
                      value={quantityDrafts[itemKey] ?? ''}
                      onChange={(value) => onQuantityChange(item, String(value))}
                    />
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </>
  )
}

function getModalTitle(target: ActionTarget | null, t: (key: string) => string): string {
  if (target?.mode === 'single') {
    return target.item.Product?.VendorCode || t('Дія')
  }

  return t('Обробити')
}

function buildInitialQuantityDrafts(items: ActReconciliationItem[]): Record<string, string> {
  return items.reduce<Record<string, string>>((drafts, item, index) => {
    const defaultQty = getDefaultActionQuantity(item)

    drafts[getItemKey(item, index)] = defaultQty === undefined ? '' : String(defaultQty)

    return drafts
  }, {})
}

function getQuantityPreviewState(items: ActReconciliationItem[], quantityDrafts: Record<string, string>) {
  return items.reduce(
    (state, item) => {
      const itemKey = getItemKey(item, state.index)
      const validation = validateActionQuantity(quantityDrafts[itemKey], getActionQuantityLimit(item))

      state.validationByKey[itemKey] = validation.reason
      state.canSubmit = state.canSubmit && validation.isValid
      state.index += 1

      return state
    },
    {
      canSubmit: items.length > 0,
      index: 0,
      validationByKey: {} as Record<string, ActionQuantityValidationReason | null>,
    },
  )
}

function getQuantityError(
  reason: ActionQuantityValidationReason,
  limit: number | undefined,
  t: (key: string) => string,
): string {
  if (reason === 'overLimit') {
    return `${t('Максимальна кількість')}: ${limit ?? '-'}`
  }

  return reason === 'invalidLimit' ? t('Немає доступної кількості') : t('Вкажіть кількість')
}

function getItemKey(item: ActReconciliationItem, index: number): string {
  return String(item.NetUid || item.Id || item.Product?.NetUid || `item-${index}`)
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
