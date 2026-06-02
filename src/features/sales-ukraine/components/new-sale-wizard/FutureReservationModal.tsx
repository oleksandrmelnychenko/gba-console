import { Alert, Button, Group, Loader, NumberInput, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCalendarClock } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { formatLocalDate } from '../../../../shared/date/dateTime'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal } from '../../../../shared/ui/AppModal'
import type { SalesUkraineProduct } from '../../types'
import { createFutureReservation, getNearestSupplyOrder, type WizardNearestSupplyOrder } from './newSaleWizardApi'

export function FutureReservationModal({
  clientNetId,
  product,
  onClose,
  onReserved,
}: {
  clientNetId: string | null
  onClose: () => void
  onReserved: () => void
  product: SalesUkraineProduct | null
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(product)} size="sm" title={t('Резервування під поставку')} onClose={onClose}>
      {product && (
        <FutureReservationForm
          key={product.NetUid || product.Id}
          clientNetId={clientNetId}
          product={product}
          onCancel={onClose}
          onReserved={onReserved}
        />
      )}
    </AppModal>
  )
}

function FutureReservationForm({
  clientNetId,
  product,
  onCancel,
  onReserved,
}: {
  clientNetId: string | null
  onCancel: () => void
  onReserved: () => void
  product: SalesUkraineProduct
}) {
  const { t } = useI18n()
  const [order, setOrder] = useState<WizardNearestSupplyOrder | null>(null)
  const [isLoading, setLoading] = useState(() => Boolean(product.NetUid))
  const [count, setCount] = useState<number | string>(1)
  const [isSaving, setSaving] = useState(false)

  useEffect(() => {
    const netId = product.NetUid

    if (!netId) {
      return
    }

    let cancelled = false

    async function load(id: string) {
      setLoading(true)

      try {
        const next = await getNearestSupplyOrder(id)

        if (!cancelled) {
          setOrder(next)
        }
      } catch {
        if (!cancelled) {
          setOrder(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load(netId)

    return () => {
      cancelled = true
    }
  }, [product.NetUid])

  const numericCount = typeof count === 'number' ? count : Number(String(count).replace(',', '.'))
  const isValid = Number.isFinite(numericCount) && numericCount > 0
  const supplyOrderNetId = order?.NetUID || order?.NetUid

  async function reserve() {
    if (!isValid || !supplyOrderNetId) {
      return
    }

    setSaving(true)

    try {
      await createFutureReservation({
        ClientNetId: clientNetId ?? undefined,
        Count: numericCount,
        ProductNetId: product.NetUid,
        RemindDate: order?.OrderArrivedDate,
        SupplyOrderNetId: supplyOrderNetId,
      })
      notifications.show({ color: 'green', message: t('Зарезервовано під поставку') })
      onReserved()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося зарезервувати') })
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Group justify="center" py="lg">
        <Loader size="sm" />
      </Group>
    )
  }

  return (
    <Stack gap="md">
      <Text fw={600} size="sm">
        {product.VendorCode || product.Articul} · {product.NameUA || product.Name}
      </Text>

      {supplyOrderNetId ? (
        <Alert color="blue" icon={<IconCalendarClock size={18} />} variant="light">
          {t('Найближча поставка')}: {order?.Number ? `${order.Number} · ` : ''}
          {order?.OrderArrivedDate ? formatLocalDate(new Date(order.OrderArrivedDate)) : t('дата невідома')}
        </Alert>
      ) : (
        <Alert color="orange" variant="light">
          {t('Немає найближчої поставки для резервування')}
        </Alert>
      )}

      <NumberInput
        allowNegative={false}
        decimalScale={2}
        disabled={!supplyOrderNetId}
        label={t('Кількість')}
        min={0}
        value={count}
        onChange={setCount}
      />

      <Group justify="flex-end">
        <Button color="gray" disabled={isSaving} variant="subtle" onClick={onCancel}>
          {t('Скасувати')}
        </Button>
        <Button disabled={!isValid || !supplyOrderNetId} loading={isSaving} onClick={reserve}>
          {t('Зарезервувати')}
        </Button>
      </Group>
    </Stack>
  )
}
