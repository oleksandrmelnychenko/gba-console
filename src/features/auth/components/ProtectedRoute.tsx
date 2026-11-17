import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../useAuth'
import { SessionBootScreen } from './SessionBootScreen'

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <SessionBootScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
