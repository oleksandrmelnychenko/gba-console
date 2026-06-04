import { AppShell } from '@mantine/core'
import type { PropsWithChildren } from 'react'
import { PageContentHeaderSlot } from '../../../shared/ui/page-header-actions/PageHeaderActions'

export function ConsoleMain({ children }: PropsWithChildren) {
  return (
    <AppShell.Main>
      <PageContentHeaderSlot className="console-content-header-slot" />
      <div className="console-frame">{children}</div>
    </AppShell.Main>
  )
}
