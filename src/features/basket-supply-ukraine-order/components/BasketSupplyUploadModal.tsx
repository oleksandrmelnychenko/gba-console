import { Alert, Button, FileInput, Group, Modal, NumberInput, SimpleGrid, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconFileSpreadsheet, IconUpload } from '@tabler/icons-react'
import { useState } from 'react'
import type {
  BasketSupplyFileUploadMode,
  BasketSupplyUploadForm,
  CartItemsParseConfiguration,
} from '../types'

type BasketSupplyUploadModalProps = {
  isSubmitting: boolean
  mode: BasketSupplyFileUploadMode
  opened: boolean
  submitError: string | null
  t: (key: string) => string
  onClose: () => void
  onSubmit: (file: File, parseConfiguration: CartItemsParseConfiguration) => void
}

const EMPTY_FORM: BasketSupplyUploadForm = {
  endRow: '',
  file: null,
  fromDateColumnNumber: '',
  priorityColumnNumber: '',
  qtyColumnNumber: '',
  startRow: '',
  vendorCodeColumnNumber: '',
}

export function BasketSupplyUploadModal({
  isSubmitting,
  mode,
  opened,
  submitError,
  t,
  onClose,
  onSubmit,
}: BasketSupplyUploadModalProps) {
  const [form, setForm] = useState<BasketSupplyUploadForm>(EMPTY_FORM)
  const [validationError, setValidationError] = useState<string | null>(null)
  const isPreview = mode === 'preview'

  function submitForm() {
    const parseConfiguration = toParseConfiguration(form, isPreview)

    if (!form.file || !parseConfiguration) {
      setValidationError(t('Заповніть файл і колонки імпорту'))
      return
    }

    setValidationError(null)
    onSubmit(form.file, parseConfiguration)
  }

  function closeModal() {
    setForm(EMPTY_FORM)
    setValidationError(null)
    onClose()
  }

  return (
    <Modal
      centered
      opened={opened}
      size="lg"
      title={isPreview ? t('UploadForExport') : t('LoadingOrder')}
      onClose={closeModal}
    >
      <Stack gap="md">
        {(validationError || submitError) && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
            {validationError || submitError}
          </Alert>
        )}

        <FileInput
          clearable
          accept=".xls,.xlsx,.csv"
          disabled={isSubmitting}
          label={t('UploadFiles')}
          leftSection={<IconFileSpreadsheet size={16} />}
          placeholder={t('Оберіть файл')}
          value={form.file}
          onChange={(file) => setForm((current) => ({ ...current, file }))}
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <NumberInput
            allowDecimal={false}
            disabled={isSubmitting}
            label={t('VendorCode')}
            min={1}
            value={form.vendorCodeColumnNumber}
            onChange={(value) => setForm((current) => ({ ...current, vendorCodeColumnNumber: toPositiveNumber(value) }))}
          />
          <NumberInput
            allowDecimal={false}
            disabled={isSubmitting}
            label={t('SpecificationQty')}
            min={1}
            value={form.qtyColumnNumber}
            onChange={(value) => setForm((current) => ({ ...current, qtyColumnNumber: toPositiveNumber(value) }))}
          />
          <NumberInput
            allowDecimal={false}
            disabled={isSubmitting}
            label={t('From')}
            min={1}
            value={form.startRow}
            onChange={(value) => setForm((current) => ({ ...current, startRow: toPositiveNumber(value) }))}
          />
          <NumberInput
            allowDecimal={false}
            disabled={isSubmitting}
            label={t('To')}
            min={1}
            value={form.endRow}
            onChange={(value) => setForm((current) => ({ ...current, endRow: toPositiveNumber(value) }))}
          />
          {!isPreview && (
            <>
              <NumberInput
                allowDecimal={false}
                disabled={isSubmitting}
                label={t('FromDate')}
                min={1}
                value={form.fromDateColumnNumber}
                onChange={(value) => setForm((current) => ({ ...current, fromDateColumnNumber: toPositiveNumber(value) }))}
              />
              <NumberInput
                allowDecimal={false}
                disabled={isSubmitting}
                label={t('Priority')}
                min={1}
                value={form.priorityColumnNumber}
                onChange={(value) => setForm((current) => ({ ...current, priorityColumnNumber: toPositiveNumber(value) }))}
              />
            </>
          )}
        </SimpleGrid>

        <Text c="dimmed" size="xs">
          {isPreview
            ? t('Файл буде перевірено перед додаванням у підбірку експорту.')
            : t('Файл буде завантажено у кошик переміщення до України.')}
        </Text>

        <Group justify="flex-end">
          <Button disabled={isSubmitting} variant="subtle" onClick={closeModal}>
            {t('Скасувати')}
          </Button>
          <Button leftSection={<IconUpload size={16} />} loading={isSubmitting} onClick={submitForm}>
            {t('Load')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function toParseConfiguration(
  form: BasketSupplyUploadForm,
  isPreview: boolean,
): CartItemsParseConfiguration | null {
  const baseConfiguration = {
    EndRow: form.endRow,
    QtyColumnNumber: form.qtyColumnNumber,
    StartRow: form.startRow,
    VendorCodeColumnNumber: form.vendorCodeColumnNumber,
  }

  if (!hasRequiredNumbers(baseConfiguration)) {
    return null
  }

  if (isPreview) {
    return baseConfiguration
  }

  if (!form.fromDateColumnNumber || !form.priorityColumnNumber) {
    return null
  }

  return {
    ...baseConfiguration,
    FromDateColumnNumber: form.fromDateColumnNumber,
    PriorityColumnNumber: form.priorityColumnNumber,
  }
}

function hasRequiredNumbers(configuration: {
  EndRow: number | ''
  QtyColumnNumber: number | ''
  StartRow: number | ''
  VendorCodeColumnNumber: number | ''
}): configuration is CartItemsParseConfiguration {
  return Boolean(
    configuration.EndRow &&
      configuration.QtyColumnNumber &&
      configuration.StartRow &&
      configuration.VendorCodeColumnNumber,
  )
}

function toPositiveNumber(value: number | string): number | '' {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : ''
}
