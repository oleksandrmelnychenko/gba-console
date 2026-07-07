import { getEditingActQty, getEditingCarrierQty } from './editingApi'

export async function getTotalActForEditing(): Promise<number> {
  const [actQty, carrierQty] = await Promise.all([getEditingActQty(), getEditingCarrierQty()])

  return actQty + carrierQty
}
