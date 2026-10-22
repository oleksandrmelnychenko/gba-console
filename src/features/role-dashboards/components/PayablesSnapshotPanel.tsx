import { Alert, Badge, Button, Card, Group, Loader, SimpleGrid, Stack, Text } from '@mantine/core'
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
  return <Card withBorder className="app-section-card" data-testid="payables-snapshot-panel">
    <Stack gap="sm">
      <Group justify="space-between" align="start">
        <div><Text component="h2" className="app-section-title">{t('Кредиторська заборгованість')}</Text>
          <Text size="sm" c="dimmed">{t('Останній підтверджений зріз джерела. Обраний період продажів на нього не впливає.')}</Text></div>
        <Button size="xs" variant="default" onClick={refresh} loading={state.loading}>{t('Оновити відображення')}</Button>
      </Group>
      <Text size="xs">{t('Fenix і AMG та різні валюти показано окремо. Борг і аванси не взаємозаліковуються.')}</Text>
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
  return <Card withBorder padding="sm" data-testid={`payables-world-${world.world}`}>
    <Stack gap="xs">
      <Group justify="space-between"><Text component="h3" fw={600}>{world.world === 'fenix' ? 'Fenix' : 'AMG'}</Text>
        <Badge color={world.status === 'confirmed' ? 'blue' : 'orange'}>{t(world.status === 'confirmed' ? 'Підтверджений зріз' : 'Дані недоступні')}</Badge></Group>
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
    <Text size="sm" fw={600}>{t('Станом на')}: {world.sourceCutoffUtc ? formatPayablesTime(world.sourceCutoffUtc) : '—'}</Text>
    <Text size="xs">{t('Операції до вказаного часу, не включно.')}</Text>
    <Text size="xs" c="orange">{t('Свіжість після цього зрізу не підтверджена.')}</Text>
    <Text size="xs">{t('Область')}: {t(payablesScopeLabel(world.scope))}</Text>
    <Text size="xs">{t('Покриття стосується зареєстрованих договорів постачальників, а не всіх даних 1С.')}</Text>
    {!world.scopeComplete && <Alert color="yellow">{world.reason || t('Покриття зареєстрованих ключів неповне. Наведені суми охоплюють лише підтверджені записи.')}</Alert>}
    {world.scopeComplete && world.reason && <Alert color="yellow">{world.reason}</Alert>}
    {world.requestedKeys !== null && <Text size="xs">{t('Записів договорів у перевірці')}: {world.requestedKeys}</Text>}
    {world.returnedKeys !== null && <Text size="xs">{t('З рухом у джерелі')}: {world.returnedKeys}</Text>}
    {world.requestedKeys !== null && world.returnedKeys !== null && <Text size="xs">{t('Підтверджених порожніх відповідей')}: {world.requestedKeys - world.returnedKeys}. {t('Їх враховано з нульовим сальдо.')}</Text>}
    {world.excludedKeys !== null && world.excludedKeys > 0 && <Text size="xs">{t('Поза обсягом цього джерела')}: {world.excludedKeys}. {t('Ці записи не входять до наведених сум.')}</Text>}
    {world.publishedAtUtc && <Text size="xs" c="dimmed">{t('Опубліковано')}: {formatPayablesTime(world.publishedAtUtc)}</Text>}
  </Stack>
}

function PayablesCurrencyCard({ bucket, onOpen }: { bucket: PayablesBucket; onOpen: () => void }) {
  const { t } = useI18n()
  return <Card withBorder padding="sm" data-testid={`payables-currency-${bucket.currencyCode}`}>
    <Stack gap={5}>
      <Text fw={600}>{payablesCurrencyLabel(bucket)}</Text>
      <Group justify="space-between"><Text size="sm">{t('Борг постачальникам')}</Text><Text fw={600}>{formatPayablesAmount(bucket.payable)}</Text></Group>
      <Group justify="space-between"><Text size="sm">{t('Аванси постачальникам')}</Text><Text>{formatPayablesAmount(bucket.advance)}</Text></Group>
      <Text size="xs" c="dimmed">{t('Сальдо джерела')}: {formatPayablesAmount(bucket.signedBalance)}</Text>
      <Button size="xs" variant="light" onClick={onOpen}>{t('Розшифровка')} · {bucket.rowCount} {t('записів')}</Button>
    </Stack>
  </Card>
}
