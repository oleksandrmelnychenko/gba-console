import { Modal, type ModalProps } from '@mantine/core'
import { SmoothResize } from '../transitions/SmoothResize'

export function AppModal({ children, ...props }: ModalProps) {
  return (
    <Modal {...props}>
      <SmoothResize maxHeight="calc(100vh - 200px)">{children}</SmoothResize>
    </Modal>
  )
}
