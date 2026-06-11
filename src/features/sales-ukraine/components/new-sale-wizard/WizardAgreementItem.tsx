import { Group, Paper, Text, Tooltip } from '@mantine/core'
import { IconHelpCircle } from '@tabler/icons-react'
import type { ClientAgreement } from '../../../clients/types'
import { getWizardClientDebtDays, getWizardClientDebtTotal } from './wizardClientStepModel'

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
  const isOverdue =
    overdueTotal > 0 ||
    (agreement.AmountDebt != null && Math.abs(accountBalance) > agreement.AmountDebt) ||
    daysOwed > overdueLimitDays

  return (
    <Paper
      p="xs"
      radius="sm"
      style={{
        ...(isOverdue ? { borderColor: 'var(--mantine-color-red-5)' } : undefined),
        ...(selected ? { background: 'var(--mantine-color-teal-0)', borderColor: 'var(--mantine-color-teal-6)' } : undefined),
        ...(onSelect ? { cursor: 'pointer' } : undefined),
      }}
      withBorder
      onClick={onSelect}
    >
      {agreement.Organization?.Name && (
        <Text c="dimmed" size="xs">
          {agreement.Organization.Name}
        </Text>
      )}
      <Group gap="sm" justify="space-between" wrap="nowrap">
        <Text fw={600} size="sm" style={{ minWidth: 0 }} truncate>
          {agreement.Name}{' '}
          <Text span c="dimmed" size="xs">
            {agreement.Currency?.Code}
          </Text>
        </Text>
        <Group gap="sm" wrap="nowrap">
          {agreement.IsControlAmountDebt && (
            <Text c={overdueTotal > 0 ? 'red' : 'dimmed'} size="xs" style={{ whiteSpace: 'nowrap' }}>
              {overdueTotal}/{accountBalance}
            </Text>
          )}
          {agreement.IsControlNumberDaysDebt && (
            <Text c={daysOwed > overdueLimitDays ? 'red' : 'dimmed'} size="xs" style={{ whiteSpace: 'nowrap' }}>
              {Math.max(0, daysOwed - overdueLimitDays)}/{overdueLimitDays}
            </Text>
          )}
        </Group>
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
    </Paper>
  )
}
