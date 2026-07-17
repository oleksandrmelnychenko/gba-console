import { Divider, Group, Stack, Text, UnstyledButton } from '@mantine/core'
import { Banknote, ChevronRight, Landmark, ListChecks } from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { PaymentRegisterType } from '../../income-cashflows/types'
import {
  buildOutgoingRegisterItems,
  buildOutgoingStandaloneItems,
  type OutgoingCreateMenuItem,
} from '../outgoingCreateMenu'

type OutgoingCreateModeSelectorProps = {
  onNavigate: (path: string) => void
}

export function OutgoingCreateModeSelector({ onNavigate }: OutgoingCreateModeSelectorProps) {
  const { t } = useI18n()

  const standaloneItems = buildOutgoingStandaloneItems(t)

  return (
    <Stack gap="md">
      <Text fw={700} size="xl">
        {t('Створення видаткової статті бюджету')}
      </Text>

      <SelectorSection
        icon={<Landmark size={18} />}
        items={buildOutgoingRegisterItems(t, PaymentRegisterType.Bank)}
        title={t('Банківські операції')}
        onNavigate={onNavigate}
      />

      <Divider />

      <SelectorSection
        icon={<Banknote size={18} />}
        items={buildOutgoingRegisterItems(t, PaymentRegisterType.Cash)}
        title={t('Касові операції')}
        onNavigate={onNavigate}
      />

      <Divider />

      <SelectorSection
        icon={<ListChecks size={18} />}
        items={standaloneItems}
        title={t('Інші операції (бух/упр)')}
        onNavigate={onNavigate}
      />
    </Stack>
  )
}

function SelectorSection({
  icon,
  items,
  title,
  onNavigate,
}: {
  icon: ReactNode
  items: OutgoingCreateMenuItem[]
  title: string
  onNavigate: (path: string) => void
}) {
  return (
    <Stack gap={6}>
      <Group gap="xs">
        {icon}
        <Text fw={600}>{title}</Text>
      </Group>
      <Stack gap={4}>
        {items.map((item) => (
          <UnstyledButton key={item.path} onClick={() => onNavigate(item.path)}>
            <Group
              gap="sm"
              justify="space-between"
              px="sm"
              py={6}
              style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}
              wrap="nowrap"
            >
              <Text size="sm">{item.label}</Text>
              <ChevronRight size={16} />
            </Group>
          </UnstyledButton>
        ))}
      </Stack>
    </Stack>
  )
}
