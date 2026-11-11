import { useEffect, useState } from 'react'
import { customerGroupDirectoryId } from '../data/customerGroupDirectory'
import { isMultiValueReportCondition } from '../data/reportOptions'
import type { ReportSelectedValue, ReportSelection } from '../types'
import { ReportValuePicker } from './ReportValuePicker'

export type CustomerGroupDirectoryPickerProps = {
  selection: ReportSelection; label?: string; disabled?: boolean; error?: string
  onChange: (values: ReportSelectedValue[]) => void
}
type DirectoryOption = { Id: number; Name: string }
type Directory = {
  load: (signal?: AbortSignal) => Promise<DirectoryOption[]>
  missing: string; search: string; failure: string
}
export function CustomerGroupDirectoryPicker({ selection, label, disabled, error, onChange, directory }: CustomerGroupDirectoryPickerProps & { directory: Directory }) {
  const [attempt, setAttempt] = useState(0)
  const [lookup, setLookup] = useState<{ attempt: number; options: DirectoryOption[]; failed: boolean } | null>(null)
  const current = lookup?.attempt === attempt ? lookup : null
  const options = current?.options ?? []
  const loading = !current && !disabled
  const failed = current?.failed === true
  const [search, setSearch] = useState('')
  useEffect(() => {
    if (disabled) return
    const abort = new AbortController()
    void directory.load(abort.signal).then(values => {
      if (!abort.signal.aborted) setLookup({ attempt, options: values, failed: false })
    }).catch(() => {
      if (!abort.signal.aborted) setLookup({ attempt, options: [], failed: true })
    })
    return () => abort.abort()
  }, [disabled, directory, attempt])
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
  return <ReportValuePicker mode={isMultiValueReportCondition(selection.FilterCondition.Type) ? 'multi' : 'single'} label={label}
    placeholder={directory.search} data={data} selected={selected} search={search} onSearchChange={setSearch} onChange={change}
    loading={loading} disabled={disabled} remote={false} error={error}
    lookupError={failed ? directory.failure : undefined} onRetry={() => setAttempt(value => value + 1)} />
}
