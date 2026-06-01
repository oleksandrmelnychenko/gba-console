import { Stack, Tabs } from '@mantine/core'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'

const SALES_DASHBOARD_TABS: Array<{ label: string; value: string }> = [
  { label: 'Продажі', value: '/sales/ukraine/all' },
  { label: 'Оферти', value: '/sales/ukraine/offers' },
  { label: 'Резерв кошика', value: '/sales/ukraine/cart-reserve' },
  { label: 'Боржники', value: '/sales/ukraine/debtors' },
  { label: 'Передзамовлення', value: '/sales/ukraine/interest' },
  { label: 'Рух товару клієнта', value: '/sales/ukraine/client-product-movement' },
  { label: 'Прогноз', value: '/sales/ukraine/prediction' },
  { label: 'Графіки', value: '/sales/charts' },
]

export function SalesDashboardShell({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const active = SALES_DASHBOARD_TABS.find((tab) => tab.value === pathname)?.value ?? null

  return (
    <Stack gap="md">
      <Tabs
        value={active}
        variant="outline"
        onChange={(value) => {
          if (value && value !== pathname) {
            navigate(value)
          }
        }}
      >
        <Tabs.List>
          {SALES_DASHBOARD_TABS.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              {t(tab.label)}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
      {children}
    </Stack>
  )
}
