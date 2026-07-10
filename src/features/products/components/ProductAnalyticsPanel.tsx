import { Alert, Center, Loader, Text } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { Component, lazy, Suspense, type ReactNode } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { Product } from '../types'

const LazyProductCard = lazy(async () => {
  const module = await import('../../assortment/components/ProductCard')

  return { default: module.ProductCard }
})

// Kept here so every product toolbar imports the analytics guard from the panel's public contract.
// eslint-disable-next-line react-refresh/only-export-components
export function getProductAnalyticsId(product: Product): number | null {
  const productId = product.Id

  return typeof productId === 'number' && Number.isFinite(productId) && Number.isInteger(productId) && productId > 0
    ? productId
    : null
}

export function ProductAnalyticsPanel({ product }: { product: Product }) {
  const { t } = useI18n()
  const productId = getProductAnalyticsId(product)

  if (productId === null) {
    return (
      <Alert color="orange" icon={<CircleAlert aria-hidden="true" size={18} />} role="alert" variant="light">
        {t('Аналітика недоступна: товар не має коректного ID.')}
      </Alert>
    )
  }

  return (
    <ProductAnalyticsErrorBoundary
      key={productId}
      fallback={(
        <Alert color="orange" icon={<CircleAlert aria-hidden="true" size={18} />} role="alert" variant="light">
          {t('Не вдалося відкрити модуль аналітики товару. Оновіть сторінку та спробуйте ще раз.')}
        </Alert>
      )}
    >
      <Suspense
        fallback={(
          <Center aria-live="polite" py="xl" role="status">
            <Loader aria-hidden="true" size="sm" />
            <Text ml="sm" size="sm">{t('Завантаження аналітики товару…')}</Text>
          </Center>
        )}
      >
        <LazyProductCard productId={productId} />
      </Suspense>
    </ProductAnalyticsErrorBoundary>
  )
}

class ProductAnalyticsErrorBoundary extends Component<{
  children: ReactNode
  fallback: ReactNode
}, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}
