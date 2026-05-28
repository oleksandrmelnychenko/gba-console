import { Alert, Button, Checkbox, Group, NumberInput, Select, Stack, Text } from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { TaxFree, TaxFreeItem, TaxFreePackList } from '../types'
import { getProductName, getTaxFreeItemProduct } from '../utils'

type MoveTaxFreeItemsModalProps = {
  items: TaxFreeItem[]
  opened: boolean
  packList: TaxFreePackList | null
  onClose: () => void
  onSubmit: (packList: TaxFreePackList) => void
}

export function MoveTaxFreeItemsModal({ items, opened, packList, onClose, onSubmit }: MoveTaxFreeItemsModalProps) {
  const { t } = useI18n()
  const [draftItems, setDraftItems] = useState<TaxFreeItem[]>([])
  const [isNewTaxFree, setNewTaxFree] = useState(true)
  const [selectedTaxFreeNetUid, setSelectedTaxFreeNetUid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const taxFrees = useMemo(() => packList?.TaxFrees || [], [packList])

  function resetModalState(nextItems: TaxFreeItem[], nextTaxFrees: TaxFree[]) {
    setDraftItems(nextItems.map((item) => ({ ...item, ChangedQty: item.ChangedQty ?? item.Qty ?? 0 })))
    setNewTaxFree(nextTaxFrees.length === 0)
    setSelectedTaxFreeNetUid(nextTaxFrees[0]?.NetUid || null)
    setError(null)
  }

  useEffect(() => {
    if (opened) {
      queueMicrotask(() => resetModalState(items, taxFrees))
    }
  }, [items, opened, taxFrees])

  const targetOptions = useMemo(
    () => taxFrees.map((taxFree, index) => ({
      label: taxFree.Number || `TF ${index + 1}`,
      value: taxFree.NetUid || String(index),
    })),
    [taxFrees],
  )

  function submitMove() {
    if (!packList) {
      return
    }

    const normalizedItems = draftItems
      .map((item) => ({ ...item, Qty: item.ChangedQty ?? item.Qty ?? 0, IsSelected: false }))
      .filter((item) => (item.Qty || 0) > 0)

    if (normalizedItems.length === 0) {
      setError(t('Оберіть кількість для перенесення'))
      return
    }

    let nextTaxFrees: TaxFree[]

    if (isNewTaxFree) {
      nextTaxFrees = taxFrees.concat({
        TaxFreeItems: normalizedItems,
        TaxFreeStatus: 0,
      })
    } else {
      if (!selectedTaxFreeNetUid) {
        setError(t('Оберіть Tax Free'))
        return
      }

      nextTaxFrees = taxFrees.map((taxFree, index) => {
        const rowId = taxFree.NetUid || String(index)

        if (rowId !== selectedTaxFreeNetUid) {
          return taxFree
        }

        return {
          ...taxFree,
          TaxFreeItems: (taxFree.TaxFreeItems || []).concat(normalizedItems),
        }
      })
    }

    onSubmit({
      ...packList,
      TaxFrees: nextTaxFrees,
    })
  }

  return (
    <AppModal centered opened={opened} size="lg" title={t('Перенесення у Tax Free')} onClose={onClose}>
      <Stack>
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <Stack gap="xs">
          {draftItems.map((item, index) => (
            <NumberInput
              key={item.NetUid || index}
              label={getProductName(getTaxFreeItemProduct(item)) || item.ProductFullName || t('Позиція')}
              min={0}
              value={item.ChangedQty || 0}
              onChange={(value) => {
                const qty = typeof value === 'number' ? value : Number(value) || 0
                setDraftItems((currentItems) => currentItems.map((currentItem, itemIndex) => (
                  itemIndex === index ? { ...currentItem, ChangedQty: qty } : currentItem
                )))
              }}
            />
          ))}
        </Stack>

        {taxFrees.length > 0 && (
          <>
            <Checkbox
              checked={isNewTaxFree}
              label={t('Створити новий Tax Free')}
              onChange={(event) => setNewTaxFree(event.currentTarget.checked)}
            />
            {!isNewTaxFree && (
              <Select
                data={targetOptions}
                label={t('Tax Free')}
                value={selectedTaxFreeNetUid}
                onChange={setSelectedTaxFreeNetUid}
              />
            )}
          </>
        )}

        {draftItems.length === 0 && <Text size="sm" c="dimmed">{t('Позиції не вибрано')}</Text>}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>{t('Скасувати')}</Button>
          <Button disabled={draftItems.length === 0} onClick={submitMove}>{t('Додати')}</Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
