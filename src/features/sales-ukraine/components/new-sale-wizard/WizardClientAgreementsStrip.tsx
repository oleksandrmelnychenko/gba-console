import { Box, Group, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { IconAlertTriangle, IconCircleCheck, IconHelpCircle } from '@tabler/icons-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { ClientAgreement } from '../../../clients/types'
import {
  getWizardAgreementKey,
  getWizardAgreementMaxDaysOwed,
  getWizardAgreementOverdueDebtTotal,
} from './wizardClientStepModel'

export function WizardClientAgreementsStrip({
  agreements,
  selectedKey,
  onSelect,
}: {
  agreements: ClientAgreement[]
  selectedKey: string
  onSelect: (agreement: ClientAgreement) => void
}) {
  return (
    <Box className="new-sale-agreements-strip">
      {agreements.map((clientAgreement, index) => (
        <WizardAgreementCard
          key={getWizardAgreementKey(clientAgreement) || index}
          clientAgreement={clientAgreement}
          isSelected={Boolean(selectedKey) && getWizardAgreementKey(clientAgreement) === selectedKey}
          onSelect={onSelect}
        />
      ))}
    </Box>
  )
}

function WizardAgreementCard({
  clientAgreement,
  isSelected,
  onSelect,
}: {
  clientAgreement: ClientAgreement
  isSelected: boolean
  onSelect: (agreement: ClientAgreement) => void
}) {
  const { t } = useI18n()
  const agreement = clientAgreement.Agreement
  const accountBalance = clientAgreement.AccountBalance ?? 0
  const overdueLimitDays = agreement?.NumberDaysDebt ?? 0
  const totalAgreementDebt = getWizardAgreementOverdueDebtTotal(agreement)
  const daysOwed = getWizardAgreementMaxDaysOwed(agreement)
  const amountLimitExceeded = agreement?.AmountDebt != null && Math.abs(accountBalance) > agreement.AmountDebt
  const daysLimitExceeded = daysOwed > overdueLimitDays
  const isOverdue = totalAgreementDebt > 0 || amountLimitExceeded || daysLimitExceeded
  const agreementName = agreement?.Name || clientAgreement.AgreementName || ''
  const organizationName = agreement?.Organization?.Name || ''
  const currencyCode = agreement?.Currency?.Code || ''

  return (
    <UnstyledButton
      className={[
        'new-sale-agreement-card',
        isSelected ? 'is-selected' : '',
        isOverdue ? 'is-overdue' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onSelect(clientAgreement)}
    >
      <Box className="new-sale-agreement-card__rail" />
      <Box className="new-sale-agreement-card__content">
        <Box className="new-sale-agreement-card__top">
          <Text className="new-sale-agreement-card__organization" title={organizationName} truncate>
            {organizationName || t('Організація не вказана')}
          </Text>
          <Box className="new-sale-agreement-card__status">
            {isOverdue ? <IconAlertTriangle size={14} /> : <IconCircleCheck size={14} />}
          </Box>
        </Box>

        <Group gap={8} wrap="nowrap">
          <Text className="new-sale-agreement-card__name" title={agreementName} truncate>
            {agreementName}
          </Text>
          {currencyCode && <span className="new-sale-agreement-card__currency">{currencyCode}</span>}
        </Group>

        {clientAgreement.OriginalClientName && (
          <Tooltip label={clientAgreement.OriginalClientName} multiline maw={320} position="top">
            <Group className="new-sale-agreement-card__origin" gap={4} wrap="nowrap">
              <IconHelpCircle size={12} />
              <Text truncate>{clientAgreement.OriginalClientName}</Text>
            </Group>
          </Tooltip>
        )}

        <Group className="new-sale-agreement-card__limits" gap={8} wrap="nowrap">
          {agreement?.IsControlAmountDebt && (
            <span className={totalAgreementDebt > 0 || amountLimitExceeded ? 'is-danger' : ''}>
              {totalAgreementDebt}/{accountBalance}
            </span>
          )}
          {agreement?.IsControlNumberDaysDebt && (
            <span className={daysLimitExceeded ? 'is-danger' : ''}>
              {daysOwed > overdueLimitDays ? daysOwed - overdueLimitDays : 0}/{overdueLimitDays}
            </span>
          )}
          {(agreement?.IsControlAmountDebt || agreement?.IsControlNumberDaysDebt) && (
            <span className={isOverdue ? 'is-danger' : ''}>{t('прострочено')}</span>
          )}
        </Group>
      </Box>
    </UnstyledButton>
  )
}
