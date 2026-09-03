import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import { changeClientPassword } from '../../api/clientCabinetApi'
import { EcommercePanel } from './EcommercePanel'

vi.mock('../../api/clientCabinetApi', () => ({
  changeClientPassword: vi.fn(),
}))
vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

const changeClientPasswordMock = vi.mocked(changeClientPassword)
const notificationsShowMock = vi.mocked(notifications.show)

describe('EcommercePanel', () => {
  beforeEach(() => {
    changeClientPasswordMock.mockReset()
    notificationsShowMock.mockReset()
  })

  it('locks the 1C phone but keeps local shop settings editable', () => {
    render(
      <MantineProvider env="test" theme={theme}>
        <I18nProvider>
          <EcommercePanel
            canChangePassword
            canEditSettings
            client={{
              ClearCartAfterDays: 7,
              MobileNumber: '+380-source',
              NetUid: '3a0ccabd-a781-45c3-a01c-6b50355c77ff',
              SourceAmgCode: 3968,
            }}
            sourceManaged
            onChange={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByRole('textbox', { name: 'Мобільний телефон' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('textbox', { name: 'Резервація корзини інтернет магазина (днів)' })).toHaveProperty('disabled', false)
    expect(screen.getByText('Телефон керується синхронізацією з 1С; тут змінюється лише пароль')).toBeTruthy()
  })

  it('keeps password and shop settings fail-closed without their independent permissions', () => {
    render(
      <MantineProvider env="test" theme={theme}>
        <I18nProvider>
          <EcommercePanel
            client={{ NetUid: 'client-1' }}
            onChange={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByRole('textbox', { name: 'Мобільний телефон' })).toHaveProperty('disabled', true)
    expect(screen.getByLabelText('Пароль')).toHaveProperty('disabled', true)
    expect(screen.getByLabelText('Підтвердити пароль')).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Змінити' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('textbox', { name: 'Резервація корзини інтернет магазина (днів)' })).toHaveProperty('disabled', true)
  })

  it('rejects a weak client password before calling the password API', async () => {
    render(
      <MantineProvider env="test" theme={theme}>
        <I18nProvider>
          <EcommercePanel
            canChangePassword
            client={{ NetUid: 'client-1' }}
            onChange={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'Password1' } })
    fireEvent.change(screen.getByLabelText('Підтвердити пароль'), { target: { value: 'Password1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Змінити' }))

    expect(changeClientPasswordMock).not.toHaveBeenCalled()
    expect(notificationsShowMock).toHaveBeenCalledWith({
      color: 'red',
      message: 'Пароль має містити мінімум 6 символів, цифру, літеру та спецсимвол',
    })
  })

  it('submits a valid client password through the dedicated password API', async () => {
    changeClientPasswordMock.mockResolvedValue(null)

    render(
      <MantineProvider env="test" theme={theme}>
        <I18nProvider>
          <EcommercePanel
            canChangePassword
            client={{ MobileNumber: '+380-source', NetUid: 'client-1' }}
            onChange={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'Password_1' } })
    fireEvent.change(screen.getByLabelText('Підтвердити пароль'), { target: { value: 'Password_1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Змінити' }))

    await waitFor(() => {
      expect(changeClientPasswordMock).toHaveBeenCalledWith('client-1', 'Password_1', '+380-source')
    })
    expect(notificationsShowMock).toHaveBeenCalledWith({
      color: 'green',
      message: 'Пароль змінено',
    })
  })
})
