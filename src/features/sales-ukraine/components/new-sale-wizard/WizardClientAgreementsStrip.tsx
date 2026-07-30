import { Box, Group, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { ClientAgreement } from '../../../clients/types'
import {
  getWizardAgreementDebtPresentation,
  getWizardAgreementKey,
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
      {agreements.map((clientAgreement) => (
        <WizardAgreementCard
          key={getWizardAgreementKey(clientAgreement)}
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
  const debt = getWizardAgreementDebtPresentation(clientAgreement)
  const amountLimitExceeded = debt.creditLimit !== null && debt.outstandingDebt > debt.creditLimit
  const hasDebtAlert = debt.isOverdue || amountLimitExceeded
  const agreementName = agreement?.Name || clientAgreement.AgreementName || ''
  const organizationName = agreement?.Organization?.Name || ''
  const currencyCode = agreement?.Currency?.Code || ''
  const isInactive = agreement?.IsActive === false
  const statusLabel = debt.isOverdue
    ? t('Прострочено')
    : amountLimitExceeded
      ? t('Перевищено ліміт')
      : isInactive
        ? t('Неактивний')
        : t('Активний')

  return (
    <UnstyledButton
      className={[
        'new-sale-agreement-card',
        isSelected ? 'is-selected' : '',
        hasDebtAlert ? 'is-overdue' : '',
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
          <Box className="new-sale-agreement-card__metric">
            <span>{t('Доступний аванс')}</span>
            <strong>{formatAgreementAmount(debt.availableAdvance)}</strong>
          </Box>
          <Box className={`new-sale-agreement-card__metric ${debt.outstandingDebt > 0 ? 'is-danger' : ''}`}>
            <span>{t('Непогашений борг')}</span>
            <strong>{formatAgreementAmount(debt.outstandingDebt)}</strong>
          </Box>
          <Box className={`new-sale-agreement-card__metric ${debt.overdueDays > 0 ? 'is-danger' : ''}`}>
            <span>{t('Вік боргу')}</span>
            <strong>{formatAgreementDays(debt.debtAgeDays)}</strong>
          </Box>
          <Box className={`new-sale-agreement-card__metric ${debt.overdueDays > 0 ? 'is-danger' : ''}`}>
            <span>{t('Днів прострочення')}</span>
            <strong>{formatAgreementDays(debt.overdueDays)}</strong>
          </Box>
          <Box className={`new-sale-agreement-card__metric ${amountLimitExceeded ? 'is-danger' : ''}`}>
            <span>{t('Кредитний ліміт')}</span>
            <strong>
              {debt.creditLimit === null
                ? t('Ліміт не налаштовано')
                : formatAgreementAmount(debt.creditLimit)}
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

function formatAgreementDays(value: number): string {
  return `${value} дн.`
}
