import { canonicalCustomerGroupInt64Id } from './customerGroupInt64'
export { customerGroupInt64Id as customerGroupProductGroupId } from './customerGroupInt64'
export function customerGroupProductGroupQueryError(query: string): string | null {
  return query.startsWith('id:') && !canonicalCustomerGroupInt64Id(query.slice(3))
    ? 'Вкажіть точний ID групи у форматі id:123 без пробілів, дробів або початкових нулів.' : null
}
export const CUSTOMER_GROUP_PRODUCT_GROUP_NOTE = 'Групи у відборі — поточні прямі зв’язки картки товару, без підгруп; зміни впливають і на минулі періоди. Відсутню в довіднику вибрану групу потрібно замінити перед формуванням.'
