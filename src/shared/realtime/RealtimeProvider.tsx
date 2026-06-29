import { notifications } from '@mantine/notifications'
import {
  HubConnectionBuilder,
  LogLevel,
  type HubConnection,
  type RetryContext,
} from '@microsoft/signalr'
import { useEffect, type PropsWithChildren } from 'react'
import { useAuth } from '../../features/auth/useAuth'
import { apiRequest } from '../api/apiClient'
import { UserRoleType, type AuthUser } from '../auth/types'
import { useI18n } from '../i18n/useI18n'
import {
  realtimeBus,
  realtimeEvents,
  type DataSyncNotification,
  type SupplyOrderNotification,
  type SupplyPaymentTaskNotification,
} from './events'
import { getNumberValue, getStringValue, parseRealtimePayload } from './payload'
import { realtimeUrl } from './realtimeUrl'
import { applyDataSyncNotification, reconcileDataSyncProgress } from './dataSyncProgressStore'

type DataSyncStatus = {
  IsInProgress?: boolean
  isInProgress?: boolean
}

const hubPaths = {
  dataSync: '/hubs/data/sync',
  exchangeRates: '/hubs/exchangerates',
  productReservation: '/hubs/products/reservation',
  resale: '/hubs/resale',
  supplyOrders: '/hubs/supplies/orders',
} as const

const reconnectDelays = [0, 2_000, 5_000, 10_000, 30_000]

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function RealtimeProvider({ children }: PropsWithChildren) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const { t } = useI18n()

  useEffect(() => {
    if (!isAuthenticated || isLoading) {
      return undefined
    }

    let disposed = false
    const dataSyncConnection = createDataSyncConnection(t, user)
    const connections = [
      createProductReservationConnection(),
      createSupplyOrdersConnection(t),
      createExchangeRatesConnection(),
      createResaleConnection(),
      dataSyncConnection,
    ]

    connections.forEach((connection) => {
      void startConnection(connection, () => disposed)
    })
    void reconcileDataSyncProgressWithServer()

    return () => {
      disposed = true
      connections.forEach((connection) => {
        void connection.stop().catch(() => undefined)
      })
    }
  }, [isAuthenticated, isLoading, t, user])

  return children
}

function createProductReservationConnection(): HubConnection {
  const connection = createConnection(hubPaths.productReservation)

  connection.on('GetProductWithoutReservedCount', (payload: unknown) => {
    realtimeBus.emit(realtimeEvents.productReservationUpdated, parseRealtimePayload(payload))
  })

  connection.on('NewSaleAdded', (payload: unknown) => {
    realtimeBus.emit(realtimeEvents.saleAdded, parseRealtimePayload(payload))
  })

  connection.on('SaleUpdated', (payload: unknown) => {
    realtimeBus.emit(realtimeEvents.saleUpdated, parseRealtimePayload(payload))
  })

  return connection
}

function createSupplyOrdersConnection(t: (key: string) => string): HubConnection {
  const connection = createConnection(hubPaths.supplyOrders)

  connection.on('AddedOrUpdatedOrder', (payload: unknown) => {
    const notification = parseRealtimePayload<SupplyOrderNotification>(payload)
    realtimeBus.emit(realtimeEvents.supplyOrderNotification, notification)
    showSupplyOrderNotification(notification, t)
  })

  connection.on('NewOrderAdded', (payload: unknown) => {
    realtimeBus.emit(realtimeEvents.supplyOrderAdded, parseRealtimePayload(payload))
  })

  connection.on('NewPaymentTask', (payload: unknown) => {
    const notification = parseRealtimePayload<SupplyPaymentTaskNotification>(payload)
    realtimeBus.emit(realtimeEvents.supplyPaymentTaskNotification, notification)
    showPaymentTaskNotification(notification, t)
  })

  return connection
}

function createExchangeRatesConnection(): HubConnection {
  const connection = createConnection(hubPaths.exchangeRates)

  connection.on('ExchangeRateUpdated', (payload: unknown) => {
    realtimeBus.emit(realtimeEvents.exchangeRateUpdated, parseRealtimePayload(payload))
  })

  connection.on('CrossExchangeRateUpdated', (payload: unknown) => {
    realtimeBus.emit(realtimeEvents.crossExchangeRateUpdated, parseRealtimePayload(payload))
  })

  connection.on('GovExchangeRateUpdated', (payload: unknown) => {
    realtimeBus.emit(realtimeEvents.govExchangeRateUpdated, parseRealtimePayload(payload))
  })

  connection.on('GovCrossExchangeRateUpdated', (payload: unknown) => {
    realtimeBus.emit(realtimeEvents.govCrossExchangeRateUpdated, parseRealtimePayload(payload))
  })

  return connection
}

