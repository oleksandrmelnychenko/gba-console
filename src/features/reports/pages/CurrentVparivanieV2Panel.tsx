import { Alert, Badge, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { useMemo, useState } from 'react'
import { readCurrentVparivanieV2 } from '../api/currentVparivanieV2Api'
import { currentVparivanieV2Available, currentVparivanieV2Csv,
  CURRENT_VPARIVANIE_V2_DAY, type CurrentVparivanieV2Cell,
  type CurrentVparivanieV2Result } from '../data/currentVparivanieV2'
import { CURRENT_VPARIVANIE_PRODUCT_CAPTIONS } from '../data/currentVparivanie'
import type { ReportDataset } from '../types'
import './report-inline-preview.css'

const columnOrder = ['Stock', 'Sales', 'CounterpartyTotal', 'CounterpartyRegionCode', 'CounterpartyUnknown']
const pageSize = 50
const columnCaption: Record<string, string> = {
  Stock: 'Остатки', Sales: 'Продажи', CounterpartyTotal: 'Контрагенты',
  CounterpartyRegionCode: 'Регіон', CounterpartyUnknown: 'Невідомий регіон',
}
const display = (cell?: CurrentVparivanieV2Cell) => cell === undefined ? '—' : cell.Quantity === null ? '∅' : cell.Quantity

export function CurrentVparivanieV2Panel({ dataset }: { dataset: ReportDataset | null }) {
  const available = currentVparivanieV2Available(dataset)
  const [buyerId, setBuyerId] = useState('')
  const [manager, setManager] = useState('')
  const [result, setResult] = useState<CurrentVparivanieV2Result | null>(null)
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const columns = useMemo(() => result ? [...new Set(result.Rows.flatMap(row => row.Cells
    .map(cell => `${cell.Column}:${cell.RegionCode ?? ''}`)))].sort((a, b) => {
    const [leftKind, leftCode] = a.split(':')
    const [rightKind, rightCode] = b.split(':')
    return columnOrder.indexOf(leftKind) - columnOrder.indexOf(rightKind) || leftCode.localeCompare(rightCode)
  }) : [], [result])

  async function read() {
    if (!dataset || !available || busy) return
    setBusy(true); setError(null); setResult(null); setPage(0)
    try { setResult(await readCurrentVparivanieV2(dataset,buyerId.trim() || undefined,
      manager.trim() || undefined)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не вдалося прочитати регіональну матрицю V2.') }
    finally { setBusy(false) }
  }

  function exportCsv() {
    if (!result || !available) return
    const url=URL.createObjectURL(new Blob([currentVparivanieV2Csv(result)],{type:'text/csv;charset=utf-8'}))
    const link=document.createElement('a')
    link.href=url;link.download=`vparivanie-region-v2-${result.Day}.csv`;link.click()
    window.setTimeout(()=>URL.revokeObjectURL(url),0)
  }

  return <section className="app-section-card" aria-label="Регіональна матриця V2">
    <Group justify="space-between"><Text component="h2" fw={600} size="sm">Регіональна матриця V2</Text>
      <Badge color={available ? 'green' : 'gray'}>{available ? 'Доступна' : 'Очікує звірки'}</Badge></Group>
    <Text size="sm">Повна група AL-KO, день {CURRENT_VPARIVANIE_V2_DAY}. Залишок поточний; продажі й повернення за цей день.</Text>
    {!available ? <Alert color="yellow" title="Регіональна форма ще недоступна">
      Сервер очікує перевірки повного SQL-плану, точних налаштувань і числової звірки з 1С.
    </Alert> : <Stack gap="sm">
      <TextInput label="Точний ID покупця" description="Необов’язково; обмежує лише колонки контрагентів"
        value={buyerId} onChange={event => { setBuyerId(event.currentTarget.value); setResult(null) }} />
      <TextInput label="Fenix ID менеджера покупця" description="Необов’язково; 32 шістнадцяткові символи"
        value={manager} onChange={event => { setManager(event.currentTarget.value); setResult(null) }} />
      <Group><Button loading={busy} onClick={() => void read()}>Показати V2</Button>
        <Button variant="light" disabled={!result} onClick={exportCsv}>Експорт CSV</Button></Group>
      {error ? <Alert color="red">{error}</Alert> : null}
      {result ? <><Group><Badge variant="light">{page * pageSize + 1}–{Math.min((page + 1) * pageSize,result.Rows.length)}
        {' '}із {result.Rows.length} товарів</Badge>
        <Button variant="subtle" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Назад</Button>
        <Button variant="subtle" disabled={(page + 1) * pageSize >= result.Rows.length}
          onClick={() => setPage(value => value + 1)}>Далі</Button></Group>
      <div className="report-inline-preview__scroll" tabIndex={0} role="region" aria-label="Регіональна матриця V2">
        <table><thead><tr>{CURRENT_VPARIVANIE_PRODUCT_CAPTIONS.map(caption => <th scope="col" key={caption}>{caption}</th>)}
          {columns.map(key => { const [kind,region] = key.split(':');return <th scope="col" key={key}>
            {columnCaption[kind]}{region ? ` / ${region}` : ''}</th> })}</tr></thead>
          <tbody>{result.Rows.slice(page * pageSize,(page + 1) * pageSize).map(row => { const cells=new Map(row.Cells.map(cell =>
            [`${cell.Column}:${cell.RegionCode ?? ''}`,cell]));return <tr key={row.ProductId}>
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
