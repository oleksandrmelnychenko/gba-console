import { Button, Loader, Stack, Text } from '@mantine/core'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { getFenixDiscountCapability } from '../api/originalFenixDiscountAnalysisApi'
import { isFenixDiscountCatalogueEntry, type FenixDiscountCapability } from '../data/originalFenixDiscountAnalysis'
import type { ReportCatalogueEntry } from '../types'
const Panel = lazy(() => import('./OriginalFenixDiscountAnalysisPanel').then(module => ({ default: module.OriginalFenixDiscountAnalysisPanel })))
type Scope = { present: boolean; enabled: boolean; callerKey: string | null; attempt: number }
function useFenixCapability(scope: Scope) {
  const [load, setLoad] = useState<{ scope: Scope; capability: FenixDiscountCapability | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.present || !scope.enabled || !scope.callerKey) return
    const controller = new AbortController()
    getFenixDiscountCapability(controller.signal).then(capability => { if (!controller.signal.aborted) setLoad({ scope, capability, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  return load?.scope === scope ? load : null
}
function FenixCapabilityStatus({ current, enabled, callerKey, disabled, retry }: {
  current: { failed: boolean } | null; enabled: boolean; callerKey: string | null; disabled: boolean; retry: () => void
}) {
  const { t } = useI18n()
  return <>{!current && enabled && callerKey ? <Loader size="xs" aria-label={t('Перевірка API аналізу знижок Fenix')} /> : null}
    {enabled && !callerKey ? <Text size="xs">{t('Для формування потрібен чинний сеанс користувача.')}</Text> : null}
    {current?.failed ? <><Text size="xs">{t('Не вдалося перевірити API аналізу знижок Fenix.')}</Text><Button variant="subtle" disabled={disabled} onClick={retry}>{t('Повторити')}</Button></> : null}</>
}
export function OriginalFenixDiscountAnalysisCatalogueLaunch({ report, worlds, enabled, disabled, callerKey }: {
  report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null
}) {
  const { t } = useI18n(), [attempt, setAttempt] = useState(0), [opened, setOpened] = useState(false)
  const present = isFenixDiscountCatalogueEntry(report, worlds)
  const scope = useMemo(() => ({ present, enabled, callerKey, attempt }), [present, enabled, callerKey, attempt]), current = useFenixCapability(scope), capability = current?.capability ?? null
  if (!present) return null
  const allowed = enabled && !disabled && !!callerKey && !!capability?.Executable
  return <Stack gap={6}><FenixCapabilityStatus current={current} enabled={enabled} callerKey={callerKey} disabled={disabled} retry={() => setAttempt(n => n + 1)} />
    <Button disabled={!allowed} onClick={() => setOpened(true)}>{t('Fenix · Аналіз знижок і націнок')}</Button>
    <Text size="sm" c="dimmed">{t('Форма власного оригіналу без відборів. Поточні дані перевіряються під час формування; відбори назв ще недоступні.')}</Text>
    <AppModal opened={opened && allowed} title={t('Fenix · Аналіз знижок і націнок')} size={1250} onClose={() => setOpened(false)} closeButtonProps={{ 'aria-label': t('Закрити аналіз знижок Fenix') }}>
      {opened && allowed && capability ? <Suspense fallback={<Loader size="sm" />}><Panel key={JSON.stringify(scope)} capability={capability} callerKey={callerKey} canGenerate={allowed}
        initialThrough={new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })} /></Suspense> : null}
    </AppModal></Stack>
}
