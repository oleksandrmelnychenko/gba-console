import { expect, it } from 'vitest'
import type { SalesUkraineSale } from './types'
import { reuseSaleSnapshot, reuseSaleSnapshots } from './saleSnapshot'

const sale = (): SalesUkraineSale => ({ NetUid: 'sale-1', Id: 1, IsLocked: false, Order: { OrderItems: [
  { NetUid: 'item-1', Qty: 1, Product: { NetUid: 'product-1', Name: 'First' } },
  { NetUid: 'item-2', Qty: 2, Product: { NetUid: 'product-2', Name: 'Second' } },
] } })
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

it('reuses equal fresh JSON, including whole registry pages', () => {
  const previous = [sale()]
  expect(reuseSaleSnapshot(previous[0], copy(previous[0]))).toBe(previous[0])
  expect(reuseSaleSnapshots(previous, copy(previous))).toBe(previous)
})

it('reuses unchanged items after a fresh response while retaining all changed fields', () => {
  const previous = sale(), next = copy(previous)
  next.IsLocked = true
  next.Order!.OrderItems![0].Qty = 7
  const shared = reuseSaleSnapshot(previous, next)
  expect(shared).toEqual(next)
  expect(shared).not.toBe(previous)
  expect(shared.Order!.OrderItems![1]).toBe(previous.Order!.OrderItems![1])
  expect(shared.Order!.OrderItems![0]).not.toBe(previous.Order!.OrderItems![0])
  expect(shared.Order!.OrderItems![0].Product).toBe(previous.Order!.OrderItems![0].Product)
  expect(previous.Order!.OrderItems![0].Qty).toBe(1)
  expect(next.Order!.OrderItems![1]).not.toBe(previous.Order!.OrderItems![1])
})

it('matches registry rows by identity across reordering, additions and removals', () => {
  const first = sale(), second = { ...sale(), Id: 2, NetUid: 'sale-2' }
  const added = { ...sale(), Id: 3, NetUid: 'sale-3' }
  const previous = [first, second]
  const shared = reuseSaleSnapshots(previous, [copy(second), added, copy(first)])
  expect(shared[0]).toBe(second)
  expect(shared[1]).toBe(added)
  expect(shared[2]).toBe(first)
  expect(reuseSaleSnapshots(previous, [copy(second)])[0]).toBe(second)
})

it('does not confuse identities, missing values, deleted fields, zero and null', () => {
  const previous = sale()
  for (const next of [
    { ...copy(previous), NetUid: 'other' }, { ...copy(previous), IsLocked: undefined },
    { ...copy(previous), TotalAmount: 0 }, { ...copy(previous), Order: undefined },
  ]) {
    expect(reuseSaleSnapshot(previous, next)).toEqual(next)
    expect(reuseSaleSnapshot(previous, next)).not.toBe(previous)
  }
  const removed = copy(previous); delete removed.IsLocked
  expect(reuseSaleSnapshot(previous, removed)).not.toHaveProperty('IsLocked')
  expect(reuseSaleSnapshot({ Id: 1, RegistrarStorageId: 0 }, { Id: 1, RegistrarStorageId: null })).toEqual({ Id: 1, RegistrarStorageId: null })
  const noIdentity = { TotalAmount: 1 }
  expect(reuseSaleSnapshot(noIdentity, { ...noIdentity })).not.toBe(noIdentity)
  const byId = { Id: 5, TotalAmount: 1 }
  expect(reuseSaleSnapshot(byId, { ...byId })).toBe(byId)
  expect(reuseSaleSnapshot({ Id: 1, TotalAmount: 0 }, { Id: 1, TotalAmount: undefined })).toEqual({ Id: 1, TotalAmount: undefined })
})
