import { AppShell } from '@mantine/core'
import type { PropsWithChildren } from 'react'
import { PageContentHeaderSlot, PageHeaderActionsSlot } from '../../../shared/ui/page-header-actions/PageHeaderActions'

export function ConsoleMain({ children }: PropsWithChildren) {
  return (
    <AppShell.Main>
      <PageHeaderActionsSlot className="console-page-actions" />
      <PageContentHeaderSlot className="console-page-content-header" />
      <div className="console-frame">{children}</div>
    </AppShell.Main>
  )
}
