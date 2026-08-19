import { Alert, Badge, Card, Group, Loader, Stack, Text } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { usePermissions } from '../../auth/usePermissions'
import { getSupplyUkraineOrderDisplayNumber } from '../../../shared/supplyUkraineOrderNumbers'
import {
  createSupplyOrderUkrainePaymentProtocol,
  deleteSupplyOrderUkrainePaymentProtocol,
  getLogisticPaymentTaskResponsibleUsers,
  getResponsibleUsers,
  getSupplyOrderUkraineById,
  getSupplyOrderUkraineProtocolKeys,
  updateSupplyOrderUkraine,
  uploadUkraineMergedService,
} from '../api/paymentProtocolsApi'
import { MergedServicesSection } from '../components/MergedServicesSection'
import { PaymentDeliveryProtocolsSection } from '../components/PaymentDeliveryProtocolsSection'
import { createUkrainePaymentMutationPayload } from '../paymentMutationPayload'
import type {
  MergedService,
  NewPaymentProtocolFormValues,
  ProtocolUser,
  SupplyOrderUkraine,
  SupplyOrderUkrainePaymentDeliveryProtocol,
  SupplyOrderUkrainePaymentDeliveryProtocolKey,
  SupplyPaymentTask,
} from '../types'
import './supply-ukraine-payment-protocols.css'

const BACK_ROUTE = '/orders/ukraine/all'
const PERMISSION_PAGE_VIEW = PermissionKeys.OrdersUkraine.Page.View
const PERMISSION_CREATE_PAYMENT_PROTOCOL = PermissionKeys.OrdersUkraine.Order.CreatePaymentTask
const PERMISSION_CREATE_LOGISTIC_PAYMENT_TASK = PermissionKeys.OrdersUkraine.LogisticWay.CreatePaymentTask
const PERMISSION_REMOVE_PAYMENT_TASK = PermissionKeys.OrdersUkraine.LogisticWay.DeletePaymentTask

export function SupplyUkrainePaymentProtocolsView() {
  const { t } = useI18n()
  const { can, isLoading } = usePermissions()

  if (isLoading) {
    return <Text c="dimmed">{t('Завантаження')}</Text>
  }

  if (!can(PERMISSION_PAGE_VIEW)) {
    return (
      <Alert color="red" icon={<CircleAlert size={18} />} title={t('Доступ заборонено')} variant="light">
        {t('Недостатньо прав для перегляду платіжних протоколів')}
      </Alert>
    )
  }

  return <SupplyUkrainePaymentProtocolsContent />
}

