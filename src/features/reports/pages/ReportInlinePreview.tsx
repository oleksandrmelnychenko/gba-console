import { settlementAttributeText, type SettlementCounterpartyAttribute } from '../data/settlementSourceAttributes'
import { Alert, Badge, Stack, Text } from '@mantine/core'
import { profitReadModeLabel } from '../data/profitReadMode'
import { settlementReadModeLabel } from '../data/settlementReadMode'
import { cashReadModeLabel } from '../data/cashReadMode'
import { previewAmountText, previewCaptionText, previewCellText, previewNumberText, previewSharedNames, type CurrentVparivanieProduct, type NativeReportPreview, type NativeReportPreviewAxis, type NativeReportPreviewFilter, type NativeReportPreviewRequest } from '../data/nativeReportPreview'
import { CURRENT_VPARIVANIE_PRODUCT_CAPTIONS, CURRENT_VPARIVANIE_PRODUCT_FIELDS, currentVparivanieQuantityText } from '../data/currentVparivanie'
import { currentVparivanieSecondTier } from '../data/currentVparivanieColumns'
import './report-inline-preview.css'
import { workbookAttributeText, type WorkbookRow } from '../data/workbookPreview'

export function ReportInlinePreview({ preview }: { preview: NativeReportPreview }) {
  const cells = new Map(preview.Cells.map(cell => [`${cell.RowSourceIndex}:${cell.ColumnSourceIndex}`, cell.Value]))
  const products = preview.CurrentVparivanieProducts
  const regions = preview.ClientDiscountRecipientRegions
  const regionRows = new Map(regions?.Rows.map(row => [row.RowSourceIndex, row.RegionCode]))
  const attributes = preview.SettlementCounterpartyAttributes
  const attributeRows = new Map(attributes?.Rows.map(row => [row.RowSourceIndex, row]))
  const productRows = new Map(products?.Rows.map(row => [row.RowSourceIndex, row]))
  const workbook = preview.WorkbookPresentation
  const workbookRows = new Map(workbook?.rows.map(row => [row.rowSourceIndex, row]))
  const workbookColumns = workbook?.fields.filter(field => field.placement === 'column') ?? []
  const inlineFields = workbook?.fields.filter(field => field.placement === 'inline') ?? []
  const sharedGroup = !products && preview.Columns.length > 1 && preview.Columns.every(column => column.Values.length > 1
    && column.Values[0].Caption === preview.Columns[0].Values[0].Caption)
  const rowCaption = (row: NativeReportPreviewAxis, index: number) => workbookRowCaption(row.Values[index]?.Caption ?? '—',
    index === preview.RowSchema.length - 1, workbookRows.get(row.SourceIndex), workbook?.fields ?? [])
  const sharedNames = preview.RowSchema.map((_, index) => previewSharedNames(preview.Rows.map(row => rowCaption(row, index))))
  const amountColumns = new Set(preview.Columns.filter(column => isAmountColumn(column)).map(column => column.SourceIndex))
  const rowHeaders = products ? CURRENT_VPARIVANIE_PRODUCT_CAPTIONS : [...preview.RowSchema.map((level, index) => [level.Caption || `Рівень ${index + 1}`,
    ...(index === preview.RowSchema.length - 1 ? inlineFields.map(field => field.caption) : [])].join(', ')),
    ...(attributes ? ['Основний менеджер покупця', 'Код по региону'] : []), ...(regions ? ['Код по региону'] : []),
    ...workbookColumns.map(field => field.caption)]
  return <section className="app-section-card report-inline-preview" aria-label="Попередній перегляд звіту">
    <div className="report-inline-preview__heading">
      <Text component="h2" fw={600} size="sm">Дані звіту</Text>
      <Badge variant="light">{preview.Page.ReturnedRows} із {preview.Page.TotalVisibleRows} рядків</Badge>
    </div>
    <ReportAttribution request={preview.Request} />
    <WorkbookMetadata workbook={workbook} />
    <Text size="xs" c="dimmed">«—» — значення немає; «∅» — суму не визначено, бо в документах бракує даних. На екрані показано рядки без підсумків; підсумки є у файлах Excel і PDF.</Text>
    <div className="report-inline-preview__scroll" tabIndex={0} role="region" aria-label="Таблиця попереднього перегляду">
      <table>
        <thead><tr>
          {rowHeaders.map((header, index) => <th scope="col" rowSpan={products ? 2 : undefined} key={`row-${index}`}>{header}</th>)}
          {preview.Columns.map(column => <th scope="col" key={column.SourceIndex}>
            {(products ? column.Values.slice(0, 1) : sharedGroup ? column.Values.slice(1) : column.Values).map(value => value.Caption).filter(Boolean).join(' / ') || `Стовпець ${column.Ordinal + 1}`}
          </th>)}
        </tr>{products ? <tr>{preview.Columns.map(column => <th scope="col" key={column.SourceIndex}>
          {currentVparivanieSecondTier(column)}
        </th>)}</tr> : null}</thead>
        <tbody>{preview.Rows.map(row => <tr key={row.SourceIndex}>
          {rowHeaders.map((header, index) => <th scope="row" key={header}>{rowHeaderText({ index, row, preview,
            products: !!products, product: productRows.get(row.SourceIndex), regions: !!regions, region: regionRows.get(row.SourceIndex),
            attributes: attributeRows.get(row.SourceIndex), workbookRow: workbookRows.get(row.SourceIndex), workbookColumns, sharedNames,
            caption: rowCaption })}</th>)}
          {preview.Columns.map(column => {
            const value = cells.get(`${row.SourceIndex}:${column.SourceIndex}`)
            return <td key={column.SourceIndex} title={value === undefined ? 'Клітинка відсутня' : value.Kind === 'null' ? 'Явне значення NULL' : undefined}>
              {products && value?.Kind === 'decimal' && typeof value.Value === 'string'
                ? previewNumberText(currentVparivanieQuantityText(value.Value))
                : amountColumns.has(column.SourceIndex) && value?.Kind === 'decimal' && typeof value.Value === 'string'
                  ? previewAmountText(value.Value) : previewCellText(value)}
            </td>
          })}
        </tr>)}</tbody>
      </table>
    </div>
    {preview.Page.HasMore ? <Text size="xs" c="dimmed">Показано перші {preview.Page.ReturnedRows} рядків. Повний результат доступний у Excel або PDF.</Text> : null}
  </section>
}

