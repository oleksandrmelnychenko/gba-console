import { Navigate, useParams } from 'react-router-dom'

export function ProductCarouselDeepLinkRedirect() {
  const { netId } = useParams<{ netId?: string }>()

  return <Navigate to={netId ? `/products?netId=${encodeURIComponent(netId)}` : '/products'} replace />
}
