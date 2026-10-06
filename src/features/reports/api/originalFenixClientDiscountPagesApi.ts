import { apiRequest } from '../../../shared/api/apiClient'
import { validateFenixDiscountRequest, type FenixDiscountRequest } from '../data/originalFenixClientDiscounts'
import { fenixChoicePageRequest, normalizeFenixChoiceCatalogue, normalizeFenixChoicePage, type FenixDiscountCatalogue, type FenixDiscountChoicePageRequest } from '../data/originalFenixClientDiscountPages'
const route = '/report/originals/fenix/client-discounts/choices'
export async function readFenixDiscountChoiceCatalogue(request: FenixDiscountRequest, signal?: AbortSignal) {
  const scope = validateFenixDiscountRequest({ ...request, ChoicesWitnessSha256: null })
  return normalizeFenixChoiceCatalogue(await apiRequest<unknown>(`${route}/catalogue`, { method: 'POST', body: scope, dedupe: false, signal }), scope)
}
export async function readFenixDiscountChoicePage(request: FenixDiscountChoicePageRequest, catalogue: FenixDiscountCatalogue, signal?: AbortSignal) {
  const scope = fenixChoicePageRequest(request.Scope.Through, catalogue, request.Field, request.Search, request.Offset, request.SelectedKeys)
  if (request.Limit !== scope.Limit || request.InputWitnessSha256 !== scope.InputWitnessSha256 || request.ChoicesWitnessSha256 !== scope.ChoicesWitnessSha256
    || JSON.stringify(validateFenixDiscountRequest(request.Scope)) !== JSON.stringify(scope.Scope)) throw new Error('Некоректна сторінка назв FENIX.')
  return normalizeFenixChoicePage(await apiRequest<unknown>(`${route}/page`, { method: 'POST', body: scope, dedupe: false, signal }), scope, catalogue)
}
