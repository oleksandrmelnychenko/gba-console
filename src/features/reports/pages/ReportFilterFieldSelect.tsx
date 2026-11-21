import { Select, defaultOptionsFilter, type SelectProps } from '@mantine/core'

type Props = SelectProps & { savedManufacturerValue?: string }

export function ReportFilterFieldSelect({ savedManufacturerValue, data, ...props }: Props) {
  if (!savedManufacturerValue) return <Select {...props} data={data} />

  // Keep the saved field caption in the input while excluding it from the list of choices.
  return <Select {...props} data={[...(data ?? []), { value: savedManufacturerValue, label: 'Виробник', disabled: true }]}
    filter={(input) => (props.filter ?? defaultOptionsFilter)({
      ...input, options: input.options.filter(option => 'group' in option || option.value !== savedManufacturerValue),
    }) as typeof input.options} />
}
