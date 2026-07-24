import { Modal, type ModalProps } from '@mantine/core'
import type { PropsWithChildren, ReactNode } from 'react'
import { SmoothResize } from '../transitions/SmoothResize'
import './app-modal.css'

const DEFAULT_MODAL_SIZE = 496

export type AppModalProps = Omit<ModalProps, 'title'> & {
  title: ReactNode
  variant?: 'default' | 'workspace'
}

export function AppModalFooter({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  const footerClassName = ['app-modal-footer', className].filter(Boolean).join(' ')

  return <div className={footerClassName}>{children}</div>
}

/**
 * Shared modal shell. It owns the common modal chrome and form styling so
 * feature modals cannot silently drift from the console pattern.
 *
 * Explicit `centered`, `size` and feature class names are still respected for
 * large work forms and deliberately positioned modals.
 */
export function AppModal({
  centered,
  children,
  className,
  size,
  variant = 'default',
  ...props
}: AppModalProps) {
  const isWorkspace = variant === 'workspace'
  const modalClassName = [
    'app-modal',
    'app-form-sheet',
    isWorkspace ? 'app-modal--workspace' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Modal
      {...props}
      centered={centered ?? !isWorkspace}
      className={modalClassName}
      size={size ?? (isWorkspace ? '100%' : DEFAULT_MODAL_SIZE)}
    >
      {isWorkspace ? (
        children
      ) : (
        <SmoothResize className="app-modal-resize" maxHeight="calc(100vh - 200px)">
          {children}
        </SmoothResize>
      )}
    </Modal>
  )
}
