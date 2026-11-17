import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { NavigationModule, NavigationNode } from '../../../features/navigation/types'
import { ConsoleNav } from './ConsoleNav'

const navigation = vi.hoisted(() => ({ value: null as unknown }))
vi.mock('react-router-dom', async original => ({ ...await original<typeof import('react-router-dom')>(), useNavigate: () => vi.fn() }))
vi.mock('../../../features/navigation/hooks/useNavigation', () => ({ useNavigation: () => navigation.value }))

const node = (Id: number, Module: string, Route: string): NavigationNode => ({ Id, Module, Route })
const serverModule: NavigationModule = {
  Id: 1,
  Module: 'Продажі',
  Children: [node(11, 'Продажі Україна', '/sales/ukraine/all'), node(12, 'Карта продажів', '/sales/geography')],
}
const visibleModule: NavigationModule = { ...serverModule, Children: [serverModule.Children[0]] }

it('lists only sub-items the user can open, even though the server menu has more', () => {
  navigation.value = {
    error: null,
    isLoading: false,
    modules: [serverModule],
    visibleModules: [visibleModule],
    selectedModule: serverModule,
    selectedNode: serverModule.Children[0],
    getNodePath: (item: NavigationNode) => item.Route,
  }

  render(
    <MantineProvider env="test">
      <I18nProvider>
        <ConsoleNav mode="items" />
      </I18nProvider>
    </MantineProvider>,
  )

  expect(screen.getByText('Продажі Україна')).not.toBeNull()
  expect(screen.queryByText('Карта продажів')).toBeNull()
})
