import { Button, Group, Stack, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { updateSale } from '../api/salesUkraineApi'
import type { SalesUkraineSale } from '../types'

const PACKAGED_TYPE = 2

export function SaleShipModal({
  sale,
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
  sale: SalesUkraineSale | null
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(sale)} size="sm" title={t('Відвантаження')} onClose={onClose}>
      {sale && <SaleShipForm key={sale.NetUid || sale.Id} sale={sale} onCancel={onClose} onSaved={onSaved} />}
    </AppModal>
  )
}

function SaleShipForm({
  sale,
  onCancel,
  onSaved,
}: {
  onCancel: () => void
  onSaved: () => void
  sale: SalesUkraineSale
}) {
  const { t } = useI18n()
  const [date, setDate] = useState(toDateInput(sale.ShipmentDate) || todayInput())
  const [isSaving, setSaving] = useState(false)

  async function ship() {
    if (!date) {
      notifications.show({ color: 'red', message: t('Вкажіть дату відвантаження') })

      return
    }

    setSaving(true)

    const payload: SalesUkraineSale = {
      ...sale,
      BaseLifeCycleStatus: { ...sale.BaseLifeCycleStatus, SaleLifeCycleType: PACKAGED_TYPE },
      ShipmentDate: new Date(date).toISOString(),
    }

    try {
      await updateSale(payload)
      notifications.show({ color: 'green', message: t('Продаж відвантажено') })
      onSaved()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося відвантажити продаж') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="md">
      <TextInput
        label={t('Дата відгрузки')}
        type="date"
        value={date}
        onChange={(event) => setDate(event.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button color="gray" disabled={isSaving} variant="subtle" onClick={onCancel}>
          {t('Скасувати')}
        </Button>
        <Button loading={isSaving} onClick={ship}>
          {t('Відвантажити')}
        </Button>
      </Group>
    </Stack>
  )
}

function toDateInput(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}

function todayInput(): string {
  return toDateInput(new Date())
}
