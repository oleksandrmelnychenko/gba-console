import { Alert, Button, Group, Stack, Table, Text, TextInput } from '@mantine/core'
import { useEffect, useState } from 'react'
import {
  goodsSupplierDirectoryPage, readGoodsSupplierDirectory, REPORT_COUNTERPARTY_PAGE_SIZE, REPORT_COUNTERPARTY_ROLES,
  searchReportCounterpartyDirectory, type ReportCounterpartyRole,
} from '../data/reportCounterpartyDirectories'
import { ReportModal } from './ReportModal'
import { useReportValueSearch } from './reportValueSearch'

type DirectoryResult = { key: string } & (
  { goods: Awaited<ReturnType<typeof readGoodsSupplierDirectory>> }
  | { page: Awaited<ReturnType<typeof searchReportCounterpartyDirectory>> }
  | { failed: true }
)

export function ReportCounterpartyDirectory({ role, onClose }: { role: ReportCounterpartyRole | null; onClose: () => void }) {
  if (role === null) return null
  return <ReportModal opened onClose={onClose} title={REPORT_COUNTERPARTY_ROLES.find(item => item.key === role)?.label} size="md">
    <DirectoryContents key={role} role={role} />
  </ReportModal>
}

function DirectoryContents({ role }: { role: ReportCounterpartyRole }) {
  const { search, setSearch, query, pending } = useReportValueSearch()
  const [offset, setOffset] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<DirectoryResult | null>(null)
  const isGoods = role === 'goods-supplier'
  const isDebouncing = !isGoods && pending
  const remoteQuery = isGoods ? '' : query.trim()
  const remoteOffset = isGoods ? 0 : offset
  const key = JSON.stringify([remoteQuery, remoteOffset, attempt])

  useEffect(() => {
    if (isDebouncing) return
    const controller = new AbortController()
    const request = isGoods ? readGoodsSupplierDirectory(controller.signal).then(goods => ({ goods }))
      : searchReportCounterpartyDirectory(role, remoteQuery, remoteOffset, controller.signal).then(page => ({ page }))
    request.then(data => {
      if (!controller.signal.aborted) setResult({ key, ...data })
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key, failed: true })
    })
    return () => controller.abort()
  }, [isDebouncing, isGoods, key, role, remoteQuery, remoteOffset])

  const current = !isDebouncing && result?.key === key ? result : null
  const page = current && ('goods' in current ? goodsSupplierDirectoryPage(current.goods, search, offset)
    : 'page' in current ? current.page : null)

  return <Stack gap="sm">
    <Text size="sm" c="dimmed">Перегляд довідника</Text>
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
    {page && (page.entries.length ? <Table className="app-static-table" aria-label="Контрагенти">
      <Table.Thead><Table.Tr><Table.Th scope="col">Код і назва</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>
        {page.entries.map(item => <Table.Tr key={item.id}><Table.Td>{item.label}</Table.Td></Table.Tr>)}
      </Table.Tbody>
    </Table> : <Text size="sm" role="status">Контрагентів не знайдено.</Text>)}
    {page && (offset > 0 || page.hasMore) && <Group justify="space-between" wrap="nowrap">
      <Button variant="default" size="compact-xs" disabled={offset === 0}
        onClick={() => setOffset(value => value - REPORT_COUNTERPARTY_PAGE_SIZE)}>Назад</Button>
      <Text size="sm" aria-live="polite">Сторінка {offset / REPORT_COUNTERPARTY_PAGE_SIZE + 1}</Text>
      <Button variant="default" size="compact-xs" disabled={!page.hasMore}
        onClick={() => setOffset(value => value + REPORT_COUNTERPARTY_PAGE_SIZE)}>Далі</Button>
    </Group>}
  </Stack>
}
