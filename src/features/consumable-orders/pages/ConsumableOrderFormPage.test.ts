import { describe, expect, it } from 'vitest'
import {
  buildOrderPayload,
  EXISTING_ORDER_MUTATION_DISCLOSURE,
  getConsumableOrderMutationLocks,
  normalizeOrderForForm,
  type ConsumableOrderFormState,
  validateOrderPayload,
} from './consumableOrderFormModel'
import type {
  ConsumablesOrder,
  ConsumablesOrderItem,
  ConsumablesStorage,
  SupplyOrganization,
  SupplyOrganizationAgreement,
} from '../types'

const t = (value: string) => value

describe('ConsumableOrderFormPage hardening', () => {
  it('does not recalculate persisted line economics while opening an order', () => {
    const order = normalizeOrderForForm({
      ConsumablesOrderItems: [
        {
          Id: 10,
          PricePerItem: 100,
          Qty: 2,
          TotalPrice: 777,
          TotalPriceWithVAT: 999,
          VAT: 222,
          VatPercent: 20,
        },
        {
          Id: -1,
          PricePerItem: 100,
          Qty: 2,
          VatPercent: 20,
        },
      ],
    })

    expect(order.ConsumablesOrderItems?.[0]).toMatchObject({
      TotalPrice: 777,
      TotalPriceWithVAT: 999,
      VAT: 222,
    })
    expect(order.ConsumablesOrderItems?.[1]).toMatchObject({
      TotalPrice: 166.67,
      TotalPriceWithVAT: 200,
      VAT: 33.33,
    })
  })

  it('rejects any active categoryless or otherwise invalid row', () => {
    const valid = createValidItem()
    const categoryless: ConsumablesOrderItem = {
      ...createValidItem(),
      ConsumableProductCategory: null,
      ConsumableProduct: {
        ...createValidItem().ConsumableProduct,
        ConsumableProductCategory: null,
      },
    }
    const order = createValidOrder([
      valid,
      categoryless,
    ])

    expect(validateOrderPayload(order, t)).toBe(
      'Оберіть товар з категорією',
    )
  })

  it('preserves an existing payment task instead of rebuilding editable fields', () => {
    const supplier = createSupplier()
    const agreement = createAgreement()
    const storage = createStorage()
    const existingTask = {
      Comment: 'canonical',
      Id: 91,
      NetUid: '91919191-9191-4191-8191-919191919191',
      PayToDate: '2026-07-26T14:30:00+03:00',
      User: {
        Id: 22,
        NetUid: '22222222-2222-4222-8222-222222222222',
      },
    }
    const order = createValidOrder([createValidItem()])
    order.SupplyPaymentTask = existingTask
    order.SupplyPaymentTaskId = 91

    const payload = buildOrderPayload({
      form: {
        ...createForm(),
        paymentTaskComment: 'changed in stale UI',
        paymentTaskPayToDate: '2027-01-01',
      },
      order,
      selectedAgreement: agreement,
      selectedResponsibleUser: {
        Id: 99,
        NetUid: '99999999-9999-4999-8999-999999999999',
      },
      selectedStorage: storage,
      selectedSupplier: supplier,
    })

    expect(payload.SupplyPaymentTask).toBe(existingTask)
    expect(payload.SupplyPaymentTask).toEqual(existingTask)
    expect(payload.SupplyPaymentTaskId).toBe(91)
  })

  it('binds existing-order economic controls to the disclosed read-only state', () => {
    expect(getConsumableOrderMutationLocks({
      isEditMode: true,
      isPaid: false,
    })).toEqual({
      isEconomicMutationLocked: true,
      isTaskMutationLocked: true,
    })
    expect(getConsumableOrderMutationLocks({
      isEditMode: false,
      isPaid: true,
    })).toEqual({
      isEconomicMutationLocked: true,
      isTaskMutationLocked: false,
    })
    expect(EXISTING_ORDER_MUTATION_DISCLOSURE).toContain(
      'постачальник, договір, склад, платіжний протокол і позиції недоступні для зміни',
    )
  })
})

function createValidOrder(
  items: ConsumablesOrderItem[],
): ConsumablesOrder {
  return {
    ConsumableProductOrganization: createSupplier(),
    ConsumablesOrderItems: items,
    ConsumablesStorage: createStorage(),
    SupplyOrganizationAgreement: createAgreement(),
  }
}

function createValidItem(): ConsumablesOrderItem {
  return {
    ConsumableProduct: {
      ConsumableProductCategory: {
        Id: 31,
        NetUid: '31313131-3131-4131-8131-313131313131',
      },
      Id: 32,
      NetUid: '32323232-3232-4232-8232-323232323232',
    },
    ConsumableProductCategory: {
      Id: 31,
      NetUid: '31313131-3131-4131-8131-313131313131',
    },
    PaymentCostMovementOperation: {
      PaymentCostMovement: {
        Id: 41,
        NetUid: '41414141-4141-4141-8141-414141414141',
      },
    },
    PricePerItem: 100,
    Qty: 1,
    TotalPrice: 100,
    TotalPriceWithVAT: 100,
    VAT: 0,
    VatPercent: 0,
  }
}

function createSupplier(): SupplyOrganization {
  return {
    Id: 11,
    NetUid: '11111111-1111-4111-8111-111111111111',
  }
}

function createAgreement(): SupplyOrganizationAgreement {
  return {
    Id: 12,
    NetUid: '12121212-1212-4121-8121-121212121212',
    Organization: {
      Id: 13,
      NetUid: '13131313-1313-4131-8131-131313131313',
    },
  }
}

function createStorage(): ConsumablesStorage {
  return {
    Id: 14,
    NetUid: '14141414-1414-4141-8141-141414141414',
  }
}

function createForm(): ConsumableOrderFormState {
  return {
    comment: '',
    invoiceDate: '2026-07-26',
    invoiceNumber: 'INV-1',
    invoiceTime: '12:00',
    paymentTaskComment: '',
    paymentTaskEnabled: true,
    paymentTaskPayToDate: '2026-07-27',
    responsibleUserValue: '',
    selectedAgreementValue: '',
    selectedStorageValue: '',
    selectedSupplierValue: '',
    storageSearch: '',
    supplierSearch: '',
  }
}
