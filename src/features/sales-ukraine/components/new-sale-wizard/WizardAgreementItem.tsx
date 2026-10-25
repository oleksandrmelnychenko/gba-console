import { DocumentaryDebtNotice } from '../../../../shared/debt/DocumentaryDebtNotice'
import { Box, Group, Text, Tooltip } from '@mantine/core'
import { TableChip } from '../../../../shared/ui/TableChip'
import { CircleHelp } from 'lucide-react'
import type { ClientAgreement } from '../../../clients/types'
import { getWizardAgreementDebtPresentation } from './wizardClientStepModel'

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

  const debt = getWizardAgreementDebtPresentation(clientAgreement)
  const amountLimitExceeded = debt.creditLimit !== null && (debt.outstandingDebt ?? 0) > debt.creditLimit
  const hasDebtAlert = debt.isOverdue || amountLimitExceeded
  const isInactive = agreement.IsActive === false
  const organizationName = agreement.Organization?.Name || ''
  const agreementName = agreement.Name || clientAgreement.AgreementName || ''
  const currencyCode = agreement.Currency?.Code || ''
  const statusLabel = debt.isOverdue
    ? 'Прострочено'
    : amountLimitExceeded
      ? 'Перевищено ліміт'
      : debt.documentary && !debt.documentary.complete
        ? debt.overdueDays === null ? 'Прострочення не визначено' : 'Прострочення визначено частково'
      : isInactive
        ? 'Неактивний'
        : 'Активний'

  return (
    <Box
      aria-pressed={onSelect ? selected : undefined}
      className={[
        'new-sale-hero-agreement',
        selected ? 'is-active' : '',
        hasDebtAlert ? 'is-overdue' : '',
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
            <TableChip tone="product" value={organizationName || 'Організація не вказана'} />
            <Group gap={7} wrap="nowrap">
              <Text className="new-sale-hero-agreement__name" title={agreementName} truncate>
                {agreementName}
              </Text>
              {currencyCode && <TableChip tone="source" value={currencyCode} />}
            </Group>
          </Box>

          <span className="new-sale-hero-agreement__status">
            {statusLabel}
          </span>
        </Box>

        <Box className="new-sale-hero-agreement__metrics">
          <AgreementOptionMetric label="Доступний аванс" value={formatAgreementAmount(debt.availableAdvance)} />
          <AgreementOptionMetric
            danger={(debt.outstandingDebt ?? 0) > 0}
            label="Непогашений борг"
            value={formatAgreementAmount(debt.outstandingDebt)}
          />
          <AgreementOptionMetric
            danger={(debt.overdueDays ?? 0) > 0}
            label={debt.documentary ? "Макс. відомий вік боргу" : "Вік боргу"}
            value={formatAgreementDays(debt.debtAgeDays)}
          />
          <AgreementOptionMetric
            danger={(debt.overdueDays ?? 0) > 0}
            label={debt.documentary ? "Макс. відоме прострочення" : "Днів прострочення"}
            value={formatAgreementDays(debt.overdueDays)}
          />
          {debt.documentary && (
            <AgreementOptionMetric label="Кредитовий залишок" value={formatAgreementAmount(debt.documentary.creditBalance)} />
          )}
          <AgreementOptionMetric
            danger={amountLimitExceeded}
            label="Кредитний ліміт"
            value={debt.creditLimit === null ? 'Ліміт не налаштовано' : formatAgreementAmount(debt.creditLimit)}
          />
        </Box>

        {debt.documentary && <DocumentaryDebtNotice presentation={debt.documentary} asOf={debt.documentary.asOf} />}
        {clientAgreement.OriginalClientName && (
          <Tooltip label={clientAgreement.OriginalClientName} multiline maw={320} position="top">
            <Group className="new-sale-hero-agreement__origin" gap={4} wrap="nowrap">
              <CircleHelp size={12} />
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

function formatAgreementAmount(value: number | null): string {
  if (value === null) return 'Не визначено'
  return agreementAmountFormatter.format(Math.round(value * 100) / 100)
}

function formatAgreementDays(value: number | null): string {
  if (value === null) return 'Не визначено'
  return `${value} дн.`
}
