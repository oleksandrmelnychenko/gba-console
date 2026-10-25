import { ActionIcon, Alert, TextInput } from '@mantine/core'
import { Check, Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { DocumentDetailSection } from '../../../../shared/ui/document-detail/DocumentDetail'

export function ProductDescriptionSection({
  canEditDescription, description, descriptionDraft, isEditingDescription, isSaving = false, error, onDescriptionDraftChange, onToggleDescription,
}: {
  canEditDescription: boolean
  description?: string | null
  descriptionDraft: string
  isEditingDescription: boolean
  isSaving?: boolean
  error?: string | null
  onDescriptionDraftChange: (value: string) => void
  onToggleDescription: () => void
}) {
  const { t } = useI18n()
  // The draft is local so typing re-renders only this editor; the parent step
  // tracks the value through onDescriptionDraftChange (a ref write, no render).
  // Re-sync from the incoming draft each time editing (re)starts.
  const [draft, setDraft] = useState(descriptionDraft)
  const wasEditingRef = useRef(isEditingDescription)

  useEffect(() => {
    if (isEditingDescription && !wasEditingRef.current) {
      setDraft(descriptionDraft)
    }

    wasEditingRef.current = isEditingDescription
  }, [descriptionDraft, isEditingDescription])
  return (
    <DocumentDetailSection stacked
      title={t('Опис')}
      actions={canEditDescription && (
        <ActionIcon
          aria-label={isEditingDescription ? t('Зберегти') : t('Редагувати')}
          color={isEditingDescription ? 'teal' : 'gray'}
          size="sm"
          title={isEditingDescription ? t('Зберегти') : t('Редагувати')}
          variant="subtle"
          loading={isSaving}
          disabled={isSaving}
          onClick={onToggleDescription}
        >
          {isEditingDescription ? <Check size={15} /> : <Pencil size={15} />}
        </ActionIcon>
      )}
    >
      {isEditingDescription ? (
        <TextInput
          aria-label={t('Опис')}
          disabled={isSaving}
          autoFocus
          size="xs"
          value={draft}
          onChange={(event) => {
            const value = event.currentTarget.value
            setDraft(value)
            onDescriptionDraftChange(value)
          }}
        />
      ) : (
        <p className="new-sale-product-detail__description">{description || t('Опис відсутній')}</p>
      )}
      {error && <Alert color="red" role="alert">{error}</Alert>}
    </DocumentDetailSection>
  )
}
