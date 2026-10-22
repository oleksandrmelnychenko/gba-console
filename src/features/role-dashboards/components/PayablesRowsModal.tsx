import { Alert, Button, Group, Loader, Modal, Pagination, Stack, Table, Text } from '@mantine/core'
import { useCallback, useReducer, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useWorkdayResource } from '../../sales-cockpit/hooks/useWorkdayResource'
import { getPayablesRows } from '../api/dashboardPayablesApi'
import type { PayablesRows, PayablesSelection, PayablesWorkspace } from '../payablesTypes'
import { formatPayablesAmount, formatPayablesTime, matchesPayablesSelection, payablesCurrencyLabel, payablesScopeLabel } from './payablesPresentation'

export function PayablesRowsModal({ workspace, selected, onClose }: { workspace: PayablesWorkspace; selected: PayablesSelection; onClose: () => void }) {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [revision, refresh] = useReducer((value: number) => value + 1, 0)
  const load = useCallback((signal: AbortSignal) => getPayablesRows({ workspace, world: selected.world.world, publicationId: selected.world.publicationId!, currencyCode: selected.bucket.currencyCode, offset: (page - 1) * 50, limit: 50 }, signal), [workspace, selected, page])
  const state = useWorkdayResource(load, `${page}:${revision}`)
  const title = `${t('Кредиторська заборгованість')} · ${selected.world.world === 'fenix' ? 'Fenix' : 'AMG'} · ${payablesCurrencyLabel(selected.bucket)}`
  return <Modal opened onClose={onClose} title={title} size="xl" closeButtonProps={{ 'aria-label': t('Закрити розшифровку') }}>
    <Stack gap="sm">
      <Group justify="space-between"><Text size="sm">{t('Станом на')}: {formatPayablesTime(selected.world.sourceCutoffUtc!)}</Text><Button size="xs" variant="default" onClick={refresh}>{t('Повторити читання')}</Button></Group>
      <Text size="xs">{t('Операції до вказаного часу, не включно.')}</Text>
      <Text size="xs">{t('Рядки зафіксованого підтвердженого зрізу. Від’ємне сальдо означає борг, додатне — аванс. Нульові підтверджені залишки також включено.')}</Text>
      <Text size="xs">{t(payablesScopeLabel(selected.world.scope))}</Text>
      {!selected.world.scopeComplete && <Alert color="yellow">{t('Покриття неповне; наведено лише підтверджену область.')}</Alert>}
      {state.loading && <Loader aria-label={t('Завантаження розшифровки')} />}
      {state.error && <Alert color="red">{state.error}</Alert>}
      {state.data && <PayablesRowsContents data={state.data} selected={selected} page={page} onPage={setPage} />}
    </Stack>
  </Modal>
}

function PayablesRowsContents({ data, selected, page, onPage }: { data: PayablesRows; selected: PayablesSelection; page: number; onPage: (value: number) => void }) {
  const { t } = useI18n()
  if (!matchesPayablesSelection(data, selected)) return <Alert color="red">{t('Розшифровка не відповідає обраному зрізу або його підсумкам. Закрийте її та оновіть відображення.')}</Alert>
  return <>
    <Text size="sm">{t('Записів')}: {data.total} · {t('Борг')}: {formatPayablesAmount(data.aggregate.payable)} · {t('Аванси')}: {formatPayablesAmount(data.aggregate.advance)} · {payablesCurrencyLabel(selected.bucket)}</Text>
    {data.rows.length === 0 ? <Text>{t('У цьому зрізі немає записів для обраної валюти.')}</Text> : <Table.ScrollContainer minWidth={720}>
      <Table withTableBorder striped><Table.Thead><Table.Tr>{['Постачальник', 'Договір', 'Організація', 'Сальдо джерела', 'Борг', 'Аванс'].map(label => <Table.Th key={label}>{t(label)}</Table.Th>)}</Table.Tr></Table.Thead>
        <Table.Tbody>{data.rows.map(row => <Table.Tr key={row.id}>
          <Table.Td>{row.supplierName || row.supplierCode}<Text size="xs" c="dimmed">{row.supplierCode}</Text></Table.Td>
          <Table.Td>{row.agreementName || row.agreementId}</Table.Td><Table.Td>{row.organizationName || '—'}</Table.Td>
          <Table.Td>{formatPayablesAmount(row.signedBalance)}</Table.Td><Table.Td>{formatPayablesAmount(row.payable)}</Table.Td><Table.Td>{formatPayablesAmount(row.advance)}</Table.Td>
        </Table.Tr>)}</Table.Tbody>
      </Table>
    </Table.ScrollContainer>}
    {(data.total > 50 || page > 1) && <Pagination value={page} total={Math.max(page, Math.ceil(data.total / 50))} onChange={onPage} />}
  </>
}
