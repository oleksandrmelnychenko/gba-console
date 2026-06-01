import { Button, Group, Select, Stack, TextInput } from '@mantine/core'
import { useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ReconciliationStorageOption } from '../types'
import { PlacementFields, type PlacementValues } from './PlacementFields'

export type ShiftFormValues = {
  cellNumber?: string
  comment: string
  fromDate: string
  fromStorageNetId: string
  qty: string
  reason: string
  rowNumber?: string
  storageNumber?: string
  toStorageNetId: string
}

const EMPTY_PLACEMENT: PlacementValues = {
  cellNumber: '',
  rowNumber: '',
  storageNumber: '',
}

export function ShiftForm({
  isSubmitting,
  maxAvailableQty,
  submitDisabled = false,
  storages,
  storagesLoading,
  onSubmit,
}: {
  isSubmitting: boolean
  maxAvailableQty?: number
  submitDisabled?: boolean
  storages: ReconciliationStorageOption[]
  storagesLoading: boolean
  onSubmit: (values: ShiftFormValues) => void
}) {
  const { t } = useI18n()
  const displayQtyField = Boolean(maxAvailableQty)
  const [fromDate, setFromDate] = useValueState(getDefaultDateTime)
  const [fromStorageNetId, setFromStorageNetId] = useValueState('')
  const [toStorageNetId, setToStorageNetId] = useValueState('')
  const [reason, setReason] = useValueState('')
  const [comment, setComment] = useValueState('')
  const [qty, setQty] = useValueState('')
  const [placement, setPlacement] = useValueState<PlacementValues>(EMPTY_PLACEMENT)

  const storageOptions = useMemo(() => buildStorageOptions(storages), [storages])
  const toStorage = useMemo(
    () => storages.find((storage) => storage.NetUid === toStorageNetId),
    [storages, toStorageNetId],
  )
  const showPlacement = displayQtyField && Boolean(toStorage) && !toStorage?.ForDefective

  const qtyError = getQtyError(qty, maxAvailableQty, displayQtyField, t)
  const placementComplete =
    !showPlacement ||
    (Boolean(placement.storageNumber) && Boolean(placement.rowNumber) && Boolean(placement.cellNumber))
  const canSubmit =
    Boolean(fromDate) &&
    Boolean(fromStorageNetId) &&
    Boolean(toStorageNetId) &&
    !qtyError &&
    placementComplete &&
    !isSubmitting &&
    !submitDisabled

  function handleSubmit() {
    if (!canSubmit) {
      return
    }

    onSubmit({
      comment,
      fromDate,
      fromStorageNetId,
      qty,
      reason,
      toStorageNetId,
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
        label={t('З складу')}
        placeholder={storagesLoading ? `${t('Завантаження')}...` : ''}
        value={fromStorageNetId || null}
        onChange={(value) => setFromStorageNetId(value || '')}
      />
      <Select
        searchable
        data={storageOptions}
        disabled={storagesLoading}
        label={t('На склад')}
        placeholder={storagesLoading ? `${t('Завантаження')}...` : ''}
        value={toStorageNetId || null}
        onChange={(value) => setToStorageNetId(value || '')}
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
          {showPlacement && <PlacementFields required values={placement} onChange={setPlacement} />}
        </>
      )}
      <Group justify="flex-end">
        <Button color="violet" disabled={!canSubmit} loading={isSubmitting} onClick={handleSubmit}>
          {t('Перемістити')}
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
