import { Button, Group, Select, Stack, TextInput } from '@mantine/core'
import { useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ReconciliationStorageOption } from '../types'
import { PlacementFields, type PlacementValues } from './PlacementFields'

export type ProductPlacementFormValues = {
  cellNumber?: string
  comment: string
  fromDate: string
  qty: string
  reason: string
  rowNumber?: string
  storageNetId: string
  storageNumber?: string
}

const EMPTY_PLACEMENT: PlacementValues = {
  cellNumber: '',
  rowNumber: '',
  storageNumber: '',
}

export function ProductPlacementForm({
  isSubmitting,
  maxAvailableQty,
  storages,
  storagesLoading,
  onSubmit,
}: {
  isSubmitting: boolean
  maxAvailableQty?: number
  storages: ReconciliationStorageOption[]
  storagesLoading: boolean
  onSubmit: (values: ProductPlacementFormValues) => void
}) {
  const { t } = useI18n()
  const displayQtyField = Boolean(maxAvailableQty)
  const [fromDate, setFromDate] = useValueState(getDefaultDateTime)
  const [storageNetId, setStorageNetId] = useValueState('')
  const [reason, setReason] = useValueState('')
  const [comment, setComment] = useValueState('')
  const [qty, setQty] = useValueState('')
  const [placement, setPlacement] = useValueState<PlacementValues>(EMPTY_PLACEMENT)

  const storageOptions = useMemo(() => buildStorageOptions(storages), [storages])
  const selectedStorage = useMemo(
    () => storages.find((storage) => storage.NetUid === storageNetId),
    [storageNetId, storages],
  )
  const showPlacement = displayQtyField && Boolean(selectedStorage) && !selectedStorage?.ForDefective

  const qtyError = getQtyError(qty, maxAvailableQty, displayQtyField, t)
  const canSubmit = Boolean(fromDate) && Boolean(storageNetId) && !qtyError && !isSubmitting

  function handleSubmit() {
    if (!canSubmit) {
      return
    }

    onSubmit({
      comment,
      fromDate,
      qty,
      reason,
      storageNetId,
      ...(showPlacement
        ? {
            cellNumber: placement.cellNumber,
            rowNumber: placement.rowNumber,
            storageNumber: placement.storageNumber,
          }
        : {}),
    })
  }

  return (
    <Stack gap="sm">
      <TextInput
        label={t('Від якої дати')}
        type="datetime-local"
        value={fromDate}
        onChange={(event) => setFromDate(event.currentTarget.value)}
      />
      <Select
        searchable
        data={storageOptions}
        disabled={storagesLoading}
        label={t('Склад')}
        placeholder={storagesLoading ? `${t('Завантаження')}...` : ''}
        value={storageNetId || null}
        onChange={(value) => setStorageNetId(value || '')}
      />
      <TextInput label={t('Причина')} value={reason} onChange={(event) => setReason(event.currentTarget.value)} />
      <TextInput label={t('Коментар')} value={comment} onChange={(event) => setComment(event.currentTarget.value)} />
      {displayQtyField && (
        <>
          <TextInput
            error={qtyError}
            label={t('К-сть')}
            type="number"
            value={qty}
            onChange={(event) => setQty(event.currentTarget.value)}
          />
          {showPlacement && <PlacementFields values={placement} onChange={setPlacement} />}
        </>
      )}
      <Group justify="flex-end">
        <Button color="violet" disabled={!canSubmit} loading={isSubmitting} onClick={handleSubmit}>
          {t('Оприходувати')}
        </Button>
      </Group>
    </Stack>
  )
}

function buildStorageOptions(storages: ReconciliationStorageOption[]) {
  return storages.reduce<Array<{ label: string; value: string }>>((options, storage) => {
    if (!storage.NetUid) {
      return options
    }

    options.push({
      label: `${storage.Name || ''}${storage.Organization?.Name ? ` (${storage.Organization.Name})` : ''}`,
      value: storage.NetUid,
    })

    return options
  }, [])
}

function getQtyError(
  qty: string,
  maxAvailableQty: number | undefined,
  displayQtyField: boolean,
  t: (key: string) => string,
): string | null {
  if (!displayQtyField) {
    return null
  }

  const parsed = Number(qty)

  if (!qty || Number.isNaN(parsed) || parsed < 1) {
    return t('Вкажіть кількість')
  }

  if (maxAvailableQty !== undefined && parsed > maxAvailableQty) {
    return `${t('Максимальна кількість')}: ${maxAvailableQty}`
  }

  return null
}

function getDefaultDateTime(): string {
  const date = new Date()
  date.setSeconds(0, 0)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}
