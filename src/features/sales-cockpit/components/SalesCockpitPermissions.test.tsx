import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { OfferCard } from '../../sales-offers/components/OfferCard'
import { OFFER_PROCESSING_STATUS, type ClientShoppingCart } from '../../sales-offers/types'
import type { CockpitTask } from '../types'
import { TaskCard } from './TaskCard'

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

const noTaskAction = vi.fn()

describe('sales cockpit action permissions', () => {
  it('does not render task business actions without their independent rights', () => {
    renderTask({})

    expect(screen.queryByRole('button', { name: 'Взяти в роботу' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Виконано' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Відкласти' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Нотатка' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Не актуально' })).toBeNull()
  })

  it('renders only the explicitly granted task action', () => {
    renderTask({ canComplete: true })

    expect(screen.getByRole('button', { name: 'Виконано' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Взяти в роботу' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Відкласти' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Нотатка' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Не актуально' })).toBeNull()
  })
})

describe('offer action permissions', () => {
  it('does not expose edit, delete or extend actions without their exact rights', () => {
    const offer: ClientShoppingCart = {
      NetUid: '11111111-1111-4111-8111-111111111111',
      OfferProcessingStatus: OFFER_PROCESSING_STATUS.PartiallyProcessed,
    }

    renderOffer(offer, {})

    expect(screen.queryByLabelText('Видалити')).toBeNull()
    expect(screen.queryByLabelText('Перезапустити')).toBeNull()
    expect(screen.queryByLabelText('Причини')).toBeNull()
  })

  it('renders delete independently from the other offer mutations', () => {
    const offer: ClientShoppingCart = {
      NetUid: '11111111-1111-4111-8111-111111111111',
      OfferProcessingStatus: OFFER_PROCESSING_STATUS.PartiallyProcessed,
    }

    renderOffer(offer, { canDelete: true })

    expect(screen.getByLabelText('Видалити')).not.toBeNull()
    expect(screen.queryByLabelText('Перезапустити')).toBeNull()
    expect(screen.queryByLabelText('Причини')).toBeNull()
  })
})

function renderTask(overrides: Partial<TaskPermissionProps>) {
  const task: CockpitTask = {
    task_key: 'task-1',
    status: 'open',
    title: 'Подзвонити клієнту',
  }

  const permissions: TaskPermissionProps = {
    canAddNote: false,
    canComplete: false,
    canDismiss: false,
    canSnooze: false,
    canTakeInProgress: false,
    ...overrides,
  }

  return renderWithTheme(
    <TaskCard
      {...permissions}
      task={task}
      onAddNote={noTaskAction}
      onDismiss={noTaskAction}
      onDone={noTaskAction}
      onSnooze={noTaskAction}
      onTakeInProgress={noTaskAction}
    />,
  )
}

function renderOffer(
  offer: ClientShoppingCart,
  overrides: Partial<OfferPermissionProps>,
) {
  const permissions: OfferPermissionProps = {
    canDelete: false,
    canEdit: false,
    canExtendValidity: false,
    ...overrides,
  }

  return renderWithTheme(
    <OfferCard
      {...permissions}
      expanded={false}
      offer={offer}
      onCopyLink={vi.fn()}
      onDelete={vi.fn()}
      onOpenItemReason={vi.fn()}
      onOpenReason={vi.fn()}
      onRestart={vi.fn()}
      onToggle={vi.fn()}
    />,
  )
}

function renderWithTheme(node: React.ReactNode) {
  return render(<MantineProvider theme={theme}>{node}</MantineProvider>)
}

type TaskPermissionProps = {
  canAddNote: boolean
  canComplete: boolean
  canDismiss: boolean
  canSnooze: boolean
  canTakeInProgress: boolean
}

type OfferPermissionProps = {
  canDelete: boolean
  canEdit: boolean
  canExtendValidity: boolean
}
