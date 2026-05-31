import {
  ActionIcon,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { useAuth } from '../../../auth/useAuth'
import { UserRoleType } from '../../../../shared/auth/types'
import {
  CURRENCY_NAME_EURO,
  PRICING_NAME_BULK_TWO,
  PRICING_NAME_BULK_TWO_VAT,
  PRICING_NAME_PURCHASE,
} from './pricingNames'
import type { Agreement, Currency, Organization, Pricing, ProviderPricing } from '../../types'

export type AgreementFormProps = {
  agreement: Agreement
  isProvider: boolean
  isEdit: boolean
  organizations: Organization[]
  currencies: Currency[]
  pricings: Pricing[]
  promotionalPricings: Pricing[]
  isVatAccountingHidden: boolean
  errors?: { name?: string }
  onChange: (patch: Partial<Agreement>) => void
}

const NAME_MAX_LENGTH = 37

export function AgreementForm({
  agreement,
  isProvider,
  isEdit,
  organizations,
  currencies,
  pricings,
  promotionalPricings,
  isVatAccountingHidden,
  errors,
  onChange,
}: AgreementFormProps) {
  const { t } = useI18n()
  const { user } = useAuth()
  const roleType = user?.UserRole?.UserRoleType
  const isAdmin = roleType === UserRoleType.Administrator || roleType === UserRoleType.GBA

  const [providerPricingEditorOpened, setProviderPricingEditorOpened] = useState(false)
  const [providerPricingName, setProviderPricingName] = useState('')

  const visiblePricings = useMemo(
    () => (isProvider ? pricings : pricings.filter((pricing) => Boolean(pricing.ForVat) === Boolean(agreement.WithVATAccounting))),
    [isProvider, pricings, agreement.WithVATAccounting],
  )
  const organizationOptions = useMemo(() => toOptions(organizations), [organizations])
  const currencyOptions = useMemo(() => toOptions(currencies), [currencies])
  const pricingOptions = useMemo(() => toOptions(visiblePricings), [visiblePricings])
  const promotionalPricingOptions = useMemo(() => toOptions(promotionalPricings), [promotionalPricings])

  const providerPricing = agreement.ProviderPricing

  return (
    <Stack gap="md">
      <Switch
        checked={Boolean(agreement.IsActive)}
        label={t('Активний договір')}
        onChange={(event) => onChange({ IsActive: event.currentTarget.checked })}
      />

      {isEdit && (
        <TextInput disabled label={t('Номер договору')} value={agreement.Number || ''} />
      )}

      <Select
        data={organizationOptions}
        disabled={isEdit}
        label={t('Організація')}
        searchable
        value={agreement.Organization?.Id ? String(agreement.Organization.Id) : null}
        onChange={(value) => handleOrganizationChange(findById(organizations, value))}
      />

      <Select
        data={currencyOptions}
        label={t('Валюта')}
        searchable
        value={agreement.Currency?.Id ? String(agreement.Currency.Id) : null}
        onChange={(value) => onChange({ Currency: findById(currencies, value) })}
      />

      {isProvider ? (
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            {t('Тип ціни')}
          </Text>
          {providerPricing?.Name ? (
            <Group gap="xs" wrap="nowrap">
              <Card
                withBorder
                padding="xs"
                radius="md"
                style={{ flex: 1, cursor: 'pointer' }}
                onClick={openProviderPricingEditor}
              >
                <Text size="sm">{providerPricing.Name}</Text>
              </Card>
              <ActionIcon
                aria-label={t('Видалити')}
                color="red"
                variant="subtle"
                onClick={handleDeleteProviderPricing}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Group>
          ) : (
            <Button
              color="violet"
              leftSection={<IconPlus size={16} />}
              size="xs"
              variant="light"
              onClick={openProviderPricingEditor}
            >
              {t('Створіть тип цін')}
            </Button>
          )}

          {providerPricingEditorOpened && (
            <Card withBorder padding="sm" radius="md">
              <Stack gap="xs">
                <TextInput
                  label={t('Назва')}
                  value={providerPricingName}
                  onChange={(event) => setProviderPricingName(event.currentTarget.value)}
                />
                <Group gap={4}>
                  <Text c="dimmed" size="xs">
                    {t('Валюта')}:
                  </Text>
                  <Text size="xs">{CURRENCY_NAME_EURO}</Text>
                </Group>
                <Group gap={4}>
                  <Text c="dimmed" size="xs">
                    {t('Тип ціни')}:
                  </Text>
                  <Text size="xs">{PRICING_NAME_PURCHASE}</Text>
                </Group>
                <Group justify="flex-end" gap="xs">
                  <Button color="gray" size="xs" variant="subtle" onClick={cancelProviderPricingEditor}>
                    {t('Скасувати')}
                  </Button>
                  <Button
                    color="violet"
                    disabled={!providerPricingName.trim()}
                    size="xs"
                    onClick={handleSaveProviderPricing}
                  >
                    {providerPricing?.Name ? t('Оновити') : t('Створити')}
                  </Button>
                </Group>
              </Stack>
            </Card>
          )}
        </Stack>
      ) : (
        <Select
          data={pricingOptions}
          label={t('Тип ціни')}
          searchable
          value={agreement.Pricing?.Id ? String(agreement.Pricing.Id) : null}
          onChange={(value) => onChange({ Pricing: findById(pricings, value) })}
        />
      )}

      {!isProvider && (
        <Select
          clearable
          data={promotionalPricingOptions}
          label={t('Акційний тип ціни')}
          searchable
          value={agreement.PromotionalPricing?.Id ? String(agreement.PromotionalPricing.Id) : null}
          onChange={(value) => onChange({ PromotionalPricing: findById(promotionalPricings, value) })}
        />
      )}

      <TextInput
        error={errors?.name}
        label={t('Найменування')}
        maxLength={NAME_MAX_LENGTH}
        required
        value={agreement.Name || ''}
        onChange={(event) => onChange({ Name: event.currentTarget.value })}
      />

      {!isProvider && (
        <Group grow align="flex-start">
          <NumberInput
            allowNegative={false}
            label={t('Сума боргу')}
            value={agreement.AmountDebt ?? ''}
            onChange={(value) => onChange({ AmountDebt: toNumber(value) })}
          />
          <NumberInput
            allowNegative={false}
            label={t('Кількість днів боргу')}
            value={agreement.NumberDaysDebt ?? ''}
            onChange={(value) => onChange({ NumberDaysDebt: toNumber(value) })}
          />
        </Group>
      )}

      <Group grow align="flex-start">
        <TextInput
          label={t('Діє з')}
          type="date"
          value={toInputDate(agreement.FromDate)}
          onChange={(event) => onChange({ FromDate: event.currentTarget.value || undefined })}
        />
        <TextInput
          label={t('Діє по')}
          type="date"
          value={toInputDate(agreement.ToDate)}
          onChange={(event) => onChange({ ToDate: event.currentTarget.value || undefined })}
        />
      </Group>

      {isProvider ? (
        <Stack gap="md">
          <NumberInput
            allowNegative={false}
            label={`${t('Відстрочка платежу')} (${t('днів')})`}
            max={999}
            value={agreement.DeferredPayment ? Number(agreement.DeferredPayment) : ''}
            onChange={(value) => onChange({ DeferredPayment: value === '' ? '' : String(value) })}
          />

          <Stack gap="xs">
            <Text size="sm" fw={500}>
              {t('Умови оплати')}
            </Text>
            <SegmentedControl
              data={[
                { label: t('100%'), value: 'full' },
                { label: t('Часткова'), value: 'partial' },
              ]}
              value={agreement.IsPrePaymentFull === false ? 'partial' : 'full'}
              onChange={(value) => handlePrepaymentChange(value === 'full')}
            />
          </Stack>

          {agreement.IsPrePaymentFull === false && (
            <NumberInput
              allowNegative={false}
              label={t('Відсоток передоплати')}
              max={100}
              value={agreement.PrePaymentPercentages ?? ''}
              onChange={(value) => onChange({ PrePaymentPercentages: toNumber(value) })}
            />
          )}

          <Checkbox
            checked={Boolean(agreement.IsPayForDelivery)}
            label={t('Постачальник сплачує доставку')}
            onChange={(event) => onChange({ IsPayForDelivery: event.currentTarget.checked })}
          />
        </Stack>
      ) : (
        <Stack gap="xs">
          {isAdmin && (
            <Checkbox
              checked={Boolean(agreement.ForReSale)}
              label={t('Для перепродажу')}
              onChange={(event) => onChange({ ForReSale: event.currentTarget.checked })}
            />
          )}

          <Checkbox
            checked={Boolean(agreement.IsManagementAccounting)}
            label={t('Управлінський облік')}
            onChange={(event) => handleManagementAccountingChange(event.currentTarget.checked)}
          />

          <Checkbox
            checked={Boolean(agreement.IsAccounting)}
            label={t('Бухгалтерський облік')}
            onChange={(event) => handleAccountingChange(event.currentTarget.checked)}
          />

          {!isVatAccountingHidden && (
            <Checkbox
              checked={Boolean(agreement.WithVATAccounting)}
              disabled={!isAdmin}
              label={t('Облік з ПДВ')}
              onChange={(event) => onChange({ WithVATAccounting: event.currentTarget.checked, Pricing: undefined })}
            />
          )}

          <Checkbox
            checked={Boolean(agreement.WithAgreementLine)}
            label={t('Друкувати рядок договору')}
            onChange={(event) => onChange({ WithAgreementLine: event.currentTarget.checked })}
          />
        </Stack>
      )}
    </Stack>
  )

  function openProviderPricingEditor() {
    setProviderPricingName(providerPricing?.Name || '')
    setProviderPricingEditorOpened(true)
  }

  function cancelProviderPricingEditor() {
    setProviderPricingEditorOpened(false)
    setProviderPricingName('')
  }

  function handleSaveProviderPricing() {
    const name = providerPricingName.trim()

    if (!name) {
      return
    }

    const nextProviderPricing: ProviderPricing = {
      ...providerPricing,
      Name: name,
      Currency: findByName(currencies, CURRENCY_NAME_EURO),
      Pricing: findByName(pricings, PRICING_NAME_PURCHASE),
    }

    onChange({ ProviderPricing: nextProviderPricing })
    setProviderPricingEditorOpened(false)
    setProviderPricingName('')
  }

  function handleDeleteProviderPricing() {
    onChange({ ProviderPricing: undefined })
    setProviderPricingEditorOpened(false)
    setProviderPricingName('')
  }

  function handlePrepaymentChange(isFull: boolean) {
    onChange({
      IsPrePaymentFull: isFull,
    })
  }

  function handleOrganizationChange(organization?: Organization) {
    if (isProvider) {
      onChange({ Organization: organization })
      return
    }

    const hasVat = organizationHasVat(organization)

    if (hasVat) {
      onChange({
        Organization: organization,
        IsManagementAccounting: false,
        IsAccounting: true,
        WithVATAccounting: true,
        Pricing: findByName(pricings, PRICING_NAME_BULK_TWO_VAT),
        PromotionalPricing: findByName(promotionalPricings, PRICING_NAME_BULK_TWO_VAT),
      })
      return
    }

    onChange({
      Organization: organization,
      IsManagementAccounting: true,
      IsAccounting: false,
      WithVATAccounting: false,
      Pricing: findByName(pricings, PRICING_NAME_BULK_TWO),
      PromotionalPricing: findByName(promotionalPricings, PRICING_NAME_BULK_TWO),
    })
  }

  function handleManagementAccountingChange(checked: boolean) {
    if (checked) {
      onChange({
        IsManagementAccounting: true,
        IsAccounting: false,
        WithVATAccounting: false,
        Pricing: findByName(pricings, PRICING_NAME_BULK_TWO),
        PromotionalPricing: findByName(promotionalPricings, PRICING_NAME_BULK_TWO),
      })
      return
    }

    onChange({
      IsManagementAccounting: false,
      IsAccounting: true,
      WithVATAccounting: true,
      Pricing: findByName(pricings, PRICING_NAME_BULK_TWO_VAT),
      PromotionalPricing: findByName(promotionalPricings, PRICING_NAME_BULK_TWO_VAT),
    })
  }

  function handleAccountingChange(checked: boolean) {
    if (checked) {
      onChange({
        IsAccounting: true,
        IsManagementAccounting: false,
        WithVATAccounting: true,
        Pricing: findByName(pricings, PRICING_NAME_BULK_TWO_VAT),
        PromotionalPricing: findByName(promotionalPricings, PRICING_NAME_BULK_TWO_VAT),
      })
      return
    }

    onChange({
      IsAccounting: false,
      IsManagementAccounting: true,
      WithVATAccounting: false,
      Pricing: findByName(pricings, PRICING_NAME_BULK_TWO),
      PromotionalPricing: findByName(promotionalPricings, PRICING_NAME_BULK_TWO),
    })
  }
}

function organizationHasVat(organization?: Organization): boolean {
  if (!organization) {
    return false
  }

  if (organization.VatRate) {
    return Boolean(organization.VatRate.Value)
  }

  return Boolean(organization.VatRateId) || Boolean(organization.IsVatAgreements)
}

function toOptions(items: Array<{ Id?: number; Name?: string }>): Array<{ label: string; value: string }> {
  return items.reduce<Array<{ label: string; value: string }>>((options, item) => {
    if (typeof item.Id === 'number' && item.Id > 0) {
      options.push({
        label: item.Name || '',
        value: String(item.Id),
      })
    }

    return options
  }, [])
}

function findById<T extends { Id?: number }>(items: T[], value: string | null): T | undefined {
  if (!value) {
    return undefined
  }

  return items.find((item) => String(item.Id) === value)
}

function findByName<T extends { Name?: string }>(items: T[], name: string): T | undefined {
  return items.find((item) => item.Name === name)
}

function toNumber(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}

function toInputDate(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
