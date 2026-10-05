import { Alert, Button, Card, Checkbox, Select, Stack, Text } from '@mantine/core'
import type { ReportDataset, ReportRequestBody } from '../types'
import { readWorkbookCapability, readWorkbookSelection, workbookConfigurationError, type WorkbookSelection } from '../data/workbookPresentation'

export function WorkbookPresentationPanel({ dataset, request, value, disabled, onChange }: {
  dataset?: ReportDataset; request: ReportRequestBody; value: unknown; disabled: boolean
  onChange: (value: WorkbookSelection | undefined) => void
}) {
  const capability = dataset ? readWorkbookCapability(dataset.workbookPresentation, dataset.DataSource) : null
  const selection = value == null ? null : readWorkbookSelection(value)
  const invalid = value != null ? workbookConfigurationError({ ...request, workbookPresentation: value }, dataset) : null
  if (!capability && value == null) return null
  return <Card withBorder radius="md" padding="md" mt="sm">
    <Stack gap="xs">
      <Text fw={600}>Додаткові поля форми</Text>
      {invalid ? <Alert color="yellow">{invalid} Збережені налаштування не змінено.</Alert> : null}
      {capability ? <WorkbookFieldControls capability={capability} selection={selection} request={request}
        disabled={disabled || !!invalid} onChange={onChange} /> : null}
      {value != null ? <Button variant="subtle" size="xs" disabled={disabled} onClick={() => onChange(undefined)}>
        Очистити налаштування форми
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
    {capability.additionalFields.map(field => <WorkbookFieldItem key={field.type} field={field} selection={selection}
      disabled={controlsDisabled} fenix={availability.fenix} onChange={onChange} />)}
    {capability.orderings.length > 0 ? <WorkbookOrderingControl selection={selection} disabled={controlsDisabled} onChange={onChange} /> : null}
    <WorkbookFieldsNote dataSource={request.dataSource} />
  </>
}

function WorkbookFieldItem({ field, selection, disabled, fenix, onChange }: {
  field: WorkbookCapability['additionalFields'][number]; selection: WorkbookSelection | null
  disabled: boolean; fenix: boolean; onChange: (value: WorkbookSelection) => void
}) {
  const fields = selection?.additionalFields ?? []
  const locked = disabled || [60, 61].includes(field.type) && !fenix
  return <Checkbox label={field.caption} checked={fields.includes(field.type)} disabled={locked}
    onChange={event => onChange({ version: 1, ordering: selection?.ordering ?? null,
      additionalFields: event.currentTarget.checked ? [...fields, field.type] : fields.filter(type => type !== field.type) })} />
}

function WorkbookOrderingControl({ selection, disabled, onChange }: {
  selection: WorkbookSelection | null; disabled: boolean; onChange: (value: WorkbookSelection) => void
}) {
  function changeOrdering(value: string | null) {
    if (value !== 'default' && value !== 'MonthAscending') return
    onChange({ version: 1, additionalFields: [...(selection?.additionalFields ?? [])],
      ordering: value === 'default' ? null : value })
  }
  return <Select label="Порядок форми" disabled={disabled} allowDeselect={false}
    value={selection?.ordering ?? 'default'} data={[{ value: 'default', label: 'Порядок набору даних' },
      { value: 'MonthAscending', label: 'Місяць за зростанням' }]} onChange={changeOrdering} />
}

function WorkbookFieldsNote({ dataSource }: { dataSource: number | undefined }) {
  if (dataSource === 35) return <Text size="xs" c="dimmed">
    Артикул і Топ зберігають налаштування книги. Значення товарів на рівні день / організація не створюються.
  </Text>
  return <Text size="xs" c="dimmed">Додаткові поля не змінюють фінансові групування. Невідомі значення залишаються недоступними.</Text>
}
