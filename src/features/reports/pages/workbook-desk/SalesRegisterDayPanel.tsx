import { Alert, Button, Group, Pagination, NativeSelect, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { apiRequest } from '../../../../shared/api/apiClient'
import { formatKyivBusinessDate } from '../../../../shared/date/dateTime'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { previousKyivDay } from '../../data/cashPeriod'

type Amounts = { Net: number; Vat: number; Cost: number; CostVat: number; Profit: number; OriginalNetUah?: number | null; OriginalVatUah?: number | null }
type Summary = Amounts & { Organization: string; RecorderType: number; Lines: number }
type Detail = Amounts & { BusinessDay: string; Organization: string; RecorderType: number; DocumentId: string; DocumentNumber: string | null
  ProductId: string; Article: string | null; Quantity: number }
type Result = { From: string; Day: string; World: string; CapturedUtc: string; GrandTotal: Amounts; Totals: Summary[]; Lines: Detail[]; TotalLines: number; Offset: number }
const money = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const quantity = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
const fields = ['Net', 'Vat', 'Cost', 'CostVat', 'Profit'] as const
const headings = ['Продаж без ПДВ', 'ПДВ продажу', 'Собівартість без ПДВ', 'ПДВ собівартості', 'Валовий прибуток']
const originalFields = ['OriginalNetUah', 'OriginalVatUah'] as const
function amountCells(row: Amounts, showOriginal: boolean) {
  return <>
    {fields.map(field => <Table.Td key={field} ta="right">{money.format(row[field])}</Table.Td>)}
    {showOriginal && originalFields.map(field => <Table.Td key={field} ta="right">{row[field] == null ? '—' : money.format(row[field])}</Table.Td>)}
  </>
}
const kind = (recorder: number) => recorder === 290 || recorder === 345 ? 'Реалізація' : 'Повернення'

type WorkbookRegister = { from: string; to: string; returnsOnly: boolean }

type RegisterQuery = { from?: string; day: string; world: string; returnsOnly?: boolean; page: number; search: string }

function useRegisterReport() {
  const [query, setQuery] = useState<RegisterQuery | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!query) return
    const controller = new AbortController()
    void apiRequest<Result>('/report/datasets/sales-register-day', {
      query: { from: query.from, day: query.day, world: query.world, returnsOnly: query.returnsOnly, search: query.search || undefined, offset: (query.page - 1) * 100 },
      signal: controller.signal, cache: 'no-store', dedupe: false,
    }).then(value => { if (!controller.signal.aborted) setResult(value) })
      .catch((err: unknown) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [query])

  function request(next: RegisterQuery | null) {
    setQuery(next); setError(''); setResult(null); setLoading(next !== null)
  }
  return { result, error, loading, page: query?.page ?? 1, request }
}

export function SalesRegisterDayPanel({ workbook }: { workbook?: WorkbookRegister }) {
  const { t } = useI18n()
  const today = formatKyivBusinessDate()
  const yesterday = previousKyivDay(today) ?? ''
  const initial = workbook && (workbook.from !== today || workbook.to !== today) ? workbook : { from: yesterday, to: yesterday }
  const [day, setDay] = useState(initial.to)
  const [from, setFrom] = useState(initial.from)
  const [world, setWorld] = useState('Fenix')
  const [search, setSearch] = useState('')
  const { result, error, loading, page, request } = useRegisterReport()
  function reset() { request(null) }
  function run(nextPage: number) {
    request({ from: workbook ? from : undefined, day, world, returnsOnly: workbook?.returnsOnly || undefined, page: nextPage, search: search.trim() })
  }
  return <Stack gap="md">
    <Title order={3}>{t(workbook?.returnsOnly ? 'Повернення за регістром 1С' : workbook ? 'Продажі й валовий прибуток за регістром 1С' : 'Звірка продажів з 1С')}</Title>
    <Group align="flex-end">
      {workbook && <TextInput label={t('Період з')} type="date" value={from} max={yesterday}
        onChange={event => { reset(); setFrom(event.currentTarget.value) }} />}
      <TextInput label={t(workbook ? 'Період до' : 'Дата рухів')} type="date" value={day} max={yesterday}
        onChange={event => { reset(); setDay(event.currentTarget.value) }} />
      <NativeSelect label={t('База 1С')} data={['Fenix', 'AMG']} value={world}
        onChange={event => { reset(); setWorld(event.currentTarget.value) }} />
      <TextInput label={t('Артикул або номер документа')} value={search} maxLength={100}
        onChange={event => { reset(); setSearch(event.currentTarget.value) }} />
      <Button disabled={!day || day > yesterday || Boolean(workbook && (!from || from > day))} loading={loading} onClick={() => run(1)}>{t('Сформувати')}</Button>
    </Group>
    {error && <Alert color="red" role="alert">{error}</Alert>}
    {result && <RegisterResult result={result} workbook={workbook} search={search} page={page} onPageChange={run} />}
  </Stack>
}

