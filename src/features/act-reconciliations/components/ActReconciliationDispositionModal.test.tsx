import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ActReconciliationDispositionModal } from './ActReconciliationDispositionModal'

const mocks = vi.hoisted(() => ({
  changeDisposition: vi.fn(),
  notification: vi.fn(),
}))

vi.mock('../api/actReconciliationsApi', () => ({
  changeReconciliationDisposition: mocks.changeDisposition,
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.notification },
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({
    children,
    opened,
    title,
  }: {
    children: ReactNode
    opened: boolean
    title: ReactNode
  }) => opened ? <div aria-label={String(title)} role="dialog">{children}</div> : null,
}))

describe('ActReconciliationDispositionModal', () => {
  beforeEach(() => {
    mocks.changeDisposition.mockReset()
    mocks.notification.mockReset()
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => '30000000-0000-4000-8000-000000000001'),
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('retries an unknown outcome with the same idempotency key', async () => {
    mocks.changeDisposition
      .mockRejectedValueOnce(new Error('Результат операції невідомий'))
      .mockResolvedValueOnce({ AffectedCount: 1 })
    const onApplied = vi.fn()
    const onClose = vi.fn()

    renderModal({ mode: 'reopen', onApplied, onClose })

    const submit = screen.getByRole('button', { name: 'Повернути в роботу' })
    fireEvent.click(submit)
    expect(await screen.findByText('Результат операції невідомий')).toBeTruthy()

    fireEvent.click(submit)
    await waitFor(() => expect(mocks.changeDisposition).toHaveBeenCalledTimes(2))

    const firstRequest = mocks.changeDisposition.mock.calls[0][0]
    const retriedRequest = mocks.changeDisposition.mock.calls[1][0]
    expect(firstRequest.operationNetUid).toBe(
      '30000000-0000-4000-8000-000000000001',
    )
    expect(retriedRequest.operationNetUid).toBe(firstRequest.operationNetUid)
    expect(retriedRequest.itemNetIds).toEqual(['item-1'])
    expect(onApplied).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fails closed when the browser cannot create a secure operation id', () => {
    vi.stubGlobal('crypto', {})

    renderModal({ mode: 'reopen' })

    expect(screen.getByText(/Браузер не зміг створити захищений ідентифікатор/))
      .toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Повернути в роботу' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(mocks.changeDisposition).not.toHaveBeenCalled()
  })

  it('fails closed when disposition permission is revoked', () => {
    renderModal({ mode: 'reopen', permitted: false })

    const submit = screen.getByRole('button', { name: 'Повернути в роботу' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(submit)
    expect(mocks.changeDisposition).not.toHaveBeenCalled()
  })
})

function renderModal({
  mode,
  onApplied = vi.fn(),
  onClose = vi.fn(),
  permitted = true,
}: {
  mode: 'dismiss' | 'reopen'
  onApplied?: () => void
  onClose?: () => void
  permitted?: boolean
}) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <ActReconciliationDispositionModal
          actNetId="act-1"
          items={[{
            Id: 1,
            NetUid: 'item-1',
            HasDifference: true,
            QtyDifference: 6,
          }]}
          mode={mode}
          opened
          permitted={permitted}
          onApplied={onApplied}
          onClose={onClose}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}
