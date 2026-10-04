import { useEffect, useRef, useState } from 'react'
import { readCashMovements } from '../api/originalCashMovementsApi'
import { cashMovementsPeriodError, cashMovementsRequest, isCashMovementsCapability, type CashMovementsCapability, type CashMovementsResult, type CashMovementsSelection } from '../data/originalCashMovements'
import { cashMovementsCsv, cashMovementsExportError, cashMovementsPdf, cashMovementsXlsx } from '../data/originalCashMovementsExport'
import { useReportRunState } from './useReportRunState'
export const cashMovementsFormats = ['csv', 'xlsx', 'pdf'] as const
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
export function useOriginalCashMovements(capability: CashMovementsCapability, callerKey: string | null, canGenerate: boolean,
  from: string, through: string, selection: CashMovementsSelection, key: string, received: (result: CashMovementsResult) => void) {
  const run = useReportRunState<CashMovementsResult>(key), [exporting, setExporting] = useState(false)
  const active = useRef<AbortController | null>(null), latest = useRef(key), fileAttempt = useRef<object | null>(null)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; fileAttempt.current = null; active.current?.abort() } }, [key])
  const periodError = cashMovementsPeriodError(from, through)
  const permitted = canGenerate && !!callerKey && isCashMovementsCapability(capability) && capability.Executable
  function invalidate() { active.current?.abort(); latest.current = ''; fileAttempt.current = null; run.clear() }
  async function generate() {
    if (!permitted || periodError || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    latest.current = key; const update = run.begin()
    try {
      const result = await readCashMovements(cashMovementsRequest(capability, from, through, selection), controller.signal)
      if (!controller.signal.aborted && latest.current === key) { update({ lastRun: result }); received(result) }
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати рухи коштів.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: typeof cashMovementsFormats[number]) {
    const result = run.lastRun
    if (!permitted || !result?.Available || exporting || cashMovementsExportError(result)) return
    const attempt = {}; fileAttempt.current = attempt
    setExporting(true)
    try {
      const blob = format === 'csv' ? new Blob([cashMovementsCsv(result)], { type: 'text/csv;charset=utf-8' })
        : format === 'xlsx' ? await cashMovementsXlsx(result) : await cashMovementsPdf(result)
      if (latest.current === key && fileAttempt.current === attempt) download(blob, `cash-movements-${result.From}-${result.Through}.${format}`)
    } catch (failure) { if (latest.current === key && fileAttempt.current === attempt) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, exporting, periodError, permitted, invalidate, generate, exportFile }
}
