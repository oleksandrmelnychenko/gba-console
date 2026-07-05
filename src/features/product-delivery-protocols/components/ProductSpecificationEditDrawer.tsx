import { Alert, Button, Group, NumberInput, Stack, Table, Text, TextInput } from '@mantine/core'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import type {
  PackingListPackageOrderItem,
  ProductSpecificationEntity,
  SpecificationProduct,
} from '../specificationTypes'
import { getLatestProductSpecification, getProductSpecificationDateTime } from '../productSpecificationLatest'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'

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
  canSave?: boolean
  isSaving: boolean
  item: PackingListPackageOrderItem | null
  onClose: () => void
  onSave: (payload: ProductSpecificationSubmitPayload) => Promise<void>
}

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })

export function ProductSpecificationEditDrawer(props: ProductSpecificationEditDrawerProps) {
  return <ProductSpecificationEditDrawerContent key={getProductDrawerKey(props.item)} {...props} />
}

function ProductSpecificationEditDrawerContent({
  canSave = true,
  isSaving,
  item,
  onClose,
  onSave,
}: ProductSpecificationEditDrawerProps) {
  const { t } = useI18n()
  const product = item?.SupplyInvoiceOrderItem?.Product || null
  const initialDraft = useMemo(() => buildDraft(product), [product])
  const [draft, setDraft] = useValueState<ProductSpecificationDraft>(() => buildDraft(product))
  const [error, setError] = useValueState<string | null>(null)
  const [confirmCloseOpen, setConfirmCloseOpen] = useValueState(false)
  const history = useMemo(() => buildSpecificationHistory(product), [product])
  const isDraftDirty = canSave && !areDraftsEqual(draft, initialDraft)

  async function submit() {
    if (!product || isSaving || !canSave) {
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

  function requestClose() {
    if (isSaving) {
      return
    }

    if (isDraftDirty) {
      setConfirmCloseOpen(true)
      return
    }

    onClose()
  }

  function confirmClose() {
    setConfirmCloseOpen(false)
    onClose()
  }

  return (
    <AppDrawer
      opened={Boolean(item)}
      padding="lg"
      position="right"
      size="34rem"
      className="app-form-sheet"
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{`${t('Митний код')} ${product?.VendorCode || ''}`.trim()}</span>}
      onClose={requestClose}
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
            disabled={isSaving || !canSave}
            label={t('Митний код')}
            required
            value={draft.specificationCode}
            onChange={(event) => {
              const nextValue = event.currentTarget.value
              setDraft((current) => ({ ...current, specificationCode: nextValue }))
            }}
          />
          <NumberInput
            decimalScale={2}
            disabled={isSaving || !canSave}
            label={t('Митна вартість')}
            value={draft.customsValue}
            onChange={(value) => setDraft((current) => ({ ...current, customsValue: toNumberOrEmpty(value) }))}
          />
          <NumberInput
            decimalScale={2}
            disabled={isSaving || !canSave}
            label={t('Мито')}
            value={draft.duty}
            onChange={(value) => setDraft((current) => ({ ...current, duty: toNumberOrEmpty(value) }))}
          />
          <NumberInput
            decimalScale={2}
            disabled={isSaving || !canSave}
            label={t('ПДВ')}
            value={draft.vatValue}
            onChange={(value) => setDraft((current) => ({ ...current, vatValue: toNumberOrEmpty(value) }))}
          />

          <Group justify="flex-end">
            <Button color="gray" disabled={isSaving} variant="light" onClick={requestClose}>
              {t('Скасувати')}
            </Button>
            {canSave && (
              <Button color={CREATE_ACTION_COLOR} leftSection={<IconCheck size={16} />} loading={isSaving} onClick={submit}>
                {t('Змінити')}
              </Button>
            )}
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

      <AppModal
        centered
        opened={confirmCloseOpen}
        className="app-form-sheet"
        title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Є незбережені зміни')}</span>}
        onClose={() => setConfirmCloseOpen(false)}
      >
        <Stack gap="md">
          <Text>{t('Якщо закрити вікно, зміни митного коду не будуть збережені.')}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmCloseOpen(false)}>
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

function buildDraft(product: SpecificationProduct | null): ProductSpecificationDraft {
  const specification = getLatestProductSpecification(product)

  return {
    customsValue: toNumberOrZero(specification?.CustomsValue),
    duty: toNumberOrZero(specification?.Duty),
    specificationCode: specification?.SpecificationCode || '',
    vatValue: toNumberOrZero(specification?.VATValue),
  }
}

function areDraftsEqual(left: ProductSpecificationDraft, right: ProductSpecificationDraft): boolean {
  return (
    left.customsValue === right.customsValue &&
    left.duty === right.duty &&
    left.specificationCode === right.specificationCode &&
    left.vatValue === right.vatValue
  )
}

function buildSpecificationHistory(product: SpecificationProduct | null): ProductSpecificationEntity[] {
  return (product?.ProductSpecifications || []).toSorted((left, right) => {
    const timeDiff = getProductSpecificationDateTime(right.Created) - getProductSpecificationDateTime(left.Created)

    if (timeDiff !== 0) {
      return timeDiff
    }

    return (right.Id || 0) - (left.Id || 0)
  })
}

function getProductDrawerKey(item: PackingListPackageOrderItem | null): string {
  if (!item) {
    return 'closed'
  }

  const product = item.SupplyInvoiceOrderItem?.Product || null
  const specification = getLatestProductSpecification(product)
  const keyParts = [
    getProductKey(product),
    specification?.NetUid,
    specification?.Id,
    specification?.SpecificationCode,
    specification?.CustomsValue,
    specification?.Duty,
    specification?.VATValue,
  ].filter(Boolean)

  return keyParts.length > 0 ? keyParts.join('|') : 'open'
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
