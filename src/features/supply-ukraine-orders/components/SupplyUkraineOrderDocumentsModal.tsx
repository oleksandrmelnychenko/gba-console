import {
  ActionIcon,
  Anchor,
  Button,
  Divider,
  FileButton,
  Group,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { IconArrowBackUp, IconFile, IconFileTypePdf, IconFileTypeXls, IconTrash, IconUpload } from '@tabler/icons-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { SupplyOrderUkraineDocument } from '../types'

export type UkraineOrderNewDocument = {
  contentType: string
  file: File
  fileName: string
  id: string
}

type SupplyUkraineOrderDocumentsModalProps = {
  existingDocuments: SupplyOrderUkraineDocument[]
  isSaving: boolean
  newDocuments: UkraineOrderNewDocument[]
  opened: boolean
  onAddFiles: (files: File[]) => void
  onClose: () => void
  onRemoveNewDocument: (document: UkraineOrderNewDocument) => void
  onSave: () => void
  onToggleExistingDocument: (document: SupplyOrderUkraineDocument) => void
}

export function SupplyUkraineOrderDocumentsModal({
  existingDocuments,
  isSaving,
  newDocuments,
  opened,
  onAddFiles,
  onClose,
  onRemoveNewDocument,
  onSave,
  onToggleExistingDocument,
}: SupplyUkraineOrderDocumentsModalProps) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} size="lg" title={t('Документи замовлення')} onClose={onClose}>
      <Stack gap="md">
        {newDocuments.length > 0 && (
          <Stack gap={4}>
            <Text fw={600} size="sm">
              {t('Нові документи')}
            </Text>
            {newDocuments.map((document) => (
              <Group key={document.id} justify="space-between" wrap="nowrap">
                <Group gap={6} wrap="nowrap">
                  <DocumentTypeIcon contentType={document.contentType} />
                  <Text size="sm" lineClamp={1}>
                    {document.fileName}
                  </Text>
                </Group>
                <Tooltip label={t('Видалити')}>
                  <ActionIcon color="red" disabled={isSaving} variant="subtle" onClick={() => onRemoveNewDocument(document)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))}
          </Stack>
        )}

        {existingDocuments.length > 0 && (
          <Stack gap={4}>
            <Text fw={600} size="sm">
              {t('Завантажені документи')}
            </Text>
            {existingDocuments.map((document, index) => (
              <Group key={getDocumentKey(document, index)} justify="space-between" wrap="nowrap">
                <Group gap={6} wrap="nowrap">
                  <DocumentTypeIcon contentType={document.ContentType} />
                  {document.DocumentUrl ? (
                    <Anchor href={upgradeHttpToHttps(document.DocumentUrl)} rel="noreferrer" target="_blank">
                      <Text size="sm" lineClamp={1} td={document.Deleted ? 'line-through' : undefined}>
                        {document.FileName || document.Name || t('Документ')}
                      </Text>
                    </Anchor>
                  ) : (
                    <Text size="sm" lineClamp={1} td={document.Deleted ? 'line-through' : undefined}>
                      {document.FileName || document.Name || t('Документ')}
                    </Text>
                  )}
                </Group>
                <Tooltip label={document.Deleted ? t('Відновити') : t('Видалити')}>
                  <ActionIcon
                    color={document.Deleted ? 'gray' : 'red'}
                    disabled={isSaving}
                    variant="subtle"
                    onClick={() => onToggleExistingDocument(document)}
                  >
                    {document.Deleted ? <IconArrowBackUp size={16} /> : <IconTrash size={16} />}
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))}
          </Stack>
        )}

        {newDocuments.length === 0 && existingDocuments.length === 0 && (
          <Text c="dimmed" size="sm">
            {t('Документів ще немає')}
          </Text>
        )}

        <Divider />

        <Group justify="flex-end">
          <FileButton multiple accept=".xls,.xlsx,.pdf" onChange={(files) => onAddFiles(files || [])}>
            {(props) => (
              <Button {...props} disabled={isSaving} leftSection={<IconUpload size={16} />} variant="light">
                {t('Завантажити')}
              </Button>
            )}
          </FileButton>
          <Button disabled={isSaving} loading={isSaving} onClick={onSave}>
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function DocumentTypeIcon({ contentType }: { contentType?: string }) {
  const normalizedType = contentType?.toLowerCase()

  if (normalizedType === 'xls' || normalizedType === 'xlsx') {
    return <IconFileTypeXls size={18} />
  }

  if (normalizedType === 'pdf') {
    return <IconFileTypePdf size={18} />
  }

  return <IconFile size={18} />
}

function getDocumentKey(document: SupplyOrderUkraineDocument, index: number): string {
  return document.NetUid || String(document.Id || document.FileName || index)
}

function upgradeHttpToHttps(url: string): string {
  return url.startsWith('http:') ? url.replace('http:', 'https:') : url
}
