import { PartialCoverageLine } from '../../../shared/ui/product-movement-history/PartialCoverageLine'
import { PhysicalQuantityExceptionLine } from '../../../shared/ui/product-movement-history/PhysicalQuantityExceptionNotice'
import { deskCount } from '../data/reportCountPresentation'
import { ActionIcon, Alert, Button, Checkbox, Group, NumberInput, Select, Stack, Table, Text, Textarea, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, MonitorPlay, Plus, X } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { TableChip } from '../../../shared/ui/TableChip'
import '../../../shared/ui/paginator/paginator.css'
import {
  exportStockMovement, getStockMovementCapability, getStockMovementMeasureUnits, getStockMovementOrganizations, getStockMovementWarehouses, previewStockMovement,
  searchStockMovementGroups, searchStockMovementManufacturers, searchStockMovementProducts,
} from '../api/warehouseStockMovementApi'
import {
  buildStockMovementRequest, copyStockMovementRow, stockMovementExpressionView, defaultStockMovementDraft, STOCK_MOVEMENT_FILTER_DEFINITIONS, STOCK_MOVEMENT_FILTER_FIELDS, displayDate, displayDateTime, formatStockQuantity, moveLevel,
  STOCK_MOVEMENT_ARTICLE_CONDITIONS, STOCK_MOVEMENT_ARTICLE_MATCHES, STOCK_MOVEMENT_COMPARISON_LABELS, STOCK_MOVEMENT_COMPARISONS, stockMovementSearchKey, stockMovementTypedText,
  STOCK_MOVEMENT_LEVEL_LABELS, STOCK_MOVEMENT_LEVELS, STOCK_MOVEMENT_MEASURE_LABELS, STOCK_MOVEMENT_MEASURES, STOCK_MOVEMENT_UNCONFIRMED_CELL_NOTE, STOCK_MOVEMENT_UNCONFIRMED_TOTAL_NOTE, STOCK_MOVEMENT_UNKNOWN_CELL_NOTE, STOCK_MOVEMENT_UNKNOWN_TOTAL_NOTE, stockMovementDraftError,
  stockMovementPeriodPresets, summarizeStockMovementFilters, toggleLevel, WAREHOUSE_STOCK_MOVEMENT_PAGE_SIZE, WAREHOUSE_STOCK_MOVEMENT_TITLE,
  type StockMovementArticleMatch, type StockMovementCapability, type StockMovementComparison, type StockMovementDraft,
  type StockMovementExport, type StockMovementLevel, type StockMovementLookupItem, type StockMovementMeasure, type StockMovementQuantity,
  type StockMovementRequest, type StockMovementResult, type StockMovementSelection, type StockMovementFilterField, type StockMovementFilterRow,
} from '../data/warehouseStockMovement'
import { searchCustomerGroupTop } from '../api/customerGroupTopApi'
import { droppedSettingsLine, movementDraftFromHistory, type ReportHistoryAction } from '../data/reportHistory'
import { groupCanonicalFilterOptions } from '../data/reportFilterFields'
import { ConstructorFilters } from './constructor-desk/ConstructorFilters'
import { ReportFilterExpressionPanel } from './ReportFilterExpressionPanel'
import { removeFilterSelection } from '../data/reportFilterExpression'
import { TableRowAction } from '../../../shared/ui/table-row-action/TableRowAction'
import { ReportFilterRow } from './ReportFilterRow'
import { ReportValuePicker } from './ReportValuePicker'
import { REPORT_VALUE_LOOKUP_FAILED, useReportValueSearch } from './reportValueSearch'
import { ReportTableScrollArea } from './ReportTableScrollArea'
import { WorkbookPeriodField, WorkbookSettings } from './workbook-desk/WorkbookSettings'
import './warehouse-stock-movement.css'

export type MovementHistoryRun = { token: number; action: ReportHistoryAction; request: StockMovementRequest
  products: StockMovementLookupItem[]; groups: StockMovementLookupItem[]; storedNames?: Partial<Record<string, Record<string, string>>> }
type Props = { callerKey: string | null; canGenerate: boolean; onBusyChange?: (busy: boolean) => void; history?: MovementHistoryRun | null }
type Setup = { capability: StockMovementCapability; warehouses: StockMovementLookupItem[]; organizations: StockMovementLookupItem[] }
type Run = { request: StockMovementRequest; result: StockMovementResult }


const measureKey: Record<StockMovementMeasure, keyof StockMovementQuantity> = {
  opening: 'Opening', incoming: 'Incoming', outgoing: 'Outgoing', closing: 'Closing',
}

