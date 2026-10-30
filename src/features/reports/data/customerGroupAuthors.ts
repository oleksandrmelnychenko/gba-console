import { canonicalCustomerGroupInt64Id } from './customerGroupInt64'

export const CUSTOMER_GROUP_AUTHOR_NOTE = 'Автор і користувач підтвердження — з первинного продажу. Для повернення ці поля визначаються лише за підтвердженим зв’язком із первинним продажем. Це не основний менеджер із поточної картки клієнта.'
export function customerGroupAuthorQueryError(query: string): string | null {
  return query.startsWith('id:') && !canonicalCustomerGroupInt64Id(query.slice(3))
    ? 'Вкажіть точний ID користувача у форматі id:123 без пробілів, дробів або початкових нулів.' : null
}
