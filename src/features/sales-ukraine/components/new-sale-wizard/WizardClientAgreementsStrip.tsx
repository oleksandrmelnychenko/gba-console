import { Box, Group, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { memo, useLayoutEffect, useRef } from 'react'
import { TableChip } from '../../../../shared/ui/TableChip'
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

export const WizardClientAgreementsStrip = memo(function WizardClientAgreementsStrip({
  agreements,
  isLoading = false,
  selectedKey,
  onSelect,
}: {
  agreements: ClientAgreement[]
  isLoading?: boolean
  selectedKey: string
  onSelect: (agreement: ClientAgreement) => void
}) {
  const { t } = useI18n()
  const stripRef = useRef<HTMLDivElement>(null)
  // Keep the previous cards' height through the debounce and network request.
  useLayoutEffect(() => {
    const strip = stripRef.current
    if (!strip || isLoading) return
    const measure = () => {
      const card = strip.querySelector('.new-sale-agreement-card')
      if (card) strip.style.setProperty('--agreement-loading-height', `${card.getBoundingClientRect().height}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(strip)
    return () => observer.disconnect()
  }, [isLoading, agreements])

  return (
    <Box className="new-sale-agreements-strip" ref={stripRef} aria-busy={isLoading}>
      {isLoading ? (
        <Box className="new-sale-agreement-card new-sale-agreement-skeleton" role="status" aria-label={t('Завантаження договорів')}>
          <div className="new-sale-agreement-card__content" aria-hidden="true">
            <div className="new-sale-agreement-shimmer is-title" />
            <div className="new-sale-agreement-shimmer is-chip" />
            <div className="new-sale-agreement-card__limits">
              {Array.from({ length: 5 }, (_, index) => <div key={index} className="new-sale-agreement-shimmer is-metric" />)}
            </div>
          </div>
        </Box>
      ) : agreements.length === 0 ? (
        <Text className="new-sale-agreements-empty">{t('Договорів не знайдено')}</Text>
      ) : agreements.map((clientAgreement) => (
        <WizardAgreementCard
          key={getWizardAgreementKey(clientAgreement)}
          clientAgreement={clientAgreement}
          isSelected={Boolean(selectedKey) && getWizardAgreementKey(clientAgreement) === selectedKey}
          onSelect={onSelect}
        />
      ))}
    </Box>
  )
})

const WizardAgreementCard = memo(function WizardAgreementCard({
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
        'new-sale-agreement-card app-selection-surface',
        isSelected ? 'is-selected' : '',
        hasDebtAlert ? 'is-overdue' : '',
        isInactive ? 'is-inactive' : '',
      ].filter(Boolean).join(' ')}
      data-selected={isSelected || undefined}
      aria-pressed={isSelected}
      onClick={() => onSelect(clientAgreement)}
    >
      <span className="app-selection-surface__marker" aria-hidden="true" />
      <Box className="new-sale-agreement-card__content">
        <Box className="new-sale-agreement-card__head">
          <Box className="new-sale-agreement-card__identity">
            <Group className="new-sale-agreement-card__title-row" gap={8} wrap="nowrap">
              <Text className="new-sale-agreement-card__name" title={agreementName} truncate>
                {agreementName}
              </Text>
              <TableChip tone={hasDebtAlert ? "danger" : isInactive ? "neutral" : "success"} value={statusLabel} />
            </Group>
            <Group gap={6} wrap="nowrap" className="new-sale-agreement-card__chips">
              <TableChip tone="product" value={organizationName || t('Організація не вказана')} />
              <TableChip tone="source" value={currencyCode} />
            </Group>
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
            <strong title={debt.creditLimit === null ? t('Ліміт не налаштовано') : undefined}>
              {debt.creditLimit === null
                ? t('Ліміт не налаштовано')
                : formatAgreementAmount(debt.creditLimit)}
            </strong>
          </Box>
        </Box>
      </Box>
    </UnstyledButton>
  )
})

function formatAgreementAmount(value: number): string {
  return agreementAmountFormatter.format(Math.round(value * 100) / 100)
}

function formatAgreementDays(value: number): string {
  return `${value} дн.`
}
