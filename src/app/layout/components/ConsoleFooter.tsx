import { AppShell, Group, ScrollArea } from '@mantine/core'
import { CurrencyRatesTicker } from '../../../features/exchange-rates/components/CurrencyRatesTicker'
import { DataSyncProgressIndicator } from './DataSyncProgressIndicator'
import { QaBuildTicker } from './QaBuildTicker'

export function ConsoleFooter() {
  return (
    <AppShell.Footer className="console-footer">
      <Group className="console-footer-inner" h="100%" gap={8} wrap="nowrap">
        <DataSyncProgressIndicator />
        <ScrollArea type="hover" scrollbars="x" scrollbarSize={3} className="console-footer-scroll">
          <CurrencyRatesTicker />
        </ScrollArea>
        <QaBuildTicker />
      </Group>
    </AppShell.Footer>
  )
}
