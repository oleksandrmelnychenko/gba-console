import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ApiError } from '../../../shared/api/apiClient'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { netDataset, reportDatasets } from '../data/reportDatasets.test-fixtures'
import { DAY_ORGANIZATION_GOODS_KIND_ID, DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS } from '../data/dayOrganizationGrossProfit'
import { FENIX_BUYERS_ROOT_ID } from '../data/nativeExactFilters'
import type { ReportDataset } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened, document }: { opened: boolean; document?: { DocumentURL?: string } }) =>
    opened ? <div role="dialog" aria-label="Файли сформованого звіту">{document?.DocumentURL}</div> : null,
}))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))

function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}

const productClassification = {
  Version: 1, SourceWorld: 0, ProductKindId: '8AB2005056C0000811DEF956DA4CFDA0', IsService: false,
}
const sourceOrganizations = {
  Version: 1, SourceWorld: 'fenix', OrganizationIds: ['00000000000000000000000000000002', '00000000000000000000000000000001'],
}
const dayDataset: ReportDataset = {
  DataSource: 35, Name: 'Валовий прибуток GBA за днем та організацією', Description: 'Проведені продажі',
  PeriodRequired: true, PeriodSupported: true,
  Groupings: [3, 4].map(Type => ({ Type, Name: `Група ${Type}` })),
  Measurements: [2, 3, 4, 6, 7, 8, 10, 12, 14, 15].map(Type => ({ Type, Name: `Показник ${Type}` })),
  Filters: [0, 1, 2, 6, 9].map(Type => ({ Type, Name: `Фільтр ${Type}` })),
  productClassification: netDataset.productClassification,
  sourceOrganizations: netDataset.sourceOrganizations,
  dayOrganizationBasis: { Version: 1, DefaultBasis: 0, Bases: [0, 1], OperationalMaximumDays: 31,
    SignedRegisterMaximumDays: 1, LegacyInferenceWhenAbsent: true },
  sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID,
    RequiresCompletePeriodLineage: true, UsesCurrentCapturedHierarchy: true },
  Limitations: [],
}
const supplierDataset: ReportDataset = {
  DataSource: 38, Name: 'Валовий прибуток GBA за постачальниками (партії)', Description: 'Партії продажів',
  PeriodRequired: true, PeriodSupported: true,
  Groupings: [73, 4, 21].map(Type => ({ Type, Name: `Група ${Type}` })),
  Measurements: [0, 2, 3, 4, 6, 7, 8, 10, 12, 14].map(Type => ({ Type, Name: `Показник ${Type}` })),
  Filters: [0, 1, 17].map(Type => ({ Type, Name: `Фільтр ${Type}` })),
  supplierSourceWorld: { Version: 1, SourceWorlds: [0, 1], RequiresCompletePeriodLineage: true },
  sourceBuyerSubtree: dayDataset.sourceBuyerSubtree,
  Limitations: [],
}
const ordinarySupplierDataset: ReportDataset = {
  ...supplierDataset, Groupings: [73, 78, 4, 21].map(Type => ({ Type, Name: `Група ${Type}` })),
  supplierBasis: { Version: 1, DefaultBasis: 0, Bases: [0, 1], MaximumDays: 31,
    IncludesReturns: true, PreservesUnavailableValues: true, RegistrarWarehouseGrouping: 78 },
}

function savedTemplate() {
  const data = defaultDatasetRequest(netDataset, '2026-07-01', '2026-07-31')
  return { Id: crypto.randomUUID(), Revision: 4, Name: 'Daily exact', Data: {
    ...data, ProductClassification: structuredClone(productClassification),
    SourceOrganizations: structuredClone(sourceOrganizations),
  } }
}

async function ready() {
  const view = render(<Providers><ReportsStocksPage consoleScope={false} /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  return view
}

async function applySaved() {
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: /Daily exact/ }))
}

