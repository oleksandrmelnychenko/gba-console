import { lazy } from 'react'

export const PublishedReportWorkspace = lazy(() =>
  import('./workbook-desk/PublishedReportWorkspace').then(module => ({ default: module.PublishedReportWorkspace })))
