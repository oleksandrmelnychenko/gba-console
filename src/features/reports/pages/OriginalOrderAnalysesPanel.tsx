import { Alert, Button, Stack, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { orderAnalysisPeriodError, orderAnalysisRequest, type OrderAnalysisCapability, type OrderAnalysisField, type OrderAnalysisState } from '../data/originalOrderAnalyses'
import { orderAnalysisSheet } from '../data/originalOrderAnalysesExport'
import type { OrderAnalysisResult } from '../data/originalOrderAnalysisResponse'
import { useOrderAnalysisChoices, useOriginalOrderAnalyses } from '../hooks/useOriginalOrderAnalyses'
import { OriginalOrderAnalysisControls } from './OriginalOrderAnalysisControls'
import { OriginalDefaultReportOutput } from './OriginalDefaultReportOutput'
function OrderResult({ result }: { result: OrderAnalysisResult | null }) {
  const { t } = useI18n(), sheet = useMemo(() => result ? orderAnalysisSheet(result) : null, [result])
  if (!result || !sheet) return null
  return <Stack gap="sm">{!result.Available ? <Alert color="yellow">{t('Повних даних для всіх потрібних показників немає. Відомі значення збережено; недоступні показники не замінено нулем.')}</Alert> : null}
    {result.UnresolvedChoices.length ? <Text size="sm" c="dimmed">{t('Деякі назви поки недоступні. Відбори за підтвердженими назвами залишаються доступними.')}</Text> : null}
    {sheet.lines.length ? <OriginalDefaultReportOutput sheet={sheet} filename="order-analysis" allowExport={result.Available && result.NormalInputsComplete && result.SelectedNumbersObserved} /> : <Text>{t(result.Available ? 'У повному зрізі рядків немає.' : 'Рядки недоступні до завершення потрібної синхронізації.')}</Text>}
  </Stack>
}
export function OriginalOrderAnalysesPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: { capability: OrderAnalysisCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string }) {
  const { t } = useI18n(), [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough)
  const [rows, setRows] = useState<OrderAnalysisField[]>([...capability.DefaultRows]), [measures, setMeasures] = useState([...capability.DefaultMeasures])
  const [shipment, setShipment] = useState<OrderAnalysisState[] | null>(null), [payment, setPayment] = useState<OrderAnalysisState[] | null>(null)
  const selection = useOrderAnalysisChoices(capability, from, through, callerKey, canGenerate), dateError = orderAnalysisPeriodError(from, through)
  const request = useMemo(() => {
    try { return orderAnalysisRequest(capability, from, through, rows, measures, selection.filters, shipment, payment) } catch { return null }
  }, [capability, from, through, rows, measures, selection.filters, shipment, payment])
  const delivery = useOriginalOrderAnalyses(request, callerKey, canGenerate)
  const edits = {
    changePeriod: (field: 'from' | 'through', value: string) => { delivery.invalidate(); if (field === 'from') setFrom(value); else setThrough(value) },
    changeRows: (values: OrderAnalysisField[]) => { delivery.invalidate(); setRows(values) },
    changeMeasures: (values: string[]) => { delivery.invalidate(); setMeasures(values) },
    select: (field: OrderAnalysisField, key: string | null) => { delivery.invalidate(); selection.select(field, key) },
    changeShipment: (values: OrderAnalysisState[] | null) => { delivery.invalidate(); setShipment(values) },
    changePayment: (values: OrderAnalysisState[] | null) => { delivery.invalidate(); setPayment(values) },
  }
  return <Stack gap="md"><Text>{t('Аналіз за нашими поточними даними. Підсумкові групи та стани збережено зі звіту; недоступні значення залишаються невідомими.')}</Text>
    <OriginalOrderAnalysisControls capability={capability} from={from} through={through} rows={rows} measures={measures} filters={selection.filters} choices={selection.choices} shipment={shipment} payment={payment}
      busy={delivery.isLoading} choicesBusy={selection.choicesBusy} {...edits} />
    <Button loading={delivery.isLoading} disabled={!delivery.allowed || delivery.isLoading} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
    {dateError ? <Alert color="yellow">{t(dateError)}</Alert> : null}{!measures.length ? <Alert color="yellow">{t('Оберіть хоча б один показник.')}</Alert> : null}
    {selection.choicesError ? <Alert color="yellow">{t(selection.choicesError)}</Alert> : null}{delivery.error ? <Alert color="red">{t(delivery.error)}</Alert> : null}
    <OrderResult key={JSON.stringify([request, delivery.lastRun?.InputWitnessSha256])} result={delivery.lastRun} />
  </Stack>
}
