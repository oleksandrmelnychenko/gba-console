import { Button, Loader, Stack, Text } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getOriginalBuyerSalesShareCapabilities } from '../api/originalBuyerSalesShareApi'
import { originalBuyerSalesShareCatalogueVariant, type OriginalBuyerSalesShareCapabilities } from '../data/originalBuyerSalesShare'
import type { ReportCatalogueEntry } from '../types'

export function OriginalBuyerSalesShareCatalogueLaunch({ report, enabled, disabled, onOpen }: {
  report: ReportCatalogueEntry
  enabled: boolean
  disabled: boolean
  onOpen: (capability: OriginalBuyerSalesShareCapabilities) => boolean
}) {
  const { t } = useI18n()
  const [attempt, setAttempt] = useState(0)
  const variant = originalBuyerSalesShareCatalogueVariant(report)
  const availableSource = variant !== null
  const scope = useMemo(() => ({ enabled, availableSource, variant, attempt }), [enabled, availableSource, variant, attempt])
  const [load, setLoad] = useState<{ scope: typeof scope; capability: OriginalBuyerSalesShareCapabilities | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.enabled || !scope.availableSource || scope.variant === null) return
    const controller = new AbortController()
    getOriginalBuyerSalesShareCapabilities(scope.variant, controller.signal).then(capability => {
      if (!controller.signal.aborted) setLoad({ scope, capability, failed: false })
    }).catch(() => {
      if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true })
    })
    return () => controller.abort()
  }, [scope])
  if (!availableSource) return null
  const current = load?.scope === scope ? load : null
  const executable = current?.capability?.Executable === true
  return <Stack gap={6} role="group" aria-label={t('Оригінальний конструктор частки продажів')}>
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
