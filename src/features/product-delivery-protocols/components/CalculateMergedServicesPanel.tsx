import { Alert, Button, Checkbox, Group, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core'
import { useMemo } from 'react'
import { Calculator } from 'lucide-react'
import { TableChip } from '../../../shared/ui/TableChip'
import '../../../shared/ui/selection-surface.css'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import type {
  CalculateMergedServiceInvoiceItem,
  MergedService,
  SupplyExtraChargeType,
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
  onSubmit: (payload: CalculateSubmit) => Promise<MergedService | null>
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
    () => toCalculationItems(service),
    [service],
  )

  const [items, setItems] = useValueState<CalculateMergedServiceInvoiceItem[]>(initialItems)
  const [isAuto, setIsAuto] = useValueState(Boolean(service.IsAutoCalculatedValue))
  const [extraChargeType, setExtraChargeType] = useValueState<SupplyExtraChargeType>(service.SupplyExtraChargeType ?? 0)
  const [error, setError] = useValueState<string | null>(null)

  const typeOptions = [
    { label: t('За вартістю'), value: '0' },
    { label: t('За вагою'), value: '1' },
    { label: t("За об'ємом"), value: '2' },
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
    const updatedService = await onSubmit({ extraChargeType, isAuto, items: selectedItems })

    if (!updatedService) {
      return
    }

    setItems(toCalculationItems(updatedService))
    setIsAuto(Boolean(updatedService.IsAutoCalculatedValue))
    setExtraChargeType(updatedService.SupplyExtraChargeType ?? extraChargeType)
  }

  return (
    <AppModal
      centered
      closeOnClickOutside={!isSaving}
      opened={opened}
      size="min(980px, calc(100vw - 32px))"
      className="calculate-merged-services-dialog"
      title={t('Розрахувати')}
      onClose={() => {
        if (!isSaving) {
          onClose()
        }
      }}
    >
      <Stack className="app-compact-form calculate-merged-services-modal" gap={12}>
          <dl aria-label={t('Інформація про витрати')} className="calculate-merged-services-summary">
            <div className="calculate-merged-services-summary-item is-supplier">
              <dt>{t('Постачальник послуг')}</dt>
              <dd title={service.SupplyOrganization?.Name || undefined}>
                <TableChip tone="document" value={service.SupplyOrganization?.Name || '-'} />
              </dd>
            </div>
            <div className="calculate-merged-services-summary-item">
              <dt>{t('Сума витрат')}</dt>
              <dd>{formatExpenseAmount(service.GrossPrice)}</dd>
            </div>
            <div className="calculate-merged-services-summary-item">
              <dt>{`${t('Сума витрат')} (${t('Бух.')})`}</dt>
              <dd>{formatExpenseAmount(service.AccountingGrossPrice)}</dd>
            </div>
            <div className="calculate-merged-services-summary-item is-currency">
              <dt>{t('Валюта витрат')}</dt>
              <dd><TableChip tone="source" value={currencyCode || '-'} /></dd>
            </div>
          </dl>
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
                label={t('Розподіл витрат')}
                value={String(extraChargeType)}
                onChange={(value) => setExtraChargeType((Number(value) || 0) as SupplyExtraChargeType)}
              />
            )}

          </div>
        </section>

        <Stack className="calculate-merged-services-list" gap="xs">
          {items.map((item, index) => (
            <div
              key={item.entity.NetUid || index}
              className="calculate-service-invoice-card app-selection-surface"
              data-selected={item.isSelected || isAuto}
            >
              <span className="app-selection-surface__marker" aria-hidden="true" />
              <Group align="center" className="calculate-service-invoice-head" gap={8} wrap="wrap">
                <TableChip tone="document" value={`№ ${item.number || '-'}`} />
                <TableChip tone="document" value={item.entity.SupplyInvoice?.SupplyOrder?.Client?.FullName || '-'} />
              </Group>

              <div className="calculate-service-invoice-meta">
                <Text component="span">{t('Курс')}</Text>
                <span className="calculate-service-invoice-rates">
                  {Boolean(item.entity.SupplyInvoice?.ExchangeRate) && (currencyCode !== 'EUR' || item.entity.SupplyInvoice?.ExchangeRate !== item.entity.SupplyInvoice?.ExchangeRateEurToUah) && <span>{item.entity.SupplyInvoice?.ExchangeRate} <TableChip tone="source" value={currencyCode || '-'} /></span>}
                  <span>{item.entity.SupplyInvoice?.ExchangeRateEurToUah || 0} <TableChip tone="source" value="EUR" /></span>
                </span>
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
                  disabled={isSaving || (!isAuto && !item.isSelected)}
                  readOnly={isAuto}
                  label={t('Вартість')}
                  type="number"
                  value={item.value}
                  onChange={(event) => updateItem(index, { value: event.currentTarget.value })}
                />
                <TextInput
                  className="calculate-service-invoice-control is-number"
                  disabled={isSaving || (!isAuto && !item.isSelected)}
                  readOnly={isAuto}
                  label={`${t('Вартість')} (${t('Бух.')})`}
                  type="number"
                  value={item.accountingValue}
                  onChange={(event) => updateItem(index, { accountingValue: event.currentTarget.value })}
                />
              </div>
            </div>
          ))}
        </Stack>

        <AppModalFooter className="calculate-merged-services-footer">
          <Button disabled={isSaving} variant="default" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button leftSection={<Calculator size={16} />} color={CREATE_ACTION_COLOR} disabled={isSaving} loading={isSaving} onClick={handleSubmit}>
            {t('Розрахувати')}
          </Button>
        </AppModalFooter>
      </Stack>
    </AppModal>
  )
}

function getMergedServicePanelKey(service: MergedService): string {
  return String(service.NetUid || service.Id || 'open')
}

function toCalculationItems(service: MergedService): CalculateMergedServiceInvoiceItem[] {
  return (service.SupplyInvoiceMergedServices || []).map((entity) => ({
    accountingValue: toInputValue(entity.AccountingValue),
    entity,
    isSelected: Boolean(entity.IsCalculatedValue),
    number: entity.SupplyInvoice?.Number || '',
    value: toInputValue(entity.Value),
  }))
}

function toInputValue(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function formatExpenseAmount(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  return value.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
