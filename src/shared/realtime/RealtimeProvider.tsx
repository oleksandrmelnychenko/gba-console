import { notifications } from '@mantine/notifications'
import {
  HubConnectionBuilder,
  HttpTransportType,
  LogLevel,
  type HubConnection,
  type RetryContext,
} from '@microsoft/signalr'
import { useEffect, type PropsWithChildren } from 'react'
import { useAuth } from '../../features/auth/useAuth'
import { PermissionKeys } from '../auth/permissionKeys'
import { useI18n } from '../i18n/useI18n'
import {
  realtimeBus,
  realtimeEvents,
  type DataSyncNotification,
  type EcommerceImageSearchRealtimeNotification,
  type PreOrderAddedRealtimeNotification,
  type SaleAddedRealtimeNotification,
  type SupplyOrderNotification,
  type SupplyPaymentTaskNotification,
} from './events'
import { getNumberValue, getStringValue, parseRealtimePayload } from './payload'
import { realtimeUrl } from './realtimeUrl'
import { applyDataSyncNotification } from './dataSyncProgressStore'
import { DATA_SYNC_ERROR_NOTIFICATION_ID, getDataSyncToastAction } from './dataSyncNotificationToast'
import { reconcileDataSyncProgressWithServer, useDataSyncProgressWatchdog } from './dataSyncStatusReconciler'
import { manageConnections } from './hubConnectionManager'
import { createEcommerceOrderNotification } from '../notification-center/ecommerceOrderNotification'
import { createEcommerceInterestNotification } from '../notification-center/ecommerceInterestNotification'
import { createEcommerceImageSearchNotification } from '../notification-center/ecommerceImageSearchNotification'
import { addConsoleNotification } from '../notification-center/store'

const hubPaths = {
  dataSync: '/hubs/data/sync',
  exchangeRates: '/hubs/exchangerates',
  productReservation: '/hubs/products/reservation',
  resale: '/hubs/resale',
  salesCockpit: '/hubs/sales/cockpit',
  supplyOrders: '/hubs/supplies/orders',
} as const

const reconnectDelays = [0, 2_000, 5_000, 10_000, 30_000]

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function RealtimeProvider({ children }: PropsWithChildren) {
  const { hasPermission, isAuthenticated, isLoading, session, user } = useAuth()
  const { t } = useI18n()
  const userKey = user?.NetUid || user?.Id?.toString() || session?.userNetUid
  const canViewDataSyncErrors = hasPermission(
    PermissionKeys.OnlineShopSeo.Synchronization.Run,
  )

  useDataSyncProgressWatchdog(isAuthenticated && !isLoading && canViewDataSyncErrors)

  useEffect(() => {
    if (!isAuthenticated || isLoading) {
      return undefined
    }

    let disposed = false
    const dataSyncConnection = createDataSyncConnection(t, canViewDataSyncErrors)
    const connections = [
      createProductReservationConnection(userKey, t),
      createSupplyOrdersConnection(t),
      createExchangeRatesConnection(),
      createResaleConnection(),
      createSalesCockpitConnection(),
      dataSyncConnection,
    ]
    const stopManagedConnections = manageConnections(connections, () => disposed, (connection) => {
      if (connection === dataSyncConnection && canViewDataSyncErrors) {
        void reconcileDataSyncProgressWithServer()
      }
    })

    if (canViewDataSyncErrors) {
      void reconcileDataSyncProgressWithServer()
    }

    return () => {
      disposed = true
      stopManagedConnections()
    }
  }, [canViewDataSyncErrors, isAuthenticated, isLoading, t, userKey])

  return children
}

