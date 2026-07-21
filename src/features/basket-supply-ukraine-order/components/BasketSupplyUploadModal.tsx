import { Alert, Button, Checkbox, FileInput, Group, NumberInput, SimpleGrid, Stack, Text } from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { CircleAlert, FileSpreadsheet, Upload } from 'lucide-react'
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
  grossWeightColumnNumber: '',
  isImportedProductColumnNumber: '',
  isWeightPerItem: false,
  priorityColumnNumber: '',
  qtyColumnNumber: '',
  specificationCodeColumnNumber: '',
  startRow: '',
  vendorCodeColumnNumber: '',
  weightColumnNumber: '',
  withGrossWeight: false,
  withIsImportedProduct: false,
  withSpecificationCode: false,
  withWeight: false,
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
    <AppModal
      centered
      opened={opened}
      size="lg"
      title={isPreview ? t('Завантаження для експорту') : t('Завантаження замовлення')}
      onClose={closeModal}
    >
      <Stack gap="md">
        {(validationError || submitError) && (
          <Alert color="red" icon={<CircleAlert size={16} />} variant="light">
            {validationError || submitError}
          </Alert>
        )}

        <FileInput
          clearable
          accept=".xls,.xlsx,.csv"
          disabled={isSubmitting}
          label={t('Завантажити файли')}
          leftSection={<FileSpreadsheet size={16} />}
          placeholder={t('Оберіть файл')}
          value={form.file}
          onChange={(file) => setForm((current) => ({ ...current, file }))}
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <NumberInput
            allowDecimal={false}
            disabled={isSubmitting}
            label={t('Код Виробника')}
            min={1}
            value={form.vendorCodeColumnNumber}
            onChange={(value) => setForm((current) => ({ ...current, vendorCodeColumnNumber: toPositiveNumber(value) }))}
          />
          <NumberInput
            allowDecimal={false}
            disabled={isSubmitting}
            label={t('К-сть')}
            min={1}
            value={form.qtyColumnNumber}
            onChange={(value) => setForm((current) => ({ ...current, qtyColumnNumber: toPositiveNumber(value) }))}
          />
          <NumberInput
            allowDecimal={false}
            disabled={isSubmitting}
            label={t('Від')}
            min={1}
            value={form.startRow}
            onChange={(value) => setForm((current) => ({ ...current, startRow: toPositiveNumber(value) }))}
          />
          <NumberInput
            allowDecimal={false}
            disabled={isSubmitting}
            label={t('До')}
            min={1}
            value={form.endRow}
            onChange={(value) => setForm((current) => ({ ...current, endRow: toPositiveNumber(value) }))}
          />
          {!isPreview && (
            <>
              <NumberInput
                allowDecimal={false}
                disabled={isSubmitting}
                label={t('Від якої дати')}
                min={1}
                value={form.fromDateColumnNumber}
                onChange={(value) => setForm((current) => ({ ...current, fromDateColumnNumber: toPositiveNumber(value) }))}
              />
              <NumberInput
                allowDecimal={false}
                disabled={isSubmitting}
                label={t('Приорітет')}
                min={1}
                value={form.priorityColumnNumber}
                onChange={(value) => setForm((current) => ({ ...current, priorityColumnNumber: toPositiveNumber(value) }))}
              />
            </>
          )}
        </SimpleGrid>

        {!isPreview && (
          <Stack gap="xs">
            <Text fw={600} size="sm">
              {t('Додаткові колонки')}
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Stack gap={4}>
                <Checkbox
                  checked={form.withWeight}
                  disabled={isSubmitting}
                  label={t('Вага нетто')}
                  onChange={(event) => {
                    const { checked } = event.currentTarget

                    setForm((current) => ({ ...current, withWeight: checked }))
                  }}
                />
                {form.withWeight && (
                  <NumberInput
                    allowDecimal={false}
                    disabled={isSubmitting}
                    label={t('Колонка ваги нетто')}
                    min={1}
                    value={form.weightColumnNumber}
                    onChange={(value) => setForm((current) => ({ ...current, weightColumnNumber: toPositiveNumber(value) }))}
                  />
                )}
              </Stack>
              <Stack gap={4}>
                <Checkbox
                  checked={form.withGrossWeight}
                  disabled={isSubmitting}
                  label={t('Вага брутто')}
                  onChange={(event) => {
                    const { checked } = event.currentTarget

                    setForm((current) => ({ ...current, withGrossWeight: checked }))
                  }}
                />
                {form.withGrossWeight && (
                  <NumberInput
                    allowDecimal={false}
                    disabled={isSubmitting}
                    label={t('Колонка ваги брутто')}
                    min={1}
                    value={form.grossWeightColumnNumber}
                    onChange={(value) => setForm((current) => ({ ...current, grossWeightColumnNumber: toPositiveNumber(value) }))}
                  />
                )}
              </Stack>
              <Stack gap={4}>
                <Checkbox
                  checked={form.withSpecificationCode}
                  disabled={isSubmitting}
                  label={t('Митний код')}
                  onChange={(event) => {
                    const { checked } = event.currentTarget

                    setForm((current) => ({ ...current, withSpecificationCode: checked }))
                  }}
                />
                {form.withSpecificationCode && (
                  <NumberInput
                    allowDecimal={false}
                    disabled={isSubmitting}
                    label={t('Колонка митного коду')}
                    min={1}
                    value={form.specificationCodeColumnNumber}
                    onChange={(value) => setForm((current) => ({ ...current, specificationCodeColumnNumber: toPositiveNumber(value) }))}
                  />
                )}
              </Stack>
              <Stack gap={4}>
                <Checkbox
                  checked={form.withIsImportedProduct}
                  disabled={isSubmitting}
                  label={t('Імпортний товар')}
                  onChange={(event) => {
                    const { checked } = event.currentTarget

                    setForm((current) => ({ ...current, withIsImportedProduct: checked }))
                  }}
                />
                {form.withIsImportedProduct && (
                  <NumberInput
                    allowDecimal={false}
                    disabled={isSubmitting}
                    label={t('Колонка імпорту')}
                    min={1}
                    value={form.isImportedProductColumnNumber}
                    onChange={(value) => setForm((current) => ({ ...current, isImportedProductColumnNumber: toPositiveNumber(value) }))}
                  />
                )}
              </Stack>
            </SimpleGrid>
            {(form.withWeight || form.withGrossWeight) && (
              <Checkbox
                checked={form.isWeightPerItem}
                disabled={isSubmitting}
                label={t('Вага за одиницю')}
                onChange={(event) => {
                  const { checked } = event.currentTarget

                  setForm((current) => ({ ...current, isWeightPerItem: checked }))
                }}
              />
            )}
          </Stack>
        )}

        <Text c="dimmed" size="xs">
          {isPreview
            ? t('Файл буде перевірено перед додаванням у підбірку експорту.')
            : t('Файл буде завантажено у кошик переміщення до України.')}
        </Text>

        <Group justify="flex-end">
          <Button disabled={isSubmitting} variant="subtle" onClick={closeModal}>
            {t('Скасувати')}
          </Button>
          <Button leftSection={<Upload size={16} />} loading={isSubmitting} onClick={submitForm}>
            {t('Завантажити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
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

  if (form.withWeight && !form.weightColumnNumber) {
    return null
  }

  if (form.withGrossWeight && !form.grossWeightColumnNumber) {
    return null
  }

  if (form.withSpecificationCode && !form.specificationCodeColumnNumber) {
    return null
  }

  if (form.withIsImportedProduct && !form.isImportedProductColumnNumber) {
    return null
  }

  return {
    ...baseConfiguration,
    FromDateColumnNumber: form.fromDateColumnNumber,
    GrossWeightColumnNumber: form.withGrossWeight ? numberOrZero(form.grossWeightColumnNumber) : 0,
    IsImportedProduct: form.withIsImportedProduct ? numberOrZero(form.isImportedProductColumnNumber) : 0,
    IsWeightPerItem: form.isWeightPerItem,
    PriorityColumnNumber: form.priorityColumnNumber,
    SpecificationCodeColumnNumber: form.withSpecificationCode ? numberOrZero(form.specificationCodeColumnNumber) : 0,
    WeightColumnNumber: form.withWeight ? numberOrZero(form.weightColumnNumber) : 0,
    WithGrossWeight: form.withGrossWeight,
    WithIsImportedProduct: form.withIsImportedProduct,
    WithSpecificationCode: form.withSpecificationCode,
    WithWeight: form.withWeight,
  }
}

function numberOrZero(value: number | ''): number {
  return typeof value === 'number' ? value : 0
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
