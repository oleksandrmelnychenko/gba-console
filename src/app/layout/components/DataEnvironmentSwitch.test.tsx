import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { DataEnvironmentSwitch } from './DataEnvironmentSwitch'

const reload = vi.fn()

function serve(body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body),
    { status, headers: { 'Content-Type': 'application/json' } })))
}

const mount = () => render(
  <MantineProvider env="test">
    <I18nProvider>
      <DataEnvironmentSwitch />
    </I18nProvider>
  </MantineProvider>,
)

beforeEach(() => {
  reload.mockClear()
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, protocol: 'http:', reload } })
  document.cookie = 'gba_env=; Path=/; Max-Age=0'
  delete document.documentElement.dataset.gbaEnv
})
afterEach(() => vi.unstubAllGlobals())

it('stays hidden when the server does not offer a QA database', async () => {
  serve({ active: 'dev', qaAvailable: false })
  mount()
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/gba-env.json', expect.anything()))
  expect(screen.queryByText('QA')).toBeNull()
  expect(document.documentElement.dataset.gbaEnv).toBeUndefined()
})

it('stays hidden when the environment endpoint is not served', async () => {
  serve('<!doctype html>', 200)
  mount()
  await waitFor(() => expect(fetch).toHaveBeenCalled())
  expect(screen.queryByText('DEV')).toBeNull()
})

it('marks the document with the active database and switches to QA with a reload', async () => {
  serve({ active: 'dev', qaAvailable: true })
  mount()
  await waitFor(() => expect(screen.getByText('QA')).toBeTruthy())
  expect(document.documentElement.dataset.gbaEnv).toBe('dev')
  fireEvent.click(screen.getByText('QA'))
  expect(document.cookie).toContain('gba_env=qa')
  expect(reload).toHaveBeenCalledOnce()
})

it('returns to DEV by clearing the cookie', async () => {
  document.cookie = 'gba_env=qa; Path=/'
  serve({ active: 'qa', qaAvailable: true })
  mount()
  await waitFor(() => expect(document.documentElement.dataset.gbaEnv).toBe('qa'))
  fireEvent.click(screen.getByText('DEV'))
  expect(document.cookie).not.toContain('gba_env=qa')
  expect(reload).toHaveBeenCalledOnce()
})

it('does nothing when the active database is chosen again', async () => {
  serve({ active: 'qa', qaAvailable: true })
  mount()
  await waitFor(() => expect(screen.getByText('QA')).toBeTruthy())
  fireEvent.click(screen.getByText('QA'))
  expect(reload).not.toHaveBeenCalled()
})
