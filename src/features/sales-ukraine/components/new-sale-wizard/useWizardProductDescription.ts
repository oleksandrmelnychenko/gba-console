import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { updateProduct } from '../../../products/api/productsApi'
import type { Product } from '../../../products/types'
import type { WizardSaleProduct } from './wizardSaleProduct'

type Editor = { scope: object; draft: string; error: string | null }

/** Keeps drafts local until the write succeeds; navigation retires only the editor, not the write. */
export function useWizardProductDescription({ product, source, onSaved, onBegin, onFinish }: {
  product: WizardSaleProduct | null
  source?: string
  onSaved: (product: WizardSaleProduct) => void
  onBegin: () => void
  onFinish: () => void
}) {
  const { t } = useI18n()
  const netId = product?.NetUid
  const scope = useMemo(() => ({ netId, source }), [netId, source])
  const currentScope = useRef<object | null>(scope)
  const editorRef = useRef<Editor | null>(null)
  const draftRef = useRef('')
  const pending = useRef(new Set<string>())
  const [editor, setEditor] = useState<Editor | null>(null)
  const [savingIds, setSavingIds] = useState<Set<string>>(() => new Set())

  useLayoutEffect(() => {
    currentScope.current = scope
    return () => { currentScope.current = null }
  }, [scope])

  const reset = useCallback(() => {
    editorRef.current = null
    setEditor(null)
  }, [])
  // Typing only updates the editor component and this ref, not the products step.
  const changeDraft = useCallback((value: string) => { draftRef.current = value }, [])

  async function toggle() {
    if (!product || !netId || currentScope.current !== scope || pending.current.has(netId)) return
    const current = editorRef.current
    if (!current || current.scope !== scope) {
      draftRef.current = product.Description ?? ''
      const next = { scope, draft: draftRef.current, error: null }
      editorRef.current = next
      setEditor(next)
      onBegin()
      return
    }

    const updated = { ...product, Description: draftRef.current }
    if (updated.Description === (product.Description ?? '')) {
      reset()
      onFinish()
      return
    }
    pending.current.add(netId)
    setSavingIds(new Set(pending.current))
    setEditor({ ...current, draft: updated.Description, error: null })
    try {
      await updateProduct(updated as Product, source === 'main')
      if (currentScope.current !== null) onSaved(updated)
      if (currentScope.current === scope && editorRef.current === current) {
        reset()
        onFinish()
      }
    } catch (error) {
      if (currentScope.current === scope && editorRef.current === current) {
        setEditor({ ...current, draft: updated.Description, error: error instanceof Error && error.message.trim() ? error.message : t('Не вдалося зберегти товар') })
      }
    } finally {
      pending.current.delete(netId)
      if (currentScope.current !== null) setSavingIds(new Set(pending.current))
    }
  }

  const visibleEditor = editor?.scope === scope ? editor : null
  return {
    isEditing: Boolean(visibleEditor),
    isSaving: Boolean(netId && savingIds.has(netId)),
    draft: visibleEditor?.draft ?? '',
    error: visibleEditor?.error ?? null,
    changeDraft,
    reset,
    toggle,
  }
}
