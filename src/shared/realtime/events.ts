import { useEffect, useRef } from 'react'

export const realtimeEvents = {
  crossExchangeRateUpdated: 'crossExchangeRateUpdated',
  dataSyncNotification: 'dataSyncNotification',
  exchangeRateUpdated: 'exchangeRateUpdated',
  govCrossExchangeRateUpdated: 'govCrossExchangeRateUpdated',
  govExchangeRateUpdated: 'govExchangeRateUpdated',
  productReservationUpdated: 'productReservationUpdated',
  resaleAvailabilitiesUpdated: 'resaleAvailabilitiesUpdated',
  saleAdded: 'saleAdded',
  saleUpdated: 'saleUpdated',
  supplyOrderAdded: 'supplyOrderAdded',
  supplyOrderNotification: 'supplyOrderNotification',
  supplyPaymentTaskNotification: 'supplyPaymentTaskNotification',
} as const

export type RealtimeEventPayloads = {
  [realtimeEvents.crossExchangeRateUpdated]: unknown
  [realtimeEvents.dataSyncNotification]: DataSyncNotification
  [realtimeEvents.exchangeRateUpdated]: unknown
  [realtimeEvents.govCrossExchangeRateUpdated]: unknown
  [realtimeEvents.govExchangeRateUpdated]: unknown
  [realtimeEvents.productReservationUpdated]: unknown
  [realtimeEvents.resaleAvailabilitiesUpdated]: unknown[]
  [realtimeEvents.saleAdded]: unknown
  [realtimeEvents.saleUpdated]: unknown
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

type RealtimeListener<TPayload> = (payload: TPayload) => void

class RealtimeEventBus {
  private readonly listeners = new Map<RealtimeEventName, Set<RealtimeListener<unknown>>>()

  emit<TEvent extends RealtimeEventName>(eventName: TEvent, payload: RealtimeEventPayloads[TEvent]): void {
    this.listeners.get(eventName)?.forEach((listener) => listener(payload))
  }

  on<TEvent extends RealtimeEventName>(
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

  useEffect(() => {
    const unsubscribe = realtimeBus.on(eventName, (payload) => {
      listenerRef.current(payload)
    })

    return () => {
      unsubscribe()
    }
  }, [eventName])
}
