import {
  Button,
  Card,
  Group,
  NumberInput,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Key } from 'lucide-react'
import { type KeyboardEvent } from 'react'
import { useValueState } from '../../../../shared/hooks/useValueState'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { changeClientPassword } from '../../api/clientCabinetApi'
import type { Client } from '../../types'

const DEFAULT_CLEAR_CART_AFTER_DAYS = 3

export type EcommercePanelProps = {
  client: Client
  onChange: (client: Client) => void
}

export function EcommercePanel({ client, onChange }: EcommercePanelProps) {
  const { t } = useI18n()
  const [mobileNumber, setMobileNumber] = useValueState(client.MobileNumber ?? '')
  const [password, setPassword] = useValueState('')
  const [confirmPassword, setConfirmPassword] = useValueState('')
  const [isChanging, setChanging] = useValueState(false)

  function handleClearCartAfterDaysChange(value: number | string) {
    const parsed = typeof value === 'number' ? value : parseInt(value, 10)
    onChange({
      ...client,
      ClearCartAfterDays: Number.isFinite(parsed) && parsed ? parsed : DEFAULT_CLEAR_CART_AFTER_DAYS,
    })
  }

  async function handleChangePassword() {
    if (password !== confirmPassword) {
      notifications.show({
        color: 'red',
        message: t('Паролі не збігаються'),
      })
      return
    }

    setChanging(true)

    try {
      await changeClientPassword(client.NetUid ?? '', password, mobileNumber)
      onChange({
        ...client,
        MobileNumber: mobileNumber,
      })
      setPassword('')
      setConfirmPassword('')
      notifications.show({
        color: 'green',
        message: t('Пароль змінено'),
      })
    } catch (changeError) {
      notifications.show({
        color: 'red',
        message: changeError instanceof Error ? changeError.message : t('Не вдалося змінити пароль'),
      })
    } finally {
      setChanging(false)
    }
  }

  function handleFieldKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void handleChangePassword()
    }
  }

  return (
    <Stack gap="lg">
      <Card className="app-section-card" withBorder padding="md" radius="md">
        <Stack gap="md">
          <Text fw={600}>{t('Зміна пароля')}</Text>
          <TextInput
            autoFocus
            label={t('Мобільний телефон')}
            value={mobileNumber}
            onChange={(event) => setMobileNumber(event.currentTarget.value)}
            onKeyDown={handleFieldKeyDown}
          />
          <PasswordInput
            autoComplete="new-password"
            label={t('Пароль')}
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            onKeyDown={handleFieldKeyDown}
          />
          <PasswordInput
            autoComplete="new-password"
            label={t('Підтвердити пароль')}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.currentTarget.value)}
            onKeyDown={handleFieldKeyDown}
          />
          <Group justify="flex-end">
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={isChanging}
              leftSection={<Key size={16} />}
              loading={isChanging}
              onClick={() => void handleChangePassword()}
            >
              {t('Змінити')}
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card className="app-section-card" withBorder padding="md" radius="md">
        <Stack gap="md">
          <Text fw={600}>{t('Налаштування магазину')}</Text>
          <NumberInput
            allowNegative={false}
            label={t('Резервація корзини інтернет магазина (днів)')}
            min={0}
            value={client.ClearCartAfterDays ?? ''}
            onChange={handleClearCartAfterDaysChange}
          />
        </Stack>
      </Card>
    </Stack>
  )
}
