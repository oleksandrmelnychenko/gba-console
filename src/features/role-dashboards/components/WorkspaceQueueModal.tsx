import { Alert, Anchor, Button, Group, Loader, Modal, Pagination, Stack, Table, Text } from '@mantine/core'
import { useCallback, useReducer, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useNavigation } from '../../navigation/hooks/useNavigation'
import { isNavigationPathAllowed } from '../../navigation/navigationUtils'
import { useWorkdayResource } from '../../sales-cockpit/hooks/useWorkdayResource'
import { getDashboardQueue } from '../api/dashboardQueuesApi'
import type { DashboardWorkspaceKey } from '../types'
import type { WorkspaceQueue, WorkspaceQueueRequest } from '../queueTypes'
import { readWorkspaceQueueRequest } from '../utils/metricScope'

const number = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 6 })
const currencyComparison = new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })

export function WorkspaceQueueModal({ workspace }: { workspace: DashboardWorkspaceKey }) {
  const [params, setParams] = useSearchParams()
  const key = params.get('queue')
  if (!key) return null
  const request = readWorkspaceQueueRequest(params, workspace)
  const close = () => {
    const next = new URLSearchParams(params)
    for (const name of ['queue', 'queueFrom', 'queueTo', 'queueAsOf', 'queueValue']) next.delete(name)
    setParams(next)
  }
  return <QueueModal key={`${workspace}:${key}:${params.get('queueFrom')}:${params.get('queueTo')}:${params.get('queueAsOf')}`} request={request} expected={params.get('queueValue')} onClose={close} />
}

function QueueModal({ request, expected, onClose }: { request: WorkspaceQueueRequest | null; expected: string | null; onClose: () => void }) {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [retry, refresh] = useReducer((value: number) => value + 1, 0)
  const load = useCallback((signal: AbortSignal) => request ? getDashboardQueue({ ...request, offset: (page - 1) * 50 }, signal) : Promise.reject(new Error('Некоректні параметри черги')), [request, page])
  const state = useWorkdayResource(load, `${page}:${retry}`)
  const data = state.data
  return <Modal opened onClose={onClose} title={data?.label || t('Точна черга показника')} size="xl" closeButtonProps={{ 'aria-label': t('Закрити чергу') }}>
    <Stack gap="sm">
      <Group justify="space-between"><Text size="sm">{t('Записи, з яких розраховано показник')}</Text><Button variant="default" size="xs" onClick={refresh}>{t('Оновити чергу')}</Button></Group>
      <Text size="xs" c="dimmed">{t('Статуси та склад записів актуальні на час читання. Зафіксована дата розрахунку визначає вікові пороги, але не відновлює історичний стан бази.')}</Text>
      {state.loading ? <Loader aria-label={t('Завантаження черги')} /> : state.error ? <Alert color="red">{state.error}</Alert> : data ? <QueueContents data={data} expected={expected} page={page} onPage={setPage} /> : null}
    </Stack>
  </Modal>
}

function QueueContents({ data, expected, page, onPage }: { data: WorkspaceQueue; expected: string | null; page: number; onPage: (page: number) => void }) {
  const { t } = useI18n()
  const { modules } = useNavigation()
  const changed = hasAggregateChanged(data.aggregateValue, data.unit, expected)
  return <>
        <Text size="sm">{t('Записів')}: {data.total} · {t('Значення показника')}: {data.aggregateValue === null ? t('Не визначено') : number.format(data.aggregateValue)} {data.unit === 'qty' ? t('шт.') : data.unit === 'count' ? '' : data.unit}</Text>
        {changed && <Alert color="yellow">{t('Дані змінилися після розрахунку дашборда. Тут показано значення за поточним складом записів; оновіть показники дашборда.')}</Alert>}
        <Text size="xs">{t(data.timeBasis === 'period' ? 'За обраний період' : 'Поточний стан')}{data.timeBasis === 'period' ? `: ${data.from} — ${data.to} (${t('верхню межу не включено')})` : ''}</Text>
        {[{ key: 'formula', text: data.formula }, { key: 'scope', text: data.scope }].filter(item => item.text).map(item => <Text key={item.key} size="xs">{item.text}</Text>)}
        <Text size="xs" c="dimmed">{t('Одиниця рядка')}: {data.grain}</Text>
        {!data.rows.length && <Text>{data.total === 0 ? t('Записів у цій черзі немає') : t('На цій сторінці записів більше немає. Перейдіть на попередню сторінку.')}</Text>}
        {data.rows.length > 0 && <Table.ScrollContainer minWidth={620}><Table withTableBorder striped>
          <Table.Thead><Table.Tr>{['Документ / запис', 'Дата джерела', 'Опис', 'Кількість / сума'].map(label => <Table.Th key={label}>{t(label)}</Table.Th>)}</Table.Tr></Table.Thead>
          <Table.Tbody>{data.rows.map(row => <Table.Tr key={row.id}>
            <Table.Td>{row.route && isNavigationPathAllowed(modules, row.route) ? <Anchor href={row.route}>{row.number || `#${row.id}`}</Anchor> : row.number || `#${row.id}`}</Table.Td>
            <Table.Td>{row.documentDate?.slice(0, 10) || '—'}</Table.Td><Table.Td>{row.description}</Table.Td>
            <Table.Td>{row.quantity === null ? '—' : number.format(row.quantity)}</Table.Td>
          </Table.Tr>)}</Table.Tbody>
        </Table></Table.ScrollContainer>}
        {(data.total > 50 || page > 1) && <Pagination value={page} total={Math.max(page, Math.ceil(data.total / 50))} onChange={onPage} />}
      </>
}

function hasAggregateChanged(actual: number | null, unit: string, expected: string | null) {
  if (expected === null || !Number.isFinite(Number(expected))) return false
  // Financial KPI totals use decimal.Round(..., 2, AwayFromZero); queues retain source precision.
  // Intl's default halfExpand rounding also rounds negative midpoint values away from zero.
  if (unit === 'EUR' && actual !== null) {
    return currencyComparison.format(actual) !== currencyComparison.format(Number(expected))
  }
  return actual !== Number(expected)
}
