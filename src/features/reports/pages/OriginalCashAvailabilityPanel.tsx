import { Alert, Button, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { type AvailabilityCapability, type AvailabilityField, type AvailabilityResult } from '../data/originalCashAvailability'
import { availabilitySheet } from '../data/originalCashAvailabilityExport'
import { useOriginalCashAvailability } from '../hooks/useOriginalCashAvailability'
import { useCashAvailabilitySelection } from '../hooks/useCashAvailabilitySelection'
import { OriginalDefaultReportOutput } from './OriginalDefaultReportOutput'
import { OriginalCashAvailabilityControls } from './OriginalCashAvailabilityControls'
function CashAvailabilityResultView({ result }: { result: AvailabilityResult | null }) {
  const { t } = useI18n()
  if (!result) return null
  return <Stack gap="sm">{!result.Available ? <Alert color="yellow">{t('Повних даних для всіх потрібних сум немає. Відомі значення збережено, недоступні суми не замінено нулем.')}</Alert> : null}
    {result.MissingCaptionMappings.length ? <Text size="sm" c="dimmed">{t('Деякі назви ще недоступні; це не змінює відомі суми.')}</Text> : null}
    {result.OwnTotals?.MixedOwnCurrencies ? <Text size="sm" c="dimmed">{t('Загальні власні суми містять різні валюти рахунків / кас. Оберіть валюту або додайте управлінські суми для порівняння.')}</Text> : null}
    {result.ResultSha256 ? <OriginalDefaultReportOutput key={result.ResultSha256} sheet={availabilitySheet(result)} filename="cash-availability" allowExport={result.Available} /> : null}</Stack>
}
export function OriginalCashAvailabilityPanel({ capability, callerKey, canGenerate, initialDateKon }: { capability: AvailabilityCapability; callerKey: string | null; canGenerate: boolean; initialDateKon: string }) {
  const { t } = useI18n(), [dateKon, setDateKon] = useState(initialDateKon), [dimensions, setDimensions] = useState<AvailabilityField[]>([]), [management, setManagement] = useState(false)
  const scope = JSON.stringify([callerKey, canGenerate, capability, dateKon]), selection = useCashAvailabilitySelection(scope)
  const key = JSON.stringify([scope, selection.filters, dimensions, management])
  const delivery = useOriginalCashAvailability({ capability, callerKey, canGenerate, dateKon, filters: selection.filters, dimensions, management, key, receive: selection.receive })
  function select(field: AvailabilityField, keys: string[]) { delivery.invalidate(); selection.select(field, keys) }
  return <Stack gap="md"><Text>{t('Доступні кошти Fenix: поточний залишок − до списання + до отримання − резерв.')}</Text>
    <OriginalCashAvailabilityControls dateKon={dateKon} choices={selection.choices} filters={selection.filters} dimensions={dimensions} management={management} busy={delivery.isLoading}
      changeDate={value => { delivery.invalidate(); setDateKon(value) }} select={select}
      changeDimensions={values => { delivery.invalidate(); setDimensions(values) }} changeManagement={value => { delivery.invalidate(); setManagement(value) }} />
    <Button loading={delivery.isLoading} disabled={!delivery.allowed || !!delivery.dateError || delivery.isLoading} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
    <Text size="sm" c="dimmed">{t('Залишок перед точною датою й часом. Власні суми — у валюті рахунку / каси; управлінські — за записаними історичними курсами.')}</Text>
    {delivery.dateError ? <Alert color="yellow">{t(delivery.dateError)}</Alert> : null}{delivery.error ? <Alert color="red">{t(delivery.error)}</Alert> : null}
    <CashAvailabilityResultView result={delivery.lastRun} />
  </Stack>
}
