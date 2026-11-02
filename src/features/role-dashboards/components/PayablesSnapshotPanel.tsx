import { Alert, Button, Card, Group, Loader, SimpleGrid, Stack, Text } from '@mantine/core'
import { Info, List, RefreshCw } from 'lucide-react'
import { TableChip } from '../../../shared/ui/TableChip'
import { useCallback, useReducer, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useWorkdayResource } from '../../sales-cockpit/hooks/useWorkdayResource'
import { getPayablesSnapshot } from '../api/dashboardPayablesApi'
import type { PayablesBucket, PayablesSelection, PayablesWorkspace } from '../payablesTypes'
import { formatPayablesAmount, formatPayablesDate, payablesGridFromDate } from './payablesPresentation'
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
        <div><Text component="h2" className="app-section-title">{t('Кредиторська заборгованість')}</Text></div>
        <Button leftSection={<RefreshCw size={14} />} size="xs" variant="default" onClick={refresh} loading={state.loading}>{t('Оновити відображення')}</Button>
      </Group>
      {state.data && <Text className="role-dashboard-source-date" size="sm" fw={600}>{t('Станом на кінець дня')}: {formatPayablesDate(state.data.asOfDate)}</Text>}
      <details className="role-dashboard-data-details"><summary><Info size={14} />{t('Про дані')}</summary>
        <Text size="xs">{t('Сальдо кожного договору постачальника рахується з документів GBA — імпортованих і власних разом: прибуткові накладні, оплати постачальникам, повернення коштів від постачальників, послуги та витратні матеріали.')}</Text>
        <Text size="xs">{t('Сальдо договору дорівнює «Залишку на початок» у взаєморозрахунках за цим договором')}{state.data ? ` ${t('з датою «з»')} ${payablesGridFromDate(state.data.asOfDate)}` : ''}.</Text>
        <Text size="xs">{t('Валюти показано окремо. Борг і аванси не взаємозаліковуються. Обраний період продажів на суми не впливає.')}</Text>
      </details>
      {state.loading && <Loader aria-label={t('Завантаження кредиторської заборгованості')} />}
      {state.error && <Alert color="red" title={t('Сальдо не вдалося прочитати')}>{state.error}</Alert>}
      {state.data && state.data.buckets.length === 0 && <Text size="sm">{t('Немає договорів постачальників із ненульовим сальдо.')}</Text>}
      {state.data && <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="sm">
        {state.data.buckets.map(bucket => <PayablesCurrencyCard key={bucket.currencyCode} bucket={bucket} onOpen={() => select({ asOfDate: state.data!.asOfDate, bucket })} />)}
      </SimpleGrid>}
      {selected && <PayablesRowsModal key={`${workspace}:${selected.asOfDate}:${selected.bucket.currencyCode}`} workspace={workspace} selected={selected} onClose={() => select(null)} />}
    </Stack>
  </Card>
}

function PayablesCurrencyCard({ bucket, onOpen }: { bucket: PayablesBucket; onOpen: () => void }) {
  const { t } = useI18n()
  return <section className="role-dashboard-payables__currency" data-testid={`payables-currency-${bucket.currencyCode}`}>
    <Stack gap={5}>
      <Group justify="space-between" gap={8}>
        <TableChip tone="source" value={bucket.currencyCode} />
        <Button leftSection={<List size={14} />} size="compact-xs" variant="default" onClick={onOpen}>{t('Розшифровка')} · {bucket.rowCount} {t('договорів')}</Button>
      </Group>
      <dl className="role-dashboard-payables__amounts">
        <div><dt>{t('Борг постачальникам')}</dt><dd className="app-money">{formatPayablesAmount(bucket.payable)}</dd></div>
        <div><dt>{t('Аванси постачальникам')}</dt><dd className="app-money">{formatPayablesAmount(bucket.advance)}</dd></div>
      </dl>
      <Text size="xs" c="dimmed">{t('Товари')}: {bucket.goodsRowCount} · {t('Послуги')}: {bucket.serviceRowCount} · {t('Сальдо')}: <span className="app-money">{formatPayablesAmount(bucket.signedBalance)}</span></Text>
      {bucket.unknownRowCount > 0 && <Alert color="yellow">{t('Договорів без підтвердженої суми приходу')}: {bucket.unknownRowCount}. {t('Їх не включено в суми; відкрийте розшифровку.')}</Alert>}
    </Stack>
  </section>
}
