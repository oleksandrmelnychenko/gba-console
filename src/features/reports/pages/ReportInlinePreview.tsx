import { TableChip } from '../../../shared/ui/TableChip'
import { settlementAttributeText, type SettlementCounterpartyAttribute } from '../data/settlementSourceAttributes'
import { Fragment } from 'react'
import { Alert, Text } from '@mantine/core'
import { isZeroPreviewScalar, previewAmountText, previewBlanksZero, previewCaptionText, previewCellText, previewNumberText, previewSharedNames, type CurrentVparivanieProduct, type NativeReportPreview, type NativeReportPreviewAxis, type NativeReportPreviewCell, type NativeReportPreviewFilter, type NativeReportPreviewRequest, type NativeReportPreviewScalar } from '../data/nativeReportPreview'
import { CURRENT_VPARIVANIE_PRODUCT_CAPTIONS, CURRENT_VPARIVANIE_PRODUCT_FIELDS, currentVparivanieQuantityText } from '../data/currentVparivanie'
import { currentVparivanieSecondTier } from '../data/currentVparivanieColumns'
import './report-inline-preview.css'
import { workbookAttributeText, type WorkbookRow } from '../data/workbookPreview'
import { deskRowsText } from '../data/workbookDesk'

export function ReportInlinePreview({ preview, embedded = false }: { preview: NativeReportPreview; embedded?: boolean }) {
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
  const blanksZero = previewBlanksZero(preview.Request?.DataSource)
  const totals = preview.Totals
  const groupTotals = new Map<number, NonNullable<NativeReportPreview['Totals']>['Groups']>()
  for (const group of totals?.Groups ?? []) groupTotals.set(group.RowSourceIndex, [...(groupTotals.get(group.RowSourceIndex) ?? []), group]
    .sort((left, right) => left.Level - right.Level))
  const valueText = (value: NativeReportPreviewScalar | undefined, columnSourceIndex: number) =>
    blanksZero && isZeroPreviewScalar(value) ? ''
      : products && value?.Kind === 'decimal' && typeof value.Value === 'string'
        ? previewNumberText(currentVparivanieQuantityText(value.Value))
        : amountColumns.has(columnSourceIndex) && value?.Kind === 'decimal' && typeof value.Value === 'string'
          ? previewAmountText(value.Value) : previewCellText(value)
  const totalCells = (values: NativeReportPreviewCell[]) => {
    const byColumn = new Map(values.map(cell => [cell.ColumnSourceIndex, cell.Value]))
    return preview.Columns.map(column => {
      const value = byColumn.get(column.SourceIndex)
      return <td key={column.SourceIndex}>{value === undefined ? '' : valueText(value, column.SourceIndex)}</td>
    })
  }
  const rowHeaders = products ? CURRENT_VPARIVANIE_PRODUCT_CAPTIONS : [...preview.RowSchema.map((level, index) => [level.Caption || `Рівень ${index + 1}`,
    ...(index === preview.RowSchema.length - 1 ? inlineFields.map(field => field.caption) : [])].join(', ')),
    ...(attributes ? ['Основний менеджер покупця', 'Код по региону'] : []), ...(regions ? ['Код по региону'] : []),
    ...workbookColumns.map(field => field.caption)]
  const levelCount = products ? 0 : preview.RowSchema.length
  const totalledLevels = new Set(totals?.Groups.map(group => group.Level))
  const repeated = preview.Rows.map((row, rowIndex) => preview.RowSchema.map((_, level) => level < levelCount - 1 && (totalledLevels.has(level)
    || rowIndex > 0 && preview.RowSchema.slice(0, level + 1).every((__, upper) => rowCaption(row, upper) === rowCaption(preview.Rows[rowIndex - 1], upper)))))
  return <section className="app-section-card report-inline-preview" aria-label="Попередній перегляд звіту">
    <div className="report-inline-preview__heading">
      {!embedded ? <Text component="h2" fw={600} size="sm" className="report-inline-preview__title">Таблиця на екрані</Text> : null}
      <Text size="sm" className="report-inline-preview__count">{deskRowsText(preview.Page.ReturnedRows, preview.Page.TotalVisibleRows, preview.Page.HasMore)}</Text>
    </div>
    <ReportAttributionWarnings request={preview.Request} />
    <div className="report-inline-preview__scroll" tabIndex={0} role="region" aria-label="Таблиця попереднього перегляду">
      <table className="app-static-table">
        <thead><tr>
          {rowHeaders.map((header, index) => <th scope="col" rowSpan={products ? 2 : undefined} key={`row-${index}`}>{header}</th>)}
          {preview.Columns.map(column => <th scope="col" key={column.SourceIndex}>
            {(products ? column.Values.slice(0, 1) : sharedGroup ? column.Values.slice(1) : column.Values).map(value => value.Caption).filter(Boolean).join(' / ') || `Стовпець ${column.Ordinal + 1}`}
          </th>)}
        </tr>{products ? <tr>{preview.Columns.map(column => <th scope="col" key={column.SourceIndex}>
          {currentVparivanieSecondTier(column)}
        </th>)}</tr> : null}</thead>
        <tbody>{preview.Rows.map((row, rowIndex) => <Fragment key={row.SourceIndex}>
          {(groupTotals.get(row.SourceIndex) ?? []).map(group => <tr key={`group-${group.Level}`}
            className="report-inline-preview__group-total" data-level={group.Level}>
            <th scope="row" colSpan={rowHeaders.length}>
              {`Підсумок: ${previewCaptionText(rowCaption(row, group.Level), sharedNames[group.Level])}`}
            </th>
            {totalCells(group.Values)}
          </tr>)}
          <tr>
          {rowHeaders.map((header, index) => {
            const caption = rowHeaderText({ index, row, preview,
              products: !!products, product: productRows.get(row.SourceIndex), regions: !!regions, region: regionRows.get(row.SourceIndex),
              attributes: attributeRows.get(row.SourceIndex), workbookRow: workbookRows.get(row.SourceIndex), workbookColumns, sharedNames,
              caption: rowCaption })
            const isOrganization = !products && index < levelCount
              && /^(Організація|Организация|Організація партії)$/iu.test(preview.RowSchema[index]?.Caption?.trim() ?? '')
            return <th scope="row" key={header} data-level={index < levelCount ? index : undefined}
              className={repeated[rowIndex]?.[index] ? 'is-repeat' : undefined}>
              {isOrganization && !repeated[rowIndex]?.[index] ? <TableChip tone="product" value={caption} /> : caption}
            </th>
          })}
          {preview.Columns.map(column => {
            const value = cells.get(`${row.SourceIndex}:${column.SourceIndex}`)
            return <td key={column.SourceIndex} title={value === undefined ? 'Клітинка відсутня' : value.Kind === 'null' ? 'Явне значення NULL' : undefined}>
              {valueText(value, column.SourceIndex)}
            </td>
          })}
          </tr>
        </Fragment>)}</tbody>
        {totals ? <tfoot><tr className="report-inline-preview__grand-total">
          <th scope="row" colSpan={rowHeaders.length}>Загальний підсумок</th>
          {totalCells(totals.Values)}
        </tr></tfoot> : null}
      </table>
    </div>
    {preview.Page.HasMore ? <Text size="xs" c="dimmed" className="report-inline-preview__more">Показано перші {preview.Page.ReturnedRows} рядків. Повний результат доступний у Excel або PDF.{totals
      ? ` Загальний підсумок — за всіма ${preview.Page.TotalVisibleRows} рядками звіту.` : ''}</Text> : null}
  </section>
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

function isAmountColumn(column: NativeReportPreviewAxis): boolean {
  const field = column.Values.at(-1)?.Identity
  return field?.Kind === 'reportField' && typeof field.Value === 'string' && !/Quantity|Count/i.test(field.Value)
}

// Repeated ignored filters remain separate and ordered. Their stable text
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
function ReportAttributionWarnings({ request }: { request: NativeReportPreviewRequest | null | undefined }) {
  if (!request) return <Alert color="yellow" title="Опис розрахунку відсутній">
    Сервер не передав опис розрахунку. Період, застосовані фільтри й обмеження цього результату не зазначені.
  </Alert>
  return <>
    <SnapshotAttribution request={request} />
    <IgnoredFilterAttribution filters={request.IgnoredFilters} />
  </>
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

function IgnoredFilterAttribution({ filters }: { filters: NativeReportPreviewFilter[] | null }) {
  if (filters === null) return <Alert color="yellow" title="Відомості про незастосовані фільтри відсутні">
    Сервер не передав перелік незастосованих фільтрів.
  </Alert>
  if (filters.length === 0) return null
  return <Alert color="yellow" title="Увага: фільтри не застосовано">
    <ul>{entries(filters.map(filterText)).map(item => <li key={item.key}>{item.text}</li>)}</ul>
  </Alert>
}

function kyivTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const parts = Object.fromEntries(new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(part => [part.type, part.value]))
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`
}
