import { Badge, Text } from '@mantine/core'
import { previewScalarText, type NativeReportPreview } from '../data/nativeReportPreview'
import './report-inline-preview.css'

export function ReportInlinePreview({ preview }: { preview: NativeReportPreview }) {
  const cells = new Map(preview.Cells.map(cell => [`${cell.RowSourceIndex}:${cell.ColumnSourceIndex}`, cell.Value]))
  const rowHeaders = preview.RowSchema.map((level, index) => level.Caption || `Рівень ${index + 1}`)
  return <section className="app-section-card report-inline-preview" aria-label="Попередній перегляд звіту">
    <div className="report-inline-preview__heading">
      <Text component="h2" fw={600} size="sm">Дані звіту</Text>
      <Badge variant="light">{preview.Page.ReturnedRows} із {preview.Page.TotalVisibleRows} рядків</Badge>
    </div>
    <Text size="xs" c="dimmed">Порожня клітинка: — · явне значення NULL: ∅. Підсумки показано лише якщо вони є в даних сервера.</Text>
    <div className="report-inline-preview__scroll" tabIndex={0} role="region" aria-label="Таблиця попереднього перегляду">
      <table>
        <thead><tr>
          {rowHeaders.map((header, index) => <th scope="col" key={`row-${index}`}>{header}</th>)}
          {preview.Columns.map(column => <th scope="col" key={column.SourceIndex}>
            {column.Values.map(value => value.Caption).filter(Boolean).join(' / ') || `Стовпець ${column.Ordinal + 1}`}
          </th>)}
        </tr></thead>
        <tbody>{preview.Rows.map(row => <tr key={row.SourceIndex}>
          {rowHeaders.map((_, index) => <th scope="row" key={index}>{row.Values[index]?.Caption ?? '—'}</th>)}
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
