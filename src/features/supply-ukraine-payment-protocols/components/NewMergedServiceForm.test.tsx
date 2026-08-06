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

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, opened }: { children: ReactNode; footer?: ReactNode; opened: boolean }) => opened ? (
    <div>
      {children}
      {footer}
    </div>
  ) : null,
}))

vi.mock('../api/paymentProtocolsApi', () => ({
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

describe('supply-ukraine NewMergedServiceForm validation', () => {
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
    const name = getInput('Назва')
    const invoice = getInput('Номер інвойса')

    for (const field of [supplier, agreement, name, invoice]) {
      expect(field.getAttribute('aria-required')).toBe('true')
    }
    expect(screen.getByText('Заповніть хоча б одну вартість: управлінську або бухгалтерську')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(onSubmit).not.toHaveBeenCalled()
    for (const field of [supplier, agreement, name, invoice]) {
      expect(field.getAttribute('aria-invalid')).toBe('true')
    }
    expect(screen.getByText('Оберіть постачальника послуг')).toBeTruthy()
    expect(screen.getByText('Оберіть договір')).toBeTruthy()
    expect(screen.getByText('Вкажіть назву')).toBeTruthy()
    expect(screen.getByText('Вкажіть номер інвойса')).toBeTruthy()
  })

  it('keeps errors beside other invalid fields while one field is corrected', () => {
    renderForm()
    const supplier = getInput('Постачальник послуг')
    const invoice = getInput('Номер інвойса')

    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    fireEvent.change(invoice, { target: { value: 'INV-1' } })

    expect(invoice.getAttribute('aria-invalid')).not.toBe('true')
    expect(supplier.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Оберіть постачальника послуг')).toBeTruthy()

    fireEvent.change(invoice, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(invoice.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Вкажіть номер інвойса')).toBeTruthy()
  })

  it('marks payment fields as required only when a positive gross cost will create a task', () => {
    renderForm()
    const grossPrice = getInput('Вартість Брутто')
    const payToDate = getInput('Сплатити до')
    const responsible = getInput('Відповідальний за оплату')

    expect(payToDate.getAttribute('aria-required')).toBe('false')
    expect(responsible.getAttribute('aria-required')).toBe('false')

    fireEvent.change(grossPrice, { target: { value: '10' } })

    expect(payToDate.getAttribute('aria-required')).toBe('true')
    expect(responsible.getAttribute('aria-required')).toBe('true')
  })
})
