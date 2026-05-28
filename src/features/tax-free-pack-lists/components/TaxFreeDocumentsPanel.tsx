import { ActionIcon, Alert, Button, FileInput, Group, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconFile, IconTrash, IconUpload } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { deleteTaxFreeDocument, uploadTaxFreeDocuments } from '../api/taxFreePackListsApi'
import type { TaxFree, TaxFreeDocument } from '../types'

type TaxFreeDocumentsPanelProps = {
  taxFree: TaxFree
  onUpdated: (taxFree: TaxFree) => void
}

export function TaxFreeDocumentsPanel({ taxFree, onUpdated }: TaxFreeDocumentsPanelProps) {
  const { t } = useI18n()
  const [files, setFiles] = useState<File[]>([])
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const documents = taxFree.TaxFreeDocuments || []

  async function removeDocument(document: TaxFreeDocument) {
    if (!document.NetUid) {
      return
    }

    setSaving(true)
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
      setSaving(false)
    }
  }

  async function uploadDocuments() {
    if (!taxFree.NetUid || files.length === 0) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const updatedTaxFree = await uploadTaxFreeDocuments(taxFree.NetUid, files)
      if (updatedTaxFree) {
        onUpdated(updatedTaxFree)
      }
      setFiles([])
      notifications.show({ color: 'green', message: t('Документи завантажено') })
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('Не вдалося завантажити документи'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="sm">
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <FileInput
        clearable
        multiple
        leftSection={<IconUpload size={16} />}
        label={t('Файли')}
        placeholder={t('Оберіть файли')}
        value={files}
        onChange={setFiles}
      />

      {documents.length > 0 ? (
        <Stack gap={6}>
          {documents.map((document, index) => (
            <Group key={document.NetUid || `${document.FileName}-${index}`} justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap">
                <IconFile size={18} />
                <div>
                  <Text size="sm" fw={600}>{document.FileName || t('Документ')}</Text>
                  {document.ContentType && <Text size="xs" c="dimmed">{document.ContentType}</Text>}
                </div>
              </Group>
              <ActionIcon
                aria-label={t('Видалити')}
                color="red"
                disabled={isSaving || !document.NetUid}
                variant="subtle"
                onClick={() => removeDocument(document)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">{t('Документів немає')}</Text>
      )}

      <Group justify="flex-end">
        <Button disabled={files.length === 0 || isSaving || !taxFree.NetUid} loading={isSaving} onClick={uploadDocuments}>
          {t('Зберегти')}
        </Button>
      </Group>
    </Stack>
  )
}