function WorkbookMetadata({ workbook }: { workbook: NativeReportPreview['WorkbookPresentation'] }) {
  if (!workbook) return null
  return <>
    {workbook.fields.some(field => field.placement === 'retainedSetting') ? <Text size="xs" c="dimmed">
      Додаткові поля книги: {workbook.fields.map(field => workbookFieldCaption(field.caption)).join('; ')}. Як і в 1С, у рядках «день / організація» вони не заповнюються.
    </Text> : null}
    {workbook.selection.ordering === 'MonthAscending' ? <Text size="xs">Сортування: по місяцях (за зростанням), як у книзі 1С.</Text> : null}
  </>
}
function rowHeaderText({ index, row, preview, products, product, regions, region, attributes, workbookRow, workbookColumns, sharedNames, caption }: {
  index: number; row: NativeReportPreviewAxis; preview: NativeReportPreview; products: boolean
  product?: CurrentVparivanieProduct; regions: boolean; region?: string | null; attributes?: SettlementCounterpartyAttribute
  workbookRow?: WorkbookRow; workbookColumns: NonNullable<NativeReportPreview['WorkbookPresentation']>['fields']
  sharedNames: readonly ReadonlySet<string>[]; caption: (row: NativeReportPreviewAxis, index: number) => string
}): string {
  if (products) return product?.[CURRENT_VPARIVANIE_PRODUCT_FIELDS[index]] ?? '—'
  if (index < preview.RowSchema.length) return previewCaptionText(caption(row, index), sharedNames[index])
  if (workbookColumns.length) return workbookAttributeText(workbookRow?.values
    .find(value => value.type === workbookColumns[index - preview.RowSchema.length]?.type))
  if (regions) return region ?? '∅'
  return settlementAttributeText(attributes, index === preview.RowSchema.length ? 'manager' : 'region')
}

function workbookRowCaption(caption: string, last: boolean, row: WorkbookRow | undefined,
  fields: NonNullable<NativeReportPreview['WorkbookPresentation']>['fields']): string {
  if (!last || !row) return caption
  return [caption, ...fields.filter(field => field.placement === 'inline')
    .map(field => workbookAttributeText(row.values.find(value => value.type === field.type)))].join(', ')
}

