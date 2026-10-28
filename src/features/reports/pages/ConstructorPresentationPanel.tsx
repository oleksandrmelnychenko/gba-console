import { Checkbox, Group } from '@mantine/core'
import type { ReportDataset, ReportRequestBody } from '../types'
import { constructorPresentationSupported, defaultConstructorPresentation, readConstructorPresentation, requestConstructorPresentation, type ConstructorPresentation } from '../data/constructorPresentation'
export function ConstructorPresentationPanel({ dataset, request, disabled, onChange }: {
  dataset?: ReportDataset; request: ReportRequestBody; disabled: boolean; onChange: (value: ConstructorPresentation) => void
}) {
  if (!constructorPresentationSupported(dataset) || !['sales', 'grossProfit'].includes(String(request.reportProfile))) return null
  const value = readConstructorPresentation(requestConstructorPresentation(request)) ?? defaultConstructorPresentation
  return <Group gap="md" role="group" aria-label="Оформлення звіту">
    <Checkbox label="Від’ємні значення червоним" checked={value.negativeRed} disabled={disabled}
      onChange={event => onChange({ ...value, negativeRed: event.currentTarget.checked })} />
    <Checkbox label="Загальний підсумок" checked={value.grandTotals} disabled={disabled}
      onChange={event => onChange({ ...value, grandTotals: event.currentTarget.checked })} />
  </Group>
}