function createProductReservationConnection(
  userKey: string | undefined,
  t: (key: string) => string,
): HubConnection {
  const connection = createConnection(hubPaths.productReservation)

  connection.on('GetProductWithoutReservedCount', (payload: unknown) => {
    realtimeBus.emit(realtimeEvents.productReservationUpdated, parseRealtimePayload(payload))
  })

  connection.on('NewSaleAdded', (payload: unknown) => {
    const saleNotification = parseRealtimePayload<SaleAddedRealtimeNotification>(payload)
    realtimeBus.emit(realtimeEvents.saleAdded, saleNotification)

    const notification = createEcommerceOrderNotification(saleNotification)
    if (notification && addConsoleNotification(userKey, notification)) {
      notifications.show({
        color: 'orange',
        message: notification.message || t('Відкрити замовлення'),
        title: notification.title,
      })
    }
  })

  connection.on('NewPreOrderAdded', (payload: unknown) => {
    const preOrder = parseRealtimePayload<PreOrderAddedRealtimeNotification>(payload)
    realtimeBus.emit(realtimeEvents.preOrderAdded, preOrder)

    const notification = createEcommerceInterestNotification(preOrder)
    if (notification && addConsoleNotification(userKey, notification)) {
      notifications.show({
        color: 'grape',
        message: notification.message || t('Відкрити зацікавленість'),
        title: notification.title,
      })
    }
  })

  connection.on('EcommerceImageSearchCreated', (payload: unknown) => {
    const imageSearch = parseRealtimePayload<EcommerceImageSearchRealtimeNotification>(payload)
    realtimeBus.emit(realtimeEvents.ecommerceImageSearchCreated, imageSearch)

    const notification = createEcommerceImageSearchNotification(imageSearch)
    if (notification && addConsoleNotification(userKey, notification)) {
      notifications.show({
        color: 'grape',
        message: notification.message || t('Відкрити AI-пошук'),
        title: notification.title,
      })
    }
  })

  connection.on('EcommerceImageSearchUpdated', (payload: unknown) => {
    realtimeBus.emit(
      realtimeEvents.ecommerceImageSearchUpdated,
      parseRealtimePayload<EcommerceImageSearchRealtimeNotification>(payload),
    )
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

function createSalesCockpitConnection(): HubConnection {
  const connection = createConnection(hubPaths.salesCockpit)

  connection.on('CockpitTasksChanged', (payload: unknown) => {
    realtimeBus.emit(realtimeEvents.salesCockpitTasksChanged, parseRealtimePayload(payload))
  })

  return connection
}

function createDataSyncConnection(
  t: (key: string) => string,
  canViewDataSyncErrors: boolean,
): HubConnection {
  const connection = createConnection(hubPaths.dataSync)
  const showDataSyncNotification = createDataSyncNotificationPresenter(canViewDataSyncErrors, t)

  connection.on('ProcessNotificationMessage', (payload: unknown) => {
    const notification = parseRealtimePayload<DataSyncNotification>(payload)
    applyDataSyncNotification(notification)
    realtimeBus.emit(realtimeEvents.dataSyncNotification, notification)
    showDataSyncNotification(notification)
  })
  connection.onreconnected(() => {
    if (canViewDataSyncErrors) {
      void reconcileDataSyncProgressWithServer()
    }
  })

  return connection
}

function createConnection(path: string): HubConnection {
  const connection = new HubConnectionBuilder()
    .withUrl(realtimeUrl(path), {
      transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents | HttpTransportType.LongPolling,
      withCredentials: true,
    })
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

function createDataSyncNotificationPresenter(
  canViewDataSyncErrors: boolean,
  t: (key: string) => string,
): (notification: DataSyncNotification) => void {
  let shownErrorRunId: string | undefined

  return (notification) => {
    const action = getDataSyncToastAction(notification, shownErrorRunId)

    if (action.type === 'hide-error') {
      notifications.hide(DATA_SYNC_ERROR_NOTIFICATION_ID)
      shownErrorRunId = undefined
      return
    }

    if (action.type !== 'show-error' || !canViewDataSyncErrors) {
      return
    }

    const { description, title } = splitDataSyncMessage(notification.DisplayMessage, t)

    notifications.hide(DATA_SYNC_ERROR_NOTIFICATION_ID)
    notifications.show({
      autoClose: false,
      color: 'red',
      id: DATA_SYNC_ERROR_NOTIFICATION_ID,
      message: description || title,
      title,
    })
    shownErrorRunId = action.runId
  }
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
