import { Stack } from '@mantine/core'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { ManagerSalesByTopNXView } from '../components/ManagerSalesByTopNXView'
import { ManagerSalesByTopView } from '../components/ManagerSalesByTopView'
import { SalesByClientChart } from '../components/SalesByClientChart'
import './sales-charts-page.css'

type SalesChartsTab = 'topNX' | 'sales' | 'top'

const SALES_CHART_TABS: Array<{ label: string; value: SalesChartsTab }> = [
  { label: 'Top N-X', value: 'topNX' },
  { label: 'Продажі', value: 'sales' },
  { label: 'Топ', value: 'top' },
]

export function SalesChartsPage() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<SalesChartsTab>('topNX')

  return (
    <Stack className="sales-charts-page" gap={0}>
      <div className="sales-charts-tabs pill-tabs">
        {SALES_CHART_TABS.map((tab) => {
          const isActive = activeTab === tab.value

          return (
            <button
              key={tab.value}
              aria-pressed={isActive}
              className={`pill-tab${isActive ? ' is-active' : ''}`}
              type="button"
              onClick={() => setActiveTab(tab.value)}
            >
              {t(tab.label)}
            </button>
          )
        })}
      </div>

      <div className="sales-charts-page__panel">
        {activeTab === 'topNX' ? <ManagerSalesByTopNXView /> : null}
        {activeTab === 'sales' ? <SalesByClientChart /> : null}
        {activeTab === 'top' ? <ManagerSalesByTopView /> : null}
      </div>
    </Stack>
  )
}
