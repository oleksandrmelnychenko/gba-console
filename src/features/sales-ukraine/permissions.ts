import { LegacyPermissionKeys } from '../../shared/auth/permissionKeys'

// Kept as exports while older call sites and tests migrate to canonical keys.
export const SALES_UKRAINE_EDIT_PERMISSION = LegacyPermissionKeys.SalesUkraine.Sale.Edit
export const SALES_UKRAINE_UNLOCK_PERMISSION = LegacyPermissionKeys.SalesUkraine.Sale.Unlock
export const SALES_UKRAINE_WILL_NOT_SHIP_PERMISSION = LegacyPermissionKeys.SalesUkraine.Sale.UnlockForShipping
