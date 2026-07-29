import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ChangeEvent } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  getIncomeCashflowClientAgreements,
  searchIncomeCashflowClientPayers,
} from '../api/incomeCashflowsApi'
import type {
  ClientAgreement,
  IncomeCashflowRow,
} from '../types'
import { ReassignIncomeClientModal } from './IncomeCashflowsPage'

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>()
  const { createElement } = await import('react')

  return {
    ...actual,
    Autocomplete: ({
      data = [],
      disabled,
      label,
      onChange,
      onOptionSubmit,
      value,
    }: {
      data?: string[]
      disabled?: boolean
      label?: string
      onChange?: (value: string) => void
      onOptionSubmit?: (value: string) => void
      value?: string
    }) => createElement(
      'div',
      null,
      createElement('input', {
        'aria-label': label,
        disabled,
        role: 'combobox',
        value,
        onChange: (event: ChangeEvent<HTMLInputElement>) =>
          onChange?.(event.currentTarget.value),
      }),
      ...data.map((option) =>
        createElement(
          'button',
          {
            key: option,
            role: 'option',
            type: 'button',
            onClick: () => {
              onOptionSubmit?.(option)
              onChange?.(option)
            },
          },
          option,
        ),
      ),
    ),
    Select: ({
      data = [],
      disabled,
      label,
      value,
    }: {
      data?: Array<{ label: string; value: string }>
      disabled?: boolean
      label?: string
      value?: string | null
    }) => createElement(
      'div',
      null,
      createElement('input', {
        'aria-label': label,
        disabled,
        role: 'combobox',
        value: value || '',
        readOnly: true,
      }),
      ...data.map((option) =>
        createElement(
          'button',
          {
            key: option.value,
            role: 'option',
            type: 'button',
          },
          option.label,
        ),
      ),
    ),
  }
})

vi.mock('../../../shared/ui/SearchableSelect', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/ui/SearchableSelect')>()
  const { createElement } = await import('react')

  return {
    ...actual,
    SearchableSelect: ({
      data = [],
      disabled,
      label,
      onChange,
      onOptionSubmit,
      value,
    }: {
      data?: string[]
      disabled?: boolean
      label?: string
      onChange?: (value: string) => void
      onOptionSubmit?: (value: string) => void
      value?: string
    }) => createElement(
      'div',
      null,
      createElement('input', {
        'aria-label': label,
        disabled,
        role: 'combobox',
        value,
        onChange: (event: ChangeEvent<HTMLInputElement>) =>
          onChange?.(event.currentTarget.value),
      }),
      ...data.map((option) =>
        createElement(
          'button',
          {
            key: option,
            role: 'option',
            type: 'button',
            onClick: () => {
              onOptionSubmit?.(option)
              onChange?.(option)
            },
          },
          option,
        ),
      ),
    ),
  }
})

vi.mock('../api/incomeCashflowsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/incomeCashflowsApi')>(),
  getIncomeCashflowClientAgreements: vi.fn(),
  searchIncomeCashflowClientPayers: vi.fn(),
}))

const getClientAgreementsMock = vi.mocked(
  getIncomeCashflowClientAgreements,
)
const searchClientPayersMock = vi.mocked(
  searchIncomeCashflowClientPayers,
)

const row: IncomeCashflowRow = {
  id: 'income-1',
  income: {
    NetUid: 'income-1',
  },
  number: 'IN-1',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })

  return {
    promise,
    resolve,
  }
}

function renderModal() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <ReassignIncomeClientModal
          row={row}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('ReassignIncomeClientModal', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    searchClientPayersMock.mockResolvedValue([
      {
        FullName: 'Client A',
        NetUid: 'client-a',
      },
      {
        FullName: 'Client B',
        NetUid: 'client-b',
      },
    ])
  })

  it('clears edited selection and ignores stale A agreements after B is selected', async () => {
    const agreementsA = deferred<ClientAgreement[]>()
    const agreementsB = deferred<ClientAgreement[]>()

    getClientAgreementsMock.mockImplementation((netId) =>
      netId === 'client-a' ? agreementsA.promise : agreementsB.promise,
    )

    renderModal()

    const clientInput = await screen.findByRole<HTMLInputElement>(
      'combobox',
      { name: 'Клієнт' },
    )
    fireEvent.change(clientInput, { target: { value: 'Client' } })

    await waitFor(() =>
      expect(searchClientPayersMock).toHaveBeenCalledWith(
        'Client',
        expect.any(AbortSignal),
      ),
    )
    fireEvent.click(await screen.findByRole('option', { name: 'Client A' }))

    await waitFor(() =>
      expect(getClientAgreementsMock).toHaveBeenCalledWith('client-a'),
    )

    fireEvent.change(clientInput, { target: { value: 'Client' } })

    expect(
      screen.getByRole<HTMLInputElement>('combobox', { name: 'Договір' })
        .disabled,
    ).toBe(true)

    fireEvent.click(await screen.findByRole('option', { name: 'Client B' }))

    await waitFor(() =>
      expect(getClientAgreementsMock).toHaveBeenCalledWith('client-b'),
    )

    await act(async () => {
      agreementsB.resolve([
        {
          NetUid: 'agreement-b',
          Agreement: {
            Name: 'Agreement B',
          },
        },
      ])
      await agreementsB.promise
    })

    const agreementInput = screen.getByRole<HTMLInputElement>('combobox', {
      name: 'Договір',
    })
    expect(agreementInput.disabled).toBe(false)
    expect(await screen.findByRole('option', { name: 'Agreement B' })).toBeTruthy()

    await act(async () => {
      agreementsA.resolve([
        {
          NetUid: 'agreement-a',
          Agreement: {
            Name: 'Agreement A',
          },
        },
      ])
      await agreementsA.promise
    })

    expect(screen.queryByRole('option', { name: 'Agreement A' })).toBeNull()
    expect(screen.getByRole('option', { name: 'Agreement B' })).toBeTruthy()
  })
})
