import { useValueState } from '../../../shared/hooks/useValueState'
import { requestWorkbookPresentation, type WorkbookSelection } from '../data/workbookPresentation'
import type { ReportDataset, ReportGroupingItem, ReportRequestBody } from '../types'
import { WorkbookPresentationPanel } from '../pages/WorkbookPresentationPanel'

export function useWorkbookPresentation({ dataSource, groupingOptions, setRowGroups, setGroupedCashPeriod }: {
  dataSource: number; groupingOptions: ReportGroupingItem[]
  setRowGroups: (rows: ReportGroupingItem[]) => void; setGroupedCashPeriod: (value: unknown) => void
}) {
  const [value, setValue] = useValueState<unknown>(undefined)
  function reset(defaults: ReportRequestBody | undefined | null) {
    setValue(requestWorkbookPresentation(defaults ?? {}))
  }
  function restore(request: ReportRequestBody) {
    setValue(structuredClone(requestWorkbookPresentation(request)))
  }
  function change(next: WorkbookSelection | undefined) {
    setValue(next)
    if (dataSource === 40) setRowGroups((next ? [40] : [43, 40, 42, 41])
      .flatMap(type => groupingOptions.filter(row => row.type === type)))
  }
  function changeCashRows(rows: ReportGroupingItem[]) {
    setRowGroups(rows)
    setValue(rows.map(row => row.type).join(',') === '40'
      ? value ?? { version: 1, additionalFields: [], ordering: null } : undefined)
  }
  function changeGroupedCash(next: unknown) {
    setValue(undefined)
    setGroupedCashPeriod(next)
  }
  function panel(dataset: ReportDataset | undefined, request: ReportRequestBody, disabled: boolean) {
    return <WorkbookPresentationPanel dataset={dataset} request={request} value={value} disabled={disabled} onChange={change} />
  }
  return { value, reset, restore, changeCashRows, changeGroupedCash, panel }
}
