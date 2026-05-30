import { Group, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import type { Sale } from '../types'
import { displayValue } from './dateHelpers'

type SaleCarrierDrawerProps = {
  sale: Sale | null
  onClose: () => void
}

export function SaleCarrierDrawer({ onClose, sale }: SaleCarrierDrawerProps) {
  const { t } = useI18n()

  return (
    <AppDrawer opened={Boolean(sale)} title={t('Перевізник')} onClose={onClose}>
      {sale && (
        <Stack gap="sm">
          <Group justify="space-between">
            <Text c="dimmed" size="sm">
              {t('Перевізник')}
            </Text>
            <Text fw={600}>{displayValue(sale.Transporter?.Name)}</Text>
          </Group>
          <Group justify="space-between">
            <Text c="dimmed" size="sm">
              {t('Номер')}
            </Text>
            <Text fw={600}>{displayValue(sale.SaleNumber?.Value)}</Text>
          </Group>
          <Group justify="space-between">
            <Text c="dimmed" size="sm">
              {t("Повне ім'я")}
            </Text>
            <Text fw={600}>{displayValue(sale.ClientAgreement?.Client?.FullName)}</Text>
          </Group>
        </Stack>
      )}
    </AppDrawer>
  )
}
