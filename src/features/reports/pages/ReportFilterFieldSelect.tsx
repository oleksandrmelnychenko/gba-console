import { Select, defaultOptionsFilter, type SelectProps } from '@mantine/core'
import { useState } from 'react'
import type { ReportCounterpartyRole } from '../data/reportCounterpartyDirectories'
import { reportFilterDirectoryRole } from '../data/reportFilterFields'
import { ReportCounterpartyDirectory } from './ReportCounterpartyDirectory'

type Props = Omit<SelectProps, 'value' | 'defaultValue'> & { value: string | null; savedManufacturerValue?: string }

export function ReportFilterFieldSelect({ savedManufacturerValue, data, filter, onChange, ...props }: Props) {
  const [directoryRole, setDirectoryRole] = useState<ReportCounterpartyRole>()
  // Keep the saved field caption in the input while excluding it from the list of choices.
  const hideSavedManufacturer: SelectProps['filter'] = savedManufacturerValue
    ? input => (filter ?? defaultOptionsFilter)({
      ...input, options: input.options.filter(option => 'group' in option || option.value !== savedManufacturerValue),
    }) as typeof input.options
    : filter
  return <>
    <Select {...props}
      data={savedManufacturerValue ? [...(data ?? []), { value: savedManufacturerValue, label: 'Виробник', disabled: true }] : data}
      filter={hideSavedManufacturer}
      onChange={(value, option) => {
        const role = reportFilterDirectoryRole(value)
        if (role) setDirectoryRole(role)
        else onChange?.(value, option)
      }} />
    {directoryRole && <ReportCounterpartyDirectory role={directoryRole} onClose={() => setDirectoryRole(undefined)} />}
  </>
}
