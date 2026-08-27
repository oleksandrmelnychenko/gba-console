import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import { EcommercePanel } from './EcommercePanel'

describe('EcommercePanel', () => {
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
})
