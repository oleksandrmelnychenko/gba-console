import { canonicalCustomerGroupInt64Id } from './customerGroupInt64'
export { canonicalCustomerGroupInt64Id as canonicalCustomerAgreementId, customerGroupInt64Id as customerGroupAgreementId } from './customerGroupInt64'

export function customerGroupAgreementQueryError(query: string): string | null {
  return query.startsWith('id:') && !canonicalCustomerGroupInt64Id(query.slice(3))
    ? 'Вкажіть точний ID договору у форматі id:123 без пробілів, дробів або початкових нулів.' : null
}
export const CUSTOMER_GROUP_AGREEMENT_NOTE = 'Відбір застосовується до договору в документі та перетинається з кожним набором клієнтів. Назви договорів — поточні.'