function createResaleConnection(): HubConnection {
  const connection = createConnection(hubPaths.resale)

  connection.on('UpdatedReSaleAvailabilities', (payload: unknown) => {
    const availabilities = parseRealtimePayload<unknown>(payload)
    realtimeBus.emit(
      realtimeEvents.resaleAvailabilitiesUpdated,
      Array.isArray(availabilities) ? availabilities : [],
    )
  })

  return connection
}

function createDataSyncConnection(t: (key: string) => string, user: AuthUser | null): HubConnection {
  const connection = createConnection(hubPaths.dataSync)

  connection.on('ProcessNotificationMessage', (payload: unknown) => {
    const notification = parseRealtimePayload<DataSyncNotification>(payload)
    applyDataSyncNotification(notification)
    realtimeBus.emit(realtimeEvents.dataSyncNotification, notification)
    showDataSyncNotification(notification, user, t)
  })
  connection.onreconnected(() => {
    void reconcileDataSyncProgressWithServer()
  })

  return connection
}

async function reconcileDataSyncProgressWithServer(): Promise<void> {
  try {
    const status = await apiRequest<DataSyncStatus>('/data/sync/status', {
      errorMessages: {
        default: 'Не вдалося перевірити статус синхронізації',
        network: 'Сервер синхронізації недоступний',
      },
    })

    reconcileDataSyncProgress(Boolean(status?.IsInProgress ?? status?.isInProgress))
  } catch {
    // Keep the local progress visible when status cannot be verified.
  }
}

function createConnection(path: string): HubConnection {
  const connection = new HubConnectionBuilder()
    .withUrl(realtimeUrl(path), { withCredentials: true })
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: (context: RetryContext) => {
        if (!navigator.onLine) {
          return null
        }

        return reconnectDelays[context.previousRetryCount] ?? reconnectDelays[reconnectDelays.length - 1]
      },
    })
    .configureLogging(LogLevel.Warning)
    .build()

  connection.serverTimeoutInMilliseconds = 60_000
  connection.keepAliveIntervalInMilliseconds = 15_000

  return connection
}

async function startConnection(connection: HubConnection, isDisposed: () => boolean, retryCount = 0): Promise<void> {
  if (isDisposed()) {
    return
  }

  try {
    await connection.start()
  } catch {
    if (isDisposed() || retryCount >= 5) {
      return
    }

    window.setTimeout(() => {
      void startConnection(connection, isDisposed, retryCount + 1)
    }, 5_000)
  }
}

function showSupplyOrderNotification(notification: SupplyOrderNotification, t: (key: string) => string): void {
  const title = getStringValue(notification.Title) || t('Оновлено замовлення')
  const message = [
    getStringValue(notification.Message),
    getStringValue(notification.CreatedBy),
    formatAmount(notification.Amount),
  ].filter(Boolean).join('\n')

  notifications.show({
    color: 'teal',
    message: message || title,
    title,
  })
}

function showPaymentTaskNotification(notification: SupplyPaymentTaskNotification, t: (key: string) => string): void {
  const message = [
    getStringValue(notification.PaymentForm),
    getStringValue(notification.PayToDate),
    getStringValue(notification.OrganisationName),
    formatAmount(notification.Amount),
  ].filter(Boolean).join('\n')

  notifications.show({
    color: 'blue',
    message: message || t('Створено нову платіжну задачу'),
    title: t('Нова платіжна задача'),
  })
}

function showDataSyncNotification(
  notification: DataSyncNotification,
  user: AuthUser | null,
  t: (key: string) => string,
): void {
  if (!shouldShowDataSyncErrorNotification(notification, user)) {
    return
  }

  const { description, title } = splitDataSyncMessage(notification.DisplayMessage, t)

  notifications.show({
    autoClose: false,
    color: 'red',
    message: description || title,
    title,
  })
}

function shouldShowDataSyncErrorNotification(notification: DataSyncNotification, user: AuthUser | null): boolean {
  if (!notification.IsError) {
    return false
  }

  const roleType = user?.UserRole?.UserRoleType
  const roleName = user?.UserRole?.Name

  return roleType === UserRoleType.Administrator
    || roleType === UserRoleType.GBA
    || roleName === 'Administrator'
    || roleName === 'GBA'
}

function splitDataSyncMessage(message: string | undefined, t: (key: string) => string) {
  const value = getStringValue(message)

  if (!value) {
    return { description: '', title: t('Синхронізація') }
  }

  const [description, ...titleParts] = value.split('-')
  const title = titleParts.join('-').trim()

  return {
    description: description.trim(),
    title: title || t('Синхронізація'),
  }
}

function formatAmount(value: unknown): string {
  const amount = getNumberValue(value)

  if (amount === undefined) {
    return ''
  }

  return amountFormatter.format(amount)
}
