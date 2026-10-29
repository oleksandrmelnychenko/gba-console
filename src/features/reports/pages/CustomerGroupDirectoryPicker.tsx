import { Alert, Button, Group, Select, Stack } from '@mantine/core'
import { useEffect, useState } from 'react'
import { customerGroupDirectoryId } from '../data/customerGroupDirectory'
import { isMultiValueReportCondition } from '../data/reportOptions'
import type { ReportSelectedValue, ReportSelection } from '../types'
import { ReportValueAutocomplete } from './ReportValueAutocomplete'

export type CustomerGroupDirectoryPickerProps = {
  selection: ReportSelection; label?: string; disabled?: boolean; error?: string
  onChange: (values: ReportSelectedValue[]) => void
}
type DirectoryOption = { Id: number; Name: string }
type Directory = {
  load: (signal?: AbortSignal) => Promise<DirectoryOption[]>
  missing: string; search: string; remove: string; failure: string
}
export function CustomerGroupDirectoryPicker({ selection, label, disabled, error, onChange, directory }: CustomerGroupDirectoryPickerProps & { directory: Directory }) {
  const [lookup, setLookup] = useState<{ options: DirectoryOption[]; failed: boolean } | null>(null)
  const options = lookup?.options ?? []
  const loading = !lookup && !disabled
  const failed = lookup?.failed === true
  const [search, setSearch] = useState('')
  useEffect(() => {
    if (disabled) return
    const abort = new AbortController()
    void directory.load(abort.signal).then(values => {
      if (!abort.signal.aborted) setLookup({ options: values, failed: false })
    }).catch(() => {
      if (!abort.signal.aborted) setLookup({ options: [], failed: true })
    })
    return () => abort.abort()
  }, [disabled, directory])
  const entries = selection.Values.map((value, index) => ({
    value: customerGroupDirectoryId(value.Data)?.toString() ?? `invalid:${index}`,
    label: value.Name || directory.missing,
  }))
  const selected = [...new Map(entries.map(item => [item.value, item])).values()]
  // Saved captions win until an explicit user choice; equal IDs never become duplicate options after a rename.
  const data = [...new Map([...options.map(item => ({ value: String(item.Id), label: item.Name })), ...selected]
    .map(item => [item.value, item])).values()]
  function change(keys: string[]) {
    const desired = new Set(keys), previous = new Set(selected.map(item => item.value))
    const retained = selection.Values.filter((_, index) => desired.has(entries[index].value))
    const added = options.filter(item => desired.has(String(item.Id)) && !previous.has(String(item.Id)))
      .map(item => ({ Data: { Id: item.Id }, Name: item.Name, Value: 0 }))
    onChange([...retained, ...added])
  }
  return <Stack gap="xs">
    {isMultiValueReportCondition(selection.FilterCondition.Type)
      ? <ReportValueAutocomplete label={label} data={data} selected={selected} search={search} onSearchChange={setSearch}
          onChange={change} loading={loading} disabled={disabled} remote={false} error={error} />
      : <><Select label={label} data={data} value={null} searchable searchValue={search} onSearchChange={setSearch}
          disabled={disabled} error={error} placeholder={directory.search}
          onChange={key => { if (key) change([key]); setSearch('') }} />
        <Group gap="xs">{selected.map(item => <Button key={item.value} variant="subtle" size="compact-sm"
          disabled={disabled} aria-label={`${directory.remove} ${item.label}`}
          onClick={() => change(selected.filter(other => other.value !== item.value).map(other => other.value))}>{item.label} ×</Button>)}</Group></>}
    {failed ? <Alert color="yellow">{directory.failure}</Alert> : null}
  </Stack>
}
