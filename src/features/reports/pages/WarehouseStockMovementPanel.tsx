import { ActionIcon, Alert, Button, Checkbox, Group, NumberInput, Select, Stack, Table, Text, Textarea, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, MonitorPlay, Plus, X } from 'lucide-react'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { CheckboxMultiSelect } from '../../../shared/ui/CheckboxMultiSelect'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { TableChip } from '../../../shared/ui/TableChip'
import '../../../shared/ui/paginator/paginator.css'
import {
  exportStockMovement, getStockMovementCapability, getStockMovementOrganizations, getStockMovementWarehouses, previewStockMovement,
  searchStockMovementGroups, searchStockMovementProducts,
} from '../api/warehouseStockMovementApi'
import {
  buildStockMovementRequest, defaultStockMovementDraft, displayDate, displayDateTime, formatStockQuantity, moveLevel, parseArticleList,
  STOCK_MOVEMENT_ARTICLE_LABELS, STOCK_MOVEMENT_ARTICLE_MATCHES, STOCK_MOVEMENT_COMPARISON_LABELS, STOCK_MOVEMENT_COMPARISONS,
  STOCK_MOVEMENT_LEVEL_LABELS, STOCK_MOVEMENT_LEVELS, STOCK_MOVEMENT_MEASURE_LABELS, STOCK_MOVEMENT_MEASURES, stockMovementDraftError,
  stockMovementPeriodPresets, summarizeStockMovementFilters, toggleLevel, WAREHOUSE_STOCK_MOVEMENT_PAGE_SIZE, WAREHOUSE_STOCK_MOVEMENT_TITLE,
  type StockMovementArticleMatch, type StockMovementCapability, type StockMovementComparison, type StockMovementDraft,
  type StockMovementExport, type StockMovementLevel, type StockMovementLookupItem, type StockMovementMeasure, type StockMovementQuantity,
  type StockMovementRequest, type StockMovementResult, type StockMovementSelection,
} from '../data/warehouseStockMovement'
import { ReportTableScrollArea } from './ReportTableScrollArea'
import { WorkbookPeriodField, WorkbookSettings } from './workbook-desk/WorkbookSettings'
import './warehouse-stock-movement.css'

type Props = { callerKey: string | null; canGenerate: boolean; onBusyChange?: (busy: boolean) => void }
type Setup = { capability: StockMovementCapability; warehouses: StockMovementLookupItem[]; organizations: StockMovementLookupItem[] }
type Run = { request: StockMovementRequest; result: StockMovementResult }

const searchKey = (request: StockMovementRequest) => `${request.ArticleMatch}|${request.Articles.join('\n')}|${request.DocumentText ?? ''}`

const measureKey: Record<StockMovementMeasure, keyof StockMovementQuantity> = {
  opening: 'Opening', incoming: 'Incoming', outgoing: 'Outgoing', closing: 'Closing',
}

function errorText(failure: unknown, fallback: string): string {
  if (failure instanceof ApiError && [401, 403].includes(failure.status)) return 'Немає права формування звітів по складу.'
  return failure instanceof Error && failure.message ? failure.message : fallback
}

function useLookupSearch(search: (query: string, signal: AbortSignal) => Promise<StockMovementLookupItem[]>, enabled: boolean) {
  const [query, setQuery] = useState('')
  const [debounced] = useDebouncedValue(query, 400)
  const [state, setState] = useState<{ query: string; items: StockMovementLookupItem[] }>({ query: '', items: [] })
  const term = debounced.trim()
  useEffect(() => {
    if (!enabled || !term) return
    const controller = new AbortController()
    search(term, controller.signal)
      .then(items => { if (!controller.signal.aborted) setState({ query: term, items }) })
      .catch(() => { if (!controller.signal.aborted) setState({ query: term, items: [] }) })
    return () => controller.abort()
  }, [term, enabled, search])
  const settled = !term || state.query === term
  return { query, setQuery, items: term && settled ? state.items : [], loading: !!query.trim() && (query.trim() !== term || !settled) }
}

