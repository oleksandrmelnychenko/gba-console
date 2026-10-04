import { settlementAttributeText } from '../data/settlementSourceAttributes'
import { Alert, Badge, Stack, Text } from '@mantine/core'
import { previewScalarText, type NativeReportPreview, type NativeReportPreviewFilter, type NativeReportPreviewRequest } from '../data/nativeReportPreview'
import { CURRENT_VPARIVANIE_PRODUCT_CAPTIONS, CURRENT_VPARIVANIE_PRODUCT_FIELDS } from '../data/currentVparivanie'
import { currentVparivanieSecondTier } from '../data/currentVparivanieColumns'
import './report-inline-preview.css'

export function ReportInlinePreview({ preview }: { preview: NativeReportPreview }) {
  const cells = new Map(preview.Cells.map(cell => [`${cell.RowSourceIndex}:${cell.ColumnSourceIndex}`, cell.Value]))
  const products = preview.CurrentVparivanieProducts
  const regions = preview.ClientDiscountRecipientRegions
  const regionRows = new Map(regions?.Rows.map(row => [row.RowSourceIndex, row.RegionCode]))
  const attributes = preview.SettlementCounterpartyAttributes
  const attributeRows = new Map(attributes?.Rows.map(row => [row.RowSourceIndex, row]))
  const productRows = new Map(products?.Rows.map(row => [row.RowSourceIndex, row]))
  const rowHeaders = products ? CURRENT_VPARIVANIE_PRODUCT_CAPTIONS : [...preview.RowSchema.map((level, index) => level.Caption || `Рівень ${index + 1}`),
    ...(attributes ? ['Основний менеджер покупця', 'Код по региону'] : []), ...(regions ? ['Код по региону'] : [])]
  return <section className="app-section-card report-inline-preview" aria-label="Попередній перегляд звіту">
    <div className="report-inline-preview__heading">
      <Text component="h2" fw={600} size="sm">Дані звіту</Text>
      <Badge variant="light">{preview.Page.ReturnedRows} із {preview.Page.TotalVisibleRows} рядків</Badge>
    </div>
    <ReportAttribution request={preview.Request} />
    <Text size="xs" c="dimmed">Порожня клітинка: — · явне значення NULL: ∅. Підсумки показано лише якщо вони є в даних сервера.</Text>
    <div className="report-inline-preview__scroll" tabIndex={0} role="region" aria-label="Таблиця попереднього перегляду">
      <table>
        <thead><tr>
          {rowHeaders.map((header, index) => <th scope="col" rowSpan={products ? 2 : undefined} key={`row-${index}`}>{header}</th>)}
          {preview.Columns.map(column => <th scope="col" key={column.SourceIndex}>
            {(products ? column.Values.slice(0, 1) : column.Values).map(value => value.Caption).filter(Boolean).join(' / ') || `Стовпець ${column.Ordinal + 1}`}
          </th>)}
        </tr>{products ? <tr>{preview.Columns.map(column => <th scope="col" key={column.SourceIndex}>
          {currentVparivanieSecondTier(column)}
        </th>)}</tr> : null}</thead>
        <tbody>{preview.Rows.map(row => <tr key={row.SourceIndex}>
          {rowHeaders.map((header, index) => <th scope="row" key={header}>{products
            ? productRows.get(row.SourceIndex)?.[CURRENT_VPARIVANIE_PRODUCT_FIELDS[index]] ?? '—'
            : index < preview.RowSchema.length ? row.Values[index]?.Caption ?? '—'
              : regions ? regionRows.get(row.SourceIndex) ?? '∅'
                : settlementAttributeText(attributeRows.get(row.SourceIndex), index === preview.RowSchema.length ? 'manager' : 'region')}</th>)}
          {preview.Columns.map(column => {
            const value = cells.get(`${row.SourceIndex}:${column.SourceIndex}`)
            return <td key={column.SourceIndex} title={value === undefined ? 'Клітинка відсутня' : value.Kind === 'null' ? 'Явне значення NULL' : undefined}>
              {previewScalarText(value)}
            </td>
          })}
        </tr>)}</tbody>
      </table>
    </div>
    {preview.Page.HasMore ? <Text size="xs" c="dimmed">Показано перші {preview.Page.ReturnedRows} рядків. Повний результат доступний у Excel або PDF.</Text> : null}
  </section>
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
  const values = filter.Values.map(value => {
    if (/^(?:\[id=\d+\]|[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}|(?:0x)?[\da-f]{32}(?:[\da-f]{32})?)$/i.test(value.trim()))
      return 'Обране точне значення'
    // Captioned values retain the caption; a numeric machine suffix is not a business label.
    return value.replace(/\s*\[id=\d+\]\s*$/i, '')
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
      <SnapshotAttribution request={request} />
      <PeriodAttribution request={request} />
      <IgnoredFilterAttribution filters={request.IgnoredFilters} />
      <AppliedFilterAttribution filters={request.Filters} />
      <NoteAttribution notes={request.Notes} />
    </>}
  </Stack>
}

function SnapshotAttribution({ request }: { request: NativeReportPreviewRequest }) {
  if (request.DataSource === 'NativeCurrentVparivanie') return <Alert color="blue" title="Поточні залишки та період продажів">
    Залишки показують поточну записану вільну кількість GBA. Вибраний період стосується продажів; історичний залишок на кінець періоду не розраховується.
    {request.ObservationStartedAtUtc && request.ObservationCompletedAtUtc
      ? <Text size="sm">Спостереження сервера: {request.ObservationStartedAtUtc} — {request.ObservationCompletedAtUtc}</Text>
      : <Text size="sm">Час спостереження сервер не передав повністю.</Text>}
  </Alert>
  if (!request.IsCurrentSnapshot) return null
  return <Alert color="blue" title="Поточний стан">
    Поточний знімок даних, а не історичний стан на вибрану дату.
    {request.ObservationStartedAtUtc && request.ObservationCompletedAtUtc
      ? <Text size="sm">Спостереження сервера: {request.ObservationStartedAtUtc} — {request.ObservationCompletedAtUtc}</Text>
      : <Text size="sm">Час спостереження сервер не передав повністю.</Text>}
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
  if (filters.length === 0) return <Text size="sm">Сервер не зазначив застосованих фільтрів.</Text>
  return <div>
    <Text size="sm" fw={600}>Застосовані фільтри</Text>
    <ul>{entries(filters.map(filterText)).map(item => <li key={item.key}>{item.text}</li>)}</ul>
  </div>
}

function NoteAttribution({ notes }: { notes: string[] | null }) {
  if (notes === null) return <Text size="sm">Сервер не передав примітки до розрахунку.</Text>
  if (notes.length === 0) return <Text size="sm">Додаткових приміток сервера немає.</Text>
  return <div>
    <Text size="sm" fw={600}>Примітки сервера</Text>
    <ul>{entries(notes).map(item => <li key={item.key}>{item.text}</li>)}</ul>
  </div>
}
