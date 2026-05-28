import { AppShell } from '@mantine/core'
import type { PropsWithChildren } from 'react'

export function ConsoleMain({ children }: PropsWithChildren) {
  return (
    <AppShell.Main>
      <div className="console-frame">{children}</div>
    </AppShell.Main>
  )
}
