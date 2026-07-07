import { Alert, Button, FileInput, Group, NumberInput, SimpleGrid, Stack } from '@mantine/core'
import { CircleAlert, FileSpreadsheet, Upload } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { ProductSpecificationParseConfiguration } from '../specificationTypes'

type UploadProductSpecificationModalProps = {
  isLoading: boolean
  opened: boolean
  onClose: () => void
  onSubmit: (parseConfiguration: ProductSpecificationParseConfiguration, file: File) => void
}

type FormDraft = {
  CustomsValue: number | string
  Duty: number | string
  EndRow: number | string
  Price: number | string
  Qty: number | string
  SpecificationCode: number | string
  StartRow: number | string
  VATValue: number | string
  VendorCode: number | string
}

const EMPTY_FORM: FormDraft = {
  CustomsValue: '',
  Duty: '',
  EndRow: '',
  Price: '',
  Qty: '',
  SpecificationCode: '',
  StartRow: '',
  VATValue: '',
  VendorCode: '',
}

export function UploadProductSpecificationModal({
  isLoading,
  opened,
  onClose,
  onSubmit,
}: UploadProductSpecificationModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormDraft>(EMPTY_FORM)
  const [file, setFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  function setField(key: keyof FormDraft, value: number | string) {
    if (isLoading) {
      return
    }

    setForm((current) => ({ ...current, [key]: toPositiveNumber(value) }))
  }

  function closeModal() {
    if (isLoading) {
      return
    }

    setForm(EMPTY_FORM)
    setFile(null)
    setValidationError(null)
    onClose()
  }

  function submitForm() {
    if (isLoading) {
      return
    }

    const parseConfiguration = toParseConfiguration(form)

    if (!file || !parseConfiguration) {
      setValidationError(t('Заповніть файл і колонки імпорту'))

      return
    }

    setValidationError(null)
    onSubmit(parseConfiguration, file)
  }

  return (
    <AppModal
      centered
      className="app-form-sheet"
      opened={opened}
      size="lg"
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Завантаження митних кодів')}</span>}
      onClose={closeModal}
    >
      <Stack gap="md">
        {validationError && (
          <Alert color="red" icon={<CircleAlert size={16} />} variant="light">
            {validationError}
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <NumberInput
            allowDecimal={false}
            disabled={isLoading}
            label={t('Код')}
            min={1}
            value={form.VendorCode}
            onChange={(value) => setField('VendorCode', value)}
          />
          <NumberInput
            allowDecimal={false}
            disabled={isLoading}
            label={t('Митна вартість')}
            min={1}
            value={form.CustomsValue}
            onChange={(value) => setField('CustomsValue', value)}
          />
          <NumberInput
            allowDecimal={false}
            disabled={isLoading}
            label={t('Митний код')}
            min={1}
            value={form.SpecificationCode}
            onChange={(value) => setField('SpecificationCode', value)}
          />
          <NumberInput
            allowDecimal={false}
            disabled={isLoading}
            label={t('Мито')}
            min={1}
            value={form.Duty}
            onChange={(value) => setField('Duty', value)}
          />
          <NumberInput
            allowDecimal={false}
            disabled={isLoading}
            label={t('Ціна')}
            min={1}
            value={form.Price}
            onChange={(value) => setField('Price', value)}
          />
          <NumberInput
            allowDecimal={false}
            disabled={isLoading}
            label={t('К-сть')}
            min={1}
            value={form.Qty}
            onChange={(value) => setField('Qty', value)}
          />
          <NumberInput
            allowDecimal={false}
            disabled={isLoading}
            label={t('Сума ПДВ')}
            min={1}
            value={form.VATValue}
            onChange={(value) => setField('VATValue', value)}
          />
          <NumberInput
            allowDecimal={false}
            disabled={isLoading}
            label={t('Від')}
            min={1}
            value={form.StartRow}
            onChange={(value) => setField('StartRow', value)}
          />
          <NumberInput
            allowDecimal={false}
            disabled={isLoading}
            label={t('До')}
            min={1}
            value={form.EndRow}
            onChange={(value) => setField('EndRow', value)}
          />
        </SimpleGrid>

        <FileInput
          clearable
          accept=".xls,.xlsx"
          disabled={isLoading}
          label={t('Завантажити')}
          leftSection={<FileSpreadsheet size={16} />}
          placeholder={t('Оберіть файл')}
          value={file}
          onChange={(nextFile) => {
            if (!isLoading) {
              setFile(nextFile)
            }
          }}
        />

        <Group justify="flex-end">
          <Button disabled={isLoading} variant="subtle" onClick={closeModal}>
            {t('Скасувати')}
          </Button>
          <Button disabled={isLoading} leftSection={<Upload size={16} />} loading={isLoading} onClick={submitForm}>
            {t('Завантажити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function toParseConfiguration(form: FormDraft): ProductSpecificationParseConfiguration | null {
  const configuration = {
    CustomsValue: toNumber(form.CustomsValue),
    Duty: toNumber(form.Duty),
    EndRow: toNumber(form.EndRow),
    Price: toNumber(form.Price),
    Qty: toNumber(form.Qty),
    SpecificationCode: toNumber(form.SpecificationCode),
    StartRow: toNumber(form.StartRow),
    VATValue: toNumber(form.VATValue),
    VendorCode: toNumber(form.VendorCode),
  }

  const hasAllValues = Object.values(configuration).every((value) => value >= 1)

  return hasAllValues ? configuration : null
}

function toNumber(value: number | string): number {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) ? numberValue : 0
}

function toPositiveNumber(value: number | string): number | '' {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : ''
}
