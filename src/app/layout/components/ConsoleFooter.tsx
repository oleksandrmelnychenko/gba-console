import { AppShell, Group, ScrollArea } from '@mantine/core'
import { CurrencyRatesTicker } from '../../../features/exchange-rates/components/CurrencyRatesTicker'

export function ConsoleFooter() {
  return (
    <AppShell.Footer className="console-footer">
      <Group h="100%" px="md" gap="md" wrap="nowrap">
        <ScrollArea type="never" scrollbarSize={0} className="console-footer-scroll">
          <CurrencyRatesTicker />
        </ScrollArea>
      </Group>
    </AppShell.Footer>
  )
}
