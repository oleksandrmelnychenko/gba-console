import { Check, Minus } from 'lucide-react'

type SelectionMarkProps = {
  checked: boolean
  disabled?: boolean
  indeterminate?: boolean
  label: string
  size?: 'md' | 'sm'
  onChange: () => void
}

export function SelectionMark({
  checked,
  disabled = false,
  indeterminate = false,
  label,
  size = 'md',
  onChange,
}: SelectionMarkProps) {
  return (
    <button
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      className={`role-tree-check${checked ? ' is-selected' : ''}${indeterminate ? ' is-indeterminate' : ''}${size === 'sm' ? ' is-sm' : ''}`}
      disabled={disabled}
      role="checkbox"
      type="button"
      onClick={onChange}
    >
      {indeterminate
        ? <Minus size={11} strokeWidth={2.2} />
        : checked
          ? <Check size={11} strokeWidth={2.2} />
          : null}
    </button>
  )
}
