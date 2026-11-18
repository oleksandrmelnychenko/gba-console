import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { useZeroPriceConfirm } from './useZeroPriceConfirm'
import { ZeroPriceConfirmModal } from './ZeroPriceConfirmModal'
import { hasZeroPrice, ZERO_PRICE_CONFIRM_MESSAGE } from './zeroPriceConfirm'

describe('zero price confirmation', () => {
  it('detects an explicit zero price only', () => {
    expect(hasZeroPrice([12, 0])).toBe(true)
    expect(hasZeroPrice(['0,00'])).toBe(true)
    expect(hasZeroPrice([12, undefined, null, '', -1])).toBe(false)
  })

  it('asks «Ціна 0 — товар буде оприбутковано безкоштовно. Продовжити?» and resolves with the answer', async () => {
    let confirm: () => Promise<boolean> = async () => false
    function Harness() {
      const { confirmZeroPrice, zeroPriceModalProps } = useZeroPriceConfirm()
      confirm = confirmZeroPrice
      return <ZeroPriceConfirmModal {...zeroPriceModalProps} />
    }
    render(<MantineProvider><I18nProvider><Harness /></I18nProvider></MantineProvider>)

    let answer: Promise<boolean> = Promise.resolve(false)
    act(() => { answer = confirm() })
    expect(await screen.findByText(ZERO_PRICE_CONFIRM_MESSAGE)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Продовжити' }))
    await expect(answer).resolves.toBe(true)

    act(() => { answer = confirm() })
    fireEvent.click(await screen.findByRole('button', { name: 'Скасувати' }))
    await expect(answer).resolves.toBe(false)
  })
})
