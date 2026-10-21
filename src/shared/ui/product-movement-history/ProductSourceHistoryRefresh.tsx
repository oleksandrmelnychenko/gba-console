import { Alert, Button, Group, Text } from '@mantine/core'
import { useEffect, useEffectEvent, useReducer, useState } from 'react'
import { apiRequest } from '../../api/apiClient'
import { useI18n } from '../../i18n/useI18n'

export type ProductSourceHistoryStatus = {
  Enabled: boolean
  State: 'queued' | 'running' | 'ready' | 'missing' | 'failed' | 'partial' | 'disabled'
  Products: Array<{
    ProductNetId: string
    State: string
    Error?: string | null
    Sources: Array<{
      SourceSystem: string
      RefreshedAtUtc?: string | null
      RowCount: number
      CoverageFromUtc?: string | null
      CoverageToExclusiveUtc?: string | null
    }>
  }>
}

const statusLabels = {
  queued: 'Історія 1С очікує оновлення', running: 'Завантажується історія 1С',
  ready: 'Історію 1С оновлено', missing: 'Історія 1С ще не завантажена',
  failed: 'Не вдалося оновити історію 1С. Показано попередні дані.',
  partial: 'Історію 1С оновлено частково. Деякі джерела недоступні.',
  disabled: 'Оновлення історії 1С вимкнено. Показано збережені дані.',
} as const

export function ProductSourceHistoryRefresh({
  productNetId, includeSiblings = false, active = true, onRefreshed,
}: {
  productNetId?: string | null
  includeSiblings?: boolean
  active?: boolean
  onRefreshed: () => void
}) {
  const { t } = useI18n()
  const scope = `${productNetId || ''}|${includeSiblings}`
  const [request, refresh] = useReducer((previous: { scope: string; revision: number }, nextScope: string) => ({
    scope: nextScope, revision: previous.revision + 1,
  }), { scope: '', revision: 0 })
  const [result, setResult] = useState<{ scope: string; status?: ProductSourceHistoryStatus; error?: string; revision: number } | null>(null)
  const onReady = useEffectEvent(onRefreshed)
  const current = result?.scope === scope ? result : null
  const status = current?.status
  const busy = active && (current?.revision !== request.revision
    || (!current?.error && (!status || status.State === 'queued' || status.State === 'running')))

  useEffect(() => {
    if (!active || !productNetId) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const query = { productNetId, includeSiblings }
    async function load(initial: boolean) {
      try {
        const next = await apiRequest<ProductSourceHistoryStatus>(
          `/consignments/info/assortment/history/${initial ? 'refresh' : 'status'}`,
          {
            method: initial ? 'POST' : 'GET', signal: controller.signal,
            query: initial ? { ...query, force: request.scope === scope && request.revision > 0 } : query,
            errorMessages: { default: 'Не вдалося оновити історію 1С', network: 'Сервер історії 1С недоступний' },
          },
        )
        if (controller.signal.aborted) return
        if (!next || !Array.isArray(next.Products) || !(next.State in statusLabels)) {
          throw new Error('Не вдалося отримати статус історії 1С')
        }
        setResult({ scope, status: next, revision: request.revision })
        if (next.State === 'queued' || next.State === 'running') timer = setTimeout(() => { void load(false) }, 2000)
        else if (next.State === 'ready' || next.State === 'partial') onReady()
      } catch (error) {
        if (!controller.signal.aborted) setResult((previous) => ({
          scope, revision: request.revision, status: previous?.scope === scope ? previous.status : undefined,
          error: error instanceof Error ? error.message : 'Не вдалося оновити історію 1С',
        }))
      }
    }
    void load(true)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [active, includeSiblings, productNetId, request, scope])

  if (!active || !productNetId) return null
  const refreshedDates = status?.Products.flatMap((product) => product.Sources)
    .map((source) => source.RefreshedAtUtc).filter((value): value is string => Boolean(value)) || []
  // Oldest timestamp avoids describing partially stale sources as freshly synchronized.
  const oldest = refreshedDates.sort()[0]
  const errors = status?.Products.map((product) => product.Error).filter(Boolean).join('; ')
  const hasNoSourceBinding = Boolean(status?.Products.length && status.Products.every((product) => product.Sources.length === 0))
  const warning = current?.error || (status && ['failed', 'partial'].includes(status.State))
  return (
    <Group gap="xs" p="xs" wrap="wrap">
      {!hasNoSourceBinding && <Button size="xs" variant="default" loading={busy} disabled={status?.Enabled === false}
        onClick={() => refresh(scope)}>{t('Оновити історію 1С')}</Button>}
      <Text size="xs" c="dimmed" role="status">
        {hasNoSourceBinding ? t('Товар не має прив’язки до 1С') : current?.error ? t(statusLabels.failed) : status ? t(statusLabels[status.State]) : t('Перевірка історії 1С')}
        {oldest ? ` · ${t('Дані від')}: ${new Date(oldest).toLocaleString('uk-UA')}` : ''}
      </Text>
      {warning ? <Alert color="yellow" p="xs">{current?.error || errors || t(statusLabels[status!.State])}</Alert> : null}
    </Group>
  )
}
