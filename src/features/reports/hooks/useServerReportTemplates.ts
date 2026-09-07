import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteServerReportTemplate, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { valuationConfigurationError } from '../data/reportValuation'
import { reportOrderingError } from '../data/reportOrdering'
import type { ReportDataset, ReportRequestBody, ReportTemplate } from '../types'

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

export function useServerReportTemplates(enabled: boolean, datasets: ReportDataset[] = []) {
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const locked = useRef(false)
  const generation = useRef(0)
  const alive = useRef(false)
  const [browserTemplates] = useState(readBrowserReportTemplates)

  const reload = useCallback((signal?: AbortSignal) => {
    const current = ++generation.current
    return getServerReportTemplates(signal).then(result => {
      if (alive.current && current === generation.current && !signal?.aborted) {
        setTemplates(result)
        setReady(true)
        setNotice(null)
      }
    }).catch((error: unknown) => {
      if (alive.current && current === generation.current && !signal?.aborted) {
        setReady(false)
        setNotice(error instanceof Error ? error.message : 'Не вдалося завантажити шаблони.')
      }
    })
  }, [])

  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    if (enabled) void reload(controller.signal)
    return () => { alive.current = false; controller.abort() }
  }, [enabled, reload])

  type Operation =
    | { kind: 'save'; name: string; data: ReportRequestBody; id?: string }
    | { kind: 'remove'; id: string }
    | { kind: 'import'; template: ReportTemplate }

  async function runTemplateOperation(operation: Operation) {
    if (!enabled || locked.current || !ready) return
    locked.current = true
    ++generation.current // Ignore a list response started before this mutation.
    setBusy(true)
    try {
      if (operation.kind === 'remove') {
        const existing = templates.find(item => item.Id === operation.id)
        if (!existing) throw new Error('Шаблон недоступний. Оновіть список.')
        await deleteServerReportTemplate(existing)
        if (alive.current) {
          setTemplates(current => current.filter(item => item.Id !== operation.id))
          setNotice('Шаблон видалено.')
        }
      } else {
        let request: ReportTemplate
        if (operation.kind === 'import') {
          const id = await browserTemplateImportId(operation.template)
          if (templates.some(item => item.Id === id)) throw new Error('Цей шаблон уже імпортовано.')
          request = { ...operation.template, Id: id, Revision: 0 }
        } else {
          const existing = operation.id ? templates.find(item => item.Id === operation.id) : undefined
          if (operation.id && !existing) throw new Error('Шаблон недоступний. Оновіть список.')
          request = { Id: existing?.Id ?? crypto.randomUUID(), Revision: existing?.Revision ?? 0,
            Name: existing?.Name ?? operation.name.trim(), Data: operation.data }
        }
        const valuationError = valuationConfigurationError(request.Data)
        if (valuationError) throw new Error(valuationError)
        const orderingError = reportOrderingError(request.Data, datasets.find(item => item.DataSource === (request.Data.dataSource ?? 0)))
        if (orderingError) throw new Error(orderingError)
        const saved = await saveServerReportTemplate(request)
        if (alive.current) {
          setTemplates(current => [...current.filter(item => item.Id !== saved.Id), saved])
          setNotice(operation.kind === 'import' ? 'Шаблон імпортовано. Копія в браузері збережена.'
            : 'Шаблон збережено на сервері у вашому обліковому записі.')
        }
      }
    } catch (error) {
      if (alive.current) setNotice(error instanceof Error ? error.message : 'Не вдалося зберегти зміни шаблону.')
    } finally {
      locked.current = false
      setBusy(false)
    }
  }

  const save = (name: string, data: ReportRequestBody, id?: string) => runTemplateOperation({ kind: 'save', name, data, id })
  const remove = (id: string) => runTemplateOperation({ kind: 'remove', id })
  const importBrowserTemplate = (template: ReportTemplate) => runTemplateOperation({ kind: 'import', template })

  return { templates, notice, busy, ready, browserTemplates, reload: () => { if (!locked.current && enabled) void reload() }, save, remove, importBrowserTemplate }
}
