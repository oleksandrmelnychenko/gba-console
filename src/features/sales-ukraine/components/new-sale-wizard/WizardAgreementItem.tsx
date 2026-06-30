import { Box, Group, Text, Tooltip } from '@mantine/core'
import { IconHelpCircle } from '@tabler/icons-react'
import type { ClientAgreement } from '../../../clients/types'
import { getWizardClientDebtDays, getWizardClientDebtTotal } from './wizardClientStepModel'

const agreementAmountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

export function WizardAgreementItem({
  clientAgreement,
  selected = false,
  onSelect,
}: {
  clientAgreement: ClientAgreement
  selected?: boolean
  onSelect?: () => void
}) {
  const agreement = clientAgreement.Agreement

  if (!agreement) {
    return null
  }

  const debts = agreement.ClientInDebts ?? []
  const overdueLimitDays = agreement.NumberDaysDebt ?? 0
  const overdueTotal =
    Math.round(
      debts
        .filter((item) => getWizardClientDebtDays(item) - overdueLimitDays > 0)
        .reduce((sum, item) => sum + getWizardClientDebtTotal(item), 0) * 100,
    ) / 100
  const daysOwed = debts.reduce((max, item) => Math.max(max, getWizardClientDebtDays(item)), 0)
  const accountBalance = clientAgreement.AccountBalance ?? 0
  const amountLimitExceeded = agreement.AmountDebt != null && Math.abs(accountBalance) > agreement.AmountDebt
  const daysLimitExceeded = daysOwed > overdueLimitDays
  const overdueDays = Math.max(0, daysOwed - overdueLimitDays)
  const isOverdue = overdueTotal > 0 || amountLimitExceeded || daysLimitExceeded
  const isInactive = agreement.IsActive === false
  const organizationName = agreement.Organization?.Name || ''
  const agreementName = agreement.Name || clientAgreement.AgreementName || ''
  const currencyCode = agreement.Currency?.Code || ''
  const statusLabel = isOverdue ? 'Прострочено' : isInactive ? 'Неактивний' : 'Активний'

  return (
    <Box
      aria-pressed={onSelect ? selected : undefined}
      className={[
        'new-sale-hero-agreement',
        selected ? 'is-active' : '',
        isOverdue ? 'is-overdue' : '',
        isInactive ? 'is-inactive' : '',
        onSelect ? 'is-clickable' : '',
      ].filter(Boolean).join(' ')}
      component={onSelect ? 'button' : 'div'}
      onClick={onSelect}
      type={onSelect ? 'button' : undefined}
    >
      <Box className="new-sale-hero-agreement__body">
        <Box className="new-sale-hero-agreement__top">
          <Box className="new-sale-hero-agreement__identity">
            <Text className="new-sale-hero-agreement__organization" title={organizationName}>
              {organizationName || 'Організація не вказана'}
            </Text>
            <Group gap={7} wrap="nowrap">
              <Text className="new-sale-hero-agreement__name" title={agreementName} truncate>
                {agreementName}
              </Text>
              {currencyCode && <span className="new-sale-hero-agreement__currency">{currencyCode}</span>}
            </Group>
          </Box>

          <span className="new-sale-hero-agreement__status">
            {statusLabel}
          </span>
        </Box>

        <Box className="new-sale-hero-agreement__metrics">
          <AgreementOptionMetric danger={overdueTotal > 0 || amountLimitExceeded} label="Борг" value={formatAgreementAmount(overdueTotal)} />
          <AgreementOptionMetric danger={amountLimitExceeded} label="Баланс" value={formatAgreementAmount(accountBalance)} />
          <AgreementOptionMetric danger={daysLimitExceeded} label="Дні" value={`${overdueDays} / ${overdueLimitDays}`} />
        </Box>

        {clientAgreement.OriginalClientName && (
          <Tooltip label={clientAgreement.OriginalClientName} multiline maw={320} position="top">
            <Group className="new-sale-hero-agreement__origin" gap={4} wrap="nowrap">
              <IconHelpCircle size={12} />
              <Text truncate>{clientAgreement.OriginalClientName}</Text>
            </Group>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}

function AgreementOptionMetric({ danger, label, value }: { danger?: boolean; label: string; value: string }) {
  return (
    <span className={`new-sale-hero-agreement__metric ${danger ? 'is-danger' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  )
}

function formatAgreementAmount(value: number): string {
  return agreementAmountFormatter.format(Math.round(value * 100) / 100)
}
