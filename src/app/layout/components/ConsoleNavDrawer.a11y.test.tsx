import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { NavigationModule } from '../../../features/navigation/types'
import { ConsoleNavDrawer } from './ConsoleNavDrawer'

const navigation = vi.hoisted(() => ({ value: null as unknown }))
vi.mock('react-router-dom', async original => ({ ...await original<typeof import('react-router-dom')>(), useNavigate: () => vi.fn() }))
vi.mock('../../../features/navigation/hooks/useNavigation', () => ({ useNavigation: () => navigation.value }))

const admin: NavigationModule = { Id: 2, Module: 'Адміністрування', Children: [{ Id: 21, Module: 'Всі користувачі', Route: '/users' }] }

beforeEach(() => {
  navigation.value = {
    error: null,
    isLoading: false,
    modules: [admin],
    visibleModules: [admin],
    selectedModule: admin,
    selectedNode: admin.Children[0],
    getNodePath: (item: { Route: string }) => item.Route,
  }
})

it('is a named modal dialog: focus moves in on open and returns to the burger on Escape', async () => {
  render(<MantineProvider env="test"><I18nProvider><ConsoleNavDrawer /></I18nProvider></MantineProvider>)
  const burger = screen.getByRole('button', { name: 'Меню' })
  burger.focus()
  fireEvent.click(burger)

  const drawer = await screen.findByRole('dialog', { name: 'Меню' })
  expect(drawer.getAttribute('aria-modal')).toBe('true')
  await waitFor(() => expect(drawer.contains(document.activeElement)).toBe(true))
  expect(screen.getByRole('button', { name: 'Закрити меню' })).toBeTruthy()

  fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Меню' })).toBeNull())
  await waitFor(() => expect(document.activeElement).toBe(burger))
})

it('the burger is offered below 1024px, not only at phone widths', async () => {
  // vitest runs with css: false, so the stylesheet is read as a file.
  const fs = await vi.importActual<{ readFileSync: (path: string, encoding: 'utf8') => string }>('node:fs')
  const layoutCss = fs.readFileSync('src/app/layout/layout.css', 'utf8')
  const css = layoutCss
  const rule = /@media \(max-width: ([\d.]+)em\) \{\s*\.console-header-burger \{ display: inline-flex; \}/.exec(css)

  expect(rule).not.toBeNull()
  const maxWidthPx = Number(rule![1]) * 16
  expect(maxWidthPx).toBeGreaterThanOrEqual(1023)
  expect(maxWidthPx).toBeLessThan(1024)
})
