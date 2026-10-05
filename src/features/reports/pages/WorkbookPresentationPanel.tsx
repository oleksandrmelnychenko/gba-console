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

function WorkbookFieldControls({ capability, selection, request, disabled, onChange }: {
  capability: NonNullable<ReturnType<typeof readWorkbookCapability>>; selection: WorkbookSelection | null
  request: ReportRequestBody; disabled: boolean; onChange: (value: WorkbookSelection) => void
}) {
  const selected = new Set(selection?.additionalFields)
  const grouped = request.groupedSettlementPeriod ?? request.GroupedSettlementPeriod
  const fenix = !!grouped && typeof grouped === 'object' && ('SourceWorld' in grouped ? grouped.SourceWorld : 'sourceWorld' in grouped ? grouped.sourceWorld : null) === 'Fenix'
  const periodBasis = request.dayOrganizationBasis ?? request.DayOrganizationBasis
  const unavailable = request.dataSource === 35 && periodBasis !== 0 || request.dataSource === 40 && request.groupedCashPeriod == null
    && request.GroupedCashPeriod == null || request.dataSource === 41 && grouped == null
  return <>
    {capability.additionalFields.map(field => <Checkbox key={field.type} label={field.caption} checked={selected.has(field.type)}
      disabled={disabled || unavailable || [60, 61].includes(field.type) && !fenix}
      onChange={event => onChange({ version: 1, ordering: selection?.ordering ?? null,
        additionalFields: event.currentTarget.checked ? [...(selection?.additionalFields ?? []), field.type]
          : (selection?.additionalFields ?? []).filter(type => type !== field.type) })} />)}
    {capability.orderings.length ? <Select label="Порядок форми" disabled={disabled || unavailable} allowDeselect={false}
      value={selection?.ordering ?? 'default'} data={[{ value: 'default', label: 'Порядок набору даних' },
        { value: 'MonthAscending', label: 'Місяць за зростанням' }]}
      onChange={value => { if (value === 'default' || value === 'MonthAscending') onChange({ version: 1,
        additionalFields: [...(selection?.additionalFields ?? [])], ordering: value === 'default' ? null : value }) }} /> : null}
    {request.dataSource === 35 ? <Text size="xs" c="dimmed">
      Артикул і Топ зберігають налаштування книги. Значення товарів на рівні день / організація не створюються.
    </Text> : <Text size="xs" c="dimmed">Додаткові поля не змінюють фінансові групування. Невідомі значення залишаються недоступними.</Text>}
  </>
}