function SupplyUkrainePaymentProtocolsContent() {
  const { t } = useI18n()
  const { can } = usePermissions()
  const navigate = useNavigate()
  const { netid } = useParams<{ netid: string }>()

  const [order, setOrder] = useValueState<SupplyOrderUkraine | null>(null)
  const [protocolKeys, setProtocolKeys] = useValueState<SupplyOrderUkrainePaymentDeliveryProtocolKey[]>([])
  const [users, setUsers] = useValueState<ProtocolUser[]>([])
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [actionError, setActionError] = useValueState<string | null>(null)
  const canCreatePaymentProtocol = can(PERMISSION_CREATE_PAYMENT_PROTOCOL)
  const canCreateLogisticPaymentTask = can(PERMISSION_CREATE_LOGISTIC_PAYMENT_TASK)
  const canRemovePaymentTask = can(PERMISSION_REMOVE_PAYMENT_TASK)
  const orderNumber = getSupplyUkraineOrderDisplayNumber(order) || netid || ''

  function closeSheet() {
    navigate(BACK_ROUTE)
  }

  function rejectAction(message: string): never {
    setActionError(message)
    throw new Error(message)
  }

  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      if (!netid) {
        setError(t('Не задано ідентифікатор замовлення'))
        setOrder(null)
        setLoading(false)

        return
      }

      setLoading(true)
      setError(null)

      try {
        const [nextOrder, nextKeys, nextUsers] = await Promise.all([
          getSupplyOrderUkraineById(netid),
          canCreatePaymentProtocol ? getSupplyOrderUkraineProtocolKeys() : Promise.resolve([]),
          canCreatePaymentProtocol
            ? getResponsibleUsers()
            : canCreateLogisticPaymentTask
              ? getLogisticPaymentTaskResponsibleUsers()
              : Promise.resolve([]),
        ])

        if (!cancelled) {
          setOrder(nextOrder)
          setProtocolKeys(nextKeys)
          setUsers(nextUsers)
        }
      } catch (requestError) {
        if (!cancelled) {
          setOrder(null)
          setError(requestError instanceof Error ? requestError.message : t('Не вдалося завантажити замовлення'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadAll()

    return () => {
      cancelled = true
    }
  }, [canCreateLogisticPaymentTask, canCreatePaymentProtocol, netid, setError, setLoading, setOrder, setProtocolKeys, setUsers, t])

  async function persistOrder(nextOrder: SupplyOrderUkraine): Promise<void> {
    setSaving(true)
    setActionError(null)

    try {
      const updated = await updateSupplyOrderUkraine(nextOrder)

      if (updated) {
        setOrder(updated)
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : t('Не вдалося виконати запит')
      setActionError(message)
      throw new Error(message, { cause: requestError })
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateService(service: MergedService, documents: File[]): Promise<void> {
    if (!can(PERMISSION_CREATE_LOGISTIC_PAYMENT_TASK)) {
      rejectAction(t('Недостатньо прав для цієї дії'))
    }

    if (!order?.NetUid) {
      rejectAction(t('Не задано замовлення'))
    }

    setSaving(true)
    setActionError(null)

    try {
      const updated = await uploadUkraineMergedService(order.NetUid, service, documents)

      if (updated) {
        setOrder(updated)
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : t('Не вдалося виконати запит')
      setActionError(message)
      throw new Error(message, { cause: requestError })
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveService(service: MergedService): Promise<void> {
    if (!can(PERMISSION_REMOVE_PAYMENT_TASK)) {
      rejectAction(t('Недостатньо прав для цієї дії'))
    }

    if (!order?.NetUid) {
      rejectAction(t('Не задано замовлення'))
    }

    const nextOrder = createUkrainePaymentMutationPayload(order, {
      mergedServices: [{ ...service, Deleted: true }],
    })

    await persistOrder(nextOrder)
  }

  async function handleAddPaymentTask(
    service: MergedService,
    values: { comment: string; payToDate: Date | null; responsible: ProtocolUser | null },
    isAccounting: boolean,
  ): Promise<void> {
    if (!can(PERMISSION_CREATE_LOGISTIC_PAYMENT_TASK)) {
      rejectAction(t('Недостатньо прав для цієї дії'))
    }

    if (!order?.NetUid) {
      rejectAction(t('Не задано замовлення'))
    }

    const paymentTask: SupplyPaymentTask = {
      Comment: values.comment,
      PayToDate: values.payToDate ? values.payToDate.toISOString() : undefined,
      User: values.responsible,
    }

    const nextService = isAccounting
      ? { ...service, AccountingPaymentTask: paymentTask }
      : { ...service, SupplyPaymentTask: paymentTask }
    const nextOrder = createUkrainePaymentMutationPayload(order, {
      mergedServices: [nextService],
    })

    await persistOrder(nextOrder)
  }

  async function handleRemovePaymentTask(service: MergedService, task: SupplyPaymentTask): Promise<void> {
    if (!can(PERMISSION_REMOVE_PAYMENT_TASK)) {
      rejectAction(t('Недостатньо прав для цієї дії'))
    }

    if (!order) {
      rejectAction(t('Не задано замовлення'))
    }

    const nextService: MergedService = { ...service }

    if (isSameEntity(service.SupplyPaymentTask, task)) {
      nextService.SupplyPaymentTask = { ...service.SupplyPaymentTask, Deleted: true }
    }

    if (isSameEntity(service.AccountingPaymentTask, task)) {
      nextService.AccountingPaymentTask = { ...service.AccountingPaymentTask, Deleted: true }
    }

    const nextOrder = createUkrainePaymentMutationPayload(order, {
      mergedServices: [nextService],
    })

    await persistOrder(nextOrder)
  }

  async function handleCreateProtocol(values: NewPaymentProtocolFormValues): Promise<void> {
    if (!can(PERMISSION_CREATE_PAYMENT_PROTOCOL)) {
      rejectAction(t('Недостатньо прав для цієї дії'))
    }

    if (!order?.NetUid) {
      rejectAction(t('Не задано замовлення'))
    }

    const protocol: SupplyOrderUkrainePaymentDeliveryProtocol = {
      IsAccounting: values.isAccounting,
      SupplyOrderUkrainePaymentDeliveryProtocolKey: values.protocolKey,
      SupplyPaymentTask: {
        Comment: values.comment,
        PayToDate: values.payToDate ? values.payToDate.toISOString() : undefined,
        User: values.responsible,
      },
      Discount: Number(values.discount) || 0,
      Value: Number(values.value) || 0,
    }

    setSaving(true)
    setActionError(null)
    try {
      const updated = await createSupplyOrderUkrainePaymentProtocol(order.NetUid, protocol)
      if (updated) {
        setOrder(updated)
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : t('Не вдалося виконати запит')
      setActionError(message)
      throw new Error(message, { cause: requestError })
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveProtocol(protocol: SupplyOrderUkrainePaymentDeliveryProtocol): Promise<void> {
    if (!can(PERMISSION_REMOVE_PAYMENT_TASK)) {
      rejectAction(t('Недостатньо прав для цієї дії'))
    }

    if (!order?.NetUid) {
      rejectAction(t('Не задано замовлення'))
    }

    setSaving(true)
    setActionError(null)
    try {
      const updated = await deleteSupplyOrderUkrainePaymentProtocol(order.NetUid, protocol)
      if (updated) {
        setOrder(updated)
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : t('Не вдалося виконати запит')
      setActionError(message)
      throw new Error(message, { cause: requestError })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppDrawer
      className="supply-payment-sheet"
      opened
      position="right"
      size="wide"
      title={
        <div className="supply-payment-sheet-title">
          <span>{t('Платіжні задачі')}</span>
          <div>
            <small>{t('Замовлення на Україну')}</small>
            {orderNumber && (
              <Badge className="app-role-pill is-yellow supply-payment-sheet-order-pill" variant="light">
                {orderNumber}
              </Badge>
            )}
          </div>
        </div>
      }
      onClose={closeSheet}
    >
      <Stack className="supply-payment-sheet-body" gap="md">
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}
        {actionError && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {actionError}
          </Alert>
        )}

        {isLoading ? (
          <Card className="app-section-card supply-payment-section-card" withBorder radius="md" padding="md">
            <Group justify="center" py="xl">
              <Loader color="orange" size="sm" />
            </Group>
          </Card>
        ) : order ? (
          <Stack gap="md">
            <Card className="app-section-card supply-payment-section-card" withBorder radius="md" padding="md">
              <MergedServicesSection
                isSaving={isSaving}
                permissions={{
                  canCreatePaymentTask: canCreateLogisticPaymentTask,
                  canCreateService: canCreateLogisticPaymentTask,
                  canRemovePaymentTask,
                  canRemoveService: canRemovePaymentTask,
                }}
                services={order.MergedServices || []}
                users={users}
                onAddPaymentTask={handleAddPaymentTask}
                onCreateService={handleCreateService}
                onRemovePaymentTask={handleRemovePaymentTask}
                onRemoveService={handleRemoveService}
              />
            </Card>

            <Card className="app-section-card supply-payment-section-card" withBorder radius="md" padding="md">
              <PaymentDeliveryProtocolsSection
                canCreateProtocol={canCreatePaymentProtocol}
                canRemoveProtocol={canRemovePaymentTask}
                isSaving={isSaving}
                protocolKeys={protocolKeys}
                protocols={order.SupplyOrderUkrainePaymentDeliveryProtocols || []}
                totalGrossPriceLocal={order.TotalGrossPriceLocal || 0}
                users={users}
                onCreateProtocol={handleCreateProtocol}
                onRemoveProtocol={handleRemoveProtocol}
              />
            </Card>
          </Stack>
        ) : (
          !error && (
            <Card className="app-section-card supply-payment-section-card" withBorder radius="md" padding="md">
              <Text className="supply-payment-empty-state">{t('Замовлення не знайдено')}</Text>
            </Card>
          )
        )}
      </Stack>
    </AppDrawer>
  )
}

function isSameEntity<T extends { Id?: number; NetUid?: string }>(
  left: T | null | undefined,
  right: T | null | undefined,
): boolean {
  if (!left || !right) {
    return false
  }

  if (left.NetUid && right.NetUid) {
    return left.NetUid === right.NetUid
  }

  if (left.Id && right.Id) {
    return left.Id === right.Id
  }

  return left === right
}

export const SupplyUkrainePaymentProtocolsPage = SupplyUkrainePaymentProtocolsView