function SelectionPicker({ label, placeholder, selected, search, disabled, onChange }: {
  label: string; placeholder: string; selected: StockMovementSelection[]; disabled: boolean
  search: ReturnType<typeof useLookupSearch>; onChange: (value: StockMovementSelection[]) => void
}) {
  const data = useMemo(() => {
    const options = new Map<string, string>(selected.map(item => [String(item.id), item.label]))
    for (const item of search.items) options.set(String(item.Id), item.Detail ? `${item.Name} — ${item.Detail}` : item.Name)
    return [...options].map(([value, text]) => ({ value, label: text }))
  }, [selected, search.items])
  return <CheckboxMultiSelect label={label} placeholder={placeholder} disabled={disabled} data={data}
    value={selected.map(item => String(item.id))}
    remoteSearch={{ value: search.query, onChange: search.setQuery, loading: search.loading }}
    onChange={values => onChange(values.map(value => ({ id: Number(value), label: data.find(option => option.value === value)?.label ?? value })))} />
}

function QuantityCell({ value, negativeRed }: { value: number; negativeRed: boolean }) {
  return <Table.Td className="app-table-cell-number" data-negative={negativeRed && value < 0 ? 'true' : undefined}>{formatStockQuantity(value)}</Table.Td>
}

function ResultTable({ run, draftMeasures, negativeRed, grandTotals, busy, onPage }: {
  run: Run; draftMeasures: readonly StockMovementMeasure[]; negativeRed: boolean; grandTotals: boolean; busy: boolean; onPage: (offset: number) => void
}) {
  const { result, request } = run
  const measures = STOCK_MOVEMENT_MEASURES.filter(measure => request.Measures.includes(measure) && draftMeasures.includes(measure))
  const deepest = request.Levels.length - 1
  const start = result.Offset, end = result.Offset + result.Rows.length
  return <Stack gap="xs">
    <ReportTableScrollArea minWidth={760} label={WAREHOUSE_STOCK_MOVEMENT_TITLE}>
      <Table className="app-static-table published-movement__table stock-movement__table" aria-label={WAREHOUSE_STOCK_MOVEMENT_TITLE}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th className="stock-movement__label-head">{request.Levels.map(level => <span key={level}>{STOCK_MOVEMENT_LEVEL_LABELS[level]}</span>)}</Table.Th>
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
                    {row.Label}{row.Source === 'gba' ? <span className="stock-movement__source"> · GBA</span> : null}</span>
                  : <span>{row.Label}</span>}
              </div>
            </Table.Td>
            {measures.map(measure => <QuantityCell key={measure} value={row.Quantity[measureKey[measure]]} negativeRed={negativeRed} />)}
          </Table.Tr>)}
        </Table.Tbody>
        {grandTotals ? <Table.Tfoot>
          <Table.Tr>
            <Table.Th>Підсумок</Table.Th>
            {measures.map(measure => <Table.Th key={measure} className="app-table-cell-number"
              data-negative={negativeRed && result.Totals[measureKey[measure]] < 0 ? 'true' : undefined}>{formatStockQuantity(result.Totals[measureKey[measure]])}</Table.Th>)}
          </Table.Tr>
        </Table.Tfoot> : null}
      </Table>
    </ReportTableScrollArea>
    <footer className="report-preview-footer">
      <Group className="app-paginator report-preview-footer__pagination" gap={4} wrap="nowrap" role="navigation" aria-label="Сторінки звіту">
        <Text size="xs" className="report-preview-footer__range" aria-live="polite">
          {result.TotalRows ? `${start + 1}–${end} із ${result.TotalRows}` : 'Немає рядків'}
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
      return <Group key={level} gap={6} wrap="nowrap" role="listitem" className="stock-movement__level">
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

