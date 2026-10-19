import { Alert, Button, FileInput, NumberInput, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { CircleAlert, Upload } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import './customs-import-modals.css'
import type { ProductSpecificationParseConfiguration } from '../specificationTypes'

type UploadProductSpecificationModalProps = {
  isLoading: boolean
  opened: boolean
  onClose: () => void
  onSubmit: (
    parseConfiguration: ProductSpecificationParseConfiguration,
    dateCustomDeclaration: string,
    file: File,
  ) => void
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
  const [dateCustomDeclaration, setDateCustomDeclaration] = useState('')
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
    setDateCustomDeclaration('')
    setFile(null)
    setValidationError(null)
    onClose()
  }

  function submitForm() {
    if (isLoading) {
      return
    }

    const parseConfiguration = toParseConfiguration(form)

    if (!file || !parseConfiguration || !isIsoDate(dateCustomDeclaration)) {
      setValidationError(t('Заповніть файл, дату митної декларації і колонки імпорту'))

      return
    }

    setValidationError(null)
    onSubmit(parseConfiguration, dateCustomDeclaration, file)
  }

  return (
    <AppModal
      centered
      className="customs-import-modal customs-codes-import-modal"
      opened={opened}
      size={800}
      title={<span>{t('Завантаження митних кодів')}</span>}
      onClose={closeModal}
    >
      <Stack className="customs-import-layout" gap={10}>
        <Stack className="customs-import-fields" gap={10}>
          {validationError && (
            <Alert color="red" icon={<CircleAlert size={16} />} variant="light">
              {validationError}
            </Alert>
          )}

          <section className="customs-import-section" aria-label={t('Файл та дата')}>
            <Text className="app-section-title">{t('Файл та дата')}</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={10}>
              <TextInput
                aria-required="true"
                disabled={isLoading}
                label={t('Дата митної декларації')}
                type="date"
                value={dateCustomDeclaration}
                withAsterisk
                onChange={(event) => setDateCustomDeclaration(event.currentTarget.value)}
              />
              <FileInput
                clearable
                accept=".xls,.xlsx"
                disabled={isLoading}
                label={t('Завантажити')}
                leftSection={<ExcelIcon size={18} />}
                placeholder={t('Оберіть файл')}
                value={file}
                onChange={(nextFile) => {
                  if (!isLoading) {
                    setFile(nextFile)
                  }
                }}
              />
            </SimpleGrid>
          </section>

          <section className="customs-import-section" aria-label={t('Колонки імпорту')}>
            <Text className="app-section-title">{t('Колонки імпорту')}</Text>
            <Text className="customs-import-hint">{t('Номери колонок у файлі')}</Text>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={10}>
              <NumberInput
                hideControls
                allowDecimal={false}
                disabled={isLoading}
                label={t('Код')}
                min={1}
                value={form.VendorCode}
                onChange={(value) => setField('VendorCode', value)}
              />
              <NumberInput
                hideControls
                allowDecimal={false}
                disabled={isLoading}
                label={t('Митна вартість')}
                min={1}
                value={form.CustomsValue}
                onChange={(value) => setField('CustomsValue', value)}
              />
              <NumberInput
                hideControls
                allowDecimal={false}
                disabled={isLoading}
                label={t('Митний код')}
                min={1}
                value={form.SpecificationCode}
                onChange={(value) => setField('SpecificationCode', value)}
              />
              <NumberInput
                hideControls
                allowDecimal={false}
                disabled={isLoading}
                label={t('Мито')}
                min={1}
                value={form.Duty}
                onChange={(value) => setField('Duty', value)}
              />
              <NumberInput
                hideControls
                allowDecimal={false}
                disabled={isLoading}
                label={t('Ціна')}
                min={1}
                value={form.Price}
                onChange={(value) => setField('Price', value)}
              />
              <NumberInput
                hideControls
                allowDecimal={false}
                disabled={isLoading}
                label={t('К-сть')}
                min={1}
                value={form.Qty}
                onChange={(value) => setField('Qty', value)}
              />
              <NumberInput
                hideControls
                allowDecimal={false}
                disabled={isLoading}
                label={t('Сума ПДВ')}
                min={1}
                value={form.VATValue}
                onChange={(value) => setField('VATValue', value)}
              />
            </SimpleGrid>
          </section>

          <section className="customs-import-section" aria-label={t('Рядки імпорту')}>
            <Text className="app-section-title">{t('Рядки імпорту')}</Text>
            <SimpleGrid cols={2} spacing={10}>
              <NumberInput
                hideControls
                allowDecimal={false}
                disabled={isLoading}
                label={t('Від')}
                min={1}
                value={form.StartRow}
                onChange={(value) => setField('StartRow', value)}
              />
              <NumberInput
                hideControls
                allowDecimal={false}
                disabled={isLoading}
                label={t('До')}
                min={1}
                value={form.EndRow}
                onChange={(value) => setField('EndRow', value)}
              />
            </SimpleGrid>
          </section>
        </Stack>

        <AppModalFooter>
          <Button disabled={isLoading} variant="default" onClick={closeModal}>
            {t('Скасувати')}
          </Button>
          <Button disabled={isLoading} leftSection={<Upload size={16} />} loading={isLoading} onClick={submitForm}>
            {t('Завантажити')}
          </Button>
        </AppModalFooter>
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

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  )
}