function RegisterResult({ result, workbook, search, page, onPageChange }: {
  result: Result; workbook?: WorkbookRegister; search: string; page: number; onPageChange: (page: number) => void
}) {
  const { t } = useI18n()
  const showOriginal = result?.GrandTotal?.OriginalNetUah != null
  const moneyHeaders = <>
    {headings.map(label => <Table.Th key={label} ta="right">{t(label)}{showOriginal && ' (€)'}</Table.Th>)}
    {showOriginal && ['Продаж без ПДВ у регістрі', 'ПДВ продажу в регістрі'].map(label =>
      <Table.Th key={label} ta="right">{t(label)} (₴)</Table.Th>)}
  </>
  const range = Boolean(result.From && result.From !== result.Day)
  return <>
      <Text>{t(showOriginal ? 'Рухи в євро та первинні суми регістру в гривнях' : workbook?.returnsOnly ? 'Повернення у валюті управлінського обліку' : 'Рухи реалізацій і повернень у валюті управлінського обліку')} · {result.World} · {range ? result.From + ' — ' : ''}{result.Day}</Text>
      <Text size="sm" c="dimmed">{t(range ? 'Найраніша звірка за період' : 'Звірено')} {new Date(result.CapturedUtc).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })} ({t('Київ')})</Text>
      {result.Totals.length === 0 ? <Text>{t(search.trim() ? 'Рухів за цим артикулом або номером немає.' : workbook ? 'За обраний період рухів немає.' : 'За цю дату рухів немає.')}</Text> : <>
        <Table.ScrollContainer minWidth={850}><Table striped>
          <Table.Thead><Table.Tr><Table.Th>{t('Організація')}</Table.Th><Table.Th>{t('Документ')}</Table.Th>{moneyHeaders}</Table.Tr></Table.Thead>
          <Table.Tbody>{result.Totals.map((row, index) => <Table.Tr key={index}>
            <Table.Td>{row.Organization}</Table.Td><Table.Td>{t(kind(row.RecorderType))}</Table.Td>{amountCells(row, showOriginal)}
          </Table.Tr>)}</Table.Tbody>
          <Table.Tfoot><Table.Tr><Table.Th colSpan={2}>{t('Разом')}</Table.Th>{amountCells(result.GrandTotal, showOriginal)}</Table.Tr></Table.Tfoot>
        </Table></Table.ScrollContainer>
        <Title order={4}>{t('Рядки документів')} ({result.TotalLines})</Title>
        <Table.ScrollContainer minWidth={1050}><Table striped>
          <Table.Thead><Table.Tr>{[...(workbook ? ['Дата'] : []), 'Документ', 'Організація', 'Артикул', 'Кількість'].map(label => <Table.Th key={label}>{t(label)}</Table.Th>)}{moneyHeaders}</Table.Tr></Table.Thead>
          <Table.Tbody>{result.Lines.map(row => <Table.Tr key={[row.BusinessDay, row.RecorderType, row.DocumentId, row.ProductId, row.Organization].join('/')}>
            {workbook && <Table.Td>{row.BusinessDay}</Table.Td>}
            <Table.Td>{t(kind(row.RecorderType))} {row.DocumentNumber || row.DocumentId}</Table.Td>
            <Table.Td>{row.Organization}</Table.Td><Table.Td>{row.Article || '—'}</Table.Td>
            <Table.Td ta="right">{quantity.format(row.Quantity)}</Table.Td>{amountCells(row, showOriginal)}
          </Table.Tr>)}</Table.Tbody>
        </Table></Table.ScrollContainer>
        {result.TotalLines > 100 && <Pagination value={page} total={Math.ceil(result.TotalLines / 100)} onChange={onPageChange} />}
      </>}
    </>
}
