import { Alert, Badge, Button, Checkbox, Group, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core'
import { useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type {
  CalculateMergedServiceInvoiceItem,
  MergedService,
  SupplyExtraChargeType,
  SupplyInvoice,
} from '../detailTypes'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import './calculate-merged-services-panel.css'

type CalculateSubmit = {
  extraChargeType: SupplyExtraChargeType
  isAuto: boolean
  items: CalculateMergedServiceInvoiceItem[]
}

type CalculateMergedServicesPanelProps = {
  isSaving: boolean
  onClose: () => void
  onSubmit: (payload: CalculateSubmit) => Promise<void>
  opened: boolean
  service: MergedService
}

export function CalculateMergedServicesPanel(props: CalculateMergedServicesPanelProps) {
  return (
    <CalculateMergedServicesPanelContent
      key={props.opened ? getMergedServicePanelKey(props.service) : 'closed'}
      {...props}
    />
  )
}

function CalculateMergedServicesPanelContent({
  opened,
  service,
  isSaving,
  onClose,
  onSubmit,
}: CalculateMergedServicesPanelProps) {
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
  const [error, setError] = useValueState<string | null>(null)

  const typeOptions = [
    { label: t('Розраховано по ціні'), value: '0' },
    { label: t('Розраховано по вазі'), value: '1' },
    { label: t("Розраховано по об'єму"), value: '2' },
  ]
  const modeOptions = [
    { label: t('Розрахувати автоматично'), value: 'auto' },
    { label: t('Розрахувати вручну'), value: 'manual' },
  ]

  function updateItem(index: number, patch: Partial<CalculateMergedServiceInvoiceItem>) {
    if (isSaving) {
      return
    }

    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  async function handleSubmit() {
    if (isSaving) {
      return
    }

    const selectedItems = items.filter((item) => item.isSelected)

    if (!isAuto && selectedItems.some((item) => !item.value.trim() && !item.accountingValue.trim())) {
      setError(t('Для ручного розрахунку заповніть вартість або бух. вартість для кожного вибраного інвойсу'))

      return
    }

    setError(null)
    await onSubmit({ extraChargeType, isAuto, items: selectedItems })
  }

  return (
    <AppModal
      centered
      closeOnClickOutside={!isSaving}
      opened={opened}
      size="min(980px, calc(100vw - 32px))"
      title={<span className="calculate-merged-services-title">{t('Розрахувати')}</span>}
      onClose={() => {
        if (!isSaving) {
          onClose()
        }
      }}
    >
      <Stack className="calculate-merged-services-modal" gap={12}>
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <section className="calculate-merged-services-section">
          <Text className="app-section-title" fw={600} size="sm">
            {t('Налаштування')}
          </Text>
          <div className="calculate-merged-services-settings">
            <SegmentedControl
              className="calculate-merged-services-mode"
              data={modeOptions}
              disabled={isSaving}
              value={isAuto ? 'auto' : 'manual'}
              onChange={(value) => setIsAuto(value === 'auto')}
            />
            {isAuto && (
              <Select
                className="calculate-merged-services-control"
                data={typeOptions}
                disabled={isSaving}
                label={t('Тип')}
                value={String(extraChargeType)}
                onChange={(value) => setExtraChargeType((Number(value) || 0) as SupplyExtraChargeType)}
              />
            )}
            {currencyCode && (
              <div className="calculate-merged-services-currency">
                <Text component="span">{t('Валюта')}</Text>
                <Badge className="app-role-pill is-gray" size="sm" variant="light">
                  {currencyCode}
                </Badge>
              </div>
            )}
          </div>
        </section>

        <Stack className="calculate-merged-services-list" gap="xs">
          {items.map((item, index) => (
            <div
              key={item.entity.NetUid || index}
              className={`calculate-service-invoice-card${item.isSelected || isAuto ? ' is-selected' : ''}`}
            >
              <Group align="center" className="calculate-service-invoice-head" gap={8} wrap="nowrap">
                <Badge className="app-role-pill is-yellow calculate-service-invoice-number" size="sm" variant="light">
                  № {item.number || '-'}
                </Badge>
                <Text
                  className="calculate-service-invoice-supplier"
                  title={item.entity.SupplyInvoice?.SupplyOrder?.Client?.FullName || '-'}
                >
                  {item.entity.SupplyInvoice?.SupplyOrder?.Client?.FullName || '-'}
                </Text>
              </Group>

              <div className="calculate-service-invoice-meta">
                <Text component="span">{t('Курс')}</Text>
                <strong>{formatInvoiceRate(item.entity.SupplyInvoice, currencyCode)}</strong>
              </div>

              <div className="calculate-service-invoice-fields">
                {!isAuto && (
                  <Checkbox
                    checked={item.isSelected}
                    className="calculate-service-invoice-check"
                    disabled={isSaving}
                    label={t('Вибрати')}
                    onChange={() => updateItem(index, { isSelected: !item.isSelected })}
                  />
                )}
                <TextInput
                  className="calculate-service-invoice-control is-number"
                  disabled={isSaving || !item.isSelected || isAuto}
                  label={t('Вартість')}
                  type="number"
                  value={item.value}
                  onChange={(event) => updateItem(index, { value: event.currentTarget.value })}
                />
                <TextInput
                  className="calculate-service-invoice-control is-number"
                  disabled={isSaving || !item.isSelected || isAuto}
                  label={`${t('Вартість')} (${t('Бух.')})`}
                  type="number"
                  value={item.accountingValue}
                  onChange={(event) => updateItem(index, { accountingValue: event.currentTarget.value })}
                />
              </div>
            </div>
          ))}
        </Stack>

        <Group className="calculate-merged-services-footer" justify="flex-end" gap={8}>
          <Button disabled={isSaving} variant="default" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color={CREATE_ACTION_COLOR} disabled={isSaving} loading={isSaving} onClick={handleSubmit}>
            {t('Розрахувати')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function getMergedServicePanelKey(service: MergedService): string {
  return String(service.NetUid || service.Id || 'open')
}

function formatInvoiceRate(invoice: SupplyInvoice | null | undefined, currencyCode: string): string {
  const exchangeRate = invoice?.ExchangeRate || 0
  const exchangeRateEurToUah = invoice?.ExchangeRateEurToUah || 0

  if (exchangeRate !== 0) {
    return `${exchangeRate} ${currencyCode}; ${exchangeRateEurToUah} EUR`
  }

  return `${exchangeRateEurToUah} EUR`
}
