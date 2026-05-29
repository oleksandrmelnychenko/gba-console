import {
  Alert,
  Button,
  Checkbox,
  FileInput,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { IconAlertCircle, IconFileSpreadsheet } from '@tabler/icons-react'
import { type FormEvent, useMemo } from 'react'
import { AppModal } from '../../../shared/ui/AppModal'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import type { DepreciatedOrderCreateFromFilePayload, DepreciatedOrderStorage } from '../types'

export type DepreciatedOrderCreateModalProps = {
  createError: string | null
  isAdmin: boolean
  isCreating: boolean
  isLoadingStorages: boolean
  opened: boolean
  storageError: string | null
  storages: DepreciatedOrderStorage[]
  onClose: () => void
  onCreate: (payload: DepreciatedOrderCreateFromFilePayload) => void
}

type CreateFormState = {
  comment: string
  endRow: number | ''
  file: File | null
  fromDate: string
  isManagement: boolean
  qtyColumnNumber: number | ''
  startRow: number | ''
  storageNetUid: string
  vendorCodeColumnNumber: number | ''
}

function createInitialForm(): CreateFormState {
  return {
    comment: '',
    endRow: '',
    file: null,
    fromDate: toDateTimeLocal(new Date()),
    isManagement: false,
    qtyColumnNumber: '',
    startRow: '',
    storageNetUid: '',
    vendorCodeColumnNumber: '',
  }
}

export function DepreciatedOrderCreateModal({
  createError,
  isAdmin,
  isCreating,
  isLoadingStorages,
  opened,
  storageError,
  storages,
  onClose,
  onCreate,
}: DepreciatedOrderCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useValueState<CreateFormState>(createInitialForm)
  const [validationError, setValidationError] = useValueState<string | null>(null)
  const [previousOpened, setPreviousOpened] = useValueState(opened)
  const storageOptions = useMemo(() => buildStorageOptions(storages), [storages])

  if (opened !== previousOpened) {
    setPreviousOpened(opened)

    if (opened) {
      setForm((current) => resolveStorageDefault(createInitialForm(), storages, current.fromDate))
      setValidationError(null)
    }
  }

  function closeModal() {
    if (!isCreating) {
      setValidationError(null)
      onClose()
    }
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const storage = storages.find((candidate) => candidate.NetUid === form.storageNetUid)
    const error = validateCreateForm(form, storage)

    if (error || !storage || !form.file) {
      setValidationError(error || t('Заповніть склад, файл і конфігурацію імпорту'))
      return
    }

    setValidationError(null)
    onCreate({
      file: form.file,
      parseConfiguration: {
        EndRow: Number(form.endRow),
        QtyColumnNumber: Number(form.qtyColumnNumber),
        StartRow: Number(form.startRow),
        VendorCodeColumnNumber: Number(form.vendorCodeColumnNumber),
      },
      depreciatedOrder: {
        Comment: form.comment.trim(),
        FromDate: new Date(form.fromDate).toISOString(),
        IsManagement: form.isManagement,
        Storage: storage,
      },
    })
  }

  return (
    <AppModal centered opened={opened} size="xl" title={`${t('Додати')} ${t('Акт списання')}`} onClose={closeModal}>
      <form id="depreciated-order-create-form" onSubmit={submitForm}>
        <Stack gap="md">
          {(validationError || createError) && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {validationError || createError}
            </Alert>
          )}
          {storageError && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {storageError}
            </Alert>
          )}

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              searchable
              allowDeselect={false}
              data={storageOptions}
              disabled={isLoadingStorages || storageOptions.length === 0 || isCreating}
              label={t('Склади')}
              placeholder={isLoadingStorages ? t('Завантаження') : t('Оберіть склад')}
              value={form.storageNetUid || null}
              onChange={(value) => setForm((current) => ({ ...current, storageNetUid: value || '' }))}
            />
            <TextInput
              disabled={isCreating}
              label={t('Від якої дати')}
              type="datetime-local"
              value={form.fromDate}
              onChange={(event) => setForm((current) => ({ ...current, fromDate: event.currentTarget.value }))}
            />
          </SimpleGrid>

          {isAdmin && (
            <Checkbox
              checked={form.isManagement}
              disabled={isCreating}
              label={t('Управ.')}
              onChange={(event) => setForm((current) => ({ ...current, isManagement: event.currentTarget.checked }))}
            />
          )}

          <SimpleGrid cols={{ base: 1, sm: 4 }}>
            <NumberInput
              allowDecimal={false}
              allowNegative={false}
              disabled={isCreating}
              label={t('Код Виробника')}
              min={1}
              value={form.vendorCodeColumnNumber}
              onChange={(value) =>
                setForm((current) => ({ ...current, vendorCodeColumnNumber: toNumberInputValue(value) }))
              }
            />
            <NumberInput
              allowDecimal={false}
              allowNegative={false}
              disabled={isCreating}
              label={t('Кількість')}
              min={1}
              value={form.qtyColumnNumber}
              onChange={(value) => setForm((current) => ({ ...current, qtyColumnNumber: toNumberInputValue(value) }))}
            />
            <NumberInput
              allowDecimal={false}
              allowNegative={false}
              disabled={isCreating}
              label={t('Від')}
              min={1}
              value={form.startRow}
              onChange={(value) => setForm((current) => ({ ...current, startRow: toNumberInputValue(value) }))}
            />
            <NumberInput
              allowDecimal={false}
              allowNegative={false}
              disabled={isCreating}
              label={t('До')}
              min={1}
              value={form.endRow}
              onChange={(value) => setForm((current) => ({ ...current, endRow: toNumberInputValue(value) }))}
            />
          </SimpleGrid>

          <Textarea
            autosize
            disabled={isCreating}
            label={t('Коментар')}
            minRows={2}
            value={form.comment}
            onChange={(event) => setForm((current) => ({ ...current, comment: event.currentTarget.value }))}
          />

          <FileInput
            accept=".xls,.xlsx"
            clearable
            disabled={isCreating}
            label={t('Завантажте документ')}
            leftSection={<IconFileSpreadsheet size={16} />}
            placeholder={t('XLS або XLSX')}
            value={form.file}
            onChange={(file) => setForm((current) => ({ ...current, file }))}
          />

          {!isAdmin && (
            <Text c="dimmed" size="xs">
              {t('Управлінське списання доступне тільки для ролей Administrator або GBA.')}
            </Text>
          )}

          <Group justify="flex-end">
            <Button color="red" disabled={isCreating} type="button" variant="subtle" onClick={closeModal}>
              {t('Скасувати')}
            </Button>
            <Button color="violet" loading={isCreating} type="submit">
              {t('Списати')}
            </Button>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}

