import { Alert, Badge, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import { readCurrentVparivanieV2 } from '../api/currentVparivanieV2Api'
import { currentVparivanieV2Available, currentVparivanieV2Csv,
  CURRENT_VPARIVANIE_V2_DAY, type CurrentVparivanieV2Cell,
  type CurrentVparivanieV2Result } from '../data/currentVparivanieV2'
import { CURRENT_VPARIVANIE_V2_DRAFT, currentVparivanieV2CellKey,
  currentVparivanieV2ColumnCaption, currentVparivanieV2Columns,
  currentVparivanieV2Pdf, currentVparivanieV2Xlsx } from '../data/currentVparivanieV2Export'
import { CURRENT_VPARIVANIE_PRODUCT_CAPTIONS } from '../data/currentVparivanie'
import type { ReportDataset } from '../types'
import './report-inline-preview.css'

const pageSize = 50
const display = (cell?: CurrentVparivanieV2Cell) => cell === undefined ? '—' : cell.Quantity === null ? '∅' : cell.Quantity

export function CurrentVparivanieV2Panel({ dataset }: { dataset: ReportDataset | null }) {
  const available = currentVparivanieV2Available(dataset)
  const [buyerId, setBuyerId] = useState('')
  const [manager, setManager] = useState('')
  const [result, setResult] = useState<CurrentVparivanieV2Result | null>(null)
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const columns = result ? currentVparivanieV2Columns(result) : []

  async function read() {
    if (!dataset || !available || busy) return
    setBusy(true); setError(null); setResult(null); setPage(0)
    try {
      setResult(await readCurrentVparivanieV2(dataset,buyerId.trim() || undefined,
        manager.trim() || undefined))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не вдалося прочитати регіональну матрицю V2.')
    } finally { setBusy(false) }
  }

  function exportCsv() {
    if (!result || !available) return
    const url=URL.createObjectURL(new Blob([currentVparivanieV2Csv(result)],{type:'text/csv;charset=utf-8'}))
    const link=document.createElement('a')
    link.href=url;link.download=`vparivanie-region-v2-current-data-draft-${result.Day}.csv`;link.click()
    window.setTimeout(()=>URL.revokeObjectURL(url),0)
  }

  async function exportDocument(format: 'xlsx' | 'pdf') {
    if (!result || !available || exporting) return
    setExporting(format); setError(null)
    try {
      const blob = format === 'xlsx' ? await currentVparivanieV2Xlsx(result)
        : await currentVparivanieV2Pdf(result)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `vparivanie-region-v2-current-data-draft-${result.Day}.${format}`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не вдалося сформувати файл V2.')
    } finally { setExporting(null) }
  }

  return <section className="app-section-card" aria-label="Регіональна матриця V2">
    <Group justify="space-between"><Text component="h2" fw={600} size="sm">Регіональна матриця V2</Text>
      <Badge color={available ? 'orange' : 'gray'}>{available ? 'Поточні дані · чернетка' : 'Очікує звірки'}</Badge></Group>
    <Text size="sm">Повна група AL-KO, день {CURRENT_VPARIVANIE_V2_DAY}. Залишок поточний; продажі й повернення за цей день.</Text>
    {!available ? <Alert color="yellow" title="Регіональна форма ще недоступна">
      Сервер очікує перевірки повного SQL-плану, точних налаштувань і числової звірки з 1С.
    </Alert> : <Stack gap="sm">
      <TextInput label="Точний ID покупця" description="Необов’язково; обмежує лише колонки контрагентів"
        disabled={busy || !!exporting} value={buyerId}
        onChange={event => { setBuyerId(event.currentTarget.value); setResult(null) }} />
      <TextInput label="Fenix ID менеджера покупця" description="Необов’язково; 32 шістнадцяткові символи"
        disabled={busy || !!exporting} value={manager}
        onChange={event => { setManager(event.currentTarget.value); setResult(null) }} />
      <Group><Button loading={busy} onClick={() => void read()}>Показати V2</Button>
        <Button variant="light" disabled={!result || !!exporting} onClick={exportCsv}>Експорт CSV</Button>
        <Button variant="light" disabled={!result || !!exporting} loading={exporting === 'xlsx'}
          onClick={() => void exportDocument('xlsx')}>Завантажити XLSX</Button>
        <Button variant="light" disabled={!result || !!exporting} loading={exporting === 'pdf'}
          onClick={() => void exportDocument('pdf')}>Завантажити PDF</Button></Group>
      {error ? <Alert color="red">{error}</Alert> : null}
      {result ? <><Text size="xs" c="dimmed">{CURRENT_VPARIVANIE_V2_DRAFT}</Text>
        <Group><Badge variant="light">{page * pageSize + 1}–{Math.min((page + 1) * pageSize,result.Rows.length)}
        {' '}із {result.Rows.length} товарів</Badge>
        <Button variant="subtle" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Назад</Button>
        <Button variant="subtle" disabled={(page + 1) * pageSize >= result.Rows.length}
          onClick={() => setPage(value => value + 1)}>Далі</Button></Group>
      <div className="report-inline-preview__scroll" tabIndex={0} role="region" aria-label="Регіональна матриця V2">
        <table><thead><tr>{CURRENT_VPARIVANIE_PRODUCT_CAPTIONS.map(caption => <th scope="col" key={caption}>{caption}</th>)}
          {columns.map(key => <th scope="col" key={key}>{currentVparivanieV2ColumnCaption(key)}</th>)}</tr></thead>
          <tbody>{result.Rows.slice(page * pageSize,(page + 1) * pageSize).map(row => { const cells=new Map(row.Cells.map(cell =>
            [currentVparivanieV2CellKey(cell),cell]));return <tr key={row.ProductId}>
            {[row.Article,row.Name,row.Description,row.Group,row.OE,row.Size,row.Top].map((value,index) =>
              <th scope="row" key={index}>{value ?? '—'}</th>)}
            {columns.map(key => <td key={key} title={cells.get(key)?.UnitId
              ? `Одиниця ${cells.get(key)?.UnitId}; фактів ${cells.get(key)?.FactCount}` : undefined}>
              {display(cells.get(key))}</td>)}
          </tr> })}</tbody></table>
      </div></> : null}
    </Stack>}
  </section>
}
