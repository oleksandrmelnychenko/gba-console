import { Alert, Button, Stack, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { stockDateError, stockRequest, type StockAxis, type StockCapability, type StockMeasure } from '../data/originalStockAvailability'
import { stockAvailabilitySheet, stockCompleteExport } from '../data/originalStockAvailabilityExport'
import type { StockResult } from '../data/originalStockAvailabilityResponse'
import { useOriginalStockAvailability, useStockAvailabilitySelection } from '../hooks/useOriginalStockAvailability'
import { OriginalDefaultReportOutput } from './OriginalDefaultReportOutput'
import { OriginalStockAvailabilityControls } from './OriginalStockAvailabilityControls'
function StockResultOutput({ result }: { result: StockResult | null }) {
  const { t } = useI18n(), sheet = useMemo(() => result ? stockAvailabilitySheet(result) : null, [result])
  if (!result || !sheet) return null
  return <Stack gap="sm">{!result.Available ? <Alert color="yellow">{t('Повних даних для вибраних рядків і показників немає. Відомі значення збережено; недоступні показники не замінено нулем. Оберіть звичайні показники або завершіть потрібну синхронізацію.')}</Alert> : null}
    {sheet.lines.length ? <OriginalDefaultReportOutput sheet={sheet} filename="stock-availability" allowExport={stockCompleteExport(result)} /> : <Text>{t(result.Available ? 'У повному зрізі рядків немає.' : 'Вибрані рядки поки недоступні.')}</Text>}</Stack>
}
export function OriginalStockAvailabilityPanel({ capability, callerKey, canGenerate, initialAt }: { capability: StockCapability; callerKey: string | null; canGenerate: boolean; initialAt: string }) {
  const { t } = useI18n(), [at, setAt] = useState(initialAt), [rows, setRows] = useState<StockAxis[]>([...capability.DefaultRows]), [measures, setMeasures] = useState<StockMeasure[]>([...capability.DefaultMeasures])
  const selection = useStockAvailabilitySelection(JSON.stringify([capability, at, callerKey, canGenerate])), dateError = stockDateError(at)
  const request = useMemo(() => { try { return stockRequest(capability, at, rows, measures, selection.filters) } catch { return null } }, [capability, at, rows, measures, selection.filters])
  const delivery = useOriginalStockAvailability(request, callerKey, canGenerate, selection.receive)
  const edits = {
    changeDate: (v: string) => { delivery.invalidate(); setAt(v) },
    changeRows: (v: StockAxis[]) => { delivery.invalidate(); setRows(v) },
    changeMeasures: (v: StockMeasure[]) => { delivery.invalidate(); setMeasures(v) },
    select: (field: StockAxis, key: string | null) => { delivery.invalidate(); selection.select(field, key) },
  }
  return <Stack gap="md"><Text>{t('Доступність товарів за нашими поточними даними. Показники залишку, резерву, надходження, передачі й замовлень постачальникам збережені окремо.')}</Text>
    <OriginalStockAvailabilityControls at={at} rows={rows} measures={measures} choices={selection.choices} filters={selection.filters} busy={delivery.isLoading} {...edits} />
    <Button loading={delivery.isLoading} disabled={!delivery.allowed || delivery.isLoading} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
    {dateError ? <Alert color="yellow">{t(dateError)}</Alert> : null}{!rows.length || !measures.length ? <Alert color="yellow">{t('Оберіть хоча б один рядок і показник.')}</Alert> : null}
    {delivery.error ? <Alert color="red">{t(delivery.error)}</Alert> : null}<StockResultOutput key={JSON.stringify(request)} result={delivery.lastRun} />
  </Stack>
}
