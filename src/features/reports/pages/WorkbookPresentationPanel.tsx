import { CurrentProductFieldsPanel } from './CurrentProductFieldsPanel'
import { Alert, Button, Card, Checkbox, Group, Select, Stack, Text } from '@mantine/core'
import { ArrowDownWideNarrow, ListPlus, RotateCcw } from 'lucide-react'
import { TableChip } from '../../../shared/ui/TableChip'
import '../../../shared/ui/selection-surface.css'
import type { ReportDataset, ReportRequestBody } from '../types'
import { currentProductCapability, readWorkbookCapability, readWorkbookSelection, workbookConfigurationError, type WorkbookSelection } from '../data/workbookPresentation'

export function WorkbookPresentationPanel({ dataset, request, value, disabled, onChange }: {
  dataset?: ReportDataset; request: ReportRequestBody; value: unknown; disabled: boolean
  onChange: (value: WorkbookSelection | undefined) => void
}) {
  const capability = dataset ? readWorkbookCapability(dataset.workbookPresentation, dataset.DataSource) : null
  const selection = value == null ? null : readWorkbookSelection(value)
  const invalid = value != null ? workbookConfigurationError({ ...request, workbookPresentation: value }, dataset) : null
  if (dataset?.DataSource === 2) return <CurrentProductFieldsPanel capability={currentProductCapability(dataset)} request={request} value={value} disabled={disabled} onChange={onChange} />
  if (!capability && value == null) return null
  return <Card className="workbook-presentation" withBorder radius="md" padding="md">
    <Stack gap="xs">
      {invalid ? <Alert color="yellow">{invalid} Збережені налаштування не змінено.</Alert> : null}
      {capability ? <WorkbookFieldControls capability={capability} selection={selection} request={request}
        disabled={disabled || !!invalid} onChange={onChange} /> : null}
      {value != null ? <Button className="workbook-presentation__reset" type="button" variant="default" size="xs" leftSection={<RotateCcw size={14} aria-hidden="true" />} disabled={disabled} onClick={() => onChange(undefined)}>
        Прибрати додаткові поля книги
      </Button> : null}
    </Stack>
  </Card>
}

type WorkbookCapability = NonNullable<ReturnType<typeof readWorkbookCapability>>
type WorkbookControlsProps = {
  capability: WorkbookCapability; selection: WorkbookSelection | null
  request: ReportRequestBody; disabled: boolean; onChange: (value: WorkbookSelection) => void
}

function workbookFieldAvailability(request: ReportRequestBody) {
  const grouped = request.groupedSettlementPeriod ?? request.GroupedSettlementPeriod
  const fenix = readSettlementWorld(grouped) === 'Fenix'
  const periodBasis = request.dayOrganizationBasis ?? request.DayOrganizationBasis
  let unavailable = false
  if (request.dataSource === 35) unavailable = periodBasis !== 0
  if (request.dataSource === 40) unavailable = request.groupedCashPeriod == null && request.GroupedCashPeriod == null
  if (request.dataSource === 41) unavailable = grouped == null
  return { fenix, unavailable }
}

function readSettlementWorld(grouped: unknown) {
  if (!grouped || typeof grouped !== 'object') return null
  if ('SourceWorld' in grouped) return grouped.SourceWorld
  if ('sourceWorld' in grouped) return grouped.sourceWorld
  return null
}

function WorkbookFieldControls({ capability, selection, request, disabled, onChange }: WorkbookControlsProps) {
  const availability = workbookFieldAvailability(request)
  const controlsDisabled = disabled || availability.unavailable
  return <>
    <div className="workbook-presentation__grid">
    <section className="workbook-advanced-card" aria-label="Додаткові поля форми">
      <Group gap={6} className="workbook-advanced-card__heading"><ListPlus size={16} aria-hidden="true" /><Text component="h4">Додаткові поля форми</Text><TableChip value={selection?.additionalFields.length ?? 0} /></Group>
      <div className="workbook-presentation__fields">
    {capability.additionalFields.map(field => <WorkbookFieldItem key={field.type} field={field} selection={selection}
      disabled={controlsDisabled} fenix={availability.fenix} onChange={onChange} />)}
      </div>
      <WorkbookFieldsNote dataSource={request.dataSource} />
    </section>
    {capability.orderings.length > 0 ? <section className="workbook-advanced-card" aria-label="Порядок рядків">
      <Group gap={6} className="workbook-advanced-card__heading"><ArrowDownWideNarrow size={16} aria-hidden="true" /><Text component="h4">Порядок рядків</Text></Group>
      <WorkbookOrderingControl selection={selection} disabled={controlsDisabled} onChange={onChange} />
    </section> : null}
    </div>
  </>
}

function WorkbookFieldItem({ field, selection, disabled, fenix, onChange }: {
  field: WorkbookCapability['additionalFields'][number]; selection: WorkbookSelection | null
  disabled: boolean; fenix: boolean; onChange: (value: WorkbookSelection) => void
}) {
  const fields = selection?.additionalFields ?? []
  const locked = disabled || [60, 61].includes(field.type) && !fenix
  return <div className="workbook-presentation__option app-selection-surface" data-selected={fields.includes(field.type)} data-disabled={locked}>
    <Checkbox label={field.caption.replace(/^Номенклатура\./, '').replace(/\s*\((?:Окремо|Вместе|Разом),.*\)$/, '')} checked={fields.includes(field.type)} disabled={locked}
    onChange={event => onChange({ version: 1, ordering: selection?.ordering ?? null,
      additionalFields: event.currentTarget.checked ? [...fields, field.type] : fields.filter(type => type !== field.type) })} />
  </div>
}

function WorkbookOrderingControl({ selection, disabled, onChange }: {
  selection: WorkbookSelection | null; disabled: boolean; onChange: (value: WorkbookSelection) => void
}) {
  function changeOrdering(value: string | null) {
    if (value !== 'default' && value !== 'MonthAscending') return
    onChange({ version: 1, additionalFields: [...(selection?.additionalFields ?? [])],
      ordering: value === 'default' ? null : value })
  }
  return <Select label="Сортування" disabled={disabled} allowDeselect={false}
    value={selection?.ordering ?? 'default'} data={[{ value: 'default', label: 'За днями' },
      { value: 'MonthAscending', label: 'За місяцями, за зростанням' }]} onChange={changeOrdering} />
}

function WorkbookFieldsNote({ dataSource }: { dataSource: number | undefined }) {
  if (dataSource === 35) return <Text size="xs" c="dimmed">
    У рядках «день / організація» Артикул і Топ порожні.
  </Text>
  return null
}
