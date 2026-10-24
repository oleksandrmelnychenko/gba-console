import { ActionIcon, TextInput } from '@mantine/core'
import { Check, Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { DocumentDetailSection } from '../../../../shared/ui/document-detail/DocumentDetail'

export function ProductDescriptionSection({
  canEditDescription, description, descriptionDraft, isEditingDescription, onDescriptionDraftChange, onToggleDescription,
}: {
  canEditDescription: boolean
  description?: string | null
  descriptionDraft: string
  isEditingDescription: boolean
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
          onClick={onToggleDescription}
        >
          {isEditingDescription ? <Check size={15} /> : <Pencil size={15} />}
        </ActionIcon>
      )}
    >
      {isEditingDescription ? (
        <TextInput
          aria-label={t('Опис')}
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
    </DocumentDetailSection>
  )
}
