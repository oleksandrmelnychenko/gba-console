import { publishedReportTabs, type PublishedReportTab } from './publishedReportTabs'
import { Stack } from '@mantine/core'
import { memo } from 'react'
import { WarehouseStockMovementPanel, type MovementHistoryRun } from '../WarehouseStockMovementPanel'

export const PublishedReportWorkspace = memo(function PublishedReportWorkspace({ tab, callerKey, onBusyChange, history }: {
  tab: PublishedReportTab; callerKey: string; onBusyChange: (busy: boolean) => void; history?: MovementHistoryRun | null
}) {
  const title = publishedReportTabs.find(item => item.key === tab)?.title ?? 'Звіт'
  return <section className="published-report-workspace" aria-label={title}>
    <Stack gap="md">
      <WarehouseStockMovementPanel callerKey={callerKey} canGenerate onBusyChange={onBusyChange} history={history} />
    </Stack>
  </section>
})
