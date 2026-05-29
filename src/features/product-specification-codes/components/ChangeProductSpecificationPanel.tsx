import { Alert, Button, Divider, Group, NumberInput, Radio, Stack, TextInput } from '@mantine/core'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useAuth } from '../../auth/useAuth'
import { changeProductSpecification } from '../api/productSpecificationCodesApi'
import { ProductSpecificationChangeMode, type ProductSpecification } from '../types'

const CHANGE_PERMISSION = 'Accounting_Specification_codes_ChangeBtn_PKEY'

type ChangeForm = {
  changeMode: ProductSpecificationChangeMode
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
  const [error, setError] = useValueState<string | null>(null)
  const [isSubmitting, setSubmitting] = useValueState(false)
  const [previousNetUid, setPreviousNetUid] = useValueState(productSpecification?.NetUid)

  const currentNetUid = productSpecification?.NetUid

  if (currentNetUid !== previousNetUid) {
    setPreviousNetUid(currentNetUid)
    setForm(buildForm(productSpecification))
    setError(null)
    setSubmitting(false)
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

  return (
    <AppDrawer
      opened={Boolean(productSpecification)}
      padding="lg"
      position="right"
      size="32rem"
      title={`${t('Зміна митного коду для')} ${vendorCode}`.trim()}
      onClose={onClose}
    >
      {productSpecification && (
        <Stack gap="md">
          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <Radio.Group
            label={t('Застосувати')}
            value={String(form.changeMode)}
            onChange={(value) =>
              setForm((current) => ({ ...current, changeMode: Number(value) as ProductSpecificationChangeMode }))
            }
          >
            <Stack gap="xs" mt="xs">
              <Radio
                disabled={isSubmitting}
                label={t('Для даного товару')}
                value={String(ProductSpecificationChangeMode.SingleProduct)}
              />
              <Radio
                disabled={isSubmitting}
                label={t('Для всіх товарів за назвою')}
                value={String(ProductSpecificationChangeMode.AllProductsByName)}
              />
              <Radio
                disabled={isSubmitting}
                label={t('Для всіх товарів за кодом')}
                value={String(ProductSpecificationChangeMode.AllProductsByCode)}
              />
            </Stack>
          </Radio.Group>

          <TextInput
            disabled={isSubmitting}
            label={t('Митний код')}
            required
            value={form.specificationCode}
            onChange={(event) => setForm((current) => ({ ...current, specificationCode: event.currentTarget.value }))}
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

          <Divider />

          <Group justify="flex-end">
            <Button color="gray" disabled={isSubmitting} variant="light" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            {canChange && (
              <Button leftSection={<IconCheck size={16} />} loading={isSubmitting} onClick={submit}>
                {t('Змінити')}
              </Button>
            )}
          </Group>
        </Stack>
      )}
    </AppDrawer>
  )
}

function buildForm(productSpecification: ProductSpecification | null): ChangeForm {
  return {
    changeMode: ProductSpecificationChangeMode.SingleProduct,
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
