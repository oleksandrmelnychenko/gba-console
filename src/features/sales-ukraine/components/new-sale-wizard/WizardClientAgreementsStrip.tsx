import { Box, Group, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { ClientAgreement } from '../../../clients/types'
import {
  getWizardAgreementKey,
  getWizardAgreementMaxDaysOwed,
  getWizardAgreementOverdueDebtTotal,
} from './wizardClientStepModel'

const agreementAmountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

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
  const overdueDays = Math.max(daysOwed - overdueLimitDays, 0)
  const isInactive = agreement?.IsActive === false
  const statusLabel = isOverdue ? t('Прострочено') : isInactive ? t('Неактивний') : t('Активний')

  return (
    <UnstyledButton
      className={[
        'new-sale-agreement-card',
        isSelected ? 'is-selected' : '',
        isOverdue ? 'is-overdue' : '',
        isInactive ? 'is-inactive' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onSelect(clientAgreement)}
    >
      <span className="new-sale-agreement-card__status">{statusLabel}</span>
      <Box className="new-sale-agreement-card__content">
        <Box className="new-sale-agreement-card__head">
          <Box className="new-sale-agreement-card__identity">
            <Group className="new-sale-agreement-card__title-row" gap={8} wrap="nowrap">
              <Text className="new-sale-agreement-card__name" title={agreementName} truncate>
                {agreementName}
              </Text>
              {currencyCode && <span className="new-sale-agreement-card__currency">{currencyCode}</span>}
            </Group>
            <Text className="new-sale-agreement-card__organization" title={organizationName} truncate>
              {organizationName || t('Організація не вказана')}
            </Text>
          </Box>

        </Box>

        {clientAgreement.OriginalClientName && (
          <Tooltip label={clientAgreement.OriginalClientName} multiline maw={320} position="top">
            <Text className="new-sale-agreement-card__origin" truncate>
              {clientAgreement.OriginalClientName}
            </Text>
          </Tooltip>
        )}

        <Box className="new-sale-agreement-card__limits">
          <Box className={`new-sale-agreement-card__metric ${totalAgreementDebt > 0 || amountLimitExceeded ? 'is-danger' : ''}`}>
            <span>{t('Борг')}</span>
            <strong>{formatAgreementAmount(totalAgreementDebt)}</strong>
          </Box>
          <Box className={`new-sale-agreement-card__metric ${amountLimitExceeded ? 'is-danger' : ''}`}>
            <span>{t('Баланс')}</span>
            <strong>{formatAgreementAmount(accountBalance)}</strong>
          </Box>
          <Box className={`new-sale-agreement-card__metric ${daysLimitExceeded ? 'is-danger' : ''}`}>
            <span>{t('Дні')}</span>
            <strong>
              {overdueDays} / {overdueLimitDays}
            </strong>
          </Box>
        </Box>
      </Box>
    </UnstyledButton>
  )
}

function formatAgreementAmount(value: number): string {
  return agreementAmountFormatter.format(Math.round(value * 100) / 100)
}
