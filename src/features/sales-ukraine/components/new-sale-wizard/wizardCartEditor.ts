import type { WizardCartSelection } from './wizardCartMutation'
import type { WizardSplitOrderItem } from './wizardSplitSale'

export type WizardCartEditorState = {
  isSplit: boolean
  selected: WizardCartSelection | null
  splitItems: WizardSplitOrderItem[]
}

export function moveWizardCartSelection(cart: WizardCartEditorState, currentCount: number, direction: 1 | -1): WizardCartEditorState {
  const splitCount = cart.isSplit ? cart.splitItems.length : 0
  const count = currentCount + splitCount
  const selected = cart.selected
  const selectedCount = selected?.list === 'current' ? currentCount : splitCount
  const index = selected && selected.index >= 0 && selected.index < selectedCount
    ? selected.index + (selected.list === 'split' ? currentCount : 0)
    : -1
  // Down from the last split row cycles within the split list, as in the original editor.
  const nextIndex = index === -1 ? (direction === 1 ? 0 : count - 1)
    : direction === 1 && index === count - 1 && splitCount > 0 ? currentCount
      : (index + direction + count) % count
  const next: WizardCartSelection | null = count === 0 ? null
    : nextIndex < currentCount ? { list: 'current', index: nextIndex }
      : { list: 'split', index: nextIndex - currentCount }
  if (selected?.list === next?.list && selected?.index === next?.index) return cart
  return { ...cart, selected: next }
}

export function toggleWizardCartSplit(cart: WizardCartEditorState, currentCount: number): WizardCartEditorState {
  const isSplit = !cart.isSplit
  let selected = cart.selected
  if (!isSplit && (!selected || selected.list === 'split')) {
    selected = currentCount > 0 ? { index: 0, list: 'current' } : null
  }
  // Toggling only changes the visible editing mode; extracted items must stay recoverable.
  return { ...cart, isSplit, selected }
}
