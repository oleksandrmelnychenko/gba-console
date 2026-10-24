import { ScrollArea } from '@mantine/core'
import type { CSSProperties, ReactNode } from 'react'
import './report-table-scroll-area.css'

/** Reserve space for both scrollbars so totals and the last row stay readable. */
export function ReportTableScrollArea({ children, minWidth, label = 'Таблиця звіту', className }: {
  children: ReactNode
  minWidth?: CSSProperties['minWidth']
  label?: string
  className?: string
}) {
  return <ScrollArea.Autosize className={['report-table-scroll-area', className].filter(Boolean).join(' ')}
    mah="var(--report-table-max-height)" type="auto" scrollbarSize={8} offsetScrollbars="present"
    viewportProps={{ tabIndex: 0, role: 'region', 'aria-label': label }}>
    <div className="report-table-scroll-area__content" style={{ minWidth }}>{children}</div>
  </ScrollArea.Autosize>
}
