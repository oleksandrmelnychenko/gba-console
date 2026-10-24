import { Alert, Button, Card, Group, Loader, SimpleGrid, Stack, Text } from '@mantine/core'
import { Info, List, RefreshCw } from 'lucide-react'
import { TableChip } from '../../../shared/ui/TableChip'
import { useCallback, useReducer, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useWorkdayResource } from '../../sales-cockpit/hooks/useWorkdayResource'
import { getPayablesSnapshot } from '../api/dashboardPayablesApi'
import type { PayablesBucket, PayablesSelection, PayablesWorkspace, PayablesWorld } from '../payablesTypes'
import { formatPayablesAmount, formatPayablesTime, payablesCurrencyLabel, payablesScopeLabel } from './payablesPresentation'
import { PayablesRowsModal } from './PayablesRowsModal'

export function PayablesSnapshotPanel({ workspace }: { workspace: PayablesWorkspace }) {
  const { t } = useI18n()
  const [revision, refresh] = useReducer((value: number) => value + 1, 0)
  const [selected, select] = useState<PayablesSelection | null>(null)
  const load = useCallback((signal: AbortSignal) => getPayablesSnapshot(workspace, signal), [workspace])
  const state = useWorkdayResource(load, `${workspace}:${revision}`)
  return <Card withBorder className="app-section-card role-dashboard-payables" data-workspace={workspace} data-testid="payables-snapshot-panel">
    <Stack gap={8}>
      <Group className="role-dashboard-payables__header" justify="space-between" align="center">
        <div><Text component="h2" className="app-section-title">{t('Кредиторська заборгованість')}</Text>
</div>
        <Button leftSection={<RefreshCw size={14} />} size="xs" variant="default" onClick={refresh} loading={state.loading}>{t('Оновити відображення')}</Button>
      </Group>
      <details className="role-dashboard-data-details"><summary><Info size={14} />{t('Про дані')}</summary><Text size="xs">{t('Останній підтверджений зріз джерела. Обраний період продажів на нього не впливає.')}</Text><Text size="xs">{t('Fenix і AMG та різні валюти показано окремо. Борг і аванси не взаємозаліковуються.')}</Text></details>
      {state.loading && <Loader aria-label={t('Завантаження кредиторської заборгованості')} />}
      {state.error && <Alert color="red" title={t('Зріз не вдалося перевірити')}>{state.error}</Alert>}
      {state.data && <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="sm">
        {state.data.worlds.map(world => <PayablesWorldCard key={world.world} world={world} onOpen={bucket => select({ world, bucket })} />)}
      </SimpleGrid>}
      {selected && <PayablesRowsModal key={`${workspace}:${selected.world.world}:${selected.world.publicationId}:${selected.bucket.currencyCode}`} workspace={workspace} selected={selected} onClose={() => select(null)} />}
    </Stack>
  </Card>
}

function PayablesWorldCard({ world, onOpen }: { world: PayablesWorld; onOpen: (bucket: PayablesBucket) => void }) {
  const { t } = useI18n()
  return <Card className="app-section-card role-dashboard-payables__world" withBorder padding="sm" data-testid={`payables-world-${world.world}`}>
    <Stack gap="xs">
      <Group justify="space-between"><TableChip tone="product" value={world.world === 'fenix' ? 'Fenix' : 'AMG'} />
        <TableChip tone={world.status === 'confirmed' ? 'document' : 'warning'} value={t(world.status === 'confirmed' ? 'Підтверджений зріз' : 'Дані недоступні')} /></Group>
      {world.status === 'unavailable' ? <Alert color="yellow">{world.reason || t('Немає підтвердженого зрізу. Сума боргу невідома.')}</Alert> : <>
        <PayablesSourceEvidence world={world} />
        {world.buckets.length === 0 && <Text size="sm">{t('У підтвердженій області немає зареєстрованих ключів постачальників.')}</Text>}
        {world.buckets.map(bucket => <PayablesCurrencyCard key={bucket.currencyCode} bucket={bucket} onOpen={() => onOpen(bucket)} />)}
      </>}
    </Stack>
  </Card>
}

export function PayablesSourceEvidence({ world }: { world: PayablesWorld }) {
  const { t } = useI18n()
  return <Stack gap={3}>
    <Text className="role-dashboard-source-date" size="sm" fw={600}>{t('Станом на')}: {world.sourceCutoffUtc ? formatPayablesTime(world.sourceCutoffUtc) : '—'}</Text>
    <Text size="xs" c="orange">{t('Свіжість після цього зрізу не підтверджена.')}</Text>
    <details className="role-dashboard-data-details"><summary><Info size={14} />{t('Область перевірки')}</summary>
    <Text size="xs">{t('Операції до вказаного часу, не включно.')}</Text>
    <Text size="xs">{t('Область')}: {t(payablesScopeLabel(world.scope))}</Text>
    <Text size="xs">{t('Покриття стосується зареєстрованих договорів постачальників, а не всіх даних 1С.')}</Text>
    {world.requestedKeys !== null && <Text size="xs">{t('Записів договорів у перевірці')}: {world.requestedKeys}</Text>}
    {world.returnedKeys !== null && <Text size="xs">{t('З рухом у джерелі')}: {world.returnedKeys}</Text>}
    {world.requestedKeys !== null && world.returnedKeys !== null && <Text size="xs">{t('Підтверджених порожніх відповідей')}: {world.requestedKeys - world.returnedKeys}. {t('Їх враховано з нульовим сальдо.')}</Text>}
    {world.excludedKeys !== null && world.excludedKeys > 0 && <Text size="xs">{t('Поза обсягом цього джерела')}: {world.excludedKeys}. {t('Ці записи не входять до наведених сум.')}</Text>}
    {world.publishedAtUtc && <Text size="xs" c="dimmed">{t('Опубліковано')}: {formatPayablesTime(world.publishedAtUtc)}</Text>}
    </details>
    {!world.scopeComplete && <Alert color="yellow">{world.reason || t('Покриття зареєстрованих ключів неповне. Наведені суми охоплюють лише підтверджені записи.')}</Alert>}
    {world.scopeComplete && world.reason && <Alert color="yellow">{world.reason}</Alert>}
  </Stack>
}

function PayablesCurrencyCard({ bucket, onOpen }: { bucket: PayablesBucket; onOpen: () => void }) {
  const { t } = useI18n()
  return <section className="role-dashboard-payables__currency" data-testid={`payables-currency-${bucket.currencyCode}`}>
    <Stack gap={5}>
      <Group justify="space-between" gap={8}>
        <TableChip tone="source" value={payablesCurrencyLabel(bucket)} />
        <Button leftSection={<List size={14} />} size="compact-xs" variant="default" onClick={onOpen}>{t('Розшифровка')} · {bucket.rowCount} {t('записів')}</Button>
      </Group>
      <dl className="role-dashboard-payables__amounts">
        <div><dt>{t('Борг постачальникам')}</dt><dd className="app-money">{formatPayablesAmount(bucket.payable)}</dd></div>
        <div><dt>{t('Аванси постачальникам')}</dt><dd className="app-money">{formatPayablesAmount(bucket.advance)}</dd></div>
      </dl>
      <Text size="xs" c="dimmed">{t('Сальдо джерела')}: <span className="app-money">{formatPayablesAmount(bucket.signedBalance)}</span></Text>
    </Stack>
  </section>
}
