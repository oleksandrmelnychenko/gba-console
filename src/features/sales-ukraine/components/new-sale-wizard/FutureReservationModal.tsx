import { useBusyState } from '../../../../shared/hooks/useBusyState'
import { Alert, Button, Group, Loader, NumberInput, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CalendarClock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatLocalDate } from '../../../../shared/date/dateTime'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { PermissionKeys } from '../../../../shared/auth/permissionKeys'
import { AppModal, AppModalFooter } from '../../../../shared/ui/AppModal'
import { TableChip } from '../../../../shared/ui/TableChip'
import { usePermissions } from '../../../auth/usePermissions'
import { usePersistentCreateMutation } from '../../persistentCreateMutation'
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
  const { can } = usePermissions()
  const canCreate = can(PermissionKeys.SalesUkraine.Sale.CreateFutureReservation)

  return (
    <AppModal centered opened={Boolean(product) && canCreate} size="sm" title={t('Резервування під поставку')} onClose={onClose}>
      {product && canCreate && (
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
  const { can } = usePermissions()
  const canCreate = can(PermissionKeys.SalesUkraine.Sale.CreateFutureReservation)
  const [order, setOrder] = useState<WizardNearestSupplyOrder | null>(null)
  const [isLoading, setLoading] = useState(() => Boolean(product.NetUid))
  const [count, setCount] = useState<number | string>(1)
  const [isSaving, setSaving, tryStartSaving] = useBusyState()
  const runCreateFutureReservation = usePersistentCreateMutation(
    'future-reservation',
    `${clientNetId ?? 'no-client'}:${product.NetUid ?? product.Id ?? 'no-product'}`,
  )

  useEffect(() => {
    const netId = product.NetUid

    if (!canCreate || !netId) {
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
  }, [canCreate, product.NetUid])

  const numericCount = typeof count === 'number' ? count : Number(String(count).replace(',', '.'))
  const maxCount = typeof order?.Qty === 'number' && Number.isFinite(order.Qty) ? order.Qty : null
  const isValid = Number.isFinite(numericCount) && numericCount > 0 && (maxCount === null || numericCount <= maxCount)
  const supplyOrderNetId = order?.NetUID || order?.NetUid
  const canReserve = Boolean(canCreate && clientNetId && product.NetUid && supplyOrderNetId && isValid)

  async function reserve() {
    if (!canCreate || !clientNetId || !product.NetUid || !supplyOrderNetId || !isValid) {
      return
    }

    if (!tryStartSaving()) {
      return
    }

    try {
      await runCreateFutureReservation(
        {
          ClientNetId: clientNetId,
          Count: numericCount,
          ProductNetId: product.NetUid,
          RemindDate: order?.OrderArrivedDate,
          SupplyOrderNetId: supplyOrderNetId,
        },
        createFutureReservation,
      )
      notifications.show({ color: 'green', message: t('Зарезервовано під поставку') })
      onReserved()
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : t('Не вдалося зарезервувати'),
      })
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
    <Stack
      className="app-compact-form"
      gap={10}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.stopPropagation()

          if (canReserve && !isSaving) {
            void reserve()
          }
        }
      }}
    >
      <Stack gap={4}>
        <Group gap={6}>
          <TableChip tone="product" value={product.VendorCode || product.Articul} />
        </Group>
        <Text fw={600} size="sm">{product.NameUA || product.Name}</Text>
      </Stack>

      {supplyOrderNetId ? (
        <Alert color="blue" icon={<CalendarClock size={18} />} variant="light">
          <Stack gap={4}>
            <Text size="xs" fw={600}>{t('Найближча поставка')}</Text>
            <Group gap={6}>
              <TableChip tone="document" value={order?.Number} />
              <Text size="xs" ff="var(--font-mono)">
                {order?.OrderArrivedDate ? formatLocalDate(new Date(order.OrderArrivedDate)) : t('дата невідома')}
                {maxCount !== null ? ` · ${maxCount} ${t('штук')}` : ''}
              </Text>
            </Group>
          </Stack>
        </Alert>
      ) : !clientNetId ? (
        <Alert color="orange" variant="light">
          {t('Оберіть клієнта для резервування')}
        </Alert>
      ) : (
        <Alert color="orange" variant="light">
          {t('Немає найближчої поставки для резервування')}
        </Alert>
      )}

      <NumberInput
        w={180}
        maw="100%"
        allowNegative={false}
        decimalScale={2}
        disabled={!supplyOrderNetId}
        error={supplyOrderNetId && !isValid ? t('Невірна кількість') : undefined}
        label={t('Кількість')}
        max={maxCount ?? undefined}
        min={0}
        value={count}
        onChange={setCount}
      />

      <AppModalFooter>
        <Button color="gray" disabled={isSaving} variant="default" onClick={onCancel}>
          {t('Скасувати')}
        </Button>
        <Button disabled={!canReserve} loading={isSaving} onClick={reserve}>
          {t('Зарезервувати')}
        </Button>
      </AppModalFooter>
    </Stack>
  )
}