function errorText(failure: unknown, fallback: string): string {
  if (failure instanceof ApiError && [401, 403].includes(failure.status)) return 'Немає права формування звітів по складу.'
  return failure instanceof Error && failure.message ? failure.message : fallback
}

function useLookupSearch(search: (query: string, signal: AbortSignal) => Promise<StockMovementLookupItem[]>, enabled: boolean) {
  const { search: query, setSearch: setQuery, query: debounced, pending } = useReportValueSearch()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ key: string; items: StockMovementLookupItem[]; failed: boolean }>({ key: '', items: [], failed: false })
  const term = debounced.trim()
  const key = `${attempt}:${term}`
  useEffect(() => {
    if (!enabled || !term) return
    const controller = new AbortController()
    search(term, controller.signal)
      .then(items => { if (!controller.signal.aborted) setState({ key, items, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setState({ key, items: [], failed: true }) })
    return () => controller.abort()
  }, [term, key, enabled, search])
  const settled = !term || state.key === key
  return { query, setQuery, items: term && settled && !pending ? state.items : [], failed: !!term && settled && !pending && state.failed,
    loading: !!query.trim() && pending || !settled, retry: () => setAttempt(value => value + 1) }
}

function SelectionPicker({ label, placeholder, selected, lookup, enabled, disabled, onChange }: {
  label: string; placeholder: string; selected: StockMovementSelection[]; disabled: boolean; enabled: boolean
  lookup: (query: string, signal: AbortSignal) => Promise<StockMovementLookupItem[]>; onChange: (value: StockMovementSelection[]) => void
}) {
  const search = useLookupSearch(lookup, enabled)
  const options = search.items.map(item => ({ value: String(item.Id), label: item.Detail ? `${item.Name} — ${item.Detail}` : item.Name }))
  const chosen = selected.map(item => ({ value: String(item.id), label: item.label }))
  return <ReportValuePicker mode="multi" label={label} placeholder={placeholder} data={options} selected={chosen}
    search={search.query} onSearchChange={search.setQuery} loading={search.loading} disabled={disabled}
    emptyMessage={search.query.trim() ? undefined : 'Почніть вводити назву'}
    lookupError={search.failed ? REPORT_VALUE_LOOKUP_FAILED : undefined} onRetry={search.retry}
    onChange={values => onChange(values.map(value => ({ id: Number(value), label: [...options, ...chosen].find(option => option.value === value)?.label ?? value })))} />
}

function ListPicker({ label, placeholder, data, value, disabled, failed, onRetry, onChange }: {
  label: string; placeholder: string; data: { value: string; label: string }[]; value: string[]; disabled: boolean
  failed?: boolean; onRetry?: () => void
  onChange: (value: string[]) => void
}) {
  const [search, setSearch] = useState('')
  return <ReportValuePicker mode="multi" remote={false} label={label} placeholder={placeholder} data={data}
    selected={value.map(key => data.find(option => option.value === key) ?? { value: key, label: key })}
    lookupError={failed ? REPORT_VALUE_LOOKUP_FAILED : undefined} onRetry={onRetry}
    search={search} onSearchChange={setSearch} disabled={disabled} onChange={onChange} />
}

function nextRowId(rows: readonly StockMovementFilterRow[]): number {
  return rows.reduce((maximum, row) => Math.max(maximum, row.id), 0) + 1
}

function lookupLabel(item: StockMovementLookupItem): string {
  return item.Name
}

function movementFieldOptions(used: ReadonlySet<StockMovementFilterField | null>, listed: boolean) {
  const movementLabel = (item: { value: string; label: string }) => STOCK_MOVEMENT_FILTER_DEFINITIONS[item.value as StockMovementFilterField]?.label ?? item.label
  return groupCanonicalFilterOptions(undefined, STOCK_MOVEMENT_FILTER_FIELDS.filter(field => listed || field !== 'manufacturer').map(field => {
    const definition = STOCK_MOVEMENT_FILTER_DEFINITIONS[field]
    return { value: field, label: definition.label, section: definition.section, disabled: used.has(field), field: { Type: definition.type } }
  })).map(entry => 'group' in entry ? { ...entry, items: entry.items.map(item => ({ ...item, label: movementLabel(item) })) } : { ...entry, label: movementLabel(entry) })
}

function useMovementList<T>(enabled: boolean, load: (signal: AbortSignal) => Promise<T[]>) {
  const [state, setState] = useState<{ items: T[]; failed: boolean; attempt: number; loaded?: boolean }>({ items: [], failed: false, attempt: 0 })
  const loader = useEffectEvent(load)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    loader(controller.signal).then(items => {
      if (!controller.signal.aborted) setState(current => ({ ...current, items, failed: false, loaded: true }))
    }).catch(() => {
      if (!controller.signal.aborted) setState(current => ({ ...current, failed: true, loaded: true }))
    })
    return () => controller.abort()
  }, [enabled, state.attempt])
  return { items: state.items, failed: state.failed, loaded: state.loaded === true, retry: () => setState(current => ({ ...current, failed: false, attempt: current.attempt + 1 })) }
}

