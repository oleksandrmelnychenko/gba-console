import { useEffect, useRef, useState } from 'react'
import { readMoneyFlow } from '../api/originalMoneyFlowAnalysisApi'
import { moneyFlowPeriodError, moneyFlowRequest, isMoneyFlowCapability, type MoneyFlowCapability, type MoneyFlowResult, type MoneyFlowSelection, type MoneyFlowMeasure } from '../data/originalMoneyFlowAnalysis'
import { moneyFlowCsv, moneyFlowExportError, moneyFlowPdf, moneyFlowXlsx } from '../data/originalMoneyFlowAnalysisExport'
import { useReportRunState } from './useReportRunState'
export const moneyFlowFormats = ['csv', 'xlsx', 'pdf'] as const
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
export function useOriginalMoneyFlowAnalysis(capability: MoneyFlowCapability, callerKey: string | null, canGenerate: boolean,
  from: string, through: string, selection: MoneyFlowSelection, measures: readonly MoneyFlowMeasure[], key: string, received: (result: MoneyFlowResult) => void) {
  const run = useReportRunState<MoneyFlowResult>(key), [exporting, setExporting] = useState(false)
  const active = useRef<AbortController | null>(null), latest = useRef(key), fileAttempt = useRef<object | null>(null)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; fileAttempt.current = null; active.current?.abort() } }, [key])
  const periodError = moneyFlowPeriodError(from, through)
  const permitted = canGenerate && !!callerKey && isMoneyFlowCapability(capability) && capability.Executable
  function invalidate() { active.current?.abort(); latest.current = ''; fileAttempt.current = null; run.clear() }
  async function generate() {
    if (!permitted || periodError || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    latest.current = key; const update = run.begin()
    try {
      const result = await readMoneyFlow(moneyFlowRequest(capability, from, through, selection, measures), controller.signal)
      if (!controller.signal.aborted && latest.current === key) { update({ lastRun: result }); received(result) }
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати аналіз руху коштів.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: typeof moneyFlowFormats[number]) {
    const result = run.lastRun
    if (!permitted || !result?.Available || exporting || moneyFlowExportError(result)) return
    const attempt = {}; fileAttempt.current = attempt
    setExporting(true)
    try {
      const blob = format === 'csv' ? new Blob([moneyFlowCsv(result)], { type: 'text/csv;charset=utf-8' })
        : format === 'xlsx' ? await moneyFlowXlsx(result) : await moneyFlowPdf(result)
      if (latest.current === key && fileAttempt.current === attempt) download(blob, `money-flow-analysis-${result.From}-${result.Through}.${format}`)
    } catch (failure) { if (latest.current === key && fileAttempt.current === attempt) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, exporting, periodError, permitted, invalidate, generate, exportFile }
}
