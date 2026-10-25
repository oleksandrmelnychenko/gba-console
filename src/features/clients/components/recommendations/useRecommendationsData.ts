import { useEffect, useReducer } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getMostPurchasedProductsByClientId, getProductById, getProductCoPurchaseRecommendations } from '../../api/clientRecommendationsApi'
import type { RecommendationProduct } from '../../recommendationsTypes'
import { getRecommendationProductKey as getProductKey } from './recommendationProductKey'

type RecommendationsState = {
  scopeKey: string
  error: string | null
  isLoading: boolean
  previewProduct: RecommendationProduct | null
  products: RecommendationProduct[]
  selectedKeys: ReadonlySet<string>
  selectedProduct: RecommendationProduct | null
}

type RecommendationsAction =
  | { type: 'failed'; error: string }
  | { type: 'loadedRecommendations'; products: RecommendationProduct[] }
  | { type: 'loadedSelectedProduct'; selectedProduct: RecommendationProduct | null }
  | { type: 'loading'; scopeKey: string }
  | { type: 'previewProduct'; product: RecommendationProduct | null }
  | { type: 'removeProduct'; key: string }
  | { type: 'toggleSelected'; key: string }

const initialRecommendationsState: RecommendationsState = {
  scopeKey: '',
  error: null,
  isLoading: true,
  previewProduct: null,
  products: [],
  selectedKeys: new Set(),
  selectedProduct: null,
}

function recommendationsReducer(state: RecommendationsState, action: RecommendationsAction): RecommendationsState {
  switch (action.type) {
    case 'failed':
      return {
        ...state,
        error: action.error,
        isLoading: false,
        products: [],
        selectedKeys: new Set(),
        selectedProduct: null,
      }
    case 'loadedRecommendations':
      return { ...state, error: null, isLoading: false, products: action.products, selectedKeys: new Set() }
    case 'loadedSelectedProduct':
      return { ...state, selectedProduct: action.selectedProduct }
    case 'loading':
      return { ...initialRecommendationsState, scopeKey: action.scopeKey }
    case 'previewProduct':
      return { ...state, previewProduct: action.product }
    case 'removeProduct': {
      const selectedKeys = new Set(state.selectedKeys)
      selectedKeys.delete(action.key)

      return {
        ...state,
        products: state.products.filter((product, index) => getProductKey(product, index) !== action.key),
        selectedKeys,
      }
    }
    case 'toggleSelected': {
      const selectedKeys = new Set(state.selectedKeys)

      if (selectedKeys.has(action.key)) {
        selectedKeys.delete(action.key)
      } else {
        selectedKeys.add(action.key)
      }

      return { ...state, selectedKeys }
    }
  }
}

export function useRecommendationsData({ agreementNetId, clientNetId, productNetId }: {
  agreementNetId: string
  clientNetId: string
  productNetId?: string
}) {
  const { t } = useI18n()
  const scopeKey = JSON.stringify([agreementNetId, clientNetId, productNetId ?? ''])
  const [state, dispatch] = useReducer(recommendationsReducer, initialRecommendationsState)
  useEffect(() => {
    const controller = new AbortController()
    dispatch({ type: 'loading', scopeKey })
    const options = { signal: controller.signal, clientAgreementNetId: agreementNetId }
    // The seed card is supplementary: it must not delay or discard usable recommendations.
    if (productNetId) {
      void getProductById(productNetId, controller.signal).then(selectedProduct => {
        if (!controller.signal.aborted) dispatch({ type: 'loadedSelectedProduct', selectedProduct })
      }).catch(() => {})
    }
    const request = productNetId
      ? getProductCoPurchaseRecommendations(productNetId, clientNetId, false, options)
      : getMostPurchasedProductsByClientId(clientNetId, false, options)
    void request.then(products => {
      if (!controller.signal.aborted) dispatch({ type: 'loadedRecommendations', products })
    }).catch(error => {
      if (!controller.signal.aborted) dispatch({ type: 'failed', error: error instanceof Error ? error.message : t('Не вдалося завантажити рекомендації') })
    })
    return () => controller.abort()
  }, [agreementNetId, clientNetId, productNetId, scopeKey, t])
  return { state: state.scopeKey === scopeKey ? state : initialRecommendationsState, dispatch }
}
