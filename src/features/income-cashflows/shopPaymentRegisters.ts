import { PaymentRegisterType, type PaymentRegister } from './types'

// Same configuration scope as PaymentRegisterRepository.GetIsSelected.
// IsActive is not the shop-selection flag (it also exists on ordinary accounts).
export function isSelectedShopPaymentRegister(register: PaymentRegister): boolean {
  return register.IsForRetail === true
    && register.IsSelected === true
    && register.Type === PaymentRegisterType.Card
    && register.Deleted !== true
}
