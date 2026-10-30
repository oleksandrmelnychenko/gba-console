import { canonicalCustomerGroupInt64Id } from './customerGroupInt64'
export { customerGroupInt64Id as customerGroupWarehouseId } from './customerGroupInt64'
export function customerGroupWarehouseQueryError(query: string): string | null {
  return query.startsWith('id:') && !canonicalCustomerGroupInt64Id(query.slice(3))
    ? 'Вкажіть точний ID складу у форматі id:123 без пробілів, дробів або початкових нулів.' : null
}
export const CUSTOMER_GROUP_WAREHOUSE_NOTE = 'Суми продажів розподілено за фактичним списанням; повернення — за власним складом. Невідвантажені рядки не входять у відбір; за неповних складських даних звіт не формується.'
