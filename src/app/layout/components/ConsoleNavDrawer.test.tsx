import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { NavigationModule, NavigationNode } from '../../../features/navigation/types'
import { ConsoleNavDrawer } from './ConsoleNavDrawer'

const navigate = vi.fn()
const navigation = vi.hoisted(() => ({ value: null as unknown }))
vi.mock('react-router-dom', async original => ({ ...await original<typeof import('react-router-dom')>(), useNavigate: () => navigate }))
vi.mock('../../../features/navigation/hooks/useNavigation', () => ({ useNavigation: () => navigation.value }))

const node = (Id: number, Module: string, Route: string): NavigationNode => ({ Id, Module, Route })
const sales: NavigationModule = { Id: 1, Module: 'Продажі', Children: [node(11, 'Продажі Україна', '/sales/ukraine/all'), node(12, 'Карта продажів', '/sales/geography')] }
const admin: NavigationModule = { Id: 2, Module: 'Адміністрування', Children: [node(21, 'Всі користувачі', '/users'), node(22, 'Ролі', '/users/roles')] }
const finance: NavigationModule = { Id: 3, Module: 'Облік', Children: [node(31, 'Банки', '/accounting/banks')] }

beforeEach(() => {
  navigate.mockClear()
  navigation.value = {
    error: null,
    isLoading: false,
    // The raw server menu has a module the user may not open; the drawer must use visibleModules.
    modules: [sales, admin, finance],
    visibleModules: [{ ...sales, Children: [sales.Children[0]] }, admin],
    selectedModule: admin,
    selectedNode: admin.Children[0],
    getNodePath: (item: NavigationNode) => item.Route,
  }
})

function renderDrawer() {
  return render(<MantineProvider env="test"><I18nProvider><ConsoleNavDrawer /></I18nProvider></MantineProvider>)
}

it('lists the same permission-filtered modules and sub-items as the desktop nav', async () => {
  renderDrawer()
  fireEvent.click(screen.getByRole('button', { name: 'Меню' }))
  const drawer = await screen.findByRole('dialog', { name: 'Меню' })

  expect(within(drawer).getByText('Продажі')).toBeTruthy()
  expect(within(drawer).getByText('Адміністрування')).toBeTruthy()
  expect(within(drawer).queryByText('Облік')).toBeNull()
  // The current module starts expanded with the current page marked.
  expect(within(drawer).getByRole('button', { name: 'Всі користувачі' }).getAttribute('aria-current')).toBe('page')

  fireEvent.click(within(drawer).getByText('Продажі'))
  expect(await within(drawer).findByRole('button', { name: 'Продажі Україна' })).toBeTruthy()
  expect(within(drawer).queryByText('Карта продажів')).toBeNull()
})

it('navigates to the picked page and closes', async () => {
  renderDrawer()
  fireEvent.click(screen.getByRole('button', { name: 'Меню' }))
  const drawer = await screen.findByRole('dialog', { name: 'Меню' })

  fireEvent.click(within(drawer).getByRole('button', { name: 'Ролі' }))

  expect(navigate).toHaveBeenCalledWith('/users/roles', { state: { nodeTitle: 'Ролі', moduleTitle: 'Адміністрування' } })
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Меню' })).toBeNull())
})
