import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NewMergedServiceForm } from './NewMergedServiceForm'

const mocks = vi.hoisted(() => ({
  getResponsibleUsers: vi.fn(),
  getSupplyServiceConsumableProducts: vi.fn(),
  searchSupplyOrganizations: vi.fn(),
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <div>{children}</div> : null,
}))

vi.mock('../api/protocolDetailApi', () => ({
  getResponsibleUsers: mocks.getResponsibleUsers,
  getSupplyServiceConsumableProducts: mocks.getSupplyServiceConsumableProducts,
  searchSupplyOrganizations: mocks.searchSupplyOrganizations,
}))

const requiredLabel = (label: string) => new RegExp(`^${label}(?: \\*)?$`)
const getInput = (label: string) => screen.getAllByLabelText(requiredLabel(label)).find(
  (element) => element.tagName === 'INPUT',
) as HTMLInputElement

function renderForm(onSubmit = vi.fn()) {
  render(
    <MantineProvider>
      <NewMergedServiceForm
        isSaving={false}
        opened
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    </MantineProvider>,
  )

  return onSubmit
}

describe('product-delivery NewMergedServiceForm validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getResponsibleUsers.mockReturnValue(new Promise(() => {}))
    mocks.getSupplyServiceConsumableProducts.mockReturnValue(new Promise(() => {}))
    mocks.searchSupplyOrganizations.mockResolvedValue([])
  })

  it('marks static requirements and blocks submit with accessible field errors', () => {
    const onSubmit = renderForm()
    const supplier = getInput('Постачальник послуг')
    const agreement = getInput('Договір')
    const type = getInput('Тип')
    const invoice = getInput('Номер інвойса')

    for (const field of [supplier, agreement, type, invoice]) {
      expect(field.getAttribute('aria-required')).toBe('true')
    }
    expect(screen.getByText('Заповніть хоча б одну вартість: управлінську або бухгалтерську')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(onSubmit).not.toHaveBeenCalled()
    for (const field of [supplier, agreement, type, invoice]) {
      expect(field.getAttribute('aria-invalid')).toBe('true')
    }
    expect(screen.getByText('Оберіть постачальника послуг')).toBeTruthy()
    expect(screen.getByText('Оберіть договір')).toBeTruthy()
    expect(screen.getByText('Оберіть тип')).toBeTruthy()
    expect(screen.getByText('Вкажіть номер інвойса')).toBeTruthy()
  })

  it('marks conditional responsible-user fields as required when their sections are enabled', () => {
    renderForm()

    fireEvent.click(screen.getByLabelText('Доставка в межах країни'))
    expect(getInput('Відповідальний за оплату в межах країни').getAttribute('aria-required')).toBe('true')

    fireEvent.click(screen.getByLabelText('Створити платіжну задачу'))
    expect(getInput('Відповідальний').getAttribute('aria-required')).toBe('true')

    fireEvent.click(screen.getByLabelText('Створити платіжну задачу (Бух.)'))
    const responsibleFields = screen.getAllByLabelText(requiredLabel('Відповідальний')).filter(
      (element) => element.tagName === 'INPUT',
    )
    expect(responsibleFields).toHaveLength(2)
    expect(responsibleFields[1].getAttribute('aria-required')).toBe('true')
  })
})
