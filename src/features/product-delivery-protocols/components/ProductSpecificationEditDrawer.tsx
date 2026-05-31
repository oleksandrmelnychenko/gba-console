import { Alert, Button, Group, NumberInput, Stack, Table, Text, TextInput } from '@mantine/core'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import type {
  PackingListPackageOrderItem,
  ProductSpecificationEntity,
  SpecificationProduct,
} from '../specificationTypes'

export type ProductSpecificationDraft = {
  customsValue: number | ''
  duty: number | ''
  specificationCode: string
  vatValue: number | ''
}

export type ProductSpecificationSubmitPayload = {
  CustomsValue: number
  Duty: number
  ProductId?: number
  SpecificationCode: string
  VATValue: number
}

export type ProductSpecificationEditDrawerProps = {
  isSaving: boolean
  item: PackingListPackageOrderItem | null
  onClose: () => void
  onSave: (payload: ProductSpecificationSubmitPayload) => Promise<void>
}

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })

export function ProductSpecificationEditDrawer({
  isSaving,
  item,
  onClose,
  onSave,
}: ProductSpecificationEditDrawerProps) {
  const { t } = useI18n()
  const product = item?.SupplyInvoiceOrderItem?.Product || null
  const [draft, setDraft] = useValueState<ProductSpecificationDraft>(() => buildDraft(product))
  const [error, setError] = useValueState<string | null>(null)
  const [previousProductKey, setPreviousProductKey] = useValueState(getProductKey(product))
  const currentProductKey = getProductKey(product)
  const history = useMemo(() => buildSpecificationHistory(product), [product])

  if (currentProductKey !== previousProductKey) {
    setPreviousProductKey(currentProductKey)
    setDraft(buildDraft(product))
    setError(null)
  }

  async function submit() {
    if (!product) {
      return
    }

    const specificationCode = draft.specificationCode.trim()

    if (!specificationCode) {
      setError(`${t('Заповніть поле')} - ${t('Митний код')}`)
      return
    }

    setError(null)

    await onSave({
      CustomsValue: toFiniteNumber(draft.customsValue),
      Duty: toFiniteNumber(draft.duty),
      ProductId: product.Id,
      SpecificationCode: specificationCode,
      VATValue: toFiniteNumber(draft.vatValue),
    })
  }

  return (
    <AppDrawer
      opened={Boolean(item)}
      padding="lg"
      position="right"
      size="34rem"
      title={`${t('Митний код')} ${product?.VendorCode || ''}`.trim()}
      onClose={onClose}
    >
      {product && (
        <Stack gap="md">
          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <Stack gap={2}>
            <Text fw={700}>{product.VendorCode || '-'}</Text>
            <Text c="dimmed" size="sm">
              {product.Name || '-'}
            </Text>
          </Stack>

          <TextInput
            disabled={isSaving}
            label={t('Митний код')}
            required
            value={draft.specificationCode}
            onChange={(event) => setDraft((current) => ({ ...current, specificationCode: event.currentTarget.value }))}
          />
          <NumberInput
            decimalScale={2}
            disabled={isSaving}
            label={t('Митна вартість')}
            value={draft.customsValue}
            onChange={(value) => setDraft((current) => ({ ...current, customsValue: toNumberOrEmpty(value) }))}
          />
          <NumberInput
            decimalScale={2}
            disabled={isSaving}
            label={t('Мито')}
            value={draft.duty}
            onChange={(value) => setDraft((current) => ({ ...current, duty: toNumberOrEmpty(value) }))}
          />
          <NumberInput
            decimalScale={2}
            disabled={isSaving}
            label={t('ПДВ')}
            value={draft.vatValue}
            onChange={(value) => setDraft((current) => ({ ...current, vatValue: toNumberOrEmpty(value) }))}
          />

          <Group justify="flex-end">
            <Button color="gray" disabled={isSaving} variant="light" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button color="violet" leftSection={<IconCheck size={16} />} loading={isSaving} onClick={submit}>
              {t('Змінити')}
            </Button>
          </Group>

          <Stack gap="xs">
            <Text fw={700}>{t('Історія митних кодів')}</Text>
            {history.length === 0 ? (
              <Text c="dimmed" size="sm">
                {t('Немає даних')}
              </Text>
            ) : (
              <Table striped withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('Митний код')}</Table.Th>
                    <Table.Th>{t('% Мита')}</Table.Th>
                    <Table.Th>{t('Користувач')}</Table.Th>
                    <Table.Th>{t('Дата')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {history.map((specification, index) => (
                    <Table.Tr key={specification.NetUid || specification.Id || index}>
                      <Table.Td>{specification.SpecificationCode || '-'}</Table.Td>
                      <Table.Td>{specification.DutyPercent ?? 0}</Table.Td>
                      <Table.Td>{getUserName(specification)}</Table.Td>
                      <Table.Td>{formatDate(specification.Created)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        </Stack>
      )}
    </AppDrawer>
  )
}

function buildDraft(product: SpecificationProduct | null): ProductSpecificationDraft {
  const specification = getLastSpecification(product)

  return {
    customsValue: toNumberOrZero(specification?.CustomsValue),
    duty: toNumberOrZero(specification?.Duty),
    specificationCode: specification?.SpecificationCode || '',
    vatValue: toNumberOrZero(specification?.VATValue),
  }
}

function buildSpecificationHistory(product: SpecificationProduct | null): ProductSpecificationEntity[] {
  return [...(product?.ProductSpecifications || [])].sort((left, right) => getDateTime(left.Created) - getDateTime(right.Created))
}

function getLastSpecification(product: SpecificationProduct | null): ProductSpecificationEntity | null {
  const specifications = product?.ProductSpecifications || []

  return specifications.length > 0 ? specifications[specifications.length - 1] : null
}

function getProductKey(product: SpecificationProduct | null): string {
  return String(product?.NetUid || product?.Id || '')
}

function getUserName(specification: ProductSpecificationEntity): string {
  const user = specification.AddedBy

  return [user?.LastName, user?.FirstName, user?.MiddleName].filter(Boolean).join(' ') || user?.Name || '-'
}

function formatDate(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
}

function getDateTime(value?: Date | string): number {
  if (!value) {
    return 0
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
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
