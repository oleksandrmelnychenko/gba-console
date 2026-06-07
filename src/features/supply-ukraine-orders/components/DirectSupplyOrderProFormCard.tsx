import {
  ActionIcon,
  Badge,
  Button,
  Card,
  FileButton,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconDeviceFloppy,
  IconFileInvoice,
  IconPencil,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { useEffect, useReducer } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import {
  deleteSupplyProformDocument,
  updateDirectSupplyOrder,
  uploadSupplyOrderProformDocuments,
} from '../api/supplyUkraineOrdersApi'
import type { DirectSupplyOrder, SupplyProForm, SupplyProFormDocument } from '../types'

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' })

type ProFormCardState = {
  draft: SupplyProForm
  files: File[]
  isEditing: boolean
  isSaving: boolean
}

type ProFormCardAction =
  | { type: 'addFiles', files: File[] }
  | { type: 'cancel', order: DirectSupplyOrder }
  | { type: 'removeLocalDocument', document: SupplyProFormDocument }
  | { type: 'setDraft', patch: Partial<SupplyProForm> }
  | { type: 'setSaving', value: boolean }
  | { type: 'startEditing' }
  | { type: 'sync', order: DirectSupplyOrder }

export function DirectSupplyOrderProFormCard({
  canEdit,
  order,
  onError,
  onOrderUpdated,
  onReload,
}: {
  canEdit: boolean
  onError: (message: string) => void
  onOrderUpdated: (order: DirectSupplyOrder) => void
  onReload: () => Promise<void>
  order: DirectSupplyOrder
}) {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(proFormCardReducer, order, createInitialProFormCardState)
  const { draft, files, isEditing, isSaving } = state
  const documents = (draft.ProFormDocuments || []).filter((document) => !document.Deleted)
  const hasProForm = Boolean(order.SupplyProFormId || order.SupplyProForm?.NetUid || order.SupplyProForm?.Id)

  useEffect(() => {
    dispatch({ type: 'sync', order })
  }, [order])

  async function removeDocument(document: SupplyProFormDocument) {
    if (document.NetUid) {
      dispatch({ type: 'setSaving', value: true })

      try {
        await deleteSupplyProformDocument(document.NetUid)
        await onReload()
        notifications.show({ color: 'green', message: t('Документ видалено') })
      } catch (deleteError) {
        onError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити документ'))
      } finally {
        dispatch({ type: 'setSaving', value: false })
      }
      return
    }

    dispatch({ type: 'removeLocalDocument', document })
  }

  async function saveProForm() {
    if (!order.NetUid) {
      return
    }

    const validationError = validateProFormDraft(draft, t)

    if (validationError) {
      onError(validationError)
      return
    }

    const payloadProForm = toProFormPayload(draft)

    dispatch({ type: 'setSaving', value: true })

    try {
      const updatedWithProForm = await updateDirectSupplyOrder({
        ...order,
        SupplyProForm: payloadProForm,
      })
      const uploadSource = updatedWithProForm?.SupplyProForm || payloadProForm
      const uploadOrderNetId = updatedWithProForm?.NetUid || order.NetUid
      const uploadedOrder = files.length > 0
        ? await uploadSupplyOrderProformDocuments({
          files,
          orderNetId: uploadOrderNetId,
          proForm: uploadSource,
        })
        : null
      const nextOrder = uploadedOrder || updatedWithProForm

      if (nextOrder) {
        onOrderUpdated(nextOrder)
        dispatch({ type: 'sync', order: nextOrder })
      } else {
        await onReload()
      }

      notifications.show({ color: 'green', message: t('Проформу збережено') })
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти проформу'))
    } finally {
      dispatch({ type: 'setSaving', value: false })
    }
  }

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="md">
        <Group justify="space-between" gap="sm" wrap="wrap">
          <Group gap="xs">
            <IconFileInvoice size={18} />
            <Text fw={600}>{t('Проформа')}</Text>
            <Badge color={hasProForm ? 'green' : 'yellow'} variant="light">
              {hasProForm ? t('Створено') : t('Потрібно створити')}
            </Badge>
          </Group>
          {isEditing ? (
            <Group gap="xs">
              <Button color="gray" disabled={isSaving} size="xs" variant="light" onClick={() => dispatch({ type: 'cancel', order })}>
                {t('Скасувати')}
              </Button>
              <Button leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} size="xs" variant="light" onClick={() => void saveProForm()}>
                {t('Зберегти')}
              </Button>
            </Group>
          ) : canEdit ? (
            <Button leftSection={<IconPencil size={16} />} size="xs" variant="light" onClick={() => dispatch({ type: 'startEditing' })}>
              {hasProForm ? t('Редагувати') : t('Створити')}
            </Button>
          ) : null}
        </Group>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          {isEditing ? (
            <>
              <TextInput
                label={t('Номер')}
                required
                value={draft.Number || ''}
                onChange={(event) => dispatch({ type: 'setDraft', patch: { Number: event.currentTarget.value } })}
              />
              <NumberInput
                allowNegative={false}
                decimalScale={2}
                label={t('Сума нетто')}
                min={0}
                required
                value={typeof draft.NetPrice === 'number' ? draft.NetPrice : ''}
                onChange={(value) => dispatch({ type: 'setDraft', patch: { NetPrice: typeof value === 'number' ? value : Number(value) || undefined } })}
              />
              <TextInput
                label={t('Дата')}
                required
                type="date"
                value={toProFormDateInput(draft.DateFrom)}
                onChange={(event) => dispatch({ type: 'setDraft', patch: { DateFrom: event.currentTarget.value } })}
              />
            </>
          ) : (
            <>
              <InfoBlock label={t('Номер')} value={draft.Number || '-'} />
              <InfoBlock label={t('Сума нетто')} value={formatMoney(draft.NetPrice)} />
              <InfoBlock label={t('Дата')} value={formatDateTime(draft.DateFrom)} />
            </>
          )}
        </SimpleGrid>

        <Stack gap="xs">
          <Group justify="space-between" gap="xs" wrap="wrap">
            <Text fw={600} size="sm">{t('Документи')}</Text>
            {isEditing && (
              <FileButton multiple onChange={(nextFiles) => dispatch({ type: 'addFiles', files: nextFiles || [] })}>
                {(fileProps) => (
                  <Button {...fileProps} disabled={isSaving} leftSection={<IconUpload size={16} />} size="xs" variant="light">
                    {t('Додати файли')}
                  </Button>
                )}
              </FileButton>
            )}
          </Group>

          {documents.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t('Документів немає')}
            </Text>
          ) : (
            <Stack gap={6}>
              {documents.map((document, index) => (
                <Group
                  key={getProFormDocumentKey(document, index)}
                  justify="space-between"
                  gap="xs"
                  wrap="nowrap"
                  style={{
                    border: '1px solid var(--mantine-color-gray-2)',
                    borderRadius: 6,
                    padding: '8px 10px',
                  }}
                >
                  <Stack gap={0} style={{ minWidth: 0 }}>
                    {document.DocumentUrl ? (
                      <a className="document-link" href={upgradeHttpToHttps(document.DocumentUrl)} rel="noreferrer" target="_blank">
                        {document.FileName || document.Name || t('Документ')}
                      </a>
                    ) : (
                      <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
                        {document.FileName || document.Name || t('Документ')}
                      </Text>
                    )}
                    {getLocalProFormFile(files, document)?.size ? (
                      <Text c="dimmed" size="xs">
                        {formatFileSize(getLocalProFormFile(files, document)?.size || 0)}
                      </Text>
                    ) : null}
                  </Stack>
                  {isEditing && (
                    <Tooltip label={t('Видалити')}>
                      <ActionIcon
                        aria-label={t('Видалити')}
                        color="red"
                        disabled={isSaving}
                        size="sm"
                        variant="subtle"
                        onClick={() => void removeDocument(document)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              ))}
            </Stack>
          )}
        </Stack>
      </Stack>
    </Card>
  )
}

