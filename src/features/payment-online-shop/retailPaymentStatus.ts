import {
  RetailPaymentStatusType,
  type RetailPaymentStatusTypeValue,
} from './types'

export type RetailPaymentStatusPresentation = {
  color: string
  label: string
}

const STATUS_PRESENTATIONS: Record<
  RetailPaymentStatusTypeValue,
  RetailPaymentStatusPresentation
> = {
  [RetailPaymentStatusType.New]: {
    color: 'gray',
    label: 'Очікує підтвердження',
  },
  [RetailPaymentStatusType.Confirmed]: {
    color: 'blue',
    label: 'Підтверджено менеджером',
  },
  [RetailPaymentStatusType.ChangedToInvoice]: {
    color: 'indigo',
    label: 'Змінено на накладну',
  },
  [RetailPaymentStatusType.PartialPaid]: {
    color: 'orange',
    label: 'Частково оплачено',
  },
  [RetailPaymentStatusType.Paid]: {
    color: 'green',
    label: 'Оплачено',
  },
}

export function getRetailPaymentStatusPresentation(
  value: number | undefined,
): RetailPaymentStatusPresentation {
  if (value !== undefined && value in STATUS_PRESENTATIONS) {
    return STATUS_PRESENTATIONS[value as RetailPaymentStatusTypeValue]
  }

  return {
    color: 'red',
    label: 'Невідомий статус',
  }
}

export function isRetailPaymentManagerConfirmed(
  value: number | undefined,
): boolean {
  return value !== undefined &&
    value !== RetailPaymentStatusType.New &&
    value in STATUS_PRESENTATIONS
}