function useMovementAttributes(enabled: boolean) {
  const tops = useMovementList(enabled, async signal => {
    const codes: string[] = []
    for (let offset = 0; offset <= 10000; offset += 30) {
      const page = await searchCustomerGroupTop('', offset, signal)
      codes.push(...page)
      if (page.length < 30) break
    }
    return codes
  })
  const units = useMovementList(enabled, signal => getStockMovementMeasureUnits(signal))
  return { tops: tops.items, topsFailed: tops.failed, retryTops: tops.retry, units: units.items, unitsFailed: units.failed, retryUnits: units.retry,
    loaded: tops.loaded && units.loaded }
}

function QuantityCell({ value, negativeRed, reason }: { value: number | null; negativeRed: boolean; reason: string }) {
  return <Table.Td className="app-table-cell-number" data-negative={negativeRed && value !== null && value < 0 ? 'true' : undefined}
    title={value === null ? reason : undefined}>{formatStockQuantity(value)}</Table.Td>
}

function ResultTable({ run, draftMeasures, negativeRed, grandTotals, busy, onPage }: {
  run: Run; draftMeasures: readonly StockMovementMeasure[]; negativeRed: boolean; grandTotals: boolean; busy: boolean; onPage: (offset: number) => void
}) {
  const { result, request } = run
  const measures = STOCK_MOVEMENT_MEASURES.filter(measure => request.Measures.includes(measure) && draftMeasures.includes(measure))
  const deepest = request.Levels.length - 1
  const articles = request.Levels.includes('product')
  const start = result.Offset, end = result.Offset + result.Rows.length
  const totalUnknown = grandTotals && measures.some(measure => result.Totals[measureKey[measure]] === null)
  const totalNote = result.PhysicalQuantityExceptions?.length ? STOCK_MOVEMENT_UNCONFIRMED_TOTAL_NOTE : STOCK_MOVEMENT_UNKNOWN_TOTAL_NOTE
  return <Stack gap="xs">
    <ReportTableScrollArea minWidth={760} label={WAREHOUSE_STOCK_MOVEMENT_TITLE}>
      <Table className="app-static-table published-movement__table stock-movement__table" aria-label={WAREHOUSE_STOCK_MOVEMENT_TITLE}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th className="stock-movement__label-head">{request.Levels.map(level => <span key={level}>{STOCK_MOVEMENT_LEVEL_LABELS[level]}</span>)}</Table.Th>
            {articles ? <Table.Th>Артикул</Table.Th> : null}
            {measures.map(measure => <Table.Th key={measure} className="app-table-cell-number">{STOCK_MOVEMENT_MEASURE_LABELS[measure]}<br /><span className="stock-movement__unit">Кількість</span></Table.Th>)}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {result.Rows.map(row => <Table.Tr key={row.Index} data-summary={row.Depth < deepest || undefined} data-level={row.Level}>
            <Table.Td>
              <div className="stock-movement__label" style={{ paddingLeft: row.Depth * 16 }}>
                {row.Level === 'warehouse' ? <TableChip tone="storage" value={row.Label} />
                  : row.Level === 'product' ? <TableChip tone="product" value={row.Label} />
                  : row.Level === 'registrar' ? <span className="stock-movement__registrar" title={[row.Counterparty, row.Organization].filter(Boolean).join(' · ') || undefined}>
                    {row.Label}</span>
                  : <span>{row.Label}</span>}
              </div>
            </Table.Td>
            {articles ? <Table.Td>{row.Level === 'product' ? row.Article ?? '' : ''}</Table.Td> : null}
            {measures.map(measure => <QuantityCell key={measure} value={row.Quantity[measureKey[measure]]} negativeRed={negativeRed}
              reason={row.QuantityStatus === 'unconfirmed_batch' ? STOCK_MOVEMENT_UNCONFIRMED_CELL_NOTE : STOCK_MOVEMENT_UNKNOWN_CELL_NOTE} />)}
          </Table.Tr>)}
        </Table.Tbody>
        {grandTotals ? <Table.Tfoot>
          <Table.Tr>
            <Table.Th colSpan={articles ? 2 : undefined}>Підсумок</Table.Th>
            {measures.map(measure => <Table.Th key={measure} className="app-table-cell-number"
              data-negative={negativeRed && (result.Totals[measureKey[measure]] ?? 0) < 0 ? 'true' : undefined}
              title={result.Totals[measureKey[measure]] === null ? totalNote : undefined}>{formatStockQuantity(result.Totals[measureKey[measure]])}</Table.Th>)}
          </Table.Tr>
        </Table.Tfoot> : null}
      </Table>
    </ReportTableScrollArea>
    {totalUnknown ? <Text size="xs" c="dimmed" className="stock-movement__total-note">{totalNote}</Text> : null}
    <footer className="report-preview-footer">
      <Group className="app-paginator report-preview-footer__pagination" gap={4} wrap="nowrap" role="navigation" aria-label="Сторінки звіту">
        <Text size="xs" className="report-preview-footer__range" aria-live="polite">
          {result.TotalRows ? `${deskCount(start + 1)}–${deskCount(end)} із ${deskCount(result.TotalRows)}` : 'Немає рядків'}
        </Text>
        <ActionIcon variant="subtle" color="gray" size={30} aria-label="Попередні рядки" disabled={busy || start === 0}
          onClick={() => onPage(Math.max(0, start - WAREHOUSE_STOCK_MOVEMENT_PAGE_SIZE))}><ChevronLeft size={16} /></ActionIcon>
        <ActionIcon variant="subtle" color="gray" size={30} aria-label="Наступні рядки" disabled={busy || end >= result.TotalRows}
          onClick={() => onPage(end)}><ChevronRight size={16} /></ActionIcon>
      </Group>
    </footer>
  </Stack>
}

