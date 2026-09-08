import { Alert, Button, Card, Group, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { useMemo } from 'react'
import { buildRegisterQuery } from './query'
import { RegisterFieldEditor } from './components/RegisterFieldEditor'
import { RegisterSelectionEditor } from './components/RegisterSelectionEditor'
import { validateRegisterDescriptor } from './validation'
import type { RegisterPeriodDraft, SourceRegisterDescriptorWire, SourceRegisterQueryDraft, SourceRegisterQueryWire } from './types'
import './sourceRegisterReports.css'

export type SourceRegisterReportBuilderProps = {
  descriptor: SourceRegisterDescriptorWire
  registerLabel: string
  value: SourceRegisterQueryDraft
  onChange: (value: SourceRegisterQueryDraft) => void
  onSubmit: (query: SourceRegisterQueryWire) => void
  disabled?: boolean
  busy?: boolean
}

function PeriodEditor({ label, value, disabled, onChange }: { label: string; value: RegisterPeriodDraft; disabled: boolean; onChange: (value: RegisterPeriodDraft) => void }) {
  return <fieldset className="source-register-period"><legend>{label}</legend><Stack gap="xs">
    <SimpleGrid cols={{ base: 1, xs: 2 }}>
      <TextInput label={`${label}: дата`} type="date" min="0001-01-01" max="9999-12-31" value={value.date} disabled={disabled}
        onChange={event => onChange({ ...value, date: event.currentTarget.value })} />
      <TextInput label={`${label}: час`} type="time" step="1" value={value.time} disabled={disabled}
        onChange={event => onChange({ ...value, time: event.currentTarget.value })} />
    </SimpleGrid>
    <details><summary>Точність до часток секунди</summary>
      <TextInput label={`${label}: частки секунди`} description="До 7 цифр після коми. Наприклад, 5 означає половину секунди." inputMode="numeric" maxLength={7}
        value={value.fraction} disabled={disabled} onChange={event => onChange({ ...value, fraction: event.currentTarget.value })} />
    </details>
  </Stack></fieldset>
}

function RegisterBuilderForm({ descriptor, registerLabel, value, onChange, onSubmit, disabled = false, busy = false }: SourceRegisterReportBuilderProps) {
  const blocked = disabled || busy
  const validation = useMemo(() => {
    try { return { query: buildRegisterQuery(descriptor, value), error: null } }
    catch (error) { return { query: null, error: error instanceof Error ? error.message : 'Некоректні параметри звіту.' } }
  }, [descriptor, value])
  return <form className="source-register-reports" aria-label="Конструктор регістрового звіту" onSubmit={event => {
    event.preventDefault()
    if (!blocked && validation.query) onSubmit(buildRegisterQuery(descriptor, value))
  }}><Stack gap="md">
    <div><Text component="h2" fw={600}>{registerLabel}</Text><Text size="sm">Джерело: {descriptor.schema.world}</Text></div>
    <Card withBorder><Stack gap="sm">
      <Text fw={600}>Період звіту</Text>
      <Text size="sm">Початкова межа входить у період, кінцева — не входить. Дата й час відповідають локальному часу джерела.</Text>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <PeriodEditor label="Від (включно)" value={value.from} disabled={blocked} onChange={from => onChange({ ...value, from })} />
        <PeriodEditor label="До (не включно)" value={value.toExclusive} disabled={blocked} onChange={toExclusive => onChange({ ...value, toExclusive })} />
      </SimpleGrid>
    </Stack></Card>
    <SimpleGrid cols={{ base: 1, md: 2 }}>
      <RegisterFieldEditor label="Рядки" fields={descriptor.dimensions} value={value.rowFields} otherAxis={value.columnFields} disabled={blocked} onChange={rowFields => onChange({ ...value, rowFields })} />
      <RegisterFieldEditor label="Колонки" fields={descriptor.dimensions} value={value.columnFields} otherAxis={value.rowFields} disabled={blocked} onChange={columnFields => onChange({ ...value, columnFields })} />
    </SimpleGrid>
    <RegisterSelectionEditor resources={descriptor.resources} value={value.selections} disabled={blocked} onChange={selections => onChange({ ...value, selections })} />
    {validation.error ? <Alert color="blue" role="status">{validation.error}</Alert> : null}
    <Group><Button type="submit" disabled={blocked || !validation.query} loading={busy}>Сформувати звіт</Button></Group>
    <details><summary>Ідентифікатори опису регістру</summary><dl className="source-register-audit">
      <dt>Регістр</dt><dd>{descriptor.schema.registerUuid}</dd><dt>Схема джерела</dt><dd>{descriptor.schema.schemaHash}</dd>
    </dl></details>
  </Stack></form>
}

/** Controlled, transport-free builder. The host owns source availability and publication access. */
export function SourceRegisterReportBuilder(props: SourceRegisterReportBuilderProps) {
  const error = validateRegisterDescriptor(props.descriptor)
  if (error) return <Alert color="red" role="alert">{error}</Alert>
  return <RegisterBuilderForm key={`${props.descriptor.schema.world}:${props.descriptor.schema.schemaHash}:${props.descriptor.schema.registerUuid}`} {...props} />
}
