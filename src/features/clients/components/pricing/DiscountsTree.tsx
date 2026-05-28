import { Alert, Box, Button, Checkbox, Group, Loader, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { usePrevious } from '@mantine/hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { useAuth } from '../../../auth/useAuth'
import { getAgreementProductGroupDiscounts } from '../../api/clientAgreementsApi'
import {
  DISCOUNT_PERCENT_INPUT_PERMISSION,
  DISCOUNT_ROW_CHECKBOX_PERMISSION,
  DISCOUNT_SELECT_ALL_PERMISSION,
} from '../../permissions'
import type { ProductGroupDiscount } from '../../types'

type DiscountNode = {
  netId: string
  parentNetId?: string
  percent: number
  name: string
  isSelected: boolean
  isActive: boolean
  hasSubGroups: boolean
  clientAgreementId?: number
}

type DiscountMap = Record<string, DiscountNode>

type ProductGroupLike = {
  NetUid?: string
  Name?: string
  FullName?: string
}

export type DiscountsTreeProps = {
  clientAgreementNetId: string
  selectedAgreementName: string
  productGroupDiscounts: ProductGroupDiscount[]
  rootProductGroupNetId?: string
  disabled?: boolean
  onApplyChanges: (updatedProductGroupDiscounts: ProductGroupDiscount[]) => void
}

function readProductGroup(discount: ProductGroupDiscount): ProductGroupLike {
  return (discount.ProductGroup as ProductGroupLike | undefined) ?? {}
}

function buildDiscountMap(productGroupDiscounts: ProductGroupDiscount[] = []): DiscountMap {
  return productGroupDiscounts.reduce<DiscountMap>((accumulator, discount) => {
    const group = readProductGroup(discount)
    const parentNetId = group.NetUid || ''
    const subDiscounts = Array.isArray(discount.SubProductGroupDiscounts) ? discount.SubProductGroupDiscounts : []

    if (parentNetId) {
      accumulator[parentNetId] = {
        netId: parentNetId,
        name: group.Name || group.FullName || '',
        percent: discount.DiscountRate || 0,
        isSelected: false,
        isActive: Boolean(discount.IsActive),
        hasSubGroups: subDiscounts.length > 0,
        clientAgreementId: discount.ClientAgreementId,
      }
    }

    subDiscounts.forEach((subDiscount) => {
      const subGroup = readProductGroup(subDiscount)
      const subNetId = subGroup.NetUid || ''

      if (!subNetId) {
        return
      }

      accumulator[subNetId] = {
        netId: subNetId,
        parentNetId,
        name: subGroup.Name || subGroup.FullName || '',
        percent: subDiscount.DiscountRate || 0,
        isSelected: false,
        isActive: Boolean(subDiscount.IsActive),
        hasSubGroups: false,
        clientAgreementId: discount.ClientAgreementId,
      }
    })

    return accumulator
  }, {})
}

function mapToDiscountArray(map: DiscountMap, productGroupDiscounts: ProductGroupDiscount[]): ProductGroupDiscount[] {
  return productGroupDiscounts.map((discount) => {
    const group = readProductGroup(discount)
    const node = group.NetUid ? map[group.NetUid] : undefined
    const subDiscounts = Array.isArray(discount.SubProductGroupDiscounts) ? discount.SubProductGroupDiscounts : []

    if (!node) {
      return discount
    }

    return {
      ...discount,
      DiscountRate: node.percent,
      IsActive: node.isActive,
      SubProductGroupDiscounts: subDiscounts.length > 0 ? mapToDiscountArray(map, subDiscounts) : [],
    }
  })
}

function toCompareValue(map: DiscountMap): string {
  return JSON.stringify(Object.values(map).map((node) => ({ key: node.netId, value: node.percent, active: node.isActive })))
}

function clampPercent(raw: string): number {
  let value = Number.parseFloat(raw)

  if (Number.isNaN(value) || value < 0) {
    value = 0
  } else if (value > 100) {
    value = 100
  }

  return value
}

export function DiscountsTree({
  clientAgreementNetId,
  selectedAgreementName,
  productGroupDiscounts,
  rootProductGroupNetId,
  disabled = false,
  onApplyChanges,
}: DiscountsTreeProps) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const canSelectAll = hasPermission(DISCOUNT_SELECT_ALL_PERMISSION)
  const canEditPercent = hasPermission(DISCOUNT_PERCENT_INPUT_PERMISSION)
  const canCheckRow = hasPermission(DISCOUNT_ROW_CHECKBOX_PERMISSION)
  const [tree, setTree] = useState<ProductGroupDiscount[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [percent, setPercent] = useState('')
  const [isAllSelected, setIsAllSelected] = useState(false)
  const [selectedNetId, setSelectedNetId] = useState('')
  const [discountMap, setDiscountMap] = useState<DiscountMap>({})
  const [initialValue, setInitialValue] = useState('')

  const requestIdRef = useRef(0)
  const prevClientAgreementNetId = usePrevious(clientAgreementNetId)
  const prevAgreementName = usePrevious(selectedAgreementName)

  useEffect(() => {
    let cancelled = false
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    async function loadDiscounts() {
      setIsLoading(true)
      setError(null)

      try {
        const result = await getAgreementProductGroupDiscounts(productGroupDiscounts, rootProductGroupNetId)

        if (cancelled || requestIdRef.current !== requestId) {
          return
        }

        const map = buildDiscountMap(result)
        setTree(result)
        setDiscountMap(map)
        setInitialValue(toCompareValue(map))
        setPercent('')
        setIsAllSelected(false)
        setSelectedNetId('')
      } catch {
        if (cancelled || requestIdRef.current !== requestId) {
          return
        }

        setTree([])
        setDiscountMap({})
        setInitialValue('')
        setPercent('')
        setIsAllSelected(false)
        setSelectedNetId('')
        setError(t('Не вдалося завантажити групи товарів'))
      } finally {
        if (!cancelled && requestIdRef.current === requestId) {
          setIsLoading(false)
        }
      }
    }

    void loadDiscounts()

    return () => {
      cancelled = true
    }
  }, [productGroupDiscounts, rootProductGroupNetId, t])

  const isDirty = useMemo(() => {
    if (!initialValue) {
      return false
    }

    return toCompareValue(discountMap) !== initialValue
  }, [discountMap, initialValue])

  const isDirtyRef = useRef(isDirty)
  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  useEffect(() => {
    return () => {
      if (isDirtyRef.current && clientAgreementNetId !== prevClientAgreementNetId) {
        window.confirm(`${t('Застосувати зміни')} ${t('Договір')}: ${prevAgreementName}`)
      }
    }
  }, [clientAgreementNetId, prevClientAgreementNetId, prevAgreementName, t])

  const nodes = useMemo(() => Object.values(discountMap), [discountMap])
  const isAnySelected = useMemo(() => nodes.some((node) => node.isSelected), [nodes])
  const rootNodes = useMemo(() => nodes.filter((node) => !node.parentNetId), [nodes])
  const currentNode = selectedNetId ? discountMap[selectedNetId] : undefined
  const selectedLabel = currentNode ? currentNode.name : t('Усі вибрані')

  function handleSelectAll() {
    const nextSelected = !isAllSelected
    setIsAllSelected(nextSelected)
    setPercent('')
    setSelectedNetId('')
    setDiscountMap((previous) =>
      Object.values(previous).reduce<DiscountMap>((accumulator, node) => {
        accumulator[node.netId] = { ...node, isSelected: nextSelected }
        return accumulator
      }, {}),
    )
  }

  function handleSelectNode(netId: string) {
    if (!discountMap[netId]) {
      return
    }

    const nextSelectedNetId = netId !== selectedNetId ? netId : ''
    setPercent('')
    setSelectedNetId(nextSelectedNetId)
    setDiscountMap((previous) =>
      Object.values(previous).reduce<DiscountMap>((accumulator, node) => {
        accumulator[node.netId] = {
          ...node,
          isSelected:
            node.netId === netId || (!!node.parentNetId && node.parentNetId === netId)
              ? selectedNetId !== netId
              : false,
        }
        return accumulator
      }, {}),
    )
  }

  function handleCheckNode(netId: string) {
    const node = discountMap[netId]

    if (!node) {
      return
    }

    setPercent('')
    setSelectedNetId('')
    setDiscountMap((previous) => ({
      ...previous,
      [node.netId]: { ...node, isSelected: !node.isSelected },
    }))
  }

  function handleToggleActive(netId: string) {
    const node = discountMap[netId]

    if (!node) {
      return
    }

    setPercent('')
    setSelectedNetId('')
    setDiscountMap((previous) => ({
      ...previous,
      [node.netId]: { ...node, isActive: !node.isActive },
    }))
  }

  function handleChangeActiveInSelected(isActive: boolean) {
    setDiscountMap((previous) =>
      Object.values(previous).reduce<DiscountMap>((accumulator, node) => {
        accumulator[node.netId] = { ...node, isActive: node.isSelected ? isActive : node.isActive }
        return accumulator
      }, {}),
    )
  }

  function handlePercentChange(value: string) {
    const normalized = value && value.match(/^(\d+|\d+[,.]|\d+[,.]\d+)$/) ? value.replace(',', '.') : ''
    setPercent(normalized)

    if (normalized === '') {
      return
    }

    const clamped = clampPercent(normalized)
    setDiscountMap((previous) =>
      Object.values(previous).reduce<DiscountMap>((accumulator, node) => {
        accumulator[node.netId] = node.isSelected ? { ...node, percent: clamped } : node
        return accumulator
      }, {}),
    )
  }

  function handleCancel() {
    setDiscountMap(buildDiscountMap(tree))
    setPercent('')
    setIsAllSelected(false)
    setSelectedNetId('')
  }

  function handleApply() {
    onApplyChanges(mapToDiscountArray(discountMap, tree))
  }

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    )
  }

  if (error) {
    return (
      <Alert color="red" variant="light">
        {error}
      </Alert>
    )
  }

  return (
    <Stack gap="sm">
      <Group align="center" gap="sm" wrap="nowrap">
        {canSelectAll && (
          <>
            <Checkbox checked={isAllSelected} disabled={disabled} onChange={handleSelectAll} />
            <Tooltip label={selectedLabel}>
              <Text
                fw={600}
                lineClamp={1}
                style={{ cursor: disabled ? 'default' : 'pointer', flex: 1 }}
                onClick={() => {
                  if (!disabled) {
                    handleSelectAll()
                  }
                }}
              >
                {selectedLabel}
              </Text>
            </Tooltip>
            {isAnySelected && (
              <Group gap="xs" wrap="nowrap">
                <Button color="red" disabled={disabled} size="xs" variant="light" onClick={() => handleChangeActiveInSelected(false)}>
                  {t('Деактивувати')}
                </Button>
                <Button color="violet" disabled={disabled} size="xs" variant="light" onClick={() => handleChangeActiveInSelected(true)}>
                  {t('Активувати')}
                </Button>
              </Group>
            )}
          </>
        )}
        {canEditPercent && (
          <TextInput
            disabled={disabled}
            placeholder={t('Введіть знижку')}
            style={{ width: 120 }}
            value={percent}
            onChange={(event) => handlePercentChange(event.currentTarget.value)}
          />
        )}
      </Group>

      <Text c="dimmed" lineClamp={1} size="sm" title={selectedAgreementName}>
        {selectedAgreementName}
      </Text>

      {isDirty && (
        <Group align="center" gap="sm" justify="space-between">
          <Text size="sm">{t('Застосувати зміни')}</Text>
          <Group gap="xs">
            <Button color="red" disabled={disabled} size="xs" variant="light" onClick={handleCancel}>
              {t('Скасувати')}
            </Button>
            <Button color="violet" disabled={disabled} size="xs" onClick={handleApply}>
              {t('Застосувати')}
            </Button>
          </Group>
        </Group>
      )}

      {rootNodes.length === 0 ? (
        <Text c="dimmed" py="md" size="sm" ta="center">
          {t('Груп товарів немає')}
        </Text>
      ) : (
        <Stack gap={4}>
          {rootNodes.map((node) => (
            <Box key={node.netId}>
              <GroupRow
                canCheck={canCheckRow}
                disabled={disabled}
                node={node}
                onCheck={handleCheckNode}
                onSelect={handleSelectNode}
                onToggleActive={handleToggleActive}
                t={t}
              />
              {node.hasSubGroups &&
                nodes
                  .filter((sub) => sub.parentNetId === node.netId)
                  .map((sub) => (
                    <Box key={sub.netId} pl="lg">
                      <GroupRow
                        canCheck={canCheckRow}
                        disabled={disabled}
                        node={sub}
                        onCheck={handleCheckNode}
                        onSelect={handleSelectNode}
                        onToggleActive={handleToggleActive}
                        t={t}
                      />
                    </Box>
                  ))}
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  )
}

type GroupRowProps = {
  node: DiscountNode
  disabled: boolean
  canCheck: boolean
  t: ReturnType<typeof useI18n>['t']
  onSelect: (netId: string) => void
  onCheck: (netId: string) => void
  onToggleActive: (netId: string) => void
}

function GroupRow({ node, disabled, canCheck, t, onSelect, onCheck, onToggleActive }: GroupRowProps) {
  return (
    <Group
      align="center"
      gap="sm"
      px="xs"
      py={6}
      style={{
        borderRadius: 6,
        backgroundColor: node.isSelected ? 'var(--mantine-color-violet-light)' : undefined,
      }}
      wrap="nowrap"
    >
      <Text
        lineClamp={1}
        style={{ cursor: disabled ? 'default' : 'pointer', flex: 1 }}
        onClick={() => {
          if (!disabled) {
            onSelect(node.netId)
          }
        }}
      >
        {node.name}
      </Text>
      {canCheck && (
        <Checkbox checked={node.isSelected} disabled={disabled} onChange={() => onCheck(node.netId)} />
      )}
      <Tooltip label={`${node.isActive ? t('Активна знижка') : t('Неактивна знижка')} ${node.percent}%`}>
        <Text
          c={node.isActive ? 'violet' : 'dimmed'}
          fw={node.isActive ? 600 : 400}
          style={{ cursor: disabled ? 'default' : 'pointer', minWidth: 56, textAlign: 'right' }}
          onClick={() => {
            if (!disabled) {
              onToggleActive(node.netId)
            }
          }}
        >
          {node.percent} %
        </Text>
      </Tooltip>
    </Group>
  )
}
