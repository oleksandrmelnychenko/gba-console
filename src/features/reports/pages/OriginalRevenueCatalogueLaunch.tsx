import { Button, Loader, Stack, Text } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getOriginalRevenueCapabilities } from '../api/originalRevenueApi'
import { isOriginalRevenueCatalogueEntry, type OriginalRevenueCapabilities } from '../data/originalRevenue'
import type { ReportCatalogueEntry } from '../types'

export function OriginalRevenueCatalogueLaunch({ report, enabled, disabled, onOpen }: {
  report: ReportCatalogueEntry
  enabled: boolean
  disabled: boolean
  onOpen: (capability: OriginalRevenueCapabilities) => boolean
}) {
  const { t } = useI18n()
  const [attempt, setAttempt] = useState(0)
  const availableSource = isOriginalRevenueCatalogueEntry(report)
  const scope = useMemo(() => ({ enabled, availableSource, attempt }), [enabled, availableSource, attempt])
  const [load, setLoad] = useState<{ scope: typeof scope; capability: OriginalRevenueCapabilities | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.enabled || !scope.availableSource) return
    const controller = new AbortController()
    getOriginalRevenueCapabilities(controller.signal).then(capability => {
      if (!controller.signal.aborted) setLoad({ scope, capability, failed: false })
    }).catch(() => {
      if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true })
    })
    return () => controller.abort()
  }, [scope])
  if (!availableSource) return null
  const current = load?.scope === scope ? load : null
  const executable = current?.capability?.Executable === true
  return <Stack gap={6} role="group" aria-label={t('Оригінальний конструктор виручки')}>
    {enabled && !current ? <Loader size="xs" aria-label={t('Перевірка доступності конструктора')} /> : null}
    {!enabled ? <Text size="xs" c="dimmed">{t('Для цього конструктора потрібне право формування звітів.')}</Text>
      : current?.failed ? <><Text size="xs" c="dimmed">{t('Не вдалося перевірити доступність конструктора.')}</Text>
        <Button type="button" variant="subtle" size="compact-xs" disabled={disabled} onClick={() => setAttempt(value => value + 1)}>{t('Повторити')}</Button></>
        : current && !executable ? <Text size="xs" c="dimmed">{t('Сервер ще не підтримує формування цього конструктора.')}</Text> : null}
    <Button type="button" variant="filled" disabled={!enabled || disabled || !executable}
      onClick={() => { if (enabled && !disabled && current?.capability?.Executable) onOpen(current.capability) }}>
      {t('Відкрити оригінальний конструктор')}
    </Button>
  </Stack>
}
