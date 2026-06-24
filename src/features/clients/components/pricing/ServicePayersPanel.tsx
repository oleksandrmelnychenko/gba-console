import { Button, Card, Group, Stack, Text, UnstyledButton } from '@mantine/core'
import { AppModal } from '../../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { ServicePayer } from '../../types'
import { ServicePayerForm } from './ServicePayerForm'

export type ServicePayersPanelProps = {
  payers: ServicePayer[]
  disabled?: boolean
  onChange: (payers: ServicePayer[]) => void
}

function getFullName(payer: ServicePayer): string {
  return [payer.LastName, payer.FirstName, payer.MiddleName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
}

export function ServicePayersPanel({ payers, disabled = false, onChange }: ServicePayersPanelProps) {
  const { t } = useI18n()
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [modalOpened, setModalOpened] = useState(false)

  const editingPayer = editingIndex !== null ? payers[editingIndex] : null

  function openNew() {
    setEditingIndex(null)
    setModalOpened(true)
  }

  function openEdit(index: number) {
    setEditingIndex(index)
    setModalOpened(true)
  }

  function closeModal() {
    setModalOpened(false)
    setEditingIndex(null)
  }

  function handleSubmit(payer: ServicePayer) {
    if (editingIndex !== null) {
      onChange(payers.map((item, index) => (index === editingIndex ? payer : item)))
    } else {
      onChange([...payers, payer])
    }

    closeModal()
  }

  function handleDelete() {
    if (editingIndex !== null) {
      onChange(payers.filter((_, index) => index !== editingIndex))
    }

    closeModal()
  }

  return (
    <>
      <Card className="app-section-card" withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text fw={600}>{t('Платники')}</Text>
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={disabled}
              leftSection={<IconPlus size={16} />}
              size="xs"
              variant="light"
              onClick={openNew}
            >
              {t('Додати')}
            </Button>
          </Group>

          {payers.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t('Платників не додано')}
            </Text>
          ) : (
            <Stack gap="xs">
              {payers.map((payer, index) => (
                <UnstyledButton
                  key={payer.NetUid || payer.Id || index}
                  disabled={disabled}
                  p="sm"
                  style={{
                    border: '1px solid var(--mantine-color-default-border)',
                    borderRadius: 'var(--mantine-radius-sm)',
                  }}
                  onClick={() => openEdit(index)}
                >
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={2}>
                      <Text fw={500}>{getFullName(payer) || t('Без імені')}</Text>
                      {payer.PaymentAddress && (
                        <Text c="dimmed" size="sm">
                          {payer.PaymentAddress}
                        </Text>
                      )}
                    </Stack>
                    <Stack gap={0} align="flex-end">
                      <Text c="dimmed" size="xs">
                        {t('Рахунок')}
                      </Text>
                      <Text size="sm">{payer.PaymentCard}</Text>
                    </Stack>
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          )}
        </Stack>
      </Card>

      <AppModal
        centered
        opened={modalOpened}
        title={editingPayer ? t('Платник') : t('Новий платник')}
        onClose={closeModal}
      >
        <ServicePayerForm
          disabled={disabled}
          payer={editingPayer}
          onCancel={closeModal}
          onDelete={handleDelete}
          onSubmit={handleSubmit}
        />
      </AppModal>
    </>
  )
}
