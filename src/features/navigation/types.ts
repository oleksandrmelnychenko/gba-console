export type NavigationNode = {
  Id: number
  NetUid?: string
  Language?: string
  Module: string
  Route: string
  CssClass?: string
  Children?: NavigationNode[]
  IsSelected?: boolean
}

export type NavigationModule = {
  Id: number
  NetUid?: string
  Language?: string
  Module: string
  Description?: string
  CssClass?: string
  Children: NavigationNode[]
  IsSelected?: boolean
}

export type NavigationMatch = {
  module: NavigationModule
  node: NavigationNode
}
