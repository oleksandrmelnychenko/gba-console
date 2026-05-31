import { Route, Routes, useLocation, type Location } from 'react-router-dom'
import { ConsoleLayout } from './layout/ConsoleLayout'
import {
  ClientEditPage,
  ClientNewPage,
  NewResalePage,
  OrganizationClientEditPage,
  OrganizationClientNewPage,
  ProductGroupDetailPage,
  SupplierOrganizationEditPage,
  UserEditPage,
  UserNewPage,
} from './routes/lazyConsolePages'
import { consoleRoutes } from './routes/consoleRoutes'
import { lazyRoute } from './routes/lazyRoute'
import { ProtectedRoute } from '../features/auth/components/ProtectedRoute'
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
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
            <Route path="*" element={<ModulePage />} />
          </Route>
        </Route>
      </Routes>

      {backgroundLocation && (
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/clients/new/:step" element={lazyRoute(<ClientNewPage />)} />
            <Route path="/clients/new" element={lazyRoute(<ClientNewPage />)} />
            <Route path="/clients/edit/:netid/:step/:productNetId" element={lazyRoute(<ClientEditPage />)} />
            <Route path="/clients/edit/:netid/:step" element={lazyRoute(<ClientEditPage />)} />
            <Route path="/clients/edit/:netid" element={lazyRoute(<ClientEditPage />)} />
            <Route path="/suppliers/edit/:netid/:step/:productNetId" element={lazyRoute(<ClientEditPage />)} />
            <Route path="/suppliers/edit/:netid/:step" element={lazyRoute(<ClientEditPage />)} />
            <Route path="/suppliers/edit/:netid" element={lazyRoute(<ClientEditPage />)} />
            <Route path="/organization-clients/new" element={lazyRoute(<OrganizationClientNewPage />)} />
            <Route path="/organization-clients/edit/:netId" element={lazyRoute(<OrganizationClientEditPage />)} />
            <Route path="/accounting/supplier-organizations/new" element={lazyRoute(<SupplierOrganizationEditPage />)} />
            <Route path="/accounting/supplier-organizations/edit/:id" element={lazyRoute(<SupplierOrganizationEditPage />)} />
            <Route path="/product-groups/:id" element={lazyRoute(<ProductGroupDetailPage />)} />
            <Route path="/resales/new" element={lazyRoute(<NewResalePage />)} />
            <Route path="/users/new" element={lazyRoute(<UserNewPage />)} />
            <Route path="/users/edit/:netid" element={lazyRoute(<UserEditPage />)} />
          </Route>
        </Routes>
      )}
    </>
  )
}
