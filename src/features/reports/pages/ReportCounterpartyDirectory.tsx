import { Alert, Button, Checkbox, Group, Stack, Table, Text, TextInput } from '@mantine/core'
import { useEffect, useState } from 'react'
import {
  goodsSupplierDirectoryPage, readGoodsSupplierDirectory, REPORT_COUNTERPARTY_PAGE_SIZE, REPORT_COUNTERPARTY_ROLES,
  searchReportCounterpartyDirectory, type ReportCounterpartyRole, type ReportDirectoryPage,
} from '../data/reportCounterpartyDirectories'
import type { ReportSelectedValue } from '../types'
import { exactId } from '../data/exactId'
import { ReportModal } from './ReportModal'
import { useReportValueSearch } from './reportValueSearch'

type DirectoryResult = { key: string } & (
  { goods: Awaited<ReturnType<typeof readGoodsSupplierDirectory>> }
  | { page: Awaited<ReturnType<typeof searchReportCounterpartyDirectory>> }
  | { failed: true }
)

type Choice = { all: boolean; values: ReportSelectedValue[] }
type SearchPage = (query: string, offset: number, signal: AbortSignal) => Promise<ReportDirectoryPage>
type Props = {
  role: ReportCounterpartyRole | null
  onClose: () => void
  choice?: Choice
  onApply?: (choice: Choice) => void
  searchPage?: SearchPage
  multiple?: boolean
}

const emptyChoice: Choice = { all: false, values: [] }
const entryId = (value: ReportSelectedValue) => exactId(value.Data) ?? value.Data.Id

export function ReportCounterpartyDirectory({ role, onClose, choice, onApply, searchPage, multiple = true }: Props) {
  const [saved, setSaved] = useState<Partial<Record<ReportCounterpartyRole, Choice>>>({})
  if (role === null) return null
  return <ReportModal opened onClose={onClose} title={REPORT_COUNTERPARTY_ROLES.find(item => item.key === role)?.label} size="lg">
    <DirectoryContents key={role} role={role} initial={choice ?? saved[role] ?? emptyChoice} searchPage={searchPage} multiple={multiple}
      onApply={next => {
        if (onApply) onApply(next)
        else setSaved(current => ({ ...current, [role]: next }))
        onClose()
      }} />
  </ReportModal>
}

function DirectoryContents({ role, initial, multiple, onApply, searchPage }: {
  role: ReportCounterpartyRole
  initial: Choice
  multiple: boolean
  onApply: (choice: Choice) => void
  searchPage?: SearchPage
}) {
  const [choice, setChoice] = useState(initial)
  const { search, setSearch, query, pending } = useReportValueSearch()
  const [offset, setOffset] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<DirectoryResult | null>(null)
  const isGoods = !searchPage && role === 'goods-supplier'
  const isDebouncing = !isGoods && pending
  const remoteQuery = isGoods ? '' : query.trim()
  const remoteOffset = isGoods ? 0 : offset
  const key = JSON.stringify([remoteQuery, remoteOffset, attempt])

  useEffect(() => {
    if (isDebouncing) return
    const controller = new AbortController()
    const request = searchPage ? searchPage(remoteQuery, remoteOffset, controller.signal).then(page => ({ page }))
      : role === 'goods-supplier' ? readGoodsSupplierDirectory(controller.signal).then(goods => ({ goods }))
      : searchReportCounterpartyDirectory(role, remoteQuery, remoteOffset, controller.signal).then(page => ({ page }))
    request.then(data => {
      if (!controller.signal.aborted) setResult({ key, ...data })
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key, failed: true })
    })
    return () => controller.abort()
  }, [isDebouncing, isGoods, key, role, remoteQuery, remoteOffset, searchPage])

  const current = !isDebouncing && result?.key === key ? result : null
  const page = current && ('goods' in current ? goodsSupplierDirectoryPage(current.goods, search, offset)
    : 'page' in current ? current.page : null)
  const appliesWithoutFilter = Boolean(searchPage && choice.all)
  const applyLabel = searchPage ? 'Застосувати' : 'Зберегти вибір'

  return <Stack gap="sm">
    {!searchPage && <Text size="sm" c="dimmed">Вибір у цьому довіднику зберігається окремо від умов звіту.</Text>}
    <Group justify="space-between">
      <Button size="xs" variant="default" aria-pressed={choice.all}
        onClick={() => setChoice(current => ({ ...current, all: !current.all }))}>
        {choice.all ? 'Скасувати вибір усіх' : 'Вибрати всі'}
      </Button>
      <Text size="sm" role="status">{choice.all ? 'Вибрано всі записи' : `Вибрано: ${choice.values.length}`}</Text>
      <Button size="xs" onClick={() => onApply(choice)}>
        {appliesWithoutFilter ? 'Застосувати без відбору' : applyLabel}
      </Button>
    </Group>
    {appliesWithoutFilter && <Text size="sm" c="dimmed">Ця умова відбору не застосовуватиметься до звіту.</Text>}
    <TextInput label="Код або назва" data-autofocus maxLength={120} value={search} onChange={event => {
      setSearch(event.currentTarget.value)
      setOffset(0)
    }} />
    {!current && <Text size="sm" role="status">Завантажуємо довідник…</Text>}
    {current && 'failed' in current && <Alert role="alert" color="red">
      <Group justify="space-between">
        <Text size="sm">Не вдалося завантажити довідник.</Text>
        <Button variant="subtle" size="compact-xs" onClick={() => setAttempt(value => value + 1)}>Повторити</Button>
      </Group>
    </Alert>}
    {page && <DirectoryEntries page={page} offset={offset} onPage={setOffset} choice={choice} onToggle={item => {
      setChoice(current => {
        const other = current.values.filter(value => entryId(value) !== entryId(item))
        const values = other.length < current.values.length ? other : multiple ? [...other, item] : [item]
        return { all: false, values }
      })
    }} />}
  </Stack>
}

function DirectoryEntries({ page, offset, onPage, choice, onToggle }: {
  page: ReportDirectoryPage
  offset: number
  onPage: (offset: number) => void
  choice: Choice
  onToggle: (item: ReportSelectedValue) => void
}) {
  const selected = new Set(choice.values.map(entryId))
  return <>
    {page.entries.length ? <Table className="app-static-table" aria-label="Контрагенти">
      <Table.Thead><Table.Tr><Table.Th scope="col">Код і назва</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>
        {page.entries.map(item => <Table.Tr key={entryId(item)}><Table.Td>
          <Checkbox label={item.Name} checked={choice.all || selected.has(entryId(item))} disabled={choice.all}
            onChange={() => onToggle(item)} />
        </Table.Td></Table.Tr>)}
      </Table.Tbody>
    </Table> : <Text size="sm" role="status">Контрагентів не знайдено.</Text>}
    {(offset > 0 || page.hasMore) && <Group justify="space-between" wrap="nowrap">
      <Button variant="default" size="compact-xs" disabled={offset === 0}
        onClick={() => onPage(offset - REPORT_COUNTERPARTY_PAGE_SIZE)}>Назад</Button>
      <Text size="sm" aria-live="polite">Сторінка {offset / REPORT_COUNTERPARTY_PAGE_SIZE + 1}</Text>
      <Button variant="default" size="compact-xs" disabled={!page.hasMore}
        onClick={() => onPage(offset + REPORT_COUNTERPARTY_PAGE_SIZE)}>Далі</Button>
    </Group>}
  </>
}
