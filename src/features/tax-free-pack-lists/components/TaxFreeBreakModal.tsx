import { Alert, Button, Group, NumberInput, SimpleGrid, Stack } from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { breakTaxFreePackList } from '../api/taxFreePackListsApi'
import type { TaxFreePackList } from '../types'

type BreakForm = {
  maxPositionsInTaxFree: number
  maxPriceLimit: number
  maxQtyInTaxFree: number
  minPriceLimit: number
  weightLimit: number
}

type TaxFreeBreakModalProps = {
  opened: boolean
  packList: TaxFreePackList | null
  onClose: () => void
  onUpdated: (packList: TaxFreePackList) => void
}

export function TaxFreeBreakModal({ opened, packList, onClose, onUpdated }: TaxFreeBreakModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<BreakForm>(() => createForm(packList))
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetModalState(nextPackList: TaxFreePackList | null) {
    setForm(createForm(nextPackList))
    setError(null)
  }

  useEffect(() => {
    if (opened) {
      queueMicrotask(() => resetModalState(packList))
    }
  }, [opened, packList])

  async function submitBreak() {
    if (!packList) {
      return
    }

    if (Object.values(form).some((value) => !Number.isFinite(value))) {
      setError(t('Заповніть усі параметри розбиття'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const updatedPackList = await breakTaxFreePackList({
        ...packList,
        MaxPositionsInTaxFree: form.maxPositionsInTaxFree,
        MaxPriceLimit: form.maxPriceLimit,
        MaxQtyInTaxFree: form.maxQtyInTaxFree,
        MinPriceLimit: form.minPriceLimit,
        WeightLimit: form.weightLimit,
      })

      if (updatedPackList) {
        onUpdated(updatedPackList)
      }
      notifications.show({ color: 'green', message: t('Розбиття виконано') })
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося виконати розбиття'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal centered opened={opened} size="lg" title={t('Розбиття Tax Free')} onClose={onClose}>
      <Stack>
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <NumberInput
            label={t('Макс. вага в TF')}
            min={0}
            value={form.weightLimit}
            onChange={(value) => setFormValue(setForm, 'weightLimit', value)}
          />
          <NumberInput
            label={t('Макс. сума з ПДВ в TF')}
            min={0}
            value={form.maxPriceLimit}
            onChange={(value) => setFormValue(setForm, 'maxPriceLimit', value)}
          />
          <NumberInput
            label={t('Мін. сума з ПДВ в TF')}
            min={0}
            value={form.minPriceLimit}
            onChange={(value) => setFormValue(setForm, 'minPriceLimit', value)}
          />
          <NumberInput
            label={t('Макс. к-сть однієї позиції в TF')}
            min={0}
            value={form.maxQtyInTaxFree}
            onChange={(value) => setFormValue(setForm, 'maxQtyInTaxFree', value)}
          />
          <NumberInput
            label={t('Макс. к-сть позицій в TF')}
            min={0}
            value={form.maxPositionsInTaxFree}
            onChange={(value) => setFormValue(setForm, 'maxPositionsInTaxFree', value)}
          />
        </SimpleGrid>

        <Group justify="flex-end">
          <Button disabled={isSaving} variant="subtle" onClick={onClose}>{t('Скасувати')}</Button>
          <Button loading={isSaving} onClick={submitBreak}>{t('Розбити')}</Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function createForm(packList: TaxFreePackList | null): BreakForm {
  return {
    maxPositionsInTaxFree: packList?.MaxPositionsInTaxFree || 0,
    maxPriceLimit: packList?.MaxPriceLimit || 0,
    maxQtyInTaxFree: packList?.MaxQtyInTaxFree || 0,
    minPriceLimit: packList?.MinPriceLimit || 0,
    weightLimit: packList?.WeightLimit || 0,
  }
}

function setFormValue(
  setForm: Dispatch<SetStateAction<BreakForm>>,
  key: keyof BreakForm,
  value: number | string,
) {
  setForm((currentForm) => ({
    ...currentForm,
    [key]: typeof value === 'number' ? value : Number(value) || 0,
  }))
}
