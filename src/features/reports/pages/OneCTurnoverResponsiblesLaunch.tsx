import { Button, Stack, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { getOneCTurnoverScopes } from '../api/reportsApi'
import { isOneCTurnoverCatalogueChoice } from '../data/reportCatalogueLaunch'
import { isOrganizationOnlyTurnoverScope, ORGANIZATION_ONLY_TURNOVER_CHOICE } from '../data/oneCTurnoverScopes'
import type { OneCTurnoverScopeSummary, ReportCatalogue } from '../types'

export type OpenTurnoverResponsibles = (scope: OneCTurnoverScopeSummary, catalogue: ReportCatalogue) => boolean

type Props = { catalogue: ReportCatalogue; canGenerate: boolean; disabled: boolean; callerKey: string | null; onOpen?: OpenTurnoverResponsibles }
export function OneCTurnoverResponsiblesLaunch({ catalogue, canGenerate, disabled, callerKey, onOpen }: Props) {
  const authorized = canGenerate && !!onOpen && isOneCTurnoverCatalogueChoice(catalogue, ORGANIZATION_ONLY_TURNOVER_CHOICE)
  const [attempt, setAttempt] = useState(0)
  const requestKey = JSON.stringify([callerKey, authorized, attempt])
  const [result, setResult] = useState<{ key: string; scope: OneCTurnoverScopeSummary | null; error: boolean } | null>(null)
  useEffect(() => {
    if (!authorized) return
    const controller = new AbortController()
    getOneCTurnoverScopes(controller.signal).then(items => {
      if (controller.signal.aborted) return
      const scopes = items.filter(isOrganizationOnlyTurnoverScope)
      setResult({ key: requestKey, scope: scopes.length === 1 ? scopes[0] : null, error: scopes.length > 1 })
    }).catch(() => { if (!controller.signal.aborted) setResult({ key: requestKey, scope: null, error: true }) })
    return () => controller.abort()
  }, [authorized, requestKey])
  if (!authorized) return null
  const current = result?.key === requestKey ? result : null
  return <Stack gap={2}>
    {current?.scope ? <Button size="compact-sm" variant="default" disabled={disabled}
      onClick={event => { event.stopPropagation(); if (!disabled && current?.scope) onOpen?.(current.scope, catalogue) }}>Продажі за відповідальними</Button> : null}
    {!current ? <Text size="xs">Перевіряємо покриття продажів за відповідальними…</Text> : null}
    {current && !current.scope ? <>
      <Text size="xs">{current.error ? 'Не вдалося перевірити опубліковане покриття продажів.' : 'Продажі за відповідальними: покриття чотирьох організацій ще не опубліковано.'}</Text>
      <Button size="compact-xs" variant="subtle" disabled={disabled} onClick={() => setAttempt(value => value + 1)}>Оновити покриття продажів</Button>
    </> : null}
  </Stack>
}
