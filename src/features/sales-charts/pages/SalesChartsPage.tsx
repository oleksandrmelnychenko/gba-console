import { Stack, Tabs } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { ManagerSalesByTopNXView } from '../components/ManagerSalesByTopNXView'
import { ManagerSalesByTopView } from '../components/ManagerSalesByTopView'
import { SalesByClientChart } from '../components/SalesByClientChart'

export function SalesChartsPage() {
  const { t } = useI18n()

  return (
    <Stack gap="lg">
      <Tabs color={CREATE_ACTION_COLOR} defaultValue="topNX" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="topNX">Top N-X</Tabs.Tab>
          <Tabs.Tab value="sales">{t('Продажі')}</Tabs.Tab>
          <Tabs.Tab value="top">{t('Топ')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel pt="md" value="topNX">
          <ManagerSalesByTopNXView />
        </Tabs.Panel>

        <Tabs.Panel pt="md" value="sales">
          <SalesByClientChart />
        </Tabs.Panel>

        <Tabs.Panel pt="md" value="top">
          <ManagerSalesByTopView />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
