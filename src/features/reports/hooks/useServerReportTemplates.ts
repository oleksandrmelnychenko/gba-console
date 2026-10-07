import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { readSession } from '../../../shared/auth/session'
import { deleteServerReportTemplate, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { getReportTemplateOrderState, orderReportTemplates } from '../api/reportTemplateOrderApi'
import { invalidTemplateOrder, templatesInAuthoritativeOrder, type ReportTemplateOrderCommand,
  type ReportTemplateOrderState } from '../data/reportTemplateOrder'
import { clientComparisonConfigurationError } from '../data/clientPeriodComparison'
import { datasetConfigurationError } from '../data/reportDatasets'
import { valuationConfigurationError } from '../data/reportValuation'
import { reportThresholdError } from '../data/reportThreshold'
import { reportHideZeroError } from '../data/reportHideZero'
import { reportOrderingError } from '../data/reportOrdering'
import { reportFilterExpressionError } from '../data/reportFilterExpression'
import { reportAbcClassificationError } from '../data/reportAbcClassification'
import { reportTopGroupsError } from '../data/reportTopGroups'
import type { ReportDataset, ReportRequestBody, ReportTemplate } from '../types'

export type TemplateMutationResult = { ok: true; template?: ReportTemplate } | { ok: false }

/** Browser variants remain untouched; importing one never sanitizes away its filters. */
export function readBrowserReportTemplates(): ReportTemplate[] {
  try {
    const raw = localStorage.getItem('app_configs_reports_template:v1') ?? localStorage.getItem('app_configs_reports_template')
    const parsed: unknown = raw ? JSON.parse(raw) : []
    const templates = Array.isArray(parsed) ? parsed.filter((item): item is ReportTemplate =>
      !!item && typeof item === 'object' && typeof item.Name === 'string' && !!item.Data,
    ) : []
    return [...new Map(templates.map(item => [JSON.stringify({ Name: item.Name, Data: item.Data }), item])).values()]
  } catch { return [] }
}

export async function browserTemplateImportId(template: ReportTemplate): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify({ Name: template.Name, Data: template.Data }))
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)).slice(0, 16)
  digest[6] = (digest[6] & 15) | 128
  digest[8] = (digest[8] & 63) | 128
  const hex = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function useServerReportTemplates(enabled: boolean, datasets: ReportDataset[] = [], callerKey: string | null = null) {
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [orderingOpened, setOrderingOpened] = useState(false)
  const [orderState, setOrderState] = useState<ReportTemplateOrderState | null>(null)
  const scope = JSON.stringify([enabled, callerKey])
  const [storedScope, setStoredScope] = useState(scope)
  const [loadedScope, setLoadedScope] = useState<string | null>(null)
  const locked = useRef(false)
  const generation = useRef(0)
  const alive = useRef(false)
  const operationController = useRef<AbortController | null>(null)
  const readController = useRef<AbortController | null>(null)
  const orderingRequested = useRef(false)
  const [browserTemplates] = useState(readBrowserReportTemplates)
  if (storedScope !== scope) {
    setStoredScope(scope)
    setReady(false)
    setOrderingOpened(false)
    setOrderState(null)
    setLoadedScope(null)
    setNotice(null)
  }

  const loadList = useCallback(async (signal: AbortSignal) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (callerKey && readSession()?.userNetUid !== callerKey) throw new DOMException('Authentication changed', 'AbortError')
      const definitions = await getServerReportTemplates(signal)
      signal.throwIfAborted()
      const session = readSession() // An ordinary GET may legitimately refresh this owner's CSRF token.
      if (callerKey && session?.userNetUid !== callerKey)
        throw new DOMException('Authentication changed', 'AbortError')
      if (!orderingRequested.current) return { definitions, order: null }
      if (!session?.userNetUid || session.userNetUid !== callerKey) throw invalidTemplateOrder()
      const order = await getReportTemplateOrderState({ session: { userNetUid: session.userNetUid, csrfToken: session.csrfToken }, signal })
      try { return { definitions: templatesInAuthoritativeOrder(definitions, order), order } }
      catch (cause) { if (attempt === 1) throw cause }
    }
    throw invalidTemplateOrder()
  }, [callerKey])

  const reload = useCallback((controller: AbortController) => {
    readController.current?.abort()
    readController.current = controller
    const signal = controller.signal
    const current = ++generation.current
    return loadList(signal).then(result => {
      if (alive.current && current === generation.current && !signal?.aborted) {
        setTemplates(result.definitions)
        setOrderState(result.order)
        setReady(true)
        setLoadedScope(scope)
        setNotice(null)
      }
    }).catch((error: unknown) => {
      if (alive.current && current === generation.current && !signal?.aborted) {
        setReady(false)
        setOrderState(null)
        setNotice(error instanceof Error ? error.message : 'Не вдалося завантажити шаблони.')
      }
    })
  }, [loadList, scope])

  const invalidatePending = useCallback(() => { ++generation.current }, [])

  useEffect(() => {
    alive.current = true
    orderingRequested.current = false
    const controller = new AbortController()
    if (enabled) void reload(controller)
    return () => { alive.current = false; invalidatePending(); controller.abort(); readController.current?.abort(); operationController.current?.abort() }
  }, [enabled, reload, invalidatePending])

  type Operation =
    | { kind: 'save'; name: string; data: ReportRequestBody; id?: string }
    | { kind: 'remove'; id: string; revision?: number }
    | { kind: 'update'; template: ReportTemplate; data: ReportRequestBody }
    | { kind: 'rename'; template: ReportTemplate; name: string }
    | { kind: 'copy'; template: ReportTemplate; name: string }
    | { kind: 'import'; template: ReportTemplate }
    | { kind: 'open-order' }
    | { kind: 'order'; command: ReportTemplateOrderCommand }

  async function runTemplateOperation(operation: Operation): Promise<TemplateMutationResult> {
    if (!enabled || loadedScope !== scope || locked.current || !ready) return { ok: false }
    locked.current = true
    const currentGeneration = ++generation.current // Ignore an earlier list response or a later permission change.
    const isCurrent = () => alive.current && generation.current === currentGeneration
      && (!callerKey || readSession()?.userNetUid === callerKey)
    const controller = new AbortController()
    operationController.current = controller
    setBusy(true)
    async function refreshCommitted(message: string, template?: ReportTemplate): Promise<TemplateMutationResult> {
      try {
        const list = await loadList(controller.signal)
        if (!isCurrent()) return { ok: false }
        setTemplates(list.definitions); setOrderState(list.order); setReady(true); setLoadedScope(scope); setNotice(message)
      } catch {
        if (!isCurrent()) return { ok: false }
        setReady(false); setOrderState(null)
        setNotice(`${message} Не вдалося оновити список. Оновіть його перед наступною дією.`)
      }
      // The mutation is committed even if the following read failed. Never retry the write.
      return template ? { ok: true, template } : { ok: true }
    }
    try {
      if (callerKey && readSession()?.userNetUid !== callerKey) throw invalidTemplateOrder()
      if (operation.kind === 'open-order') {
        orderingRequested.current = true; setOrderingOpened(true); setOrderState(null)
        const list = await loadList(controller.signal)
        if (!isCurrent()) return { ok: false }
        setTemplates(list.definitions); setOrderState(list.order); setReady(true); setNotice(null)
        return { ok: true }
      } else if (operation.kind === 'order') {
        const session = readSession()
        if (!orderingRequested.current || !orderState || !session?.userNetUid || session.userNetUid !== callerKey) throw invalidTemplateOrder()
        templatesInAuthoritativeOrder(templates, orderState)
        if (operation.command.Id && !orderState.Items.some(item => item.Id.toLowerCase() === operation.command.Id?.toLowerCase())) throw invalidTemplateOrder()
        const response = await orderReportTemplates(operation.command, orderState.ListRevision,
          { session: { userNetUid: session.userNetUid, csrfToken: session.csrfToken }, signal: controller.signal })
        if (!isCurrent()) return { ok: false }
        // The accepted order response confirms the write, but cannot replace definitions.
        // Always reload both snapshots; a racing definition update must not turn this into a retryable write failure.
        try { templatesInAuthoritativeOrder(templates, response) } catch { setOrderState(null) }
        return await refreshCommitted('Порядок шаблонів збережено.')
      } else if (operation.kind === 'remove') {
        const existing = templates.find(item => item.Id === operation.id)
        if (!existing) throw new Error('Шаблон недоступний. Оновіть список.')
        if (operation.revision !== undefined && existing.Revision !== operation.revision) throw new Error('Шаблон змінився. Відкрийте його знову перед збереженням змін.')
        controller.signal.throwIfAborted()
        if (!isCurrent()) return { ok: false }
        await deleteServerReportTemplate(existing, controller.signal)
        if (isCurrent()) return await refreshCommitted('Шаблон видалено.')
      } else {
        let request: ReportTemplate
        if (operation.kind === 'import') {
          const id = await browserTemplateImportId(operation.template)
          controller.signal.throwIfAborted()
          if (!isCurrent()) return { ok: false }
          if (templates.some(item => item.Id === id)) throw new Error('Цей шаблон уже імпортовано.')
          request = { ...operation.template, Id: id, Revision: 0 }
        } else if (operation.kind === 'update' || operation.kind === 'rename' || operation.kind === 'copy') {
          const existing = templates.find(item => item.Id === operation.template.Id)
          if (!existing?.Id) throw new Error('Шаблон недоступний. Оновіть список.')
          if (existing.Revision !== operation.template.Revision) throw new Error('Шаблон змінився. Відкрийте його знову перед збереженням змін.')
          request = { Id: operation.kind === 'copy' ? crypto.randomUUID() : existing.Id,
            Revision: operation.kind === 'copy' ? 0 : operation.template.Revision,
            Name: operation.kind === 'update' ? existing.Name : operation.name.trim(),
            Data: structuredClone(operation.kind === 'update' ? operation.data : existing.Data) }
        } else {
          const existing = operation.id ? templates.find(item => item.Id === operation.id) : undefined
          if (operation.id && !existing) throw new Error('Шаблон недоступний. Оновіть список.')
          request = { Id: existing?.Id ?? crypto.randomUUID(), Revision: existing?.Revision ?? 0,
            Name: existing?.Name ?? operation.name.trim(), Data: structuredClone(operation.data) }
        }
        if (!request.Name.trim()) throw new Error('Введіть назву шаблону.')
        const comparisonError = clientComparisonConfigurationError(request.Data, datasets.find(item => item.DataSource === request.Data.dataSource))
        if (comparisonError) throw new Error(comparisonError)
        if (request.Data.dataSource === 12 || request.Data.dataSource === 13 || request.Data.dataSource === 14 || request.Data.dataSource === 15 || request.Data.dataSource === 16 || request.Data.dataSource === 17 || request.Data.dataSource === 18 || request.Data.dataSource === 19 || request.Data.dataSource === 20 || request.Data.dataSource === 21) {
          const activityError = datasetConfigurationError(request.Data, datasets.find(item => item.DataSource === request.Data.dataSource))
          if (activityError) throw new Error(activityError)
        }
        const valuationError = valuationConfigurationError(request.Data)
        if (valuationError) throw new Error(valuationError)
        const abcError = reportAbcClassificationError(request.Data, datasets.find(item => item.DataSource === (request.Data.dataSource ?? 0)))
        if (abcError) throw new Error(abcError)
        const orderingError = reportOrderingError(request.Data, datasets.find(item => item.DataSource === (request.Data.dataSource ?? 0)))
        if (orderingError) throw new Error(orderingError)
        const filterError = reportFilterExpressionError(request.Data, datasets.find(item => item.DataSource === (request.Data.dataSource ?? 0)))
        if (filterError) throw new Error(filterError)
        const topError = reportTopGroupsError(request.Data, datasets.find(item => item.DataSource === (request.Data.dataSource ?? 0)))
        if (topError) throw new Error(topError)
        const thresholdError = reportThresholdError(request.Data, datasets.find(item => item.DataSource === (request.Data.dataSource ?? 0)))
        if (thresholdError) throw new Error(thresholdError)
        const hideZeroError = reportHideZeroError(request.Data, datasets.find(item => item.DataSource === (request.Data.dataSource ?? 0)))
        if (hideZeroError) throw new Error(hideZeroError)
        controller.signal.throwIfAborted()
        if (!isCurrent()) return { ok: false }
        const saved = await saveServerReportTemplate(request, controller.signal)
        if (isCurrent()) {
          const message = operation.kind === 'import' ? 'Шаблон імпортовано. Копія в браузері збережена.'
            : operation.kind === 'rename' ? 'Назву шаблону змінено.'
              : operation.kind === 'copy' ? 'Створено незалежну копію збереженого шаблону.'
                : 'Шаблон збережено на сервері у вашому обліковому записі.'
          return await refreshCommitted(message, saved)
        }
      }
    } catch (error) {
      if (isCurrent() && operation.kind === 'order' && error instanceof ApiError && error.status === 409) {
        try {
          const list = await loadList(controller.signal)
          if (isCurrent()) { setTemplates(list.definitions); setOrderState(list.order); setReady(true) }
        } catch { if (isCurrent()) { setReady(false); setOrderState(null) } }
        if (isCurrent()) setNotice('Список шаблонів змінився. Спробуйте потрібну дію ще раз після оновлення списку.')
      } else if (isCurrent()) {
        if (operation.kind === 'open-order' || operation.kind === 'order') { setOrderState(null); setReady(false) }
        setNotice(operation.kind === 'order'
          ? 'Не вдалося підтвердити зміну порядку. Оновіть список перед наступною дією.'
          : error instanceof Error ? error.message : 'Не вдалося зберегти зміни шаблону.')
      }
    } finally {
      locked.current = false
      setBusy(false)
      if (operationController.current === controller) operationController.current = null
    }
    return { ok: false }
  }

  const save = (name: string, data: ReportRequestBody, id?: string) => runTemplateOperation({ kind: 'save', name, data, id })
  const remove = (id: string, revision?: number) => runTemplateOperation({ kind: 'remove', id, revision })
  const update = (template: ReportTemplate, data: ReportRequestBody) => runTemplateOperation({ kind: 'update', template, data })
  const rename = (template: ReportTemplate, name: string) => runTemplateOperation({ kind: 'rename', template, name })
  const copy = (template: ReportTemplate, name: string) => runTemplateOperation({ kind: 'copy', template, name })
  const importBrowserTemplate = (template: ReportTemplate) => runTemplateOperation({ kind: 'import', template })
  const ordering = {
    opened: enabled && loadedScope === scope && orderingOpened, state: enabled && loadedScope === scope ? orderState : null,
    open: () => runTemplateOperation({ kind: 'open-order' }),
    close: () => { if (!locked.current) { orderingRequested.current = false; setOrderingOpened(false); setOrderState(null) } },
    change: (command: ReportTemplateOrderCommand) => runTemplateOperation({ kind: 'order', command }),
  }

  return { templates: enabled && loadedScope === scope ? templates : [], notice: enabled ? notice : null, busy, ready: enabled && loadedScope === scope && ready, browserTemplates: enabled ? browserTemplates : [], update, rename, copy,
    reload: () => { if (!locked.current && enabled) { setReady(false); void reload(new AbortController()) } }, save, remove, importBrowserTemplate, ordering }
}
