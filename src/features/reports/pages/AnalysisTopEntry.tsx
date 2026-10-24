import { useState } from 'react'
import { Button, Group, Stack, TextInput } from '@mantine/core'
import { analysisValueIdentity, type AnalysisTextEntry } from '../data/currentVparivanieAnalysis'
import { isMultiValueReportCondition } from '../data/reportOptions'
import type { ReportSelectedValue, ReportSelection } from '../types'

export function AnalysisTopEntry({ capability, selection, onChange, multiple = isMultiValueReportCondition(selection.FilterCondition.Type) }: {
  capability: AnalysisTextEntry; selection: ReportSelection; onChange: (values: ReportSelectedValue[]) => void; multiple?: boolean
}) {
  const [draft, setDraft] = useState('')
  const code = draft.trim().toUpperCase()
  const valid = capability.allowedValues.includes(code)
  const add = () => {
    if (!valid) return
    const value = { Data: { value: code }, Name: code, Value: 0 }
    const key = analysisValueIdentity(3, value.Data)
    onChange(multiple
      ? [...selection.Values.filter(item => analysisValueIdentity(3, item.Data) !== key), value] : [value])
    setDraft('')
  }
  return <Stack gap={4}>
    <Group align="start" gap="xs" wrap="wrap">
      <TextInput label="TOP вручну" placeholder={capability.allowedValues.join(', ')} value={draft}
        error={code && !valid ? `Доступні коди: ${capability.allowedValues.join(', ')}` : undefined}
        onChange={event => setDraft(event.currentTarget.value)}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add() } }} />
      <Button type="button" variant="default" mt={24} disabled={!valid} onClick={add}>Додати TOP</Button>
    </Group>
  </Stack>
}
