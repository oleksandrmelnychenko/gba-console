import { useEffect, useRef } from 'react'

export const realtimeEvents = {
  crossExchangeRateUpdated: 'crossExchangeRateUpdated',
  dataSyncNotification: 'dataSyncNotification',
  exchangeRateUpdated: 'exchangeRateUpdated',
  ecommerceImageSearchCreated: 'ecommerceImageSearchCreated',
  ecommerceImageSearchUpdated: 'ecommerceImageSearchUpdated',
  govCrossExchangeRateUpdated: 'govCrossExchangeRateUpdated',
  govExchangeRateUpdated: 'govExchangeRateUpdated',
  productReservationUpdated: 'productReservationUpdated',
  preOrderAdded: 'preOrderAdded',
  resaleAvailabilitiesUpdated: 'resaleAvailabilitiesUpdated',
  saleAdded: 'saleAdded',
  saleUpdated: 'saleUpdated',
  salesCockpitTasksChanged: 'salesCockpitTasksChanged',
  supplyOrderAdded: 'supplyOrderAdded',
  supplyOrderNotification: 'supplyOrderNotification',
  supplyPaymentTaskNotification: 'supplyPaymentTaskNotification',
} as const

export type RealtimeEventPayloads = {
  [realtimeEvents.crossExchangeRateUpdated]: unknown
  [realtimeEvents.dataSyncNotification]: DataSyncNotification
  [realtimeEvents.exchangeRateUpdated]: unknown
  [realtimeEvents.ecommerceImageSearchCreated]: EcommerceImageSearchRealtimeNotification
  [realtimeEvents.ecommerceImageSearchUpdated]: EcommerceImageSearchRealtimeNotification
  [realtimeEvents.govCrossExchangeRateUpdated]: unknown
  [realtimeEvents.govExchangeRateUpdated]: unknown
  [realtimeEvents.productReservationUpdated]: unknown
  [realtimeEvents.preOrderAdded]: PreOrderAddedRealtimeNotification
  [realtimeEvents.resaleAvailabilitiesUpdated]: unknown[]
  [realtimeEvents.saleAdded]: SaleAddedRealtimeNotification
  [realtimeEvents.saleUpdated]: unknown
  [realtimeEvents.salesCockpitTasksChanged]: SalesCockpitTasksChangedNotification
  [realtimeEvents.supplyOrderAdded]: unknown
  [realtimeEvents.supplyOrderNotification]: SupplyOrderNotification
  [realtimeEvents.supplyPaymentTaskNotification]: SupplyPaymentTaskNotification
}

export type RealtimeEventName = keyof RealtimeEventPayloads

export type DataSyncNotification = {
  DisplayMessage?: string
  IsError?: boolean
  StopProgressBar?: boolean
}

export type SupplyOrderNotification = {
  Amount?: number | string
  CreatedBy?: string
  Message?: string
  Title?: string
}

export type SupplyPaymentTaskNotification = {
  Amount?: number | string
  OrganisationName?: string
  PayToDate?: string
  PaymentForm?: string
}

export type SalesCockpitTasksChangedNotification = {
  ChangedAtUtc?: string
  changedAtUtc?: string
}

export type SaleAddedRealtimeNotification = {
  Sale?: {
    ClientAgreement?: {
      Agreement?: {
        Currency?: { Code?: string }
      }
      Client?: { FullName?: string }
    }
    Created?: string
    NetUid?: string
    Order?: {
      OrderItems?: unknown[]
      OrderSource?: number | string
      TotalAmountLocal?: number | string
    }
    RetailClient?: {
      FullName?: string
      Name?: string
    }
    SaleNumber?: { Value?: string }
    TotalAmountLocal?: number | string
    TotalPositions?: number | string
  }
}

export type PreOrderAddedRealtimeNotification = {
  Client?: {
    FullName?: string
    MobileNumber?: string
  }
  Comment?: string
  Created?: string
  MobileNumber?: string
  NetUid?: string
  Product?: {
    Name?: string
    NameUA?: string
    NetUid?: string
    VendorCode?: string
  }
  Qty?: number | string
}

export type EcommerceImageSearchRealtimeNotification = {
  CreatedAtUtc?: string
  IsAuthenticated?: boolean
  Locale?: string
  NetUid?: string
  OriginalFileName?: string
  Status?: 'completed' | 'failed' | 'processing' | string
}

type RealtimeListener<TPayload> = (payload: TPayload) => void

class RealtimeEventBus {
  private readonly listeners = new Map<RealtimeEventName, Set<RealtimeListener<unknown>>>()

  emit<TEvent extends RealtimeEventName>(eventName: TEvent, payload: RealtimeEventPayloads[TEvent]): void {
    this.listeners.get(eventName)?.forEach((listener) => listener(payload))
  }

  subscribe<TEvent extends RealtimeEventName>(
    eventName: TEvent,
    listener: RealtimeListener<RealtimeEventPayloads[TEvent]>,
  ): () => void {
    const listeners = this.listeners.get(eventName) ?? new Set<RealtimeListener<unknown>>()
    listeners.add(listener as RealtimeListener<unknown>)
    this.listeners.set(eventName, listeners)

    return () => {
      listeners.delete(listener as RealtimeListener<unknown>)

      if (listeners.size === 0) {
        this.listeners.delete(eventName)
      }
    }
  }
}

export const realtimeBus = new RealtimeEventBus()

export function useRealtimeEvent<TEvent extends RealtimeEventName>(
  eventName: TEvent,
  listener: RealtimeListener<RealtimeEventPayloads[TEvent]>,
): void {
  const listenerRef = useRef(listener)

  useEffect(() => {
    listenerRef.current = listener
  }, [listener])

  useEffect(
    () => realtimeBus.subscribe(eventName, (payload) => {
      listenerRef.current(payload)
    }),
    [eventName],
  )
}
