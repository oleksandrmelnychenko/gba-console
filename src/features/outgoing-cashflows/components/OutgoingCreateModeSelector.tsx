import { Badge, Card, Group, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconCash, IconChevronRight } from '@tabler/icons-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { OUTGOING_CREATE_MODE, type OutgoingCreateMode } from '../outgoingCreateTypes'

type ModeDefinition = {
  description: string
  enabled: boolean
  label: string
  mode: OutgoingCreateMode
}

type OutgoingCreateModeSelectorProps = {
  onSelect: (mode: OutgoingCreateMode) => void
}

export function OutgoingCreateModeSelector({ onSelect }: OutgoingCreateModeSelectorProps) {
  const { t } = useI18n()

  const modes: ModeDefinition[] = [
    {
      description: t('Стандартний видатковий касовий ордер (під звіт / переказ відповідальному).'),
      enabled: true,
      label: t('Видатковий касовий ордер'),
      mode: OUTGOING_CREATE_MODE.Simple,
    },
    {
      description: t('Поповнити баланс постачальника послуг'),
      enabled: false,
      label: t('Поповнити баланс постачальника послуг'),
      mode: OUTGOING_CREATE_MODE.OrganizationPayment,
    },
    {
      description: t('Платіжна задача'),
      enabled: false,
      label: t('Платіжна задача'),
      mode: OUTGOING_CREATE_MODE.PaymentTasks,
    },
    {
      description: t('Повернення клієнту'),
      enabled: false,
      label: t('Повернення клієнту'),
      mode: OUTGOING_CREATE_MODE.ClientReturn,
    },
  ]

  return (
    <Stack gap="md">
      <Text fw={700} size="xl">
        {t('Створення видаткової статті бюджету')}
      </Text>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {modes.map((definition) => (
          <UnstyledButton
            key={definition.mode}
            disabled={!definition.enabled}
            onClick={() => definition.enabled && onSelect(definition.mode)}
          >
            <Card withBorder opacity={definition.enabled ? 1 : 0.6} radius="md" shadow="sm">
              <Group align="flex-start" justify="space-between" wrap="nowrap">
                <Group align="flex-start" gap="sm" wrap="nowrap">
                  <IconCash size={28} />
                  <Stack gap={4}>
                    <Group gap="xs">
                      <Text fw={600}>{definition.label}</Text>
                      {!definition.enabled && (
                        <Badge color="gray" variant="light">
                          {t('у розробці')}
                        </Badge>
                      )}
                    </Group>
                    <Text c="dimmed" size="sm">
                      {definition.description}
                    </Text>
                  </Stack>
                </Group>
                {definition.enabled && <IconChevronRight size={20} />}
              </Group>
            </Card>
          </UnstyledButton>
        ))}
      </SimpleGrid>
    </Stack>
  )
}
