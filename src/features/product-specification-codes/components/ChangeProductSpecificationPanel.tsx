import { Alert, Button, Group, NumberInput, Radio, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useAuth } from '../../auth/useAuth'
import { changeProductSpecification } from '../api/productSpecificationCodesApi'
import { ProductSpecificationChangeMode, type ProductSpecification } from '../types'
import './change-product-specification-panel.css'

const CHANGE_PERMISSION = 'Accounting_Specification_codes_ChangeBtn_PKEY'

type ChangeForm = {
  changeMode: ProductSpecificationChangeMode
  confirmSpecificationCode: string
  customs: number | ''
  customsValue: number | ''
  specificationCode: string
  vat: number | ''
}

export type ChangeProductSpecificationPanelProps = {
  productSpecification: ProductSpecification | null
  onClose: () => void
  onChanged: () => void
}

export function ChangeProductSpecificationPanel({
  productSpecification,
  onClose,
  onChanged,
}: ChangeProductSpecificationPanelProps) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const canChange = hasPermission(CHANGE_PERMISSION)
  const [form, setForm] = useValueState<ChangeForm>(() => buildForm(productSpecification))
  const [initialForm, setInitialForm] = useValueState<ChangeForm>(() => buildForm(productSpecification))
  const [error, setError] = useValueState<string | null>(null)
  const [isSubmitting, setSubmitting] = useValueState(false)
  const [confirmCloseOpen, setConfirmCloseOpen] = useValueState(false)
  const [previousNetUid, setPreviousNetUid] = useValueState(productSpecification?.NetUid)

  const currentNetUid = productSpecification?.NetUid

  if (currentNetUid !== previousNetUid) {
    setPreviousNetUid(currentNetUid)
    setForm(buildForm(productSpecification))
    setInitialForm(buildForm(productSpecification))
    setError(null)
    setSubmitting(false)
    setConfirmCloseOpen(false)
  }

  const isDirty = !areFormsEqual(form, initialForm)

  function requestClose() {
    if (isSubmitting) {
      return
    }

    if (isDirty) {
      setConfirmCloseOpen(true)
      return
    }

    onClose()
  }

  function confirmClose() {
    setConfirmCloseOpen(false)
    onClose()
  }

  async function submit() {
    if (!productSpecification) {
      return
    }

    const specificationCode = form.specificationCode.trim()

    if (!specificationCode) {
      setError(t('Заповніть поле') + ' - ' + t('Митний код'))
      return
    }

    if (form.confirmSpecificationCode.trim() !== specificationCode) {
      setError(t('Митні коди не співпадають'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await changeProductSpecification({
        body: {
          ...productSpecification,
          SpecificationCode: specificationCode,
          CustomsValue: toFiniteNumber(form.customsValue),
          Duty: toFiniteNumber(form.customs),
          VATValue: toFiniteNumber(form.vat),
        },
        specificationChangeMode: form.changeMode,
      })

      notifications.show({ color: 'green', message: t('Зміни збережено') })
      onChanged()
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('Не вдалося змінити митний код'))
    } finally {
      setSubmitting(false)
    }
  }

  const vendorCode = productSpecification?.Product?.VendorCode || ''
  const title = vendorCode ? (
    <span className="product-specification-change-title">
      <span>{t('Зміна митного коду для')}</span>
      <span className="product-specification-change-title-code">{vendorCode}</span>
    </span>
  ) : (
    <span className="product-specification-change-title">{t('Зміна митного коду')}</span>
  )

  return (
    <AppDrawer
      className="product-specification-change-sheet"
      footer={
        productSpecification ? (
          <>
            <Button color="gray" disabled={isSubmitting} variant="light" onClick={requestClose}>
              {t('Скасувати')}
            </Button>
            {canChange && (
              <Button
                color={CREATE_ACTION_COLOR}
                leftSection={<IconCheck size={16} />}
                loading={isSubmitting}
                onClick={submit}
              >
                {t('Змінити')}
              </Button>
            )}
          </>
        ) : null
      }
      opened={Boolean(productSpecification)}
      padding="lg"
      position="right"
      size="32rem"
      title={title}
      onClose={requestClose}
    >
      {productSpecification && (
        <Stack className="product-specification-change-body" gap={12}>
          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <Radio.Group
            className="product-specification-change-mode"
            label={t('Застосувати')}
            value={String(form.changeMode)}
            onChange={(value) =>
              setForm((current) => ({ ...current, changeMode: Number(value) as ProductSpecificationChangeMode }))
            }
          >
            <Stack className="product-specification-change-options" gap={4} mt={8}>
              <Radio
                className="product-specification-change-option"
                disabled={isSubmitting}
                label={t('Для даного товару')}
                value={String(ProductSpecificationChangeMode.SingleProduct)}
              />
              <Radio
                className="product-specification-change-option"
                disabled={isSubmitting}
                label={t('Для всіх товарів за назвою')}
                value={String(ProductSpecificationChangeMode.AllProductsByName)}
              />
              <Radio
                className="product-specification-change-option"
                disabled={isSubmitting}
                label={t('Для всіх товарів за кодом')}
                value={String(ProductSpecificationChangeMode.AllProductsByCode)}
              />
            </Stack>
          </Radio.Group>

          <div className="product-specification-change-form">
            <TextInput
              disabled={isSubmitting}
              label={t('Митний код')}
              required
              value={form.specificationCode}
              onChange={(event) => {
                const nextValue = event.currentTarget.value
                setForm((current) => ({ ...current, specificationCode: nextValue }))
              }}
            />

            <TextInput
              disabled={isSubmitting}
              label={t('Підтвердіть митний код')}
              required
              value={form.confirmSpecificationCode}
              onChange={(event) => {
                const nextValue = event.currentTarget.value
                setForm((current) => ({ ...current, confirmSpecificationCode: nextValue }))
              }}
            />

            <NumberInput
              decimalScale={2}
              disabled={isSubmitting}
              label={t('Митна вартість')}
              value={form.customsValue}
              onChange={(value) => setForm((current) => ({ ...current, customsValue: toNumberOrEmpty(value) }))}
            />

            <NumberInput
              decimalScale={2}
              disabled={isSubmitting}
              label={t('Мито')}
              value={form.customs}
              onChange={(value) => setForm((current) => ({ ...current, customs: toNumberOrEmpty(value) }))}
            />

            <NumberInput
              decimalScale={2}
              disabled={isSubmitting}
              label={t('ПДВ')}
              value={form.vat}
              onChange={(value) => setForm((current) => ({ ...current, vat: toNumberOrEmpty(value) }))}
            />
          </div>
        </Stack>
      )}

      <AppModal
        centered
        opened={confirmCloseOpen}
        title={t('Є незбережені зміни')}
        onClose={() => setConfirmCloseOpen(false)}
      >
        <Stack gap="md">
          <Text>{t('Якщо закрити вікно, зміни митного коду не будуть збережені.')}</Text>
          <Group justify="flex-end">
            <Button color="gray" variant="light" onClick={() => setConfirmCloseOpen(false)}>
              {t('Залишитися')}
            </Button>
            <Button color="red" onClick={confirmClose}>
              {t('Закрити без збереження')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </AppDrawer>
  )
}

function areFormsEqual(left: ChangeForm, right: ChangeForm): boolean {
  return (
    left.changeMode === right.changeMode &&
    left.customs === right.customs &&
    left.customsValue === right.customsValue &&
    left.specificationCode === right.specificationCode &&
    left.vat === right.vat
  )
}

function buildForm(productSpecification: ProductSpecification | null): ChangeForm {
  return {
    changeMode: ProductSpecificationChangeMode.SingleProduct,
    confirmSpecificationCode: '',
    customs: toNumberOrZero(productSpecification?.Duty),
    customsValue: toNumberOrZero(productSpecification?.CustomsValue),
    specificationCode: productSpecification?.SpecificationCode || '',
    vat: toNumberOrZero(productSpecification?.VATValue),
  }
}

function toNumberOrEmpty(value: number | string): number | '' {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) ? numberValue : ''
}

function toNumberOrZero(value?: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toFiniteNumber(value: number | ''): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
