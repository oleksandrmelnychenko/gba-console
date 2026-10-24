import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { NavigationModule, NavigationNode } from '../../../features/navigation/types'
import { ConsoleNav } from './ConsoleNav'

const navigate = vi.fn()
const navigation = vi.hoisted(() => ({ value: null as unknown }))
vi.mock('react-router-dom', async original => ({ ...await original<typeof import('react-router-dom')>(), useNavigate: () => navigate }))
vi.mock('../../../features/navigation/hooks/useNavigation', () => ({ useNavigation: () => navigation.value }))

const node = (Id: number, Module: string): NavigationNode => ({ Id, Module, Route: `/route-${Id}` })
const modules: NavigationModule[] = ['Продажі', 'Замовлення', 'Товари', 'Склади', 'Звіти', 'Послуги']
  .map((Module, index) => ({ Id: index + 1, Module, Children: [node(100 + index, `${Module}: перший`)] }))
const realRect = HTMLElement.prototype.getBoundingClientRect

function select(index: number) {
  navigation.value = { error: null, isLoading: false, modules, selectedModule: modules[index], selectedNode: modules[index].Children[0],
    getNodePath: (item: NavigationNode) => item.Route }
}

beforeEach(() => {
  navigate.mockClear()
  HTMLElement.prototype.getBoundingClientRect = function rect(this: HTMLElement) {
    const width = this.classList.contains('console-subnav-pill') ? 100 : 0
    return { width, height: 30, top: 0, left: 0, right: width, bottom: 30, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
  }
})
afterEach(() => { HTMLElement.prototype.getBoundingClientRect = realRect })

const nav = (availableWidth?: number) => <MantineProvider env="test"><I18nProvider>
  <ConsoleNav mode="modules" availableWidth={availableWidth} />
</I18nProvider></MantineProvider>

function shown() {
  return within(screen.getByRole('navigation', { name: 'Навігація' })).getAllByRole('button').map(button => button.textContent)
}

it('shows every module when the header has room or has not been measured', () => {
  select(0)
  const view = render(nav())
  expect(shown()).toEqual(['Продажі', 'Замовлення', 'Товари', 'Склади', 'Звіти', 'Послуги'])
  view.rerender(nav(600))
  expect(shown()).toEqual(['Продажі', 'Замовлення', 'Товари', 'Склади', 'Звіти', 'Послуги'])
})

it('moves the modules that do not fit into «Ще» and opens them from there', async () => {
  select(0)
  render(nav(450))
  expect(shown()).toEqual(['Продажі', 'Замовлення', 'Товари', 'Ще'])
  expect(screen.getByRole('button', { name: 'Продажі' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Ще' }))
  expect((await screen.findAllByRole('menuitem')).map(item => item.textContent)).toEqual(['Склади', 'Звіти', 'Послуги'])
  fireEvent.click(screen.getByRole('menuitem', { name: 'Звіти' }))
  expect(navigate).toHaveBeenCalledWith('/route-104', { state: { nodeTitle: 'Звіти: перший', moduleTitle: 'Звіти' } })
})

it('keeps the active module on screen with its highlight', () => {
  select(4)
  render(nav(450))
  expect(shown()).toEqual(['Продажі', 'Замовлення', 'Звіти', 'Ще'])
  const active = screen.getByRole('button', { name: 'Звіти' })
  expect(active.getAttribute('aria-pressed')).toBe('true')
  expect(active.className).toContain('is-active')
  expect(screen.getByRole('button', { name: 'Ще' }).className).not.toContain('is-active')
})

it('labels the reports submenu Catalogue while preserving the reports module and route', () => {
  const reportNode = { Id: 200, Module: 'Звіти', Route: '/reports/stocks' }
  const reportModule = { Id: 20, Module: 'Звіти', Children: [reportNode] }
  navigation.value = { error: null, isLoading: false, modules: [reportModule], selectedModule: reportModule, selectedNode: reportNode,
    getNodePath: (item: NavigationNode) => item.Route }
  render(<MantineProvider env="test"><I18nProvider><ConsoleNav /></I18nProvider></MantineProvider>)
  expect(screen.getByRole('button', { name: 'Звіти' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Каталог' }))
  expect(navigate).toHaveBeenCalledWith('/reports/stocks', { state: { nodeTitle: 'Звіти', moduleTitle: 'Звіти' } })
})
