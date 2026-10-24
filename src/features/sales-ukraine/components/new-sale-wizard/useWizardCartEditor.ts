import { useCallback, useState } from 'react'
import { moveWizardCartSelection, toggleWizardCartSplit, type WizardCartEditorState } from './wizardCartEditor'

export function useWizardCartEditor(currentCount: number) {
  const [editCart, setEditCart] = useState<WizardCartEditorState | null>(null)
  const moveCartSelection = useCallback((direction: 1 | -1) => {
    setEditCart((cart) => cart ? moveWizardCartSelection(cart, currentCount, direction) : cart)
  }, [currentCount])
  const toggleSplitMode = useCallback(() => {
    setEditCart((cart) => cart ? toggleWizardCartSplit(cart, currentCount) : cart)
  }, [currentCount])
  return { editCart, setEditCart, moveCartSelection, toggleSplitMode }
}