describe('exact Fenix filters in the report constructor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
    vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: (template.Revision ?? 0) + 1 }))
  })

  it('submits and updates a saved exact scope without exposing an unproved free-text editor', async () => {
    const template = savedTemplate()
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    const { container } = await ready()
    await applySaved()

    expect(screen.queryByRole('textbox', { name: /Fenix|виду товару|організацій джерела/i })).toBeNull()
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({
      dataSource: 2, productClassification, sourceOrganizations,
    })
    expect(vi.mocked(createStockReport).mock.calls[0][0]).not.toHaveProperty('ProductClassification')
    expect(vi.mocked(createStockReport).mock.calls[0][0]).not.toHaveProperty('SourceOrganizations')

    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0]).toMatchObject({ Id: template.Id, Revision: 4, Data: {
      productClassification, sourceOrganizations,
    } })
  })

  it('refuses an invalid exact scope before replacing the current constructor', async () => {
    const template = savedTemplate()
    template.Data.SourceOrganizations = { ...sourceOrganizations, SourceWorld: 'Fenix' }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    await ready()
    await applySaved()

    expect(screen.getByText(/Некоректний точний відбір організацій Fenix/)).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Набір даних звіту' }) as HTMLInputElement).value).toBe(reportDatasets[0].Name)
    expect(createStockReport).not.toHaveBeenCalled()
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })

  it('selects the saved XLS Goods and non-service scope without typing a source ID', async () => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dayDataset])
    const { container } = await ready()
    fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
    fireEvent.click(await screen.findByRole('option', { name: dayDataset.Name }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Товар без послуг (Fenix)' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'П’ять організацій зі збереженого налаштування 1С' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Група «Покупці» Fenix' }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({
      dataSource: 35, dayOrganizationBasis: 0,
      productClassification: { Version: 1, SourceWorld: 0,
        ProductKindId: DAY_ORGANIZATION_GOODS_KIND_ID, IsService: false },
      sourceOrganizations: { Version: 1, SourceWorld: 'fenix',
        OrganizationIds: [...DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS] },
      sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID },
    })
  })

  it('opens the VP workbook with all three retained filters and lets the user change that scope before submission', async () => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dayDataset])
    const { container } = await ready()
    fireEvent.click(screen.getByText('Часткові форми за зразками Excel'))
    fireEvent.click(screen.getByRole('button', { name: 'Відкрити часткову форму: Валовий прибуток за днем' }))
    expect((screen.getByRole('checkbox', { name: 'Товар без послуг (Fenix)' }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('checkbox', { name: 'П’ять організацій зі збереженого налаштування 1С' }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('checkbox', { name: 'Група «Покупці» Fenix' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('До'), { target: { value: '2026-09-30' } })
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({
      dataSource: 35, dayOrganizationBasis: 0, from: '2026-09-01', to: '2026-09-30',
      productClassification: { Version: 1, SourceWorld: 0, ProductKindId: DAY_ORGANIZATION_GOODS_KIND_ID, IsService: false },
      sourceOrganizations: { Version: 1, SourceWorld: 'fenix', OrganizationIds: [...DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS] },
      sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Група «Покупці» Fenix' }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    expect(vi.mocked(createStockReport).mock.calls[1][0]).not.toHaveProperty('sourceBuyerSubtree')
    expect(vi.mocked(createStockReport).mock.calls[1][0]).toMatchObject({
      productClassification: { Version: 1, SourceWorld: 0, ProductKindId: DAY_ORGANIZATION_GOODS_KIND_ID, IsService: false },
      sourceOrganizations: { Version: 1, SourceWorld: 'fenix', OrganizationIds: [...DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS] },
    })
  })


  it('keeps new requests compatible when the server has no basis capability', async () => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, { ...dayDataset, dayOrganizationBasis: undefined }])
    const { container } = await ready()
    fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
    fireEvent.click(await screen.findByRole('option', { name: dayDataset.Name }))
    expect(screen.queryByRole('combobox', { name: 'Розрахунок валового прибутку' })).toBeNull()
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).not.toHaveProperty('dayOrganizationBasis')
  })

  it.each([null, 1])('loads and updates saved basis %s without replacing it with the new default', async basis => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dayDataset])
    const data = defaultDatasetRequest(dayDataset, '2026-07-01', '2026-07-01')
    delete data.dayOrganizationBasis
    data.DayOrganizationBasis = basis
    data.productClassification = structuredClone(productClassification)
    data.sourceOrganizations = structuredClone(sourceOrganizations)
    data.sourceBuyerSubtree = { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID }
    const template = { Id: crypto.randomUUID(), Revision: 2, Name: 'Daily exact', Data: data }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    const { container } = await ready()
    await applySaved()
    expect((screen.getByRole('combobox', { name: 'Розрахунок валового прибутку' }) as HTMLInputElement).value)
      .toBe(basis === 1 ? 'Продажі з поверненнями за день' : 'Збережений спосіб розрахунку')
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].dayOrganizationBasis).toBe(basis)
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    const saved = vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data
    expect(saved.dayOrganizationBasis).toBe(basis)
    expect(saved).not.toHaveProperty('DayOrganizationBasis')
  })

  it('removes the previous file when the calculation changes and refuses an unsupported signed period before HTTP', async () => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dayDataset])
    vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/period-sales.xlsx' }, raw: {} })
    const { container } = await ready()
    fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
    fireEvent.click(await screen.findByRole('option', { name: dayDataset.Name }))
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-07-01' } })
    fireEvent.change(screen.getByLabelText('До'), { target: { value: '2026-07-31' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Товар без послуг (Fenix)' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'П’ять організацій зі збереженого налаштування 1С' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Група «Покупці» Fenix' }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].dayOrganizationBasis).toBe(0)
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('combobox', { name: 'Розрахунок валового прибутку' }))
    fireEvent.click(screen.getByRole('option', { name: 'Продажі з поверненнями за день' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(container.querySelector('form')!)
    expect(createStockReport).toHaveBeenCalledOnce()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-07-31' } })
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    expect(vi.mocked(createStockReport).mock.calls[1][0]).toMatchObject({
      dataSource: 35, dayOrganizationBasis: 1, from: '2026-07-31', to: '2026-07-31',
    })
  })

  it('explains a 409 without an authored message as missing coverage for day profit', async () => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dayDataset])
    vi.mocked(createStockReport).mockResolvedValueOnce({ document: { DocumentURL: '/files/previous.xlsx' }, raw: {} })
      .mockRejectedValueOnce(new ApiError('Не вдалося виконати запит', 409, null))
    const { container } = await ready()
    fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
    fireEvent.click(await screen.findByRole('option', { name: dayDataset.Name }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Товар без послуг (Fenix)' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'П’ять організацій зі збереженого налаштування 1С' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Група «Покупці» Fenix' }))
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    await screen.findByRole('dialog')
    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => expect(screen.getAllByRole('alert').some(node =>
      node.textContent?.includes('Сервер не підтвердив повноту даних для цього звіту'))).toBe(true))
    expect(screen.queryByText('Не вдалося виконати запит')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('preserves the server coverage explanation when the 409 has a Message', async () => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dayDataset])
    const reason = 'Період звіту 1С ще не завантажено повністю для цих відборів.'
    vi.mocked(createStockReport).mockRejectedValue(new ApiError(reason, 409, { Message: reason }))
    const { container } = await ready()
    fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
    fireEvent.click(await screen.findByRole('option', { name: dayDataset.Name }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Товар без послуг (Fenix)' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'П’ять організацій зі збереженого налаштування 1С' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Група «Покупці» Fenix' }))
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => expect(screen.getAllByRole('alert').some(node =>
      node.textContent?.includes(reason))).toBe(true))
    expect(screen.queryByText(/Сервер не підтвердив повноту даних для цього звіту/)).toBeNull()
  })

  it('shows the exact authored supplier return refusal without an export file', async () => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, supplierDataset])
    const refusal = 'За період є повернення продажів; прибуток за постачальниками без підтвердженої обробки повернень не сформовано.'
    vi.mocked(createStockReport).mockRejectedValue(new ApiError(refusal, 400, { Message: refusal }))
    const { container } = await ready()
    fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
    fireEvent.click(await screen.findByRole('option', { name: supplierDataset.Name }))
    fireEvent.submit(container.querySelector('form')!)

    expect(await screen.findByText(refusal)).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('starts a new supplier form with returns, registrar warehouse and unavailable-value guidance', async () => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, ordinarySupplierDataset])
    const { container } = await ready()
    fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
    fireEvent.click(await screen.findByRole('option', { name: supplierDataset.Name }))
    expect((screen.getByRole('combobox', { name: 'Розрахунок за постачальниками' }) as HTMLInputElement).value)
      .toBe('Продажі мінус повернення')
    expect(screen.getAllByText(/Недоступні собівартість і прибуток залишаються порожніми, зокрема у підсумках/).length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-07-01' } })
    fireEvent.change(screen.getByLabelText('До'), { target: { value: '2026-07-31' } })
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    const submitted = vi.mocked(createStockReport).mock.calls[0][0]
    expect(submitted).toMatchObject({ dataSource: 38, supplierBasis: 0, from: '2026-07-01', to: '2026-07-31' })
    expect((screen.getByRole('checkbox', { name: 'Кількість продажів мінус повернення' }) as HTMLInputElement).checked).toBe(true)
    expect(submitted.sorted.Row.map(field => field.type)).toEqual([78, 4, 21])
  })

  it.each([undefined, null, 1])('preserves saved supplier basis %s and receipt layout on submit and update', async basis => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, ordinarySupplierDataset])
    const data = defaultDatasetRequest(supplierDataset, '2026-07-01', '2026-07-31')
    if (basis !== undefined) data.SupplierBasis = basis
    const template = { Id: crypto.randomUUID(), Revision: 2, Name: 'Daily exact supplier saved', Data: data }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    const { container } = await ready()
    await applySaved()
    expect((screen.getByRole('combobox', { name: 'Розрахунок за постачальниками' }) as HTMLInputElement).value)
      .toBe(basis === 1 ? 'Продажі за партіями без повернень' : 'Збережений спосіб розрахунку')
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    const submitted = vi.mocked(createStockReport).mock.calls[0][0]
    expect(submitted.supplierBasis).toBe(basis)
    expect((screen.getByRole('checkbox', { name: 'Кількість за регістром собівартості 1С' }) as HTMLInputElement).checked).toBe(true)
    expect(submitted.sorted.Row.map(field => field.type)).toEqual([73, 4, 21])
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    const updated = vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data
    expect(updated.supplierBasis).toBe(basis)
    expect(updated).not.toHaveProperty('SupplierBasis')
    if (basis === undefined) expect(updated).not.toHaveProperty('supplierBasis')
    expect(updated.sorted.Row.map(field => field.type)).toEqual([73, 4, 21])
  })

  it('switches a saved receipt calculation to registrar warehouse only after an explicit ordinary selection', async () => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, ordinarySupplierDataset])
    const data = defaultDatasetRequest(supplierDataset, '2026-07-01', '2026-07-31')
    data.selections = [{ IsChecked: true, SelectedField: { Type: 17, Name: 'Постачальник' },
      FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [{ Data: { Id: '9007199254740993' }, Name: 'Постачальник', Value: 0 }] }]
    vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 1, Name: 'Daily exact supplier saved', Data: data }])
    vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/legacy-supplier.xlsx' }, raw: {} })
    const { container } = await ready()
    await applySaved()
    fireEvent.submit(container.querySelector('form')!)
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('combobox', { name: 'Розрахунок за постачальниками' }))
    fireEvent.click(screen.getByRole('option', { name: 'Продажі мінус повернення' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    const submitted = vi.mocked(createStockReport).mock.calls[1][0]
    expect(submitted.supplierBasis).toBe(0)
    expect((screen.getByRole('checkbox', { name: 'Кількість продажів мінус повернення' }) as HTMLInputElement).checked).toBe(true)
    expect(submitted.sorted.Row.map(field => field.type)).toEqual([78, 4, 21])
    expect(submitted.selections).toEqual(data.selections)
  })

  it('sends the exact Buyers subtree with Fenix for supplier gross profit', async () => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, supplierDataset])
    const { container } = await ready()
    fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
    fireEvent.click(await screen.findByRole('option', { name: supplierDataset.Name }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Група «Покупці» Fenix' }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({
      dataSource: 38, supplierSourceWorld: 0,
      sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID },
    })
  })

  it.each(['AMG', 'Обидві бази'])('clears the Fenix Buyers filter when supplier world changes to %s', async world => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, supplierDataset])
    const { container } = await ready()
    fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
    fireEvent.click(await screen.findByRole('option', { name: supplierDataset.Name }))
    const buyers = screen.getByRole('checkbox', { name: 'Група «Покупці» Fenix' }) as HTMLInputElement
    fireEvent.click(buyers)
    expect(buyers.checked).toBe(true)
    fireEvent.click(screen.getByRole('combobox', { name: 'База продажів для прибутку за постачальниками' }))
    fireEvent.click(screen.getByRole('option', { name: world }))
    expect(buyers.checked).toBe(false)
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    const request = vi.mocked(createStockReport).mock.calls[0][0]
    expect(request.supplierSourceWorld).toBe(world === 'AMG' ? 1 : undefined)
    expect(request.sourceBuyerSubtree).toBeUndefined()
  })

  it('selecting Buyers after AMG selects Fenix before submitting the supplier report', async () => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, supplierDataset])
    const { container } = await ready()
    fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
    fireEvent.click(await screen.findByRole('option', { name: supplierDataset.Name }))
    fireEvent.click(screen.getByRole('combobox', { name: 'База продажів для прибутку за постачальниками' }))
    fireEvent.click(screen.getByRole('option', { name: 'AMG' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Група «Покупці» Fenix' }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({
      dataSource: 38, supplierSourceWorld: 0,
      sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID },
    })
  })

  it.each([73, 78])('keeps supplier exclusion and original AND/OR indices for warehouse axis %s', async axis => {
    const dataset: ReportDataset = { ...supplierDataset,
      Groupings: [73, 78, 4, 21].map(Type => ({ Type, Name: `Група ${Type}` })),
      FilterExpression: { Version: 1, MaximumDepth: 8, MaximumLeaves: 64,
        MaximumNodes: 128, Operators: [1, 2] },
    }
    const data = defaultDatasetRequest(dataset, '2026-09-05', '2026-09-05')
    data.sorted.Row[0].type = axis
    data.selections = [301, 302].map((id, index) => ({ IsChecked: index !== 0,
      SelectedField: { Type: 1, Name: 'Товар' }, FilterCondition: { Type: 0, Name: 'Дорівнює' },
      Values: [{ Data: { Id: String(id) }, Name: `Товар ${id}`, Value: 0 }] }))
    data.selections.push({ IsChecked: true, SelectedField: { Type: 17, Name: 'Постачальник' },
      FilterCondition: { Type: 1, Name: 'Не дорівнює' },
      Values: [{ Data: { Id: '9007199254740993' }, Name: 'Постачальник', Value: 0 }] })
    data.filterExpression = { Version: 1, Root: { Kind: 1, Children: [
      { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 1 }] },
      { Kind: 3, SelectionIndex: 2 },
    ] } }
    const template = { Id: crypto.randomUUID(), Revision: 4, Name: 'Daily exact supplier variant', Data: data }
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    const { container } = await ready()
    await applySaved()
    expect(screen.getByRole('button', { name: 'Очистити групи: усі умови через І' })).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    const submitted = vi.mocked(createStockReport).mock.calls[0][0]
    expect(submitted.sorted.Row.map(group => group.type)).toEqual([axis, 4, 21])
    expect(submitted.selections).toEqual(data.selections)
    expect(submitted.filterExpression).toEqual(data.filterExpression)
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data).toEqual(submitted)
  })
})
