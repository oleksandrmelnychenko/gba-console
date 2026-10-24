import { useBusyState } from '../../../shared/hooks/useBusyState'
import { Alert, Button, Card, Group, NumberInput, Stack } from '@mantine/core'
import { AppModal, AppModalFooter } from "../../../shared/ui/AppModal"
import { CircleAlert } from 'lucide-react'
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
  canBreak: boolean
  opened: boolean
  packList: TaxFreePackList | null
  onClose: () => void
  onUpdated: (packList: TaxFreePackList) => void
}

export function TaxFreeBreakModal({ canBreak, opened, packList, onClose, onUpdated }: TaxFreeBreakModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<BreakForm>(() => createForm(packList))
  const [isSaving, setSaving, tryStartSaving] = useBusyState()
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
    if (!canBreak || !packList) {
      return
    }

    if (Object.values(form).some((value) => !Number.isFinite(value))) {
      setError(t('Заповніть усі параметри розбиття'))
      return
    }

    if (!tryStartSaving()) {
      return
    }
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
    <AppModal className="app-compact-form" centered opened={opened} size={620} title={t('Розбиття Tax Free')} onClose={onClose}>
      <Stack gap={10}>
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <Card className="app-section-card" withBorder padding={12} radius="md">
          <Group align="end" gap={10}>
            <NumberInput w={170} maw="100%"
              label={t('Макс. вага в TF')}
              min={0}
              value={form.weightLimit}
              onChange={(value) => setFormValue(setForm, 'weightLimit', value)}
            />
            <NumberInput w={170} maw="100%"
              label={t('Макс. сума з ПДВ в TF')}
              min={0}
              value={form.maxPriceLimit}
              onChange={(value) => setFormValue(setForm, 'maxPriceLimit', value)}
            />
            <NumberInput w={170} maw="100%"
              label={t('Мін. сума з ПДВ в TF')}
              min={0}
              value={form.minPriceLimit}
              onChange={(value) => setFormValue(setForm, 'minPriceLimit', value)}
            />
            <NumberInput w={170} maw="100%"
              label={t('Макс. к-сть однієї позиції в TF')}
              min={0}
              value={form.maxQtyInTaxFree}
              onChange={(value) => setFormValue(setForm, 'maxQtyInTaxFree', value)}
            />
            <NumberInput w={170} maw="100%"
              label={t('Макс. к-сть позицій в TF')}
              min={0}
              value={form.maxPositionsInTaxFree}
              onChange={(value) => setFormValue(setForm, 'maxPositionsInTaxFree', value)}
            />
          </Group>
        </Card>

        <AppModalFooter>
          <Button disabled={isSaving} variant="default" onClick={onClose}>{t('Скасувати')}</Button>
          <Button disabled={!canBreak} loading={isSaving} onClick={submitBreak}>{t('Розбити')}</Button>
        </AppModalFooter>
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
