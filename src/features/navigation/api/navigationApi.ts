import { apiRequest } from '../../../shared/api/apiClient'
import type { NavigationModule } from '../types'

export function getNavigation(): Promise<NavigationModule[]> {
  return apiRequest<NavigationModule[]>('/dashboards/modules/all/role', {
    errorMessages: {
      401: 'Сесію завершено. Увійдіть повторно.',
      403: 'Недостатньо прав для меню.',
      default: 'Не вдалося завантажити меню.',
      network: 'Сервер меню недоступний. Спробуйте ще раз пізніше.',
    },
  })
}
