import { apiRequest } from '../../../shared/api/apiClient'
import type { ProductWriteOffRule } from '../types'

export function getProductWriteOffBaseRules(): Promise<ProductWriteOffRule[]> {
  return apiRequest<ProductWriteOffRule[]>('/products/writeoff/rules/all/base', {
    errorMessages: {
      default: 'Не вдалося завантажити глобальні правила списання',
      network: 'Сервер правил списання недоступний',
    },
  })
}

export function deleteProductWriteOffRule(netUid: string): Promise<void> {
  return apiRequest<void>('/products/writeoff/rules/delete', {
    method: 'DELETE',
    query: {
      netId: netUid,
    },
    errorMessages: {
      default: 'Не вдалося видалити правило списання',
      network: 'Сервер правил списання недоступний',
    },
  })
}
