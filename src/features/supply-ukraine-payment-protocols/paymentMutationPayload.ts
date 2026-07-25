import type {
  MergedService,
  SupplyOrderUkraine,
  SupplyOrderUkrainePaymentDeliveryProtocol,
} from './types'

export function createUkrainePaymentMutationPayload(
  order: SupplyOrderUkraine,
  {
    mergedServices = [],
    paymentProtocols = [],
  }: {
    mergedServices?: MergedService[]
    paymentProtocols?: SupplyOrderUkrainePaymentDeliveryProtocol[]
  },
): SupplyOrderUkraine {
  return {
    ...order,
    MergedServices: mergedServices,
    SupplyOrderUkrainePaymentDeliveryProtocols: paymentProtocols,
  }
}
