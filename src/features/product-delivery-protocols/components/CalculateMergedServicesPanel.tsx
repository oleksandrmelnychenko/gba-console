import { Button, Checkbox, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import type { CalculateMergedServiceInvoiceItem, MergedService, SupplyExtraChargeType } from '../detailTypes'

type CalculateSubmit = {
  extraChargeType: SupplyExtraChargeType
  isAuto: boolean
  items: CalculateMergedServiceInvoiceItem[]
}

export function CalculateMergedServicesPanel({
  opened,
  service,
  isSaving,
  onClose,
  onSubmit,
}: {
  isSaving: boolean
  onClose: () => void
  onSubmit: (payload: CalculateSubmit) => Promise<void>
  opened: boolean
  service: MergedService
}) {
  const { t } = useI18n()
  const currencyCode = service.SupplyOrganizationAgreement?.Currency?.Code || ''

  const initialItems = useMemo<CalculateMergedServiceInvoiceItem[]>(
    () =>
      (service.SupplyInvoiceMergedServices || []).map((entity) => ({
        accountingValue: entity.AccountingValue ? String(entity.AccountingValue) : '',
        entity,
        isSelected: Boolean(entity.IsCalculatedValue),
        number: entity.SupplyInvoice?.Number || '',
        value: entity.Value ? String(entity.Value) : '',
      })),
    [service],
  )

  const [items, setItems] = useValueState<CalculateMergedServiceInvoiceItem[]>(initialItems)
  const [isAuto, setIsAuto] = useValueState(Boolean(service.IsAutoCalculatedValue))
  const [extraChargeType, setExtraChargeType] = useValueState<SupplyExtraChargeType>(service.SupplyExtraChargeType ?? 0)
  const [prevOpened, setPrevOpened] = useValueState(opened)

  if (opened !== prevOpened) {
    setPrevOpened(opened)

    if (opened) {
      setItems(initialItems)
      setIsAuto(Boolean(service.IsAutoCalculatedValue))
      setExtraChargeType(service.SupplyExtraChargeType ?? 0)
    }
  }

  const typeOptions = [
    { label: t('Розраховано по ціні'), value: '0' },
    { label: t('Розраховано по вазі'), value: '1' },
    { label: t("Розраховано по об'єму"), value: '2' },
  ]

  function updateItem(index: number, patch: Partial<CalculateMergedServiceInvoiceItem>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  async function handleSubmit() {
    await onSubmit({ extraChargeType, isAuto, items: items.filter((item) => item.isSelected) })
  }

  return (
    <AppDrawer opened={opened} size="md" title={t('Розрахувати')} onClose={onClose}>
      <Stack gap="md">
        <Group gap="lg">
          <Checkbox checked={isAuto} label={t('Розрахувати автоматично')} onChange={() => setIsAuto(true)} />
          <Checkbox checked={!isAuto} label={t('Розрахувати вручну')} onChange={() => setIsAuto(false)} />
        </Group>

        {isAuto && (
          <Select
            data={typeOptions}
            label={t('Тип')}
            value={String(extraChargeType)}
            onChange={(value) => setExtraChargeType((Number(value) || 0) as SupplyExtraChargeType)}
          />
        )}

        <Stack gap="sm">
          {items.map((item, index) => (
            <Stack key={item.entity.NetUid || index} gap={4}>
              <Text size="sm" fw={600}>
                № {item.number} - {t('Постачальник')}: {item.entity.SupplyInvoice?.SupplyOrder?.Client?.FullName || '-'}
              </Text>
              <Group align="flex-end" gap="sm" wrap="nowrap">
                {!isAuto && (
                  <Checkbox
                    checked={item.isSelected}
                    onChange={() => updateItem(index, { isSelected: !item.isSelected })}
                  />
                )}
                <TextInput
                  disabled={!item.isSelected || isAuto}
                  label={t('Вартість')}
                  type="number"
                  value={item.value}
                  onChange={(event) => updateItem(index, { value: event.currentTarget.value })}
                />
                <TextInput
                  disabled={!item.isSelected || isAuto}
                  label={`${t('Вартість')} (${t('Бух.')})`}
                  type="number"
                  value={item.accountingValue}
                  onChange={(event) => updateItem(index, { accountingValue: event.currentTarget.value })}
                />
              </Group>
            </Stack>
          ))}
        </Stack>

        <Text c="dimmed" size="xs">
          {currencyCode}
        </Text>

        <Group justify="flex-end">
          <Button color="violet" loading={isSaving} onClick={handleSubmit}>
            {t('Розрахувати')}
          </Button>
        </Group>
      </Stack>
    </AppDrawer>
  )
}
