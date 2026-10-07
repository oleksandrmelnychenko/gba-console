import { Button, Loader, Stack, Text } from '@mantine/core'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { getClientReportCapability } from '../api/originalClientReportApi'
import { getPlannedFlowCapability } from '../api/originalPlannedCashFlowApi'
import { isClientReportCatalogueEntry, type ClientCapability } from '../data/originalClientReport'
import { isPlannedFlowCatalogueEntry, type PlannedFlowCapability } from '../data/originalPlannedCashFlow'
import type { ReportCatalogueEntry } from '../types'
import { ReportCapabilityStatus } from './ReportCapabilityStatus'

const ClientPanel = lazy(() => import('./OriginalClientReportPanel').then(module => ({ default: module.OriginalClientReportPanel })))
const FlowPanel = lazy(() => import('./OriginalPlannedCashFlowPanel').then(module => ({ default: module.OriginalPlannedCashFlowPanel })))
type Props = { report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null }
type Kind = 'client' | 'flow'
type Scope = { kind: Kind; present: boolean; enabled: boolean; callerKey: string | null; attempt: number }
type Capability = { kind: 'client'; value: ClientCapability } | { kind: 'flow'; value: PlannedFlowCapability }
type Load = { scope: Scope; capability: Capability | null; failed: boolean }
function useCapability(scope: Scope) {
  const [load, setLoad] = useState<Load | null>(null)
  useEffect(() => {
    if (!scope.present || !scope.enabled || !scope.callerKey) return
    const controller = new AbortController()
    const pending: Promise<Capability> = scope.kind === 'client'
      ? getClientReportCapability(controller.signal).then(value => ({ kind: 'client' as const, value }))
      : getPlannedFlowCapability(controller.signal).then(value => ({ kind: 'flow' as const, value }))
    pending.then(capability => { if (!controller.signal.aborted) setLoad({ scope, capability, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  return load?.scope === scope ? load : null
}
function DefaultModal({ opened, enabled, disabled, capability, scope, close }: { opened: boolean; enabled: boolean; disabled: boolean;
  capability: Capability | null; scope: Scope; close: () => void }) {
  const { t } = useI18n(), today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })
  const title = scope.kind === 'client' ? 'Звіт за клієнтами' : 'Плани руху коштів'
  const props = { callerKey: scope.callerKey, canGenerate: enabled && !disabled, initialFrom: `${today.slice(0, 7)}-01`, initialThrough: today }
  return <AppModal opened={opened && enabled && !!capability} title={t(title)} size={1350} onClose={close}>
    {opened && capability ? <Suspense fallback={<Loader size="sm" />}>{capability.kind === 'client'
      ? <ClientPanel key={JSON.stringify(scope)} capability={capability.value} {...props} />
      : <FlowPanel key={JSON.stringify(scope)} capability={capability.value} {...props} />}</Suspense> : null}
  </AppModal>
}
function DefaultCatalogueLaunch({ report, worlds, enabled, disabled, callerKey, kind }: Props & { kind: Kind }) {
  const { t } = useI18n(), [opened, setOpened] = useState(false), [attempt, setAttempt] = useState(0)
  const present = kind === 'client' ? isClientReportCatalogueEntry(report, worlds) : isPlannedFlowCatalogueEntry(report, worlds)
  const scope = useMemo(() => ({ kind, present, enabled, callerKey, attempt }), [kind, present, enabled, callerKey, attempt])
  const current = useCapability(scope), capability = current?.capability ?? null
  if (!present) return null
  return <Stack gap={6}>
    <ReportCapabilityStatus current={current} enabled={enabled} disabled={disabled} callerKey={callerKey} retry={() => setAttempt(value => value + 1)}
      loadingLabel="Перевірка оригіналу" failureMessage="Не вдалося підтвердити цей оригінал на сервері." />
    <Button disabled={!enabled || disabled || !callerKey || !capability} onClick={() => setOpened(true)}>{t(kind === 'client' ? 'Fenix · Звіт за клієнтами' : 'Fenix · Плани руху коштів')}</Button>
    <Text size="xs" c="dimmed">{t('Повнота синхронізованих даних перевіряється для обраного періоду під час формування.')}</Text>
    <DefaultModal opened={opened} enabled={enabled} disabled={disabled} capability={capability} scope={scope} close={() => setOpened(false)} />
  </Stack>
}
export function OriginalClientReportCatalogueLaunch(props: Props) { return <DefaultCatalogueLaunch {...props} kind="client" /> }
export function OriginalPlannedCashFlowCatalogueLaunch(props: Props) { return <DefaultCatalogueLaunch {...props} kind="flow" /> }
