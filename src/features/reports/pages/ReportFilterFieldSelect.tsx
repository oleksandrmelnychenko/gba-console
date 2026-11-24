import { Select, defaultOptionsFilter, type SelectProps } from '@mantine/core'
import { useState } from 'react'
import { reportFilterDirectoryRole, type ReportCounterpartyRole } from '../data/reportFilterFields'
import { ReportCounterpartyDirectory, type DirectoryFilter } from './ReportCounterpartyDirectory'

type Props = Omit<SelectProps, 'value' | 'defaultValue'> & {
  value: string | null
  retainedOption?: { value: string; label: string }
  directoryFilter?: (role: ReportCounterpartyRole) => DirectoryFilter | undefined
}

export function ReportFilterFieldSelect({ retainedOption, data, filter, onChange, directoryFilter, ...props }: Props) {
  const [directoryRole, setDirectoryRole] = useState<ReportCounterpartyRole>()
  // Keep the saved field caption in the input while excluding it from the list of choices.
  const hideRetainedOption: SelectProps['filter'] = retainedOption
    ? input => (filter ?? defaultOptionsFilter)({
      ...input, options: input.options.filter(option => 'group' in option || option.value !== retainedOption.value),
    }) as typeof input.options
    : filter
  return <>
    <Select {...props}
      data={retainedOption ? [...(data ?? []), { ...retainedOption, disabled: true }] : data}
      filter={hideRetainedOption}
      onChange={(value, option) => {
        const role = reportFilterDirectoryRole(value)
        if (role) setDirectoryRole(role)
        else onChange?.(value, option)
      }} />
    <ReportCounterpartyDirectory role={directoryRole ?? null} onClose={() => setDirectoryRole(undefined)}
      {...(directoryRole && directoryFilter?.(directoryRole))} />
  </>
}
