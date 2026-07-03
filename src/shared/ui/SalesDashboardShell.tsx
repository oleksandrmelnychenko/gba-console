import { Stack } from '@mantine/core'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'
import { usePageBreadcrumb } from './page-header-actions/pageHeaderActionsContext'

type SalesTab = { label: string; value: string }

const SALES_DASHBOARD_TABS: SalesTab[] = [
  { label: 'Продажі', value: '/sales/ukraine/all' },
  { label: 'Оферти', value: '/sales/ukraine/offers' },
  { label: 'Резерв кошика', value: '/sales/ukraine/cart-reserve' },
  { label: 'Боржники', value: '/sales/ukraine/debtors' },
  { label: 'Зацікавленість', value: '/sales/ukraine/interest' },
  { label: 'Повернення', value: '/sales/ukraine/all/returns/new' },
  { label: 'Рух товару клієнта', value: '/sales/ukraine/client-product-movement' },
  { label: 'Прогноз', value: '/sales/ukraine/prediction' },
  { label: 'Графіки', value: '/sales/charts' },
  { label: 'Перепродажі', value: '/resales' },
]

export function SalesDashboardShell({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const activeTab = SALES_DASHBOARD_TABS.find((tab) => tab.value === pathname) ?? null
  const active = activeTab?.value ?? null

  usePageBreadcrumb(activeTab ? t(activeTab.label) : null)

  return (
    <Stack gap={6}>
      <div className="pill-tabs">
        {SALES_DASHBOARD_TABS.map((tab) => {
          const isActive = active === tab.value

          return (
            <button
              key={tab.value}
              type="button"
              className={`pill-tab${isActive ? ' is-active' : ''}`}
              aria-pressed={isActive}
              onClick={() => {
                if (tab.value !== pathname) {
                  navigate(tab.value)
                }
              }}
            >
              {t(tab.label)}
            </button>
          )
        })}
      </div>
      {children}
    </Stack>
  )
}
