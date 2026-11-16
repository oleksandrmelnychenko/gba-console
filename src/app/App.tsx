import { Route, Routes, useLocation, type Location } from 'react-router-dom'
import { ConsoleLayout } from './layout/ConsoleLayout'
import { overlayConsoleRoutes } from './routes/overlayConsoleRoutes'
import { consoleRoutes } from './routes/consoleRoutes'
import { ProtectedRoute } from '../features/auth/components/ProtectedRoute'
import { PagePermissionBoundary } from '../features/auth/components/PagePermissionBoundary'
import { LoginPage } from '../pages/login/LoginPage'
import { ModulePage } from '../pages/module/ModulePage'

type AppLocationState = {
  backgroundLocation?: Location
}

export function App() {
  const location = useLocation()
  const state = location.state as AppLocationState | null
  const backgroundLocation = state?.backgroundLocation

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<ConsoleLayout />}>
            {consoleRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  route.permissionKey ? (
                    <PagePermissionBoundary permissionKey={route.permissionKey}>
                      {route.element}
                    </PagePermissionBoundary>
                  ) : (
                    route.element
                  )
                }
              />
            ))}
            <Route path="*" element={<ModulePage fallback />} />
          </Route>
        </Route>
      </Routes>

      {backgroundLocation && (
        <Routes>
          <Route element={<ProtectedRoute />}>
            {overlayConsoleRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  route.permissionKey ? (
                    <PagePermissionBoundary permissionKey={route.permissionKey}>
                      {route.element}
                    </PagePermissionBoundary>
                  ) : (
                    route.element
                  )
                }
              />
            ))}
          </Route>
        </Routes>
      )}
    </>
  )
}
