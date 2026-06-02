import { Button, Group, Select, Stack, TextInput } from '@mantine/core'
import { useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ReconciliationStorageOption } from '../types'

export type WriteOffFormValues = {
  comment: string
  fromDate: string
  qty: string
  reason: string
  storageNetId: string
}

export function WriteOffForm({
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
  onSubmit: (values: WriteOffFormValues) => void
}) {
  const { t } = useI18n()
  const displayQtyField = Boolean(maxAvailableQty)
  const [fromDate, setFromDate] = useValueState(getDefaultDateTime)
  const [storageNetId, setStorageNetId] = useValueState('')
  const [reason, setReason] = useValueState('')
  const [comment, setComment] = useValueState('')
  const [qty, setQty] = useValueState('')

  const storageOptions = useMemo(() => buildStorageOptions(storages), [storages])
  const qtyError = getQtyError(qty, maxAvailableQty, displayQtyField, t)
  const canSubmit = Boolean(fromDate) && Boolean(storageNetId) && !qtyError && !isSubmitting && !submitDisabled

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
        <TextInput
          error={qtyError}
          label={t('К-сть')}
          type="number"
          value={qty}
          onChange={(event) => setQty(event.currentTarget.value)}
        />
      )}
      <Group justify="flex-end">
        <Button color="red" disabled={!canSubmit} loading={isSubmitting} onClick={handleSubmit}>
          {t('Списати')}
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