function validateCreateForm(form: CreateFormState, storage?: DepreciatedOrderStorage): string | null {
  if (!storage) {
    return translate('Оберіть склад')
  }

  if (
    !isPositiveNumber(form.endRow)
    || !isPositiveNumber(form.startRow)
    || !isPositiveNumber(form.qtyColumnNumber)
    || !isPositiveNumber(form.vendorCodeColumnNumber)
  ) {
    return translate('Невірно заповнено значення колонки')
  }

  if (!form.file) {
    return translate('Завантажте документ')
  }

  if (Number(form.vendorCodeColumnNumber) === Number(form.qtyColumnNumber)) {
    return translate('Код Виробника і Кількість повинні бути різні')
  }

  return null
}

function buildStorageOptions(storages: DepreciatedOrderStorage[]): { label: string; value: string }[] {
  return storages.reduce<Array<{ label: string; value: string }>>((options, storage) => {
    if (!storage.NetUid) {
      return options
    }

    options.push({
      label: [storage.Name, storage.Organization?.Name ? `(${storage.Organization.Name})` : '']
        .filter(Boolean)
        .join(' '),
      value: storage.NetUid,
    })

    return options
  }, [])
}

function resolveStorageDefault(
  form: CreateFormState,
  storages: DepreciatedOrderStorage[],
  fromDate: string,
): CreateFormState {
  const storage = storages.find((candidate) => candidate.NetUid)

  return {
    ...form,
    fromDate,
    storageNetUid: storage?.NetUid || '',
  }
}

function toDateTimeLocal(date: Date): string {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)

  return offsetDate.toISOString().slice(0, 16)
}

function toNumberInputValue(value: string | number): number | '' {
  if (value === '') {
    return ''
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : ''
}

function isPositiveNumber(value: number | ''): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}
