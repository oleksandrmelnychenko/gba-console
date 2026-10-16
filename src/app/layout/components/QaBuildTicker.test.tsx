import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { QaBuildTicker } from './QaBuildTicker'

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))

function desk(number: string) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ number, bugs: [], pending: [] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } })))
}
beforeEach(() => { vi.mocked(notifications.show).mockClear(); vi.stubGlobal('__BUILD_NUMBER__', '2026.10.15.2236') })
afterEach(() => vi.unstubAllGlobals())
const mount = () => render(<MantineProvider env="test"><QaBuildTicker /></MantineProvider>)

it('keeps the running build and stays quiet when the QA Desk release is older', async () => {
  desk('2026.10.06.2301')
  mount()
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/qa-desk/api/builds/current'))
  await waitFor(() => expect(screen.getByRole('button').getAttribute('title')).toBe('Баги, опрацьовані в поточному build'))
  expect(screen.getByText('2026.10.15.2236')).toBeTruthy()
  expect(screen.queryByText('2026.10.06.2301')).toBeNull()
  expect(notifications.show).not.toHaveBeenCalled()
})

it('announces a strictly newer QA Desk release once', async () => {
  desk('2026.10.16.0930')
  mount()
  await waitFor(() => expect(notifications.show).toHaveBeenCalledOnce())
  expect(vi.mocked(notifications.show).mock.calls[0][0]).toMatchObject({ message: expect.stringContaining('2026.10.16.0930') })
  expect(screen.getByRole('button').getAttribute('title')).toBe('Задеплоєно нову версію — оновіть сторінку')
  expect(screen.getByText('2026.10.15.2236')).toBeTruthy()
})
