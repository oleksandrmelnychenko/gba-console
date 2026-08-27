import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NewMergedServiceForm } from './NewMergedServiceForm'

const mocks = vi.hoisted(() => ({
  getUnifiedServiceCreateResponsibleUsers: vi.fn(),
  getSupplyServiceConsumableProducts: vi.fn(),
  searchUnifiedServiceCreateSupplyOrganizations: vi.fn(),
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <div>{children}</div> : null,
}))

vi.mock('../api/protocolDetailApi', () => ({
  getUnifiedServiceCreateResponsibleUsers: mocks.getUnifiedServiceCreateResponsibleUsers,
  getSupplyServiceConsumableProducts: mocks.getSupplyServiceConsumableProducts,
  searchUnifiedServiceCreateSupplyOrganizations: mocks.searchUnifiedServiceCreateSupplyOrganizations,
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
    mocks.getUnifiedServiceCreateResponsibleUsers.mockReturnValue(new Promise(() => {}))
    mocks.getSupplyServiceConsumableProducts.mockReturnValue(new Promise(() => {}))
    mocks.searchUnifiedServiceCreateSupplyOrganizations.mockResolvedValue([])
  })

  it('explains that both exchange-rate fields are optional manual overrides', () => {
    renderForm()

    const managementRate = getInput('Курс управлінських витрат')
    const accountingRate = getInput('Курс бухгалтерських витрат')
    const automaticRateHelp = 'Необов’язково. Залиште порожнім — система застосує офіційний курс на дату митної декларації, а якщо її немає — на дату створення сервісу. Введене значення буде ручним курсом.'

    expect(managementRate.getAttribute('aria-required')).not.toBe('true')
    expect(accountingRate.getAttribute('aria-required')).not.toBe('true')
    expect(managementRate.getAttribute('placeholder')).toBe('Автоматично за офіційним курсом')
    expect(accountingRate.getAttribute('placeholder')).toBe('Автоматично за офіційним курсом')
    expect(screen.getAllByText(automaticRateHelp)).toHaveLength(2)
  })

  it('marks static requirements and blocks submit with accessible field errors', () => {
    const onSubmit = renderForm()
    const supplier = getInput('Постачальник послуг')
    const agreement = getInput('Договір')
    const type = getInput('Тип')
    const invoice = getInput('Номер інвойса')

    for (const field of [supplier, agreement, invoice]) {
      expect(field.getAttribute('aria-required')).toBe('true')
    }
    expect(type.getAttribute('aria-required')).not.toBe('true')
    expect(screen.getByText('Заповніть хоча б одну вартість: управлінську або бухгалтерську')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(onSubmit).not.toHaveBeenCalled()
    for (const field of [supplier, agreement, invoice]) {
      expect(field.getAttribute('aria-invalid')).toBe('true')
    }
    expect(type.getAttribute('aria-invalid')).not.toBe('true')
    expect(screen.getByText('Оберіть постачальника послуг')).toBeTruthy()
    expect(screen.getByText('Оберіть договір')).toBeTruthy()
    expect(screen.queryByText('Оберіть тип')).toBeNull()
    expect(screen.getByText('Вкажіть номер інвойса')).toBeTruthy()
  })

  it('loads the initial supplier list and allows selecting a supplier and its agreement', async () => {
    mocks.searchUnifiedServiceCreateSupplyOrganizations.mockResolvedValueOnce([{
      Name: 'LMAX ATL SP.',
      NetUid: 'supplier-1',
      SupplyOrganizationAgreements: [
        { Currency: { Code: 'EUR' }, Name: 'Main agreement', NetUid: 'agreement-1' },
      ],
    }])
    renderForm()

    await waitFor(() => expect(mocks.searchUnifiedServiceCreateSupplyOrganizations).toHaveBeenCalledWith(''))

    const supplier = getInput('Постачальник послуг')
    fireEvent.click(supplier)
    fireEvent.click(await screen.findByText('LMAX ATL SP.'))

    expect(supplier.value).toBe('LMAX ATL SP.')

    const agreement = getInput('Договір')
    expect(agreement.disabled).toBe(false)
    fireEvent.click(agreement)
    expect(await screen.findByText('Main agreement (EUR)')).toBeTruthy()
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
