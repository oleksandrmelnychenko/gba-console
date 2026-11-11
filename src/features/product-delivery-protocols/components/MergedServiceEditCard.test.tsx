import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MergedService } from '../detailTypes'
import { MergedServiceEditCard } from './MergedServiceEditCard'

const mocks = vi.hoisted(() => ({
  getUnifiedServiceEditResponsibleUsers: vi.fn(),
  getSupplyServiceConsumableProducts: vi.fn(),
  searchUnifiedServiceEditSupplyOrganizations: vi.fn(),
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

vi.mock('../api/protocolDetailApi', () => ({
  getUnifiedServiceEditResponsibleUsers: mocks.getUnifiedServiceEditResponsibleUsers,
  getSupplyServiceConsumableProducts: mocks.getSupplyServiceConsumableProducts,
  searchUnifiedServiceEditSupplyOrganizations: mocks.searchUnifiedServiceEditSupplyOrganizations,
}))

const requiredLabel = (label: string) => new RegExp(`^${label}(?: \\*)?$`)
const getInput = (label: string) => screen.getAllByLabelText(requiredLabel(label)).find(
  (element) => element.tagName === 'INPUT',
) as HTMLInputElement

const service: MergedService = {
  ConsumableProduct: { Name: 'Послуга', NetUid: 'product-1' },
  GrossPrice: 100,
  Number: 'INV-1',
  SupplyOrganization: {
    Name: 'Постачальник',
    NetUid: 'supplier-1',
    SupplyOrganizationAgreements: [
      { Currency: { Code: 'UAH' }, Name: 'Договір', NetUid: 'agreement-1' },
    ],
  },
  SupplyOrganizationAgreement: { Currency: { Code: 'UAH' }, Name: 'Договір', NetUid: 'agreement-1' },
  SupplyPaymentTask: { GrossPrice: 100, User: null },
}

describe('MergedServiceEditCard validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUnifiedServiceEditResponsibleUsers.mockReturnValue(new Promise(() => {}))
    mocks.getSupplyServiceConsumableProducts.mockReturnValue(new Promise(() => {}))
    mocks.searchUnifiedServiceEditSupplyOrganizations.mockResolvedValue([])
  })

  it('labels all three empty document pickers for the reported logistics service', () => {
    render(
      <MantineProvider>
        <MergedServiceEditCard
          isSaving={false}
          opened
          service={{
            ...service,
            NetUid: '1060ed12-6b4f-4684-80f1-a55c28dfa5f6',
            Number: '888',
            Name: '6546544545455',
            GrossPrice: 1000,
            AccountingGrossPrice: 1500,
            InvoiceDocuments: [],
            SupplyServiceAccountDocument: null,
            ActProvidingServiceDocument: null,
            SupplyPaymentTask: null,
          }}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      </MantineProvider>,
    )

    for (const label of ['Рахунок', 'Акт надання послуг', 'Інші файли']) {
      const picker = screen.getByRole('button', { name: label })
      expect(within(picker).getByText('Оберіть файл')).toBeTruthy()
    }
    expect(screen.getAllByText('Оберіть файл')).toHaveLength(3)
    expect(getInput('Номер інвойса').value).toBe('888')
  })

  it('shows selected filenames, restores hints after clearing and saves files in their categories', () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <MantineProvider>
        <MergedServiceEditCard
          isSaving={false}
          opened
          service={{
            ...service,
            SupplyPaymentTask: null,
            InvoiceDocuments: [{ NetUid: 'existing-document', FileName: 'existing.pdf', DocumentUrl: 'https://example.com/existing.pdf' }],
          }}
          onClose={vi.fn()}
          onSave={onSave}
        />
      </MantineProvider>,
    )
    const labels = ['Рахунок', 'Акт надання послуг', 'Інші файли']
    const selectedFiles = labels.map((_, index) => new File(['document'], `document-${index}.pdf`, { type: 'application/pdf' }))
    const inputs = container.querySelectorAll('input[type="file"]')
    expect(inputs).toHaveLength(3)

    selectedFiles.forEach((file, index) => {
      fireEvent.change(inputs[index], { target: { files: [file] } })
      const picker = screen.getByRole('button', { name: labels[index] })
      expect(within(picker).getByText(file.name)).toBeTruthy()
      expect(within(picker).queryByText('Оберіть файл')).toBeNull()
    })

    const clearButtons = container.querySelectorAll('.mantine-FileInput-root .mantine-CloseButton-root')
    expect(clearButtons).toHaveLength(3)
    clearButtons.forEach((button) => fireEvent.click(button))
    expect(screen.getAllByText('Оберіть файл')).toHaveLength(3)

    selectedFiles.forEach((file, index) => {
      fireEvent.change(inputs[index], { target: { files: [file] } })
    })
    expect(screen.getByRole('link', { name: 'existing.pdf' }).getAttribute('href')).toBe('https://example.com/existing.pdf')
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave.mock.calls[0][1]).toEqual({
      accountDocuments: [selectedFiles[0]],
      actDocuments: [selectedFiles[1]],
      files: [selectedFiles[2]],
      taskDocuments: [],
      accountingTaskDocuments: [],
    })
    expect(onSave.mock.calls[0][0].InvoiceDocuments).toEqual([
      expect.objectContaining({ NetUid: 'existing-document', Deleted: false }),
    ])
  })

  it('shows the agreement currency and automatic fallback on both rate overrides', () => {
    render(
      <MantineProvider>
        <MergedServiceEditCard
          isSaving={false}
          opened
          service={service}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      </MantineProvider>,
    )

    const managementRate = screen.getByLabelText('Курс управлінських витрат (UAH = 1)') as HTMLInputElement
    const accountingRate = screen.getByLabelText('Курс бухгалтерських витрат (UAH = 1)') as HTMLInputElement

    expect(managementRate.getAttribute('placeholder')).toBe('Автоматично за офіційним курсом')
    expect(accountingRate.getAttribute('placeholder')).toBe('Автоматично за офіційним курсом')
    expect(screen.getAllByText(/Договір у гривні: автоматичний курс дорівнює 1/)).toHaveLength(2)
    expect(document.getElementById(managementRate.getAttribute('aria-describedby') || '')?.textContent).toContain('Договір у гривні')
    expect(document.getElementById(accountingRate.getAttribute('aria-describedby') || '')?.textContent).toContain('Договір у гривні')
  })

  it('blocks save and identifies a conditionally required task user', () => {
    const onSave = vi.fn()
    render(
      <MantineProvider>
        <MergedServiceEditCard
          isSaving={false}
          opened
          service={service}
          onClose={vi.fn()}
          onSave={onSave}
        />
      </MantineProvider>,
    )

    expect(screen.queryByText('Заповніть хоча б одну вартість: управлінську або бухгалтерську')).toBeNull()
    const responsible = getInput('Відповідальний')
    expect(responsible.getAttribute('aria-required')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(responsible.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getAllByText('Вкажіть відповідального за платіжну задачу')).toHaveLength(2)

    fireEvent.change(getInput('Назва'), { target: { value: 'Оновлена назва' } })

    expect(responsible.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Вкажіть відповідального за платіжну задачу')).toBeTruthy()
  })

  it('allows saving without a type', () => {
    const onSave = vi.fn()
    render(
      <MantineProvider>
        <MergedServiceEditCard
          isSaving={false}
          opened
          service={{ ...service, ConsumableProduct: null, SupplyPaymentTask: null }}
          onClose={vi.fn()}
          onSave={onSave}
        />
      </MantineProvider>,
    )

    const type = getInput('Тип')
    expect(type.getAttribute('aria-required')).not.toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave.mock.calls[0][0].ConsumableProduct).toBeNull()
    expect(screen.queryByText('Оберіть тип')).toBeNull()
  })
})
