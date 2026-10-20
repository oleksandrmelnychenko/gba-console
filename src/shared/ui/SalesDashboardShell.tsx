import { Stack } from '@mantine/core'
import {
  ArrowLeftRight,
  ClipboardList,
  FileText,
  Heart,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { usePermissions } from '../../features/auth/usePermissions'
import { PermissionKeys, type PermissionKey } from '../auth/permissionKeys'
import { useI18n } from '../i18n/useI18n'
import { usePageBreadcrumb } from './page-header-actions/pageHeaderActionsContext'
import './sales-dashboard-shell.css'

type SalesTab = {
  icon: LucideIcon
  label: string
  permissionKey: PermissionKey
  value: string
}

const SALES_DASHBOARD_TABS: SalesTab[] = [
  {
    icon: Receipt,
    label: 'Продажі',
    permissionKey: PermissionKeys.SalesUkraine.Sale.View,
    value: '/sales/ukraine/all',
  },
  {
    icon: FileText,
    label: 'Пропозиції',
    permissionKey: PermissionKeys.SystemPages.SalesUkraineOffers.View,
    value: '/sales/ukraine/offers',
  },
  {
    icon: ShoppingCart,
    label: 'Резерв кошика',
    permissionKey: PermissionKeys.SystemPages.SalesUkraineCartReserve.View,
    value: '/sales/ukraine/cart-reserve',
  },
  {
    icon: Wallet,
    label: 'Боржники',
    permissionKey: PermissionKeys.SystemPages.SalesUkraineDebtors.View,
    value: '/sales/ukraine/debtors',
  },
  {
    icon: Heart,
    label: 'Зацікавленість',
    permissionKey: PermissionKeys.SystemPages.SalesUkraineInterest.View,
    value: '/sales/ukraine/interest',
  },
  {
    icon: RotateCcw,
    label: 'Повернення',
    permissionKey: PermissionKeys.SystemPages.SalesUkraineReturns.View,
    value: '/sales/ukraine/all/returns/new',
  },
  {
    icon: ArrowLeftRight,
    label: 'Рух товару клієнта',
    permissionKey: PermissionKeys.SystemPages.SalesUkraineClientProductMovement.View,
    value: '/sales/ukraine/client-product-movement',
  },
  // Прогноз і Графіки тимчасово приховані з навігації.
  /*
  {
    icon: TrendingUp,
    label: 'Прогноз',
    permissionKey: PermissionKeys.SystemPages.SalesUkrainePrediction.View,
    value: '/sales/ukraine/prediction',
  },
  {
    icon: ChartNoAxesCombined,
    label: 'Графіки',
    permissionKey: PermissionKeys.SystemPages.SalesCharts.View,
    value: '/sales/charts',
  },
  */
  {
    icon: ClipboardList,
    label: 'Resale',
    permissionKey: PermissionKeys.Resales.Page.View,
    value: '/resales',
  },
]

export function SalesDashboardShell({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { can, isLoading } = usePermissions()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const activePath = normalizeSalesDashboardPath(pathname)
  const requestedTab = SALES_DASHBOARD_TABS.find((tab) => tab.value === activePath) ?? null
  const visibleTabs = SALES_DASHBOARD_TABS.filter((tab) => can(tab.permissionKey))
  const activeTab = visibleTabs.find((tab) => tab.value === activePath) ?? null
  const active = activeTab?.value ?? null
  const fallbackPath = visibleTabs[0]?.value

  useEffect(() => {
    if (
      !isLoading
      && requestedTab
      && !can(requestedTab.permissionKey)
      && fallbackPath
      && fallbackPath !== pathname
    ) {
      navigate(fallbackPath, { replace: true })
    }
  }, [can, fallbackPath, isLoading, navigate, pathname, requestedTab])

  usePageBreadcrumb(activeTab ? t(activeTab.label) : null)

  return (
    <Stack className="sales-dashboard-shell" gap={6}>
      <div className="sales-dashboard-shell__card console-table-shell">
        <div className="sales-dashboard-shell__tabs pill-tabs app-screen-tabs">
          {visibleTabs.map((tab) => {
            const isActive = active === tab.value
            const Icon = tab.icon

            return (
              <button
                key={tab.value}
                type="button"
                className={`pill-tab app-screen-tab${isActive ? ' is-active' : ''}`}
                aria-pressed={isActive}
                onClick={() => {
                  if (tab.value !== pathname) {
                    navigate(tab.value)
                  }
                }}
              >
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                {t(tab.label)}
              </button>
            )
          })}
        </div>
        <div className="sales-dashboard-shell__content">{children}</div>
      </div>
    </Stack>
  )
}

function normalizeSalesDashboardPath(pathname: string): string {
  if (pathname === '/sales/return/client') {
    return '/sales/ukraine/all/returns/new'
  }

  return pathname
}
