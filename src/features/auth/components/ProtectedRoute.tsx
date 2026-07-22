import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { OrbSplash } from '../../../shared/ui/orb/Orb'
import { useAuth } from '../useAuth'

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <OrbSplash className="app-orb-splash--viewport" label="Завантаження" />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
