import { createContext } from 'react'
import type { NavigationModule, NavigationNode } from './types'

export type NavigationContextValue = {
  error: Error | null
  isLoading: boolean
  modules: NavigationModule[]
  selectedModule: NavigationModule | null
  selectedNode: NavigationNode | null
  getNodePath: (node: NavigationNode) => string
  isNodeActive: (node: NavigationNode) => boolean
  selectModule: (module: NavigationModule) => void
}

export const NavigationContext = createContext<NavigationContextValue | null>(null)
