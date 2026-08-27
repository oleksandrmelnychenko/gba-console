import { ActionIcon, Alert, FileInput, Group, Stack, Text } from '@mantine/core'
import { CircleAlert, File, Trash2, Upload } from 'lucide-react'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { deleteTaxFreeDocument, uploadTaxFreeDocuments } from '../api/taxFreePackListsApi'
import type { TaxFree, TaxFreeDocument } from '../types'

type TaxFreeDocumentsPanelProps = {
  canDelete: boolean
  canUpload: boolean
  files: File[]
  formId: string
  isSaving: boolean
  taxFree: TaxFree
  onFilesChange: (files: File[]) => void
  onSavingChange: (isSaving: boolean) => void
  onUpdated: (taxFree: TaxFree) => void
}

export function TaxFreeDocumentsPanel({
  canDelete,
  canUpload,
  files,
  formId,
  isSaving,
  taxFree,
  onFilesChange,
  onSavingChange,
  onUpdated,
}: TaxFreeDocumentsPanelProps) {
  const { t } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const documents = taxFree.TaxFreeDocuments || []

  async function removeDocument(document: TaxFreeDocument) {
    if (!canDelete || !document.NetUid) {
      return
    }

    onSavingChange(true)
    setError(null)

    try {
      await deleteTaxFreeDocument(document.NetUid)
      onUpdated({
        ...taxFree,
        TaxFreeDocuments: documents.filter((item) => item.NetUid !== document.NetUid),
      })
      notifications.show({ color: 'green', message: t('Документ видалено') })
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : t('Не вдалося видалити документ'))
    } finally {
      onSavingChange(false)
    }
  }

  async function uploadDocuments() {
    if (!canUpload || !taxFree.NetUid || files.length === 0) {
      return
    }

    onSavingChange(true)
    setError(null)

    try {
      const updatedTaxFree = await uploadTaxFreeDocuments(taxFree.NetUid, files)
      if (updatedTaxFree) {
        onUpdated(updatedTaxFree)
      }
      onFilesChange([])
      notifications.show({ color: 'green', message: t('Документи завантажено') })
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('Не вдалося завантажити документи'))
    } finally {
      onSavingChange(false)
    }
  }

  return (
    <Stack
      component="form"
      gap="sm"
      id={formId}
      onSubmit={(event) => {
        event.preventDefault()
        void uploadDocuments()
      }}
    >
      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <FileInput
        clearable
        disabled={!canUpload}
        multiple
        leftSection={<Upload size={16} />}
        label={t('Файли')}
        placeholder={t('Оберіть файли')}
        value={files}
        onChange={onFilesChange}
      />

      {documents.length > 0 ? (
        <Stack gap={6}>
          {documents.map((document, index) => (
            <Group key={document.NetUid || `${document.FileName}-${index}`} justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap">
                <File size={18} />
                <div>
                  <Text size="sm" fw={600}>{document.FileName || t('Документ')}</Text>
                  {document.ContentType && <Text size="xs" c="dimmed">{document.ContentType}</Text>}
                </div>
              </Group>
              {canDelete && <ActionIcon
                aria-label={t('Видалити')}
                color="red"
                disabled={isSaving || !document.NetUid}
                type="button"
                variant="subtle"
                onClick={() => removeDocument(document)}
              >
                <Trash2 size={16} />
              </ActionIcon>}
            </Group>
          ))}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">{t('Документів немає')}</Text>
      )}
    </Stack>
  )
}
