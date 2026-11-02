import type { ReactNode } from 'react'

type Props = {
  label: string
  field: ReactNode
  condition: ReactNode
  value: ReactNode
  toggle?: ReactNode
  action?: ReactNode
  error?: ReactNode
  selected?: boolean
  onSelect?: () => void
}

/** One presentation for native selections and typed movement filters. Operators and IDs stay with each adapter. */
export function ReportFilterRow({ label, field, condition, value, toggle, action, error, selected, onSelect }: Props) {
  return <div className="constructor-selection-row" role="group" aria-label={label}
    data-selected={selected} onFocusCapture={onSelect} onMouseDown={onSelect}>
    <div className="constructor-selection-row__check">{toggle}</div>
    <div className="constructor-selection-row__field">{field}</div>
    <div className="constructor-selection-row__condition">{condition}</div>
    <div className="constructor-selection-row__value">{value}</div>
    <div className="constructor-selection-row__actions">{action}</div>
    {error ? <div className="constructor-selection-row__error">{error}</div> : null}
  </div>
}
