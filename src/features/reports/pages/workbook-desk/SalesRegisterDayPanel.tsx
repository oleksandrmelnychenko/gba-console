import { Alert, Button, Group, Pagination, NativeSelect, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { apiRequest } from '../../../../shared/api/apiClient'
import { formatKyivBusinessDate } from '../../../../shared/date/dateTime'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { previousKyivDay } from '../../data/cashPeriod'

type Amounts = { Net: number; Vat: number; Cost: number; CostVat: number; Profit: number }
type Summary = Amounts & { Organization: string; RecorderType: number; Lines: number }
type Detail = Amounts & { Organization: string; RecorderType: number; DocumentId: string; DocumentNumber: string | null
  ProductId: string; Article: string | null; Quantity: number }
type Result = { Day: string; World: string; CapturedUtc: string; GrandTotal: Amounts; Totals: Summary[]; Lines: Detail[]; TotalLines: number; Offset: number }
const money = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const quantity = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
const fields = ['Net', 'Vat', 'Cost', 'CostVat', 'Profit'] as const
const headings = ['Продаж без ПДВ', 'ПДВ продажу', 'Собівартість без ПДВ', 'ПДВ собівартості', 'Валовий прибуток']
const amountCells = (row: Amounts) => fields.map(field => <Table.Td key={field} ta="right">{money.format(row[field])}</Table.Td>)
const kind = (recorder: number) => recorder === 290 || recorder === 345 ? 'Реалізація' : 'Повернення'

export function SalesRegisterDayPanel() {
  const { t } = useI18n()
  const yesterday = previousKyivDay(formatKyivBusinessDate()) ?? ''
  const [day, setDay] = useState(yesterday)
  const [world, setWorld] = useState('Fenix')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState<{ day: string; world: string; page: number; search: string } | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!query) return
    const controller = new AbortController()
    void apiRequest<Result>('/report/datasets/sales-register-day', {
      query: { day: query.day, world: query.world, search: query.search || undefined, offset: (query.page - 1) * 100 },
      signal: controller.signal, cache: 'no-store', dedupe: false,
    }).then(value => { if (!controller.signal.aborted) setResult(value) })
      .catch((err: unknown) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [query])

  function reset() { setQuery(null); setPage(1); setResult(null); setError(''); setLoading(false) }
  function run(nextPage: number) {
    setError(''); setResult(null); setPage(nextPage); setLoading(true); setQuery({ day, world, page: nextPage, search: search.trim() })
  }
  const moneyHeaders = headings.map(label => <Table.Th key={label} ta="right">{t(label)}</Table.Th>)
  return <Stack gap="md">
    <Title order={3}>{t('Звірка продажів з 1С')}</Title>
    <Group align="flex-end">
      <TextInput label={t('Дата рухів')} type="date" value={day} max={yesterday}
        onChange={event => { reset(); setDay(event.currentTarget.value) }} />
      <NativeSelect label={t('База 1С')} data={['Fenix', 'AMG']} value={world}
        onChange={event => { reset(); setWorld(event.currentTarget.value) }} />
      <TextInput label={t('Артикул або номер документа')} value={search} maxLength={100}
        onChange={event => { reset(); setSearch(event.currentTarget.value) }} />
      <Button disabled={!day || day > yesterday} loading={loading} onClick={() => run(1)}>{t('Сформувати')}</Button>
    </Group>
    {error && <Alert color="red" role="alert">{error}</Alert>}
    {result && <>
      <Text>{t('Рухи реалізацій і повернень у валюті управлінського обліку')} · {result.World} · {result.Day}</Text>
      <Text size="sm" c="dimmed">{t('Звірено')} {new Date(result.CapturedUtc).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })} ({t('Київ')})</Text>
      {result.Totals.length === 0 ? <Text>{t(query?.search ? 'Рухів за цим артикулом або номером немає.' : 'За цю дату рухів немає.')}</Text> : <>
        <Table.ScrollContainer minWidth={850}><Table striped>
          <Table.Thead><Table.Tr><Table.Th>{t('Організація')}</Table.Th><Table.Th>{t('Документ')}</Table.Th>{moneyHeaders}</Table.Tr></Table.Thead>
          <Table.Tbody>{result.Totals.map((row, index) => <Table.Tr key={index}>
            <Table.Td>{row.Organization}</Table.Td><Table.Td>{t(kind(row.RecorderType))}</Table.Td>{amountCells(row)}
          </Table.Tr>)}</Table.Tbody>
          <Table.Tfoot><Table.Tr><Table.Th colSpan={2}>{t('Разом')}</Table.Th>{amountCells(result.GrandTotal)}</Table.Tr></Table.Tfoot>
        </Table></Table.ScrollContainer>
        <Title order={4}>{t('Рядки документів')} ({result.TotalLines})</Title>
        <Table.ScrollContainer minWidth={1050}><Table striped>
          <Table.Thead><Table.Tr>{['Документ', 'Організація', 'Артикул', 'Кількість'].map(label => <Table.Th key={label}>{t(label)}</Table.Th>)}{moneyHeaders}</Table.Tr></Table.Thead>
          <Table.Tbody>{result.Lines.map(row => <Table.Tr key={[row.RecorderType, row.DocumentId, row.ProductId, row.Organization].join('/')}>
            <Table.Td>{t(kind(row.RecorderType))} {row.DocumentNumber || row.DocumentId}</Table.Td>
            <Table.Td>{row.Organization}</Table.Td><Table.Td>{row.Article || '—'}</Table.Td>
            <Table.Td ta="right">{quantity.format(row.Quantity)}</Table.Td>{amountCells(row)}
          </Table.Tr>)}</Table.Tbody>
        </Table></Table.ScrollContainer>
        {result.TotalLines > 100 && <Pagination value={page} total={Math.ceil(result.TotalLines / 100)} onChange={run} />}
      </>}
    </>}
  </Stack>
}
