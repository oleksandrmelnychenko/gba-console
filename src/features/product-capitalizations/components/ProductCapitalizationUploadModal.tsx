import { Alert, Button, Checkbox, FileInput, Group, NumberInput, SimpleGrid, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconFileSpreadsheet, IconUpload } from '@tabler/icons-react'
import { AppModal } from '../../../shared/ui/AppModal'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useValueState } from '../../../shared/hooks/useValueState'
import type { ProductCapitalizationParseConfiguration } from '../types'

type ProductCapitalizationUploadModalProps = {
  isSubmitting: boolean
  opened: boolean
  submitError: string | null
  onClose: () => void
  onSubmit: (file: File, parseConfiguration: ProductCapitalizationParseConfiguration) => void
}

type UploadForm = {
  endRow: number | ''
  file: File | null
  priceColumnNumber: number | ''
  pricePerItem: boolean
  qtyColumnNumber: number | ''
  startRow: number | ''
  vendorCodeColumnNumber: number | ''
  weightColumnNumber: number | ''
  weightPerItem: boolean
}

const EMPTY_FORM: UploadForm = {
  endRow: '',
  file: null,
  priceColumnNumber: '',
  pricePerItem: true,
  qtyColumnNumber: '',
  startRow: '',
  vendorCodeColumnNumber: '',
  weightColumnNumber: '',
  weightPerItem: true,
}

export function ProductCapitalizationUploadModal({
  isSubmitting,
  opened,
  submitError,
  onClose,
  onSubmit,
}: ProductCapitalizationUploadModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useValueState<UploadForm>(EMPTY_FORM)
  const [validationError, setValidationError] = useValueState<string | null>(null)

  function submitForm() {
    if (isSubmitting) {
      return
    }

    const parseConfiguration = toParseConfiguration(form)

    if (!form.file || !parseConfiguration) {
      setValidationError(t('Заповніть файл і колонки імпорту'))
      return
    }

    if (parseConfiguration.EndRow < parseConfiguration.StartRow) {
      setValidationError(t('Кінцевий рядок має бути не меншим за початковий'))
      return
    }

    if (hasDuplicateColumns(parseConfiguration)) {
      setValidationError(t('Колонки імпорту не можуть повторюватися'))
      return
    }

    setValidationError(null)
    onSubmit(form.file, parseConfiguration)
  }

  function closeModal() {
    if (isSubmitting) {
      return
    }

    setForm(EMPTY_FORM)
    setValidationError(null)
    onClose()
  }

  return (
    <AppModal centered opened={opened} size="lg" title={t('Імпорт з Excel')} onClose={closeModal}>
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
          label={t('Завантажити файли')}
          leftSection={<IconFileSpreadsheet size={16} />}
          placeholder={t('Оберіть файл')}
          value={form.file}
          onChange={(file) => setForm((current) => ({ ...current, file }))}
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <NumberInput
            allowDecimal={false}
            disabled={isSubmitting}
            label={t('Артикул')}
            min={1}
            value={form.vendorCodeColumnNumber}
            onChange={(value) => setForm((current) => ({ ...current, vendorCodeColumnNumber: toPositiveNumber(value) }))}
          />
          <NumberInput
            allowDecimal={false}
            disabled={isSubmitting}
            label={t('Кількість')}
            min={1}
            value={form.qtyColumnNumber}
            onChange={(value) => setForm((current) => ({ ...current, qtyColumnNumber: toPositiveNumber(value) }))}
          />
          <NumberInput
            allowDecimal={false}
            disabled={isSubmitting}
            label={t('З')}
            min={1}
            value={form.startRow}
            onChange={(value) => setForm((current) => ({ ...current, startRow: toPositiveNumber(value) }))}
          />
          <NumberInput
            allowDecimal={false}
            disabled={isSubmitting}
            label={t('По')}
            min={1}
            value={form.endRow}
            onChange={(value) => setForm((current) => ({ ...current, endRow: toPositiveNumber(value) }))}
          />
        </SimpleGrid>

        <Stack gap="xs">
          <Group align="end" gap="sm" wrap="nowrap">
            <NumberInput
              allowDecimal={false}
              disabled={isSubmitting}
              label={form.weightPerItem ? t('Вага за одиницю') : t('Вага')}
              min={1}
              style={{ flex: 1 }}
              value={form.weightColumnNumber}
              onChange={(value) => setForm((current) => ({ ...current, weightColumnNumber: toPositiveNumber(value) }))}
            />
            <Checkbox
              checked={form.weightPerItem}
              disabled={isSubmitting}
              label={t('За одиницю')}
              mb={6}
              onChange={(event) =>
                setForm((current) => ({ ...current, weightPerItem: event.currentTarget.checked }))
              }
            />
          </Group>
          <Group align="end" gap="sm" wrap="nowrap">
            <NumberInput
              allowDecimal={false}
              disabled={isSubmitting}
              label={form.pricePerItem ? t('Ціна за одиницю') : t('Вартість')}
              min={1}
              style={{ flex: 1 }}
              value={form.priceColumnNumber}
              onChange={(value) => setForm((current) => ({ ...current, priceColumnNumber: toPositiveNumber(value) }))}
            />
            <Checkbox
              checked={form.pricePerItem}
              disabled={isSubmitting}
              label={t('За одиницю')}
              mb={6}
              onChange={(event) => setForm((current) => ({ ...current, pricePerItem: event.currentTarget.checked }))}
            />
          </Group>
        </Stack>

        <Text c="dimmed" size="xs">
          {t('Позиції з файлу буде додано до документа оприбуткування.')}
        </Text>

        <Group justify="flex-end">
          <Button disabled={isSubmitting} variant="subtle" onClick={closeModal}>
            {t('Скасувати')}
          </Button>
          <Button disabled={isSubmitting} leftSection={<IconUpload size={16} />} loading={isSubmitting} onClick={submitForm}>
            {t('Завантажити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function toParseConfiguration(form: UploadForm): ProductCapitalizationParseConfiguration | null {
  if (!form.startRow || !form.endRow || !form.vendorCodeColumnNumber || !form.qtyColumnNumber || !form.priceColumnNumber) {
    return null
  }

  const priceColumnNumber = form.priceColumnNumber || 0
  const weightColumnNumber = form.weightColumnNumber || 0

  return {
    EndRow: form.endRow,
    PriceColumnNumber: priceColumnNumber,
    PricePerItem: form.pricePerItem,
    QtyColumnNumber: form.qtyColumnNumber,
    StartRow: form.startRow,
    VendorCodeColumnNumber: form.vendorCodeColumnNumber,
    WeightColumnNumber: weightColumnNumber,
    WeightPerItem: form.weightPerItem,
    WithPrice: priceColumnNumber > 0,
    WithWeight: weightColumnNumber > 0,
  }
}

function hasDuplicateColumns(parseConfiguration: ProductCapitalizationParseConfiguration): boolean {
  const columns = [
    parseConfiguration.PriceColumnNumber,
    parseConfiguration.QtyColumnNumber,
    parseConfiguration.VendorCodeColumnNumber,
  ]

  if (parseConfiguration.WeightColumnNumber > 0) {
    columns.push(parseConfiguration.WeightColumnNumber)
  }

  return new Set(columns).size !== columns.length
}

function toPositiveNumber(value: number | string): number | '' {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : ''
}