function proFormCardReducer(state: ProFormCardState, action: ProFormCardAction): ProFormCardState {
  switch (action.type) {
    case 'addFiles':
      return {
        ...state,
        draft: {
          ...state.draft,
          ProFormDocuments: mergeProFormDraftDocuments(state.draft.ProFormDocuments || [], action.files),
        },
        files: mergeProFormFiles(state.files, action.files),
      }
    case 'cancel':
    case 'sync':
      return createInitialProFormCardState(action.order)
    case 'removeLocalDocument':
      return {
        ...state,
        draft: {
          ...state.draft,
          ProFormDocuments: (state.draft.ProFormDocuments || []).filter((document) => document !== action.document),
        },
        files: state.files.filter((file) => file.name !== action.document.FileName),
      }
    case 'setDraft':
      return {
        ...state,
        draft: { ...state.draft, ...action.patch },
      }
    case 'setSaving':
      return {
        ...state,
        isSaving: action.value,
      }
    case 'startEditing':
      return {
        ...state,
        isEditing: true,
      }
    default:
      return state
  }
}

function createInitialProFormCardState(order: DirectSupplyOrder): ProFormCardState {
  return {
    draft: createProFormDraft(order),
    files: [],
    isEditing: false,
    isSaving: false,
  }
}

function createProFormDraft(order: DirectSupplyOrder): SupplyProForm {
  const proForm = order.SupplyProForm

  return {
    ...(proForm || {}),
    DateFrom: toProFormDateInput(proForm?.DateFrom) || formatLocalDate(new Date()),
    NetPrice: typeof proForm?.NetPrice === 'number'
      ? proForm.NetPrice
      : typeof order.NetPrice === 'number'
        ? order.NetPrice
        : undefined,
    ProFormDocuments: Array.isArray(proForm?.ProFormDocuments) ? proForm.ProFormDocuments : [],
  }
}

