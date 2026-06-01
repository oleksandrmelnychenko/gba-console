import { Stack } from '@mantine/core'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'
import { usePageBreadcrumb } from './page-header-actions/PageHeaderActions'

const SALES_DASHBOARD_TABS: Array<{ label: string; value: string }> = [
  { label: 'Продажі', value: '/sales/ukraine/all' },
  { label: 'Оферти', value: '/sales/ukraine/offers' },
  { label: 'Резерв кошика', value: '/sales/ukraine/cart-reserve' },
  { label: 'Боржники', value: '/sales/ukraine/debtors' },
  { label: 'Зацікавленість', value: '/sales/ukraine/interest' },
  { label: 'Повернення', value: '/sales/ukraine/all/returns/new' },
  { label: 'Рух товару клієнта', value: '/sales/ukraine/client-product-movement' },
  { label: 'Прогноз', value: '/sales/ukraine/prediction' },
  { label: 'Графіки', value: '/sales/charts' },
]

export function SalesDashboardShell({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const activeTab = SALES_DASHBOARD_TABS.find((tab) => tab.value === pathname) ?? null
  const active = activeTab?.value ?? null

  usePageBreadcrumb(activeTab ? t(activeTab.label) : null)

  return (
    <Stack gap="md">
      <div className="pill-tabs" style={{ width: 'fit-content', margin: '0 auto' }}>
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
