import { Box, Group, Paper, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { IconHelpCircle } from '@tabler/icons-react'
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
    <Group
      align="stretch"
      gap="xs"
      style={{ flexWrap: 'nowrap', minHeight: 84, overflowX: 'auto', paddingBottom: 4 }}
    >
      {agreements.map((clientAgreement, index) => (
        <WizardAgreementCard
          key={getWizardAgreementKey(clientAgreement) || index}
          clientAgreement={clientAgreement}
          isSelected={Boolean(selectedKey) && getWizardAgreementKey(clientAgreement) === selectedKey}
          onSelect={onSelect}
        />
      ))}
    </Group>
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
  const isOverdue =
    totalAgreementDebt > 0 ||
    (agreement?.AmountDebt != null && Math.abs(accountBalance) > agreement.AmountDebt) ||
    daysOwed > overdueLimitDays

  return (
    <UnstyledButton style={{ flexShrink: 0 }} onClick={() => onSelect(clientAgreement)}>
      <Paper
        h="100%"
        miw={230}
        px="sm"
        py={6}
        radius="md"
        style={{
          borderColor: isSelected
            ? 'var(--mantine-color-violet-5)'
            : isOverdue
              ? 'var(--mantine-color-red-5)'
              : undefined,
          borderWidth: isSelected ? 2 : 1,
        }}
        withBorder
      >
        {agreement?.Organization?.Name && (
          <Text c="dimmed" size="xs" truncate>
            {agreement.Organization.Name}
          </Text>
        )}

        <Group gap={6} wrap="nowrap">
          <Text fw={isSelected ? 700 : 600} size="sm" truncate>
            {agreement?.Name}
          </Text>
          <Text c="dimmed" size="xs" style={{ flexShrink: 0 }}>
            {agreement?.Currency?.Code}
          </Text>
        </Group>

        {clientAgreement.OriginalClientName && (
          <Tooltip label={clientAgreement.OriginalClientName} multiline maw={320} position="top">
            <Group gap={4} wrap="nowrap">
              <IconHelpCircle size={12} style={{ color: 'var(--mantine-color-gray-6)', flexShrink: 0 }} />
              <Text c="dimmed" size="xs" truncate>
                {clientAgreement.OriginalClientName}
              </Text>
            </Group>
          </Tooltip>
        )}

        <Group gap="sm" wrap="nowrap">
          {agreement?.IsControlAmountDebt && (
            <Text c={totalAgreementDebt > 0 ? 'red.7' : 'dimmed'} size="xs" style={{ whiteSpace: 'nowrap' }}>
              {totalAgreementDebt}/{accountBalance}
            </Text>
          )}
          {agreement?.IsControlNumberDaysDebt && (
            <Text c={daysOwed > overdueLimitDays ? 'red.7' : 'dimmed'} size="xs" style={{ whiteSpace: 'nowrap' }}>
              {daysOwed > overdueLimitDays ? daysOwed - overdueLimitDays : 0}/{overdueLimitDays}
            </Text>
          )}
          {(agreement?.IsControlAmountDebt || agreement?.IsControlNumberDaysDebt) && (
            <Box component="span" style={{ flexShrink: 0 }}>
              <Text c={isOverdue ? 'red.7' : 'dimmed'} size="xs">
                {t('прострочено')}
              </Text>
            </Box>
          )}
        </Group>
      </Paper>
    </UnstyledButton>
  )
}
