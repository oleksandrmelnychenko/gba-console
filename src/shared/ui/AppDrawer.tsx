import { Drawer, type DrawerProps } from '@mantine/core'

export function AppDrawer({ position = 'right', children, ...props }: DrawerProps) {
  return (
    <Drawer position={position} {...props}>
      {children}
    </Drawer>
  )
}