function workbookFieldCaption(caption: string): string {
  return caption.replace(/\(Вместе,/g, '(Разом,')
}

function isAmountColumn(column: NativeReportPreviewAxis): boolean {
  const field = column.Values.at(-1)?.Identity
  return field?.Kind === 'reportField' && typeof field.Value === 'string' && !/Quantity|Count/i.test(field.Value)
}

// Repeated server notes/filters remain separate and ordered. Their stable text
// plus occurrence identifies entries without dropping duplicates.
function entries(values: readonly string[]) {
  const occurrences = new Map<string, number>()
  return values.map(text => {
    const occurrence = (occurrences.get(text) ?? 0) + 1
    occurrences.set(text, occurrence)
    return { key: `${occurrence}:${text}`, text }
  })
}
function filterText(filter: NativeReportPreviewFilter): string {
  const shared = previewSharedNames(filter.Values.map(value => value.trim()))
  const values = filter.Values.map(value => {
    if (/^(?:\[id=\d+\]|[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}|(?:0x)?[\da-f]{32}(?:[\da-f]{32})?)$/i.test(value.trim()))
      return 'Обране точне значення'
    // Captioned values retain the caption; a numeric machine suffix is not a business label.
    return previewCaptionText(value.trim(), shared)
  })
  const description = `${filter.Field} ${filter.Condition}: ${values.length ? values.join(', ') : '—'}`
  return filter.IgnoredReason ? `${description} (${filter.IgnoredReason})` : description
}
function ReportAttribution({ request }: { request: NativeReportPreviewRequest | null | undefined }) {
  return <Stack gap="xs" component="section" aria-label="Про дані звіту">
    <Text component="h3" fw={600} size="sm">Про дані звіту</Text>
    {!request ? <Alert color="yellow" title="Опис розрахунку відсутній">
      Сервер не передав опис розрахунку. Період, застосовані фільтри й обмеження цього результату не зазначені.
    </Alert> : <>
      {request.ProfitReadMode != null ? <Text size="sm">Джерело розрахунку: {profitReadModeLabel(request.ProfitReadMode)}</Text> : null}
      {request.SettlementReadMode != null ? <Text size="sm">Джерело розрахунку: {settlementReadModeLabel(request.SettlementReadMode)}</Text> : null}
      {request.CashReadMode != null ? <Text size="sm">Джерело розрахунку: {cashReadModeLabel(request.CashReadMode)}</Text> : null}
      <SnapshotAttribution request={request} />
      <PeriodAttribution request={request} />
      <IgnoredFilterAttribution filters={request.IgnoredFilters} />
      <AppliedFilterAttribution filters={request.Filters} />
      <NoteAttribution notes={request.Notes} />
    </>}
  </Stack>
}

function SnapshotAttribution({ request }: { request: NativeReportPreviewRequest }) {
  if (request.DataSource === 'NativeCurrentVparivanie') return <Alert color="blue" title="Залишки на кінець періоду та період продажів">
    Залишки показують вільний залишок GBA на кінець вибраного періоду; до останньої синхронізації залишків з 1С вони порожні. Вибраний період стосується продажів.
    {request.ObservationStartedAtUtc && request.ObservationCompletedAtUtc
      ? <Text size="sm">Дані прочитано: {kyivTimestamp(request.ObservationCompletedAtUtc)}</Text>
      : null}
  </Alert>
  if (!request.IsCurrentSnapshot) return null
  return <Alert color="blue" title="Поточний стан">
    Поточний знімок даних, а не історичний стан на вибрану дату.
    {request.ObservationStartedAtUtc && request.ObservationCompletedAtUtc
      ? <Text size="sm">Дані прочитано: {kyivTimestamp(request.ObservationCompletedAtUtc)}</Text>
      : <Text size="sm">Час читання даних сервер не передав.</Text>}
  </Alert>
}

function PeriodAttribution({ request }: { request: NativeReportPreviewRequest }) {
  let period = 'Період розрахунку сервер не зазначив.'
  if (request.HasPeriod) {
    period = request.PeriodFrom && request.PeriodTo
      ? `Період розрахунку: ${request.PeriodFrom} — ${request.PeriodTo}`
      : 'Сервер не передав повні дати періоду розрахунку.'
  }
  return <>
    <Text size="sm">{period}</Text>
    {request.ComparisonPeriodFrom || request.ComparisonPeriodTo ? <Text size="sm">
      Період порівняння: {request.ComparisonPeriodFrom ?? 'не зазначено'} — {request.ComparisonPeriodTo ?? 'не зазначено'}
    </Text> : null}
  </>
}

function IgnoredFilterAttribution({ filters }: { filters: NativeReportPreviewFilter[] | null }) {
  if (filters === null) return <Alert color="yellow" title="Відомості про незастосовані фільтри відсутні">
    Сервер не передав перелік незастосованих фільтрів.
  </Alert>
  if (filters.length === 0) return null
  return <Alert color="yellow" title="Увага: фільтри не застосовано">
    <ul>{entries(filters.map(filterText)).map(item => <li key={item.key}>{item.text}</li>)}</ul>
  </Alert>
}

function AppliedFilterAttribution({ filters }: { filters: NativeReportPreviewFilter[] | null }) {
  if (filters === null) return <Text size="sm">Сервер не передав відомості про застосовані фільтри.</Text>
  if (filters.length === 0) return <Text size="sm">Відборів немає.</Text>
  return <div>
    <Text size="sm" fw={600}>Застосовані фільтри</Text>
    <ul>{entries(filters.map(filterText)).map(item => <li key={item.key}>{item.text}</li>)}</ul>
  </div>
}

function NoteAttribution({ notes }: { notes: string[] | null }) {
  if (notes === null) return <Text size="sm">Сервер не передав примітки до розрахунку.</Text>
  if (notes.length === 0) return <Text size="sm">Додаткових приміток сервера немає.</Text>
  return <div>
    <Text size="sm" fw={600}>Як розраховано</Text>
    <ul>{entries(notes).map(item => <li key={item.key}>{item.text}</li>)}</ul>
  </div>
}

function kyivTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const parts = Object.fromEntries(new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(part => [part.type, part.value]))
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`
}