function mergeProFormFiles(currentFiles: File[], nextFiles: File[]): File[] {
  const fileNames = new Set(currentFiles.map((file) => file.name))
  const merged = [...currentFiles]

  nextFiles.forEach((file) => {
    if (!fileNames.has(file.name)) {
      fileNames.add(file.name)
      merged.push(file)
    }
  })

  return merged
}

function mergeProFormDraftDocuments(currentDocuments: SupplyProFormDocument[], files: File[]): SupplyProFormDocument[] {
  const documentNames = new Set<string>()
  const merged = [...currentDocuments]

  currentDocuments.forEach((document) => {
    if (!document.Deleted) {
      const name = document.FileName || document.Name

      if (name) {
        documentNames.add(name)
      }
    }
  })

  files.forEach((file) => {
    if (!documentNames.has(file.name)) {
      documentNames.add(file.name)
      merged.push({
        ContentType: file.type,
        FileName: file.name,
        Name: file.name,
      })
    }
  })

  return merged
}

function validateProFormDraft(proForm: SupplyProForm, t: (value: string) => string): string | null {
  if (!proForm.Number?.trim()) {
    return t('Вкажіть номер проформи')
  }

  if (!proForm.NetPrice || proForm.NetPrice <= 0) {
    return t('Вкажіть суму проформи')
  }

  if (!toProFormDateInput(proForm.DateFrom)) {
    return t('Вкажіть дату проформи')
  }

  if (!(proForm.ProFormDocuments || []).some((document) => !document.Deleted)) {
    return t('Додайте документ проформи')
  }

  return null
}

function toProFormPayload(proForm: SupplyProForm): SupplyProForm {
  const date = toProFormDateInput(proForm.DateFrom)

  return {
    ...proForm,
    DateFrom: date ? `${date}T00:00:00` : undefined,
    NetPrice: Number(proForm.NetPrice) || 0,
    Number: proForm.Number?.trim(),
    ProFormDocuments: proForm.ProFormDocuments || [],
  }
}

function toProFormDateInput(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const stringValue = typeof value === 'string' ? value : value.toISOString()

  if (/^\d{4}-\d{2}-\d{2}/.test(stringValue)) {
    return stringValue.slice(0, 10)
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? '' : formatLocalDate(date)
}

function getProFormDocumentKey(document: SupplyProFormDocument, index: number): string {
  return String(document.NetUid || document.Id || document.DocumentUrl || document.GeneratedName || document.FileName || index)
}

function getLocalProFormFile(files: File[], document: SupplyProFormDocument): File | null {
  return files.find((file) => file.name === document.FileName) || null
}

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 102.4) / 10} KB`
  }

  return `${Math.round(size / 1024 / 102.4) / 10} MB`
}

function InfoBlock({ label, value }: { label: string, value: string }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs">{label}</Text>
      <Text fw={600} size="sm">{value}</Text>
    </Stack>
  )
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateTimeFormatter.format(date)
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '-'
}
