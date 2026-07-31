export type ConsoleNotificationKind =
  | 'ecommerce-ai-image-search'
  | 'ecommerce-interest'
  | 'ecommerce-order'

export type ConsoleNotification = {
  createdAt: string
  entityNetUid?: string
  id: string
  kind: ConsoleNotificationKind
  message: string
  readAt?: string
  route?: string
  title: string
}

export type ConsoleNotificationState = {
  items: ConsoleNotification[]
}
