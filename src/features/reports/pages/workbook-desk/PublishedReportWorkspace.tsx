import { publishedReportTabs, type PublishedReportTab } from './publishedReportTabs'
import { Alert, Button, Loader, Stack, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { getReportCatalogue } from '../../api/reportWorkspaceApi'
import { getOneCTurnoverScopes } from '../../api/reportsApi'
import { getMovementCapability, getMovementPublications } from '../../api/originalWarehouseMovementApi'
import { isOneCTurnoverCatalogueChoice } from '../../data/reportCatalogueLaunch'
import { isOrganizationOnlyTurnoverScope, ORGANIZATION_ONLY_TURNOVER_CHOICE } from '../../data/oneCTurnoverScopes'
import { isMovementCapability, isWarehouseMovementCatalogueEntry, type MovementPublication } from '../../data/originalWarehouseMovement'
import type { OneCTurnoverScopeSummary } from '../../types'
import { OneCTurnoverResponsiblesPanel } from '../OneCTurnoverResponsiblesPanel'
import { OriginalWarehouseMovementPanel } from '../OriginalWarehouseMovementPanel'

type Content = { kind: 'responsibles'; scope: OneCTurnoverScopeSummary } | { kind: 'movement'; publications: MovementPublication[] }

/** Mounted on first visit; hidden tabs retain their own dates and applied result. */
export function PublishedReportWorkspace({ tab, callerKey, onBusyChange }: {
  tab: PublishedReportTab; callerKey: string; onBusyChange: (busy: boolean) => void
}) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ attempt: number; content?: Content; error?: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    async function load(): Promise<Content> {
      const catalogue = await getReportCatalogue(controller.signal)
      if (tab === 'responsibles') {
        if (!isOneCTurnoverCatalogueChoice(catalogue, ORGANIZATION_ONLY_TURNOVER_CHOICE)) throw new Error('Продажі за відповідальними недоступні в поточному каталозі.')
        const scopes = (await getOneCTurnoverScopes(controller.signal)).filter(isOrganizationOnlyTurnoverScope)
        if (scopes.length !== 1) throw new Error(scopes.length ? 'Не вдалося однозначно визначити опубліковане покриття продажів.' : 'Продажі за відповідальними: покриття чотирьох організацій ще не опубліковано.')
        return { kind: tab, scope: scopes[0] }
      }
      if (!catalogue.Reports.some(report => isWarehouseMovementCatalogueEntry(report, ['fenix']))) throw new Error('Рух товару недоступний у поточному каталозі.')
      const [capability, publications] = await Promise.all([getMovementCapability(controller.signal), getMovementPublications(controller.signal)])
      if (!isMovementCapability(capability)) throw new Error('Сервер не підтримує цей звіт руху товару.')
      if (!publications.length) throw new Error('Рух товару: опублікованих даних ще немає.')
      return { kind: tab, publications }
    }
    void load().then(content => { if (!controller.signal.aborted) setResult({ attempt, content }) })
      .catch(failure => { if (!controller.signal.aborted) setResult({ attempt, error: failure instanceof Error ? failure.message : 'Не вдалося завантажити звіт.' }) })
    return () => controller.abort()
  }, [tab, callerKey, attempt])
  const current = result?.attempt === attempt ? result : null
  const title = publishedReportTabs.find(item => item.key === tab)?.title ?? 'Звіт'
  return <section className="published-report-workspace" aria-label={title}>
    <Stack gap="md">
      {!current ? <div role="status"><Loader size="sm" /><Text>Перевіряємо доступні дані звіту…</Text></div>
        : current.error ? <Alert color="yellow"><Text>{current.error}</Text><Button type="button" variant="default" mt="xs" onClick={() => setAttempt(value => value + 1)}>Повторити перевірку</Button></Alert>
        : current.content?.kind === 'responsibles' ? <OneCTurnoverResponsiblesPanel scope={current.content.scope} callerKey={callerKey} canGenerate onBusyChange={onBusyChange} />
        : current.content?.kind === 'movement' ? <OriginalWarehouseMovementPanel publications={current.content.publications} callerKey={callerKey} canGenerate onBusyChange={onBusyChange} /> : null}
    </Stack>
  </section>
}
