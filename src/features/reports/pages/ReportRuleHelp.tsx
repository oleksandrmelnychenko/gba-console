import { Stack } from '@mantine/core'
import type { ReactNode } from 'react'

export function ReportRuleHelp({ title, children }: { title: string; children: ReactNode }) {
  return <details className="reports-constructor-rule-help">
    <summary>{title}</summary>
    <Stack gap="xs" mt="xs">{children}</Stack>
  </details>
}