export function WarehouseStockMovementPanel({ callerKey, canGenerate, onBusyChange }: Props) {
  const [setup, setSetup] = useState<{ value: Setup | null; error: string | null; attempt: number }>({ value: null, error: null, attempt: 0 })
  const [draft, setDraft] = useState<StockMovementDraft | null>(null)
  const [articleListText, setArticleListText] = useState('')
  const [run, setRun] = useState<Run | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'exporting'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<StockMovementExport | null>(null)
  const [fileOpened, setFileOpened] = useState(false)
  const active = useRef<AbortController | null>(null)
  const alive = useRef(true)
  const enabled = canGenerate && !!callerKey
  const products = useLookupSearch(searchStockMovementProducts, enabled)
  const groups = useLookupSearch(searchStockMovementGroups, enabled)
  const [articleText] = useDebouncedValue(draft?.articleText ?? '', 400)
  const [documentText] = useDebouncedValue(draft?.documentText ?? '', 400)
  const [articleList] = useDebouncedValue(articleListText, 400)
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
  const current = draft ? { ...draft, articleList: parseArticleList(articleListText) } : null
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
    appliedSearch.current = searchKey(request)
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
    if (!enabled || !run || busy) return
    const owner = begin('exporting')
    try {
      const value = await exportStockMovement({ ...run.request, Offset: 0, Limit: 1 }, owner.signal)
      if (alive.current && !owner.signal.aborted) { setFile(value); setFileOpened(true) }
    } catch (failure) {
      if (alive.current && !owner.signal.aborted) setError(errorText(failure, 'Не вдалося сформувати файл Excel.'))
    } finally { finish(owner) }
  }

  const searchChanged = useEffectEvent((article: string, list: string, document: string) => {
    if (!draft || appliedSearch.current === null) return
    const source = { ...draft, articleText: article, articleList: parseArticleList(list), documentText: document }
    if (searchKey(buildStockMovementRequest(source)) !== appliedSearch.current) apply(source)
  })

  useEffect(() => { searchChanged(articleText, articleList, documentText) }, [articleText, articleList, documentText])

  if (!enabled) return <Text>Немає права формування звітів по складу.</Text>
  if (setup.error) return <Alert color="yellow">
    <Text size="sm">{setup.error}</Text>
    <Button type="button" variant="default" size="xs" mt="xs" onClick={() => setSetup(current => ({ ...current, error: null, attempt: current.attempt + 1 }))}>Повторити</Button>
  </Alert>
  if (!setup.value || !draft || !current || !capability) return <Text role="status" size="sm">Завантажуємо налаштування звіту…</Text>

  const { warehouses, organizations } = setup.value
  const update = (patch: Partial<StockMovementDraft>) => setDraft(current => current ? { ...current, ...patch } : current)
  const filters = summarizeStockMovementFilters(current, warehouses, organizations, capability.DocumentKinds)
  const pending = run ? JSON.stringify({ ...buildStockMovementRequest(current), Offset: 0 }) !== JSON.stringify({ ...run.request, Offset: 0 }) : false
  const presets = stockMovementPeriodPresets(capability.Today, capability.MinimumFrom)

  return <Stack gap={8} className="published-movement stock-movement">
    <Group justify="space-between" gap={8} wrap="wrap">
      <Text fw={600}>{WAREHOUSE_STOCK_MOVEMENT_TITLE}</Text>
      {capability.StockSyncAt ? <Text size="xs" c="dimmed">Залишки з 1С синхронізовано {displayDateTime(capability.StockSyncAt)} (Київ)</Text> : null}
    </Group>
    <WorkbookSettings unified disabled={locked}
      period={<WorkbookPeriodField required from={draft.from} to={draft.to} minDate={capability.MinimumFrom} maxDate={capability.Today}
        presets={presets} error={null} disabled={locked}
        onFromChange={value => update({ from: value })} onToChange={value => update({ to: value })} />}
      sections={[
        { id: 'warehouses', title: 'Склади', summary: draft.warehouseIds.length ? `Вибрано: ${draft.warehouseIds.length}` : 'Усі склади',
          compactSummary: draft.warehouseIds.length ? String(draft.warehouseIds.length) : undefined, content: <Stack gap={6}>
            <CheckboxMultiSelect label="Склад у списку" placeholder="Усі склади" disabled={locked}
              data={warehouses.map(item => ({ value: String(item.Id), label: item.Detail ? `${item.Name} · ${item.Detail}` : item.Name }))}
              value={draft.warehouseIds.map(String)} onChange={values => update({ warehouseIds: values.map(Number) })} />
            <CheckboxMultiSelect label="Організація складу" placeholder="Усі організації" disabled={locked}
              data={organizations.map(item => ({ value: String(item.Id), label: item.Name }))}
              value={draft.organizationIds.map(String)} onChange={values => update({ organizationIds: values.map(Number) })} />
          </Stack> },
        { id: 'product', title: 'Номенклатура', summary: filters.filter(line => line.startsWith('Номенклатура') || line.startsWith('Група')).join('; ') || 'Усі товари',
          content: <Stack gap={6}>
            <Group gap={6} align="flex-end" wrap="wrap">
              <Select label="Артикул" w={150} disabled={locked} allowDeselect={false} value={draft.articleMatch}
                data={STOCK_MOVEMENT_ARTICLE_MATCHES.map(match => ({ value: match, label: STOCK_MOVEMENT_ARTICLE_LABELS[match] }))}
                onChange={value => { if (value) update({ articleMatch: value as StockMovementArticleMatch }) }} />
              {draft.articleMatch === 'inList' ? null : <TextInput aria-label="Значення артикула" placeholder="Напр. 94000" disabled={locked}
                value={draft.articleText} onChange={event => update({ articleText: event.currentTarget.value })} />}
            </Group>
            {draft.articleMatch === 'inList' ? <Textarea aria-label="Артикули списку" placeholder="Артикули через кому або з нового рядка" autosize minRows={2} maxRows={6}
              disabled={locked} value={articleListText} onChange={event => setArticleListText(event.currentTarget.value)} /> : null}
            <SelectionPicker label="Номенклатура у списку" placeholder="Пошук за артикулом або назвою" selected={draft.products}
              search={products} disabled={locked} onChange={value => update({ products: value })} />
            <SelectionPicker label="Група товарів (з підгрупами)" placeholder="Пошук групи" selected={draft.groups}
              search={groups} disabled={locked} onChange={value => update({ groups: value })} />
          </Stack> },
        { id: 'filters', title: 'Відбори', summary: [draft.documentKinds.length ? `Види документів: ${draft.documentKinds.length}` : '',
          draft.documentText.trim() ? `Документ: ${draft.documentText.trim()}` : '', draft.conditions.length ? `Умови: ${draft.conditions.length}` : ''].filter(Boolean).join('; ') || 'Без відборів',
          content: <Stack gap={6}>
            <CheckboxMultiSelect label="Вид документа руху" placeholder="Усі документи" disabled={locked}
              data={capability.DocumentKinds.map(kind => ({ value: kind.Code, label: kind.Name }))}
              value={draft.documentKinds} onChange={values => update({ documentKinds: values })} />
            <TextInput label="Документ руху містить" placeholder="Номер, вид або контрагент" disabled={locked}
              value={draft.documentText} onChange={event => update({ documentText: event.currentTarget.value })} />
            {draft.conditions.map((condition, index) => <Group key={index} gap={4} wrap="nowrap" align="flex-end">
              <Select aria-label="Показник умови" w={150} disabled={locked} allowDeselect={false} value={condition.Measure}
                data={STOCK_MOVEMENT_MEASURES.map(measure => ({ value: measure, label: `Кількість ${STOCK_MOVEMENT_MEASURE_LABELS[measure].toLocaleLowerCase('uk')}` }))}
                onChange={value => { if (value) update({ conditions: draft.conditions.map((item, position) => position === index ? { ...item, Measure: value as StockMovementMeasure } : item) }) }} />
              <Select aria-label="Порівняння" w={130} disabled={locked} allowDeselect={false} value={condition.Comparison}
                data={STOCK_MOVEMENT_COMPARISONS.map(comparison => ({ value: comparison, label: STOCK_MOVEMENT_COMPARISON_LABELS[comparison] }))}
                onChange={value => { if (value) update({ conditions: draft.conditions.map((item, position) => position === index ? { ...item, Comparison: value as StockMovementComparison } : item) }) }} />
              <NumberInput aria-label="Значення умови" w={90} disabled={locked} value={condition.Value} decimalSeparator="," allowDecimal
                onChange={value => update({ conditions: draft.conditions.map((item, position) => position === index ? { ...item, Value: typeof value === 'number' ? value : Number.NaN } : item) })} />
              <ActionIcon variant="subtle" color="gray" aria-label="Прибрати умову" disabled={locked}
                onClick={() => update({ conditions: draft.conditions.filter((_, position) => position !== index) })}><X size={14} /></ActionIcon>
            </Group>)}
            {draft.conditions.length < 4 ? <Button type="button" size="compact-xs" variant="subtle" leftSection={<Plus size={14} />} disabled={locked}
              onClick={() => update({ conditions: [...draft.conditions, { Measure: 'closing', Comparison: 'greater', Value: 0 }] })}>Умова за показником</Button> : null}
          </Stack> },
        { id: 'grouping', title: 'Групування рядків', summary: draft.levels.map(level => STOCK_MOVEMENT_LEVEL_LABELS[level]).join(' → '),
          content: <LevelsEditor levels={draft.levels} disabled={locked} onChange={levels => update({ levels })} /> },
        { id: 'measures', title: 'Показники', summary: draft.measures.map(measure => STOCK_MOVEMENT_MEASURE_LABELS[measure]).join(', '),
          content: <Stack gap={4}>
            {STOCK_MOVEMENT_MEASURES.map(measure => <Checkbox key={measure} size="xs" disabled={locked} checked={draft.measures.includes(measure)}
              label={`${STOCK_MOVEMENT_MEASURE_LABELS[measure]} (Кількість)`}
              onChange={event => update({ measures: event.currentTarget.checked ? [...draft.measures, measure] : draft.measures.filter(item => item !== measure) })} />)}
            <Checkbox size="xs" mt={6} disabled={locked} checked={draft.negativeRed} label="Від'ємне червоним" onChange={event => update({ negativeRed: event.currentTarget.checked })} />
            <Checkbox size="xs" disabled={locked} checked={draft.grandTotals} label="Виводити загальні підсумки" onChange={event => update({ grandTotals: event.currentTarget.checked })} />
          </Stack> },
      ]}
      advanced={<Stack gap={4}>{capability.Notes.map(note => <Text key={note} size="xs" c="dimmed">{note}</Text>)}</Stack>} />
    {validation ? <Alert color="yellow">{validation}</Alert> : null}
    {error ? <Alert color="red">{error}</Alert> : null}
    {pending ? <Text size="xs" c="orange.8">Налаштування змінено. Таблиця й файл залишаються за попереднім сформованим звітом до застосування.</Text> : null}
    <div className="workbook-actions" role="region" aria-label="Дії зі звітом">
      <div className="app-filter-bar workbook-toolbar"><div className="app-filter-actions workbook-actions__buttons published-movement__actions">
        <div className="workbook-actions__delivery">
          <Button variant="default" leftSection={<ExcelIcon size={16} />} disabled={!run || busy} loading={status === 'exporting'}
            onClick={() => { void exportFile() }}>Excel</Button>
          <Button leftSection={<MonitorPlay size={16} />} loading={status === 'loading'} disabled={busy || !!validation}
            onClick={() => apply()}>Застосувати й показати</Button>
        </div>
      </div></div>
    </div>
    <section className="workbook-result" aria-label="Результат">
      <h2 className="app-section-title">Результат</h2>
      {run ? <Stack gap={8}>
        <Group gap={8} justify="space-between" wrap="wrap">
          <Text size="sm" fw={600}>{displayDate(run.result.From)} — {displayDate(run.result.To)}</Text>
          <Text size="xs" c="dimmed">Складів і товарів: {run.result.Keys}; документів руху: {run.result.Registrars}; сформовано {displayDateTime(run.result.ObservedAt)} (Київ)</Text>
        </Group>
        {run.result.Notes.length ? <details className="stock-movement__notes"><summary>Як розраховано</summary>
          {run.result.Notes.map(note => <Text key={note} size="xs" c="dimmed">{note}</Text>)}</details> : null}
        <ResultTable run={run} draftMeasures={run.request.Measures} negativeRed={run.request.NegativeRed} grandTotals={run.request.GrandTotals}
          busy={busy} onPage={offset => { void load({ ...run.request, Offset: offset }) }} />
      </Stack> : <div className="published-movement__empty" role="status">Таблиці ще немає</div>}
    </section>
    <DocumentExportModal opened={fileOpened} title={WAREHOUSE_STOCK_MOVEMENT_TITLE} excelUrl={file?.DocumentURL ?? null} pdfUrl={null}
      fileBaseName={file?.FileName.replace(/\.xlsx$/, '')} onClose={() => setFileOpened(false)} />
  </Stack>
}
