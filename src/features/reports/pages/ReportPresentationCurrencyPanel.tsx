import { useEffect, useState } from 'react'
import { Alert, Button, Select, Stack, Text } from '@mantine/core'
import type { ReportDataset, ReportRequestBody } from '../types'
import { getReportPresentationCurrencies, type ReportCurrencyOption } from '../api/reportPresentationCurrencies'
import { presentationCurrencyError, presentationCurrencyModeSupported, presentationCurrencySupported,
  readPresentationCurrency, requestPresentationCurrency, type ReportPresentationCurrency } from '../data/reportPresentationCurrency'

export function ReportPresentationCurrencyPanel({ dataset, request, disabled, onChange }: {
  dataset?: ReportDataset; request: ReportRequestBody; disabled: boolean; onChange: (value: ReportPresentationCurrency | undefined) => void
}) {
  const supported = presentationCurrencySupported(dataset)
  const value = requestPresentationCurrency(request)
  if (!supported && value == null) return null
  if (!supported || !presentationCurrencyModeSupported(request)) return <Stack gap="xs">
    <Alert color="yellow" title="Валюта звіту">{presentationCurrencyError(request, dataset) ?? 'Вибір валюти доступний для поточних документів ВП.'}</Alert>
    {value != null ? <Button variant="subtle" disabled={disabled} onClick={() => onChange(undefined)}>Використовувати EUR за замовчуванням</Button> : null}
  </Stack>
  return <CurrencyLookup value={value} disabled={disabled} onChange={onChange} />
}
function CurrencyLookup({ value, disabled, onChange }: { value: unknown; disabled: boolean; onChange: (value: ReportPresentationCurrency | undefined) => void }) {
  const [state, setState] = useState<{ rows: ReportCurrencyOption[]; loading: boolean; error?: string }>({ rows: [], loading: true })
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    getReportPresentationCurrencies(controller.signal).then(rows => {
      if (!controller.signal.aborted) setState({ rows, loading: false })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ rows: [], loading: false, error: error instanceof Error ? error.message : 'Не вдалося завантажити валюти.' })
    })
    return () => controller.abort()
  }, [retry])
  const selected = readPresentationCurrency(value)
  const id = selected?.currencyNetUid.toLowerCase()
  const missing = value != null && (!id || !state.rows.some(row => row.value === id))
  const data = [{ value: 'default', label: 'EUR — за замовчуванням' }, ...state.rows,
    ...(missing ? [{ value: id ?? 'invalid', label: state.loading ? 'Збережена валюта — завантаження…' : 'Збережена валюта — недоступна в довіднику', disabled: true }] : [])]
  return <Stack gap="xs">
    <Select label="Валюта звіту" value={value == null ? 'default' : id ?? 'invalid'} data={data} searchable allowDeselect={false}
      disabled={disabled} nothingFoundMessage="Валюту не знайдено" onChange={next => {
        if (next === 'default') onChange(undefined)
        else if (next && state.rows.some(row => row.value === next)) onChange({ version: 1, currencyNetUid: next })
      }} />
    <Text size="xs" c="dimmed">Комерційний курс GBA на дату кожного документа, включно з поверненнями. Без підтвердженого курсу сума не визначена.</Text>
    {state.error ? <><Text size="xs" c="red" role="alert">{state.error} Збережену валюту не змінено.</Text><Button size="xs" variant="subtle" disabled={disabled || state.loading} onClick={() => { setState({ rows: [], loading: true }); setRetry(attempt => attempt + 1) }}>Повторити завантаження валют</Button></> : null}
    {!state.loading && !state.error && missing ? <Text size="xs" c="red" role="alert">Збереженої валюти немає в актуальному довіднику. Оберіть доступну валюту перед формуванням.</Text> : null}
  </Stack>
}
