import { currentVparivanieAnalysisCapability } from '../data/currentVparivanieAnalysis'
import { currentVparivanieFullScopeAvailable } from '../data/currentVparivanie'
import { Alert, Checkbox, Group, Stack, Text } from '@mantine/core'
import { ArrowLeftRight } from 'lucide-react'
import { currentVparivanieMovementsAvailable, MOVEMENT_FILTER_NOTICE, type CurrentVparivanieMovementSelection } from '../data/currentVparivanieMovements'
import type { ReportDataset } from '../types'

export function CurrentVparivanieMovementSettings({ dataset, value, onChange, disabled }: {
  dataset: ReportDataset | null | undefined
  value: CurrentVparivanieMovementSelection
  onChange: (value: CurrentVparivanieMovementSelection) => void
  disabled: boolean
}) {
  if (!currentVparivanieMovementsAvailable(dataset) || !currentVparivanieFullScopeAvailable(dataset)) return null
  return <Stack gap="xs" role="group" aria-label="Показники руху товару">
    <Text size="sm" fw={600}><Group component="span" gap={6} wrap="nowrap"><ArrowLeftRight size={16} aria-hidden="true" />Рух товару за період</Group></Text>
    <Group>
      <Checkbox label="Прихід" checked={value.Incoming} disabled={disabled}
        onChange={event => onChange({ ...value, Incoming: event.currentTarget.checked })} />
      <Checkbox label="Розхід" checked={value.Outgoing} disabled={disabled}
        onChange={event => onChange({ ...value, Outgoing: event.currentTarget.checked })} />
    </Group>
    {value.Incoming || value.Outgoing ? <Alert color="blue">Обробляються всі товари вибраного відбору. {currentVparivanieAnalysisCapability(dataset) ? 'Період застосовується до продажів і фізичного руху; склад — до залишків і руху. Відбори покупця, договору й менеджера застосовуються до всіх продажів, без розподілу складського руху за покупцями.' : MOVEMENT_FILTER_NOTICE}</Alert> : null}
  </Stack>
}
