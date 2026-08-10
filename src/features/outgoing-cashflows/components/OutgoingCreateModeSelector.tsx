import { Group, Stack, Text, UnstyledButton } from '@mantine/core'
import { ChevronRight } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { PaymentRegisterType } from '../../income-cashflows/types'
import {
  buildOutgoingRegisterItems,
  type OutgoingCreateMenuItem,
} from '../outgoingCreateMenu'

type OutgoingCreateModeSelectorProps = {
  onNavigate: (path: string) => void
}

export function OutgoingCreateModeSelector({ onNavigate }: OutgoingCreateModeSelectorProps) {
  const { t } = useI18n()

  return (
    <Stack className="outgoing-create-selector" gap="md">
      <SelectorSection
        items={buildOutgoingRegisterItems(t, PaymentRegisterType.Bank)}
        title={t('Банківські операції')}
        onNavigate={onNavigate}
      />
      <SelectorSection
        items={buildOutgoingRegisterItems(t, PaymentRegisterType.Cash)}
        title={t('Касові операції')}
        onNavigate={onNavigate}
      />
    </Stack>
  )
}

function SelectorSection({
  items,
  title,
  onNavigate,
}: {
  items: OutgoingCreateMenuItem[]
  title: string
  onNavigate: (path: string) => void
}) {
  return (
    <Stack className="outgoing-create-selector__section" gap={6}>
      <Text className="app-section-title" fw={600} size="sm">{title}</Text>
      <Stack className="outgoing-create-selector__list" gap={2}>
        {items.map((item) => (
          <UnstyledButton className="outgoing-create-selector__item" key={item.path} onClick={() => onNavigate(item.path)}>
            <Group
              gap="sm"
              justify="space-between"
              wrap="nowrap"
            >
              <Text className="outgoing-create-selector__label" size="sm">{item.label}</Text>
              <ChevronRight className="outgoing-create-selector__chevron" size={15} />
            </Group>
          </UnstyledButton>
        ))}
      </Stack>
    </Stack>
  )
}