function LevelsEditor({ levels, disabled, onChange }: { levels: StockMovementLevel[]; disabled: boolean; onChange: (levels: StockMovementLevel[]) => void }) {
  const ordered = [...levels, ...STOCK_MOVEMENT_LEVELS.filter(level => !levels.includes(level))]
  return <Stack gap={4} role="list" aria-label="Групування рядків">
    {ordered.map(level => {
      const index = levels.indexOf(level)
      return <Group key={level} gap={8} wrap="nowrap" role="listitem" className="stock-movement__level">
        <Checkbox size="xs" checked={index >= 0} disabled={disabled} label={STOCK_MOVEMENT_LEVEL_LABELS[level]}
          onChange={event => onChange(toggleLevel(levels, level, event.currentTarget.checked))} />
        {index >= 0 ? <Group gap={2} wrap="nowrap" ml="auto">
          <ActionIcon size="sm" variant="subtle" color="gray" aria-label={`Вище: ${STOCK_MOVEMENT_LEVEL_LABELS[level]}`}
            disabled={disabled || index === 0} onClick={() => onChange(moveLevel(levels, level, -1))}><ArrowUp size={14} /></ActionIcon>
          <ActionIcon size="sm" variant="subtle" color="gray" aria-label={`Нижче: ${STOCK_MOVEMENT_LEVEL_LABELS[level]}`}
            disabled={disabled || index === levels.length - 1} onClick={() => onChange(moveLevel(levels, level, 1))}><ArrowDown size={14} /></ActionIcon>
        </Group> : null}
      </Group>
    })}
  </Stack>
}

