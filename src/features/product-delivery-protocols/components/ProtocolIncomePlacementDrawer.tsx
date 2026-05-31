import { ActionIcon, Button, Checkbox, Group, NumberInput, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import type {
  DynamicProductPlacement,
  DynamicProductPlacementRow,
  IncomeProduct,
  IncomeProductPlacement,
  IncomeStorage,
  PackingListPackageOrderItem,
} from '../productIncomeTypes'

type ProtocolIncomePlacementDrawerProps = {
  opened: boolean
  item: PackingListPackageOrderItem | null
  row: DynamicProductPlacementRow | null
  selectedStorage: IncomeStorage | null
  onClose: () => void
  onApply: (placements: DynamicProductPlacement[]) => void
}

type PlacementDraftState = {
  editing: DynamicProductPlacement | null
  useNewAddress: boolean
  storageNumber: string
  rowNumber: string
  cellNumber: string
  selectedAddress: string
  qty: number
}

const MAX_PLACEMENT_NAME_LENGTH = 5

function buildAddress(placement: IncomeProductPlacement): string {
  return (placement.StorageNumber || '') + '-' + (placement.RowNumber ? placement.RowNumber + '-' : '') + (placement.CellNumber || '')
}

function sumQty(placements: DynamicProductPlacement[]): number {
  return placements.reduce((total, placement) => total + (placement.Qty || 0), 0)
}

function sumQtyExcept(placements: DynamicProductPlacement[], excluded: DynamicProductPlacement): number {
  return placements.reduce((total, placement) => total + (placement === excluded ? 0 : placement.Qty || 0), 0)
}

function isPlaceholderPlacement(placement: DynamicProductPlacement): boolean {
  return !placement.IsApplied
    && (placement.StorageNumber || 'N') === 'N'
    && (placement.RowNumber || 'N') === 'N'
    && (placement.CellNumber || 'N') === 'N'
}

function completePlacementsToRowQty(
  placements: DynamicProductPlacement[],
  rowQty: number,
): DynamicProductPlacement[] {
  const placedQty = sumQty(placements)
  const remainderQty = rowQty - placedQty

  if (remainderQty <= 0) {
    return placements
  }

  const placeholder = placements.find(isPlaceholderPlacement)

  if (placeholder) {
    return placements.map((placement) =>
      placement === placeholder ? { ...placement, Qty: (placement.Qty || 0) + remainderQty } : placement,
    )
  }

  return [
    ...placements,
    { StorageNumber: 'N', RowNumber: 'N', CellNumber: 'N', Qty: remainderQty, IsApplied: false },
  ]
}

function placementKey(placement: DynamicProductPlacement): string {
  return String(
    placement.NetUid
      || placement.Id
      || `${placement.StorageNumber || 'N'}-${placement.RowNumber || 'N'}-${placement.CellNumber || 'N'}-${placement.Qty || 0}`,
  )
}

export function ProtocolIncomePlacementDrawer({
  opened,
  item,
  row,
  selectedStorage,
  onClose,
  onApply,
}: ProtocolIncomePlacementDrawerProps) {
  const { t } = useI18n()
  const [placements, setPlacements] = useValueState<DynamicProductPlacement[]>([])
  const [draft, setDraft] = useValueState<PlacementDraftState | null>(null)
  const [error, setError] = useValueState<string | null>(null)

  const rowKey = row?.NetUid || row?.Id || ''
  const [syncedKey, setSyncedKey] = useValueState<string | number>('')

  if (opened && rowKey !== syncedKey) {
    setSyncedKey(rowKey)
    setPlacements(row ? row.DynamicProductPlacements.map((placement) => ({ ...placement })) : [])
    setDraft(null)
    setError(null)
  }

  if (!opened && syncedKey !== '') {
    setSyncedKey('')
  }

  const rowQty = row?.Qty || 0
  const product: IncomeProduct | null | undefined = item?.SupplyInvoiceOrderItem?.Product
  const availableAddresses = useMemo<IncomeProductPlacement[]>(() => {
    const productPlacements = product?.ProductPlacements || []

    return productPlacements.reduce<IncomeProductPlacement[]>((addresses, placement) => {
      if (selectedStorage && placement.Storage?.NetUid !== selectedStorage.NetUid) {
        return addresses
      }

      addresses.push({ ...placement, Address: buildAddress(placement) })
      return addresses
    }, [])
  }, [product, selectedStorage])

  const placedQty = sumQty(placements)
  const canAddPlacements = rowQty > placedQty

  function openDraft(placement: DynamicProductPlacement | null) {
    const excludedQty = placement ? sumQtyExcept(placements, placement) : placedQty
    const defaultQty = placement?.Qty || Math.max(rowQty - excludedQty, 0)
    const hasAddresses = availableAddresses.length > 0

    setError(null)
    setDraft({
      editing: placement,
      useNewAddress: !hasAddresses,
      storageNumber: placement?.StorageNumber || '',
      rowNumber: placement?.RowNumber || '',
      cellNumber: placement?.CellNumber || '',
      selectedAddress: hasAddresses ? availableAddresses[0].Address || '' : '',
      qty: defaultQty,
    })
  }

  function removePlacement(placement: DynamicProductPlacement) {
    setPlacements((current) => current.filter((entry) => entry !== placement))
  }

  function acceptDraft() {
    if (!draft) {
      return
    }

    const excludedQty = draft.editing ? sumQtyExcept(placements, draft.editing) : placedQty

    if (!draft.qty || draft.qty <= 0 || draft.qty % 1 !== 0) {
      setError(t('Невірна кількість'))
      return
    }

    if (draft.qty + excludedQty > rowQty) {
      setError(t('Невірна кількість'))
      return
    }

    if (
      draft.useNewAddress &&
      (draft.storageNumber.length > MAX_PLACEMENT_NAME_LENGTH ||
        draft.rowNumber.length > MAX_PLACEMENT_NAME_LENGTH ||
        draft.cellNumber.length > MAX_PLACEMENT_NAME_LENGTH)
    ) {
      setError(t('Текст не може перевищувати 5 символів'))
      return
    }

    let storageNumber = draft.storageNumber
    let rowNumber = draft.rowNumber
    let cellNumber = draft.cellNumber

    if (!draft.useNewAddress) {
      const target = availableAddresses.find((address) => address.Address === draft.selectedAddress)

      if (target) {
        storageNumber = target.StorageNumber || 'N'
        rowNumber = target.RowNumber || 'N'
        cellNumber = target.CellNumber || 'N'
      }
    } else {
      storageNumber = storageNumber || 'N'
      rowNumber = rowNumber || 'N'
      cellNumber = cellNumber || 'N'
    }

    setPlacements((current) => {
      if (draft.editing) {
        return current.map((entry) =>
          entry === draft.editing
            ? { ...entry, Qty: draft.qty, StorageNumber: storageNumber, RowNumber: rowNumber, CellNumber: cellNumber }
            : entry,
        )
      }

      return [
        ...current,
        { Qty: draft.qty, StorageNumber: storageNumber, RowNumber: rowNumber, CellNumber: cellNumber, IsApplied: false },
      ]
    })
    setDraft(null)
    setError(null)
  }

  function handleApply() {
    if (placedQty > rowQty) {
      setError(t('Невірна кількість'))
      return
    }

    onApply(completePlacementsToRowQty(placements, rowQty).map((placement) => ({ ...placement })))
  }

  const headerText = product
    ? `${product.VendorCode || ''} ${product.NameUA || product.Name || ''} ${rowQty} ${t('шт')}`.trim()
    : ''

  return (
    <AppDrawer opened={opened} size="lg" title={t('Розміщення')} onClose={onClose}>
      <Stack gap="md">
        <Text fw={600}>{headerText}</Text>
        <Text c="dimmed" size="sm">
          {`${t('Доступна К-сть')} ${Math.max(rowQty - placedQty, 0)}`}
        </Text>

        <Table withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>{t('Склад')}</Table.Th>
              <Table.Th>{t('Ряд')}</Table.Th>
              <Table.Th>{t('Полиця')}</Table.Th>
              <Table.Th>{t('К-сть')}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {placements.map((placement, index) => (
              <Table.Tr
                key={placementKey(placement)}
                style={{ cursor: placement.IsApplied ? 'default' : 'pointer' }}
                onClick={() => !placement.IsApplied && openDraft(placement)}
              >
                <Table.Td>{index + 1}</Table.Td>
                <Table.Td>{placement.StorageNumber}</Table.Td>
                <Table.Td>{placement.RowNumber}</Table.Td>
                <Table.Td>{placement.CellNumber}</Table.Td>
                <Table.Td>{placement.Qty}</Table.Td>
                <Table.Td>
                  {!placement.IsApplied && (
                    <ActionIcon
                      aria-label={t('Видалити')}
                      color="red"
                      variant="subtle"
                      onClick={(event) => {
                        event.stopPropagation()
                        removePlacement(placement)
                      }}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {!draft && (
          <Group>
            <Button disabled={!canAddPlacements} variant="light" onClick={() => openDraft(null)}>
              {t('Додати')}
            </Button>
          </Group>
        )}

        {draft && (
          <Stack gap="sm">
            <Text fw={600}>{t('Оприходування')}</Text>
            <TextInput readOnly label={t('Код Виробника')} value={product?.VendorCode || ''} />

            {availableAddresses.length > 0 && (
              <Checkbox
                checked={draft.useNewAddress}
                label={t('Нова адреса')}
                onChange={(event) => setDraft({ ...draft, useNewAddress: event.currentTarget.checked })}
              />
            )}

            {draft.useNewAddress ? (
              <Group grow>
                <TextInput
                  label={t('Склад')}
                  value={draft.storageNumber}
                  onChange={(event) => setDraft({ ...draft, storageNumber: event.currentTarget.value })}
                />
                <TextInput
                  label={t('Ряд')}
                  value={draft.rowNumber}
                  onChange={(event) => setDraft({ ...draft, rowNumber: event.currentTarget.value })}
                />
                <TextInput
                  label={t('Полиця')}
                  value={draft.cellNumber}
                  onChange={(event) => setDraft({ ...draft, cellNumber: event.currentTarget.value })}
                />
              </Group>
            ) : (
              <Select
                data={availableAddresses.map((address) => address.Address || '')}
                label={t('На адресу')}
                value={draft.selectedAddress}
                onChange={(value) => setDraft({ ...draft, selectedAddress: value || '' })}
              />
            )}

            <NumberInput
              allowDecimal={false}
              label={t('Кількість')}
              min={1}
              value={draft.qty}
              onChange={(value) => setDraft({ ...draft, qty: typeof value === 'number' ? value : Number(value) || 0 })}
            />

            {error && (
              <Text c="red" size="sm">
                {error}
              </Text>
            )}

            <Group justify="flex-end">
              <Button color="gray" variant="light" onClick={() => setDraft(null)}>
                {t('Скасувати')}
              </Button>
              <Button onClick={acceptDraft}>{t('Зберегти')}</Button>
            </Group>
          </Stack>
        )}

        {!draft && (
          <Group justify="flex-end">
            <Button color="gray" variant="light" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button onClick={handleApply}>{t('Зберегти')}</Button>
          </Group>
        )}
      </Stack>
    </AppDrawer>
  )
}
