import { AppShell } from '@mantine/core'
import type { PropsWithChildren } from 'react'
import { PageContentHeaderSlot } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { ConsoleContentHeader } from './ConsoleContentHeader'

export function ConsoleMain({ children }: PropsWithChildren) {
  return (
    <AppShell.Main>
      <div className="console-content">
        <ConsoleContentHeader />
        <PageContentHeaderSlot className="console-content-header-slot" />
        <div className="console-frame">{children}</div>
      </div>
    </AppShell.Main>
  )
}