export function WarehouseStockMovementPanel({ callerKey, canGenerate, onBusyChange, history }: Props) {
  const [setup, setSetup] = useState<{ value: Setup | null; error: string | null; attempt: number }>({ value: null, error: null, attempt: 0 })
  const [draft, setDraft] = useState<StockMovementDraft | null>(null)
  const [run, setRun] = useState<Run | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'exporting'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<StockMovementExport | null>(null)
  const [fileOpened, setFileOpened] = useState(false)
  const [historyNotice, setHistoryNotice] = useState<string | null>(null)
  const handledHistory = useRef(0)
  const active = useRef<AbortController | null>(null)
  const alive = useRef(true)
  const enabled = canGenerate && !!callerKey
  const attributes = useMovementAttributes(enabled)
  const typed = draft ? stockMovementTypedText(draft) : ''
  const [typedText] = useDebouncedValue(typed, 400)
  const busy = status !== 'idle'
  const locked = status === 'exporting'

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; active.current?.abort() }
  }, [])

  useEffect(() => {
    if (!busy || !onBusyChange) return
    onBusyChange(true)
    return () => onBusyChange(false)
  }, [busy, onBusyChange])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    Promise.all([getStockMovementCapability(controller.signal), getStockMovementWarehouses(controller.signal), getStockMovementOrganizations(controller.signal)])
      .then(([capability, warehouses, organizations]) => {
        if (controller.signal.aborted) return
        setSetup(current => ({ ...current, value: { capability, warehouses, organizations }, error: null }))
        setDraft(current => current ?? defaultStockMovementDraft(capability))
      })
      .catch(failure => { if (!controller.signal.aborted) setSetup(current => ({ ...current, error: errorText(failure, 'Не вдалося завантажити налаштування звіту.') })) })
    return () => controller.abort()
  }, [enabled, setup.attempt])

  const capability = setup.value?.capability ?? null
  const current = draft
  const validation = current && capability ? stockMovementDraftError(current, capability) : null
  const appliedSearch = useRef<string | null>(null)

  function begin(next: 'loading' | 'exporting') {
    const owner = new AbortController()
    active.current?.abort()
    active.current = owner
    setStatus(next)
    setError(null)
    return owner
  }

  function finish(owner: AbortController) {
    if (!alive.current || active.current !== owner) return
    active.current = null
    setStatus('idle')
  }

  async function load(request: StockMovementRequest) {
    if (!enabled) return
    appliedSearch.current = stockMovementSearchKey(request)
    const owner = begin('loading')
    try {
      const result = await previewStockMovement(request, owner.signal)
      if (alive.current && !owner.signal.aborted) setRun({ request, result })
    } catch (failure) {
      if (alive.current && !owner.signal.aborted) setError(errorText(failure, 'Не вдалося сформувати рух товару.'))
    } finally { finish(owner) }
  }

  function apply(source: StockMovementDraft | null = current) {
    if (!source || !capability || stockMovementDraftError(source, capability)) return
    void load(buildStockMovementRequest(source))
  }

  async function exportFile() {
    if (!enabled || !run || busy || pending) return
    await exportRequest(run.request)
  }

  async function exportRequest(request: StockMovementRequest) {
    if (!enabled) return
    const owner = begin('exporting')
    try {
      const value = await exportStockMovement({ ...request, Offset: 0, Limit: 1 }, owner.signal)
      if (alive.current && !owner.signal.aborted) { setFile(value); setFileOpened(true) }
    } catch (failure) {
      if (alive.current && !owner.signal.aborted) setError(errorText(failure, 'Не вдалося сформувати файл Excel.'))
    } finally { finish(owner) }
  }

  const applyHistory = useEffectEvent((run: MovementHistoryRun) => {
    const value = setup.value
    if (!value) return
    handledHistory.current = run.token
    const restored = movementDraftFromHistory(run.request, value.capability, defaultStockMovementDraft(value.capability), {
      warehouses: value.warehouses, organizations: value.organizations, units: attributes.unitsFailed ? null : attributes.units,
      tops: attributes.topsFailed ? null : attributes.tops, products: run.products, groups: run.groups, storedNames: run.storedNames })
    setDraft(restored.draft)
    setRun(null)
    setHistoryNotice(droppedSettingsLine(restored.dropped))
    const invalid = stockMovementDraftError(restored.draft, value.capability)
    if (invalid) { setError(invalid); return }
    const request = buildStockMovementRequest(restored.draft)
    if (run.action === 'excel') void exportRequest(request)
    else void load(request)
  })

  useEffect(() => {
    if (!history || history.token === handledHistory.current || !setup.value || !attributes.loaded) return
    applyHistory(history)
  }, [history, setup.value, attributes.loaded])

  const searchChanged = useEffectEvent((settled: string) => {
    if (!draft || appliedSearch.current === null || settled !== stockMovementTypedText(draft)) return
    if (stockMovementSearchKey(buildStockMovementRequest(draft)) !== appliedSearch.current) apply(draft)
  })

  useEffect(() => { searchChanged(typedText) }, [typedText])

  if (!enabled) return <Text>Немає права формування звітів по складу.</Text>
  if (setup.error) return <Alert color="yellow">
    <Text size="sm">{setup.error}</Text>
    <Button type="button" variant="default" size="xs" mt="xs" onClick={() => setSetup(current => ({ ...current, error: null, attempt: current.attempt + 1 }))}>Повторити</Button>
  </Alert>
  if (!setup.value || !draft || !current || !capability) return <Text role="status" size="sm">Завантажуємо налаштування звіту…</Text>

  const { warehouses, organizations } = setup.value
  const update = (patch: Partial<StockMovementDraft>) => setDraft(current => current ? { ...current, ...patch } : current)
  const filters = summarizeStockMovementFilters(current, warehouses, organizations, capability.DocumentKinds, attributes.units)
  const setRow = (index: number, patch: Partial<StockMovementFilterRow>) =>
    update({ filterRows: draft.filterRows.map((row, position) => position === index ? { ...row, ...patch } : row) })
  const removeRow = (index: number) => {
    if (!draft.filterRows[index]) return
    update({ filterRows: draft.filterRows.filter((_, position) => position !== index),
      ...(draft.filterExpression ? { filterExpression: removeFilterSelection(draft.filterExpression, index) as StockMovementDraft['filterExpression'] } : {}) })
  }
  const copyRow = (index: number) => {
    const row = draft.filterRows[index]
    if (!row || !draft.listed) return
    update({ filterRows: [...draft.filterRows, copyStockMovementRow(row, nextRowId(draft.filterRows))] })
  }
  const changeRowField = (index: number, value: string | null) => {
    const row = draft.filterRows[index]
    const field = value === null ? null : STOCK_MOVEMENT_FILTER_FIELDS.find(option => option === value)
    if (field === undefined) return
    if (!row || row.field === field) return
    update({ filterRows: draft.filterRows.map((item, position) => position === index ? { id: item.id, enabled: item.enabled, field } : item) })
  }
  const movementValue = (row: StockMovementFilterRow, index: number): ReactNode => {
    const set = (patch: Partial<StockMovementFilterRow>) => setRow(index, patch)
    switch (row.field) {
      case null: return <Text size="sm">Оберіть поле відбору.</Text>
      case 'organization': return <ListPicker label="Значення" placeholder="Усі організації" disabled={locked}
        data={organizations.map(item => ({ value: String(item.Id), label: lookupLabel(item) }))}
        value={(row.ids ?? []).map(String)} onChange={values => set({ ids: values.map(Number) })} />
      case 'product': return <SelectionPicker label="Значення" placeholder="Пошук за артикулом або назвою" selected={row.items ?? []}
        lookup={searchStockMovementProducts} enabled={enabled} disabled={locked} onChange={value => set({ items: value })} />
      case 'article': return row.articleMatch === 'inList'
        ? <Textarea label="Значення" aria-label="Артикули списку" placeholder="Артикули через кому або з нового рядка" autosize minRows={1} maxRows={6}
          disabled={locked} value={row.text ?? ''} onChange={event => set({ text: event.currentTarget.value })} />
        : <TextInput label="Значення" aria-label="Значення артикула" placeholder="Напр. 94000" disabled={locked}
          value={row.text ?? ''} onChange={event => set({ text: event.currentTarget.value })} />
      case 'top': return <ListPicker label="Значення" placeholder="Усі значення топу" disabled={locked}
        data={attributes.tops.map(code => ({ value: code, label: code }))} failed={attributes.topsFailed} onRetry={attributes.retryTops}
        value={row.values ?? []} onChange={values => set({ values })} />
      case 'group': return <SelectionPicker label="Значення" placeholder="Пошук групи" selected={row.items ?? []}
        lookup={searchStockMovementGroups} enabled={enabled} disabled={locked} onChange={value => set({ items: value })} />
      case 'manufacturer': return <SelectionPicker label="Значення" placeholder="Пошук виробника" selected={row.items ?? []}
        lookup={searchStockMovementManufacturers} enabled={enabled} disabled={locked} onChange={value => set({ items: value })} />
      case 'unit': return <ListPicker label="Значення" placeholder="Усі одиниці виміру" disabled={locked}
        data={attributes.units.map(item => ({ value: String(item.Id), label: lookupLabel(item) }))} failed={attributes.unitsFailed} onRetry={attributes.retryUnits}
        value={(row.ids ?? []).map(String)} onChange={values => set({ ids: values.map(Number) })} />
      case 'warehouse': return <ListPicker label="Значення" placeholder="Усі склади" disabled={locked}
        data={warehouses.map(item => ({ value: String(item.Id), label: item.Detail ? `${lookupLabel(item)} · ${item.Detail}` : lookupLabel(item) }))}
        value={(row.ids ?? []).map(String)} onChange={values => set({ ids: values.map(Number) })} />
      case 'documentKind': return <ListPicker label="Значення" placeholder="Усі документи" disabled={locked}
        data={capability.DocumentKinds.map(kind => ({ value: kind.Code, label: kind.Name }))}
        value={row.values ?? []} onChange={values => set({ values })} />
      case 'documentText': return <TextInput label="Значення" placeholder="Номер, вид або контрагент" disabled={locked}
        value={row.text ?? ''} onChange={event => set({ text: event.currentTarget.value })} />
    }
  }
  const pending = run ? JSON.stringify({ ...buildStockMovementRequest(current), Offset: 0 }) !== JSON.stringify({ ...run.request, Offset: 0 }) : false
  const presets = stockMovementPeriodPresets(capability.Today, capability.MinimumFrom)

  return <Stack gap={8} className="published-movement stock-movement">
    <Group justify="space-between" gap={8} wrap="wrap">
      <Text fw={600}>{WAREHOUSE_STOCK_MOVEMENT_TITLE}</Text>
    </Group>
    {historyNotice ? <Alert color="yellow" role="status" withCloseButton closeButtonLabel="Закрити повідомлення"
      onClose={() => setHistoryNotice(null)}>{historyNotice}</Alert> : null}
    <WorkbookSettings unified disabled={locked}
      period={<WorkbookPeriodField required from={draft.from} to={draft.to} minDate={capability.MinimumFrom} maxDate={capability.Today}
        presets={presets} error={null} disabled={locked}
        onFromChange={value => update({ from: value })} onToChange={value => update({ to: value })} />}
      sections={[
        { id: 'grouping', title: 'Групування рядків', summary: draft.levels.map(level => STOCK_MOVEMENT_LEVEL_LABELS[level]).join(' → '),
          content: <LevelsEditor levels={draft.levels} disabled={locked} onChange={levels => update({ levels })} /> },
        { id: 'measures', title: 'Показники', summary: draft.measures.map(measure => STOCK_MOVEMENT_MEASURE_LABELS[measure]).join(', '),
          content: <Stack gap={4}>
            {STOCK_MOVEMENT_MEASURES.map(measure => <Checkbox key={measure} size="xs" disabled={locked} checked={draft.measures.includes(measure)}
              label={`${STOCK_MOVEMENT_MEASURE_LABELS[measure]} (Кількість)`}
              onChange={event => update({ measures: event.currentTarget.checked ? [...draft.measures, measure] : draft.measures.filter(item => item !== measure) })} />)}
            <Checkbox size="xs" mt={8} disabled={locked} checked={draft.negativeRed} label="Від'ємне червоним" onChange={event => update({ negativeRed: event.currentTarget.checked })} />
            <Checkbox size="xs" disabled={locked} checked={draft.grandTotals} label="Виводити загальні підсумки" onChange={event => update({ grandTotals: event.currentTarget.checked })} />
          </Stack> },
        { id: 'filters', title: 'Відбори', summary: filters.join('; ') || 'Фільтрів немає',
          content: <Stack gap={8}>
            <ConstructorFilters count={draft.filterRows.length} rowKeys={draft.filterRows.map(row => String(row.id))} disabled={locked}
              copyDisabled={!draft.listed}
              footer={capability.FilterExpression || draft.filterExpression ? (view => <ReportFilterExpressionPanel data={view.data} dataset={view.dataset}
                disabled={locked} notice={null} onChange={value => update({ filterExpression: value == null ? null : value as StockMovementDraft['filterExpression'] })} />)(
                stockMovementExpressionView(draft, capability, { warehouses, organizations, units: attributes.units })) : null}
              onAdd={() => update({ filterRows: [...draft.filterRows, { id: nextRowId(draft.filterRows), field: null, enabled: true }] })}
              onDelete={index => removeRow(index)}
              onCopy={copyRow}
              renderRow={({ index, selected, onSelect }) => {
                const row = draft.filterRows[index]
                const used = new Set(draft.listed ? [] : draft.filterRows.flatMap(item => item.field && item.id !== row.id ? [item.field] : []))
                const definition = row.field ? STOCK_MOVEMENT_FILTER_DEFINITIONS[row.field] : null
                return <ReportFilterRow label={`Умова відбору ${index + 1}`} selected={selected} onSelect={onSelect}
                  toggle={<Checkbox size="xs" aria-label={`Увімкнути умову ${index + 1}`} checked={row.enabled} disabled={locked}
                    onChange={event => setRow(index, { enabled: event.currentTarget.checked })} />}
                  field={<Select size="xs" label="Поле" searchable allowDeselect={false} disabled={locked} placeholder="Оберіть поле"
                    data={movementFieldOptions(used, draft.listed)} value={row.field}
                    onChange={value => changeRowField(index, value)} />}
                  condition={row.field === 'article'
                    ? <Select size="xs" label="Тип порівняння" disabled={locked} allowDeselect={false} value={row.articleMatch ?? 'equals'}
                      data={STOCK_MOVEMENT_ARTICLE_MATCHES.map(match => ({ value: match, label: STOCK_MOVEMENT_ARTICLE_CONDITIONS[match] }))}
                      onChange={value => { if (value) setRow(index, { articleMatch: value as StockMovementArticleMatch }) }} />
                    : <Select size="xs" label="Тип порівняння" readOnly value={definition?.condition ?? null} data={definition ? [definition.condition] : []} />}
                  value={movementValue(row, index)}
                  action={locked ? null : <TableRowAction action="delete" label={`Видалити умову ${index + 1}`} onClick={() => removeRow(index)} />} />
              }} />
            {draft.conditions.map((condition, index) => <ReportFilterRow key={index} label={`Умова за показником ${index + 1}`}
              field={<Select label="Поле" aria-label="Показник умови" disabled={locked} allowDeselect={false} value={condition.Measure}
                data={STOCK_MOVEMENT_MEASURES.map(measure => ({ value: measure, label: `Кількість ${STOCK_MOVEMENT_MEASURE_LABELS[measure].toLocaleLowerCase('uk')}` }))}
                onChange={value => { if (value) update({ conditions: draft.conditions.map((item, position) => position === index ? { ...item, Measure: value as StockMovementMeasure } : item) }) }} />}
              condition={<Select label="Тип порівняння" aria-label="Порівняння" disabled={locked} allowDeselect={false} value={condition.Comparison}
                data={STOCK_MOVEMENT_COMPARISONS.map(comparison => ({ value: comparison, label: STOCK_MOVEMENT_COMPARISON_LABELS[comparison] }))}
                onChange={value => { if (value) update({ conditions: draft.conditions.map((item, position) => position === index ? { ...item, Comparison: value as StockMovementComparison } : item) }) }} />}
              value={<NumberInput label="Значення" aria-label="Значення умови" disabled={locked} value={condition.Value} decimalSeparator="," allowDecimal
                onChange={value => update({ conditions: draft.conditions.map((item, position) => position === index ? { ...item, Value: typeof value === 'number' ? value : Number.NaN } : item) })} />}
              action={<ActionIcon variant="subtle" color="gray" aria-label="Прибрати умову" disabled={locked}
                onClick={() => update({ conditions: draft.conditions.filter((_, position) => position !== index) })}><X size={14} /></ActionIcon>} />)}
            {draft.conditions.length < 4 ? <Button type="button" size="compact-xs" variant="subtle" leftSection={<Plus size={14} />} disabled={locked}
              onClick={() => update({ conditions: [...draft.conditions, { Measure: 'closing', Comparison: 'greater', Value: 0 }] })}>Умова за показником</Button> : null}
          </Stack> },
      ]}
      advanced={null} />
    {validation ? <Alert color="yellow">{validation}</Alert> : null}
    {error ? <Alert color="red">{error}</Alert> : null}
    {pending ? <Text id="stock-movement-pending-notice" size="xs" c="orange.8">Налаштування змінено. Натисніть «Застосувати й показати», щоб оновити звіт. Excel буде за новими налаштуваннями після оновлення звіту.</Text> : null}
    <div className="workbook-actions" role="region" aria-label="Дії зі звітом">
      <div className="app-filter-bar workbook-toolbar"><div className="app-filter-actions workbook-actions__buttons published-movement__actions">
        <div className="workbook-actions__delivery">
          <Button variant="default" leftSection={<ExcelIcon size={16} />} disabled={!run || busy || pending} loading={status === 'exporting'}
            aria-describedby={pending ? 'stock-movement-pending-notice' : undefined}
            onClick={() => { void exportFile() }}>Excel</Button>
          <Button leftSection={<MonitorPlay size={16} />} loading={status === 'loading'} disabled={busy || !!validation}
            onClick={() => apply()}>Застосувати й показати</Button>
        </div>
      </div></div>
    </div>
    <section className="workbook-result" aria-label="Результат">
      <h2 className="app-section-title">Результат</h2>
      {run ? <Stack gap={8}>
        <PartialCoverageLine coverage={run.result.PhysicalCoverage} />
        <PhysicalQuantityExceptionLine exceptions={run.result.PhysicalQuantityExceptions} />
        <Group gap={8} justify="space-between" wrap="wrap">
          <Text size="sm" fw={600}>{displayDate(run.result.From)} — {displayDate(run.result.To)}</Text>
          <Text size="xs" c="dimmed">Сформовано {displayDateTime(run.result.ObservedAt)}</Text>
        </Group>
        <ResultTable run={run} draftMeasures={run.request.Measures} negativeRed={run.request.NegativeRed} grandTotals={run.request.GrandTotals}
          busy={busy} onPage={offset => { void load({ ...run.request, Offset: offset }) }} />
      </Stack> : <div className="published-movement__empty" role="status">Таблиці ще немає</div>}
    </section>
    <DocumentExportModal opened={fileOpened} title={WAREHOUSE_STOCK_MOVEMENT_TITLE} excelUrl={file?.DocumentURL ?? null} pdfUrl={null}
      fileBaseName={file?.FileName.replace(/\.xlsx$/, '')} onClose={() => setFileOpened(false)} />
  </Stack>
}
