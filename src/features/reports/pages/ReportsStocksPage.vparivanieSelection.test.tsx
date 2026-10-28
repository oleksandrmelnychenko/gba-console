import { MantineProvider } from "@mantine/core"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import { I18nProvider } from "../../../shared/i18n/I18nProvider"
import { PageHeaderActionsProvider, PageSubmenuActionsSlot } from "../../../shared/ui/page-header-actions/PageHeaderActions"
import { getReportDatasets, getServerReportTemplates } from "../api/reportWorkspaceApi"
import { previewStockReport, searchDatasetReportValues } from "../api/reportsApi"
import { searchAnalysisValues } from "../api/currentVparivanieAnalysisApi"
import { analysisDataset } from "../data/currentVparivanieAnalysis.test-fixtures"
import hierarchy from "../data/currentVparivanieAnalysis.hierarchy-capability-fixture.json"
import { profitDayDataset } from "../data/profitReadMode.test-fixtures"
import { changeReportPeriod } from "../testing/reportPeriod"
import { findOpenedWorkbook } from "../testing/workbookDesk"
import { ReportsStocksPage } from "./ReportsStocksPage"

vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock("../api/reportWorkspaceApi", async original => ({ ...await original<typeof import("../api/reportWorkspaceApi")>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock("../api/reportsApi", async original => ({ ...await original<typeof import("../api/reportsApi")>(),
  previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock("../api/currentVparivanieAnalysisApi", async original => ({ ...await original<typeof import("../api/currentVparivanieAnalysisApi")>(),
  searchAnalysisValues: vi.fn(), getAnalysisHierarchyStatus: vi.fn().mockResolvedValue({ productGroup: null, counterpartyGroup: null, warehouseGroup: null }) }))
const dataset = { ...analysisDataset, currentVparivanie: { ...analysisDataset.currentVparivanie as object, analysis: hierarchy } }
const choices = [
  { field: 21, label: "Склад", id: "id:2962", name: "Автопарк Конкорд [2962]", data: { Id: 2962 } },
  { field: 1, label: "Номенклатура", id: "id:38182879", name: "Акумулятор RITAR RT1270 [38182879]", data: { Id: 38182879 } },
  { field: 5, label: "Контрагент", id: "id:630804", name: "AMG CONCORD LLC [630804]", data: { Id: 630804 } },
  { field: 60, label: "Основний менеджер покупця", id: "EC8D2243AED0D54794502E1DAFA56A68", name: "Administrator Local [10193]", data: { Id: "EC8D2243AED0D54794502E1DAFA56A68" } },
]
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([profitDayDataset, dataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(searchAnalysisValues).mockImplementation(async field => choices.filter(choice => choice.field === field))
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: {
    Version: 1, ResultSha256: "a".repeat(64), PresentationOnly: true, Request: null,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
    RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [],
  } })
})
async function open() {
  render(<MantineProvider env="test"><I18nProvider><PageHeaderActionsProvider>
    <PageSubmenuActionsSlot /><ReportsStocksPage consoleScope />
  </PageHeaderActionsProvider></I18nProvider></MantineProvider>)
  await findOpenedWorkbook("ВП.xls")
  fireEvent.click(screen.getByRole("button", { name: "Особливі звіти" }))
  fireEvent.click(await screen.findByRole("menuitem", { name: "Аналіз залишків і продажів" }))
  await findOpenedWorkbook("Впарювання.xls")
  await waitFor(() => expect(screen.getByRole("button", { name: "Особливі звіти" })).toHaveProperty("disabled", false))
}
it("shows only selection settings on the exact special-report menu launch and after reset", async () => {
  await open()
  expect(screen.getByRole("group", { name: "Фільтри" })).toBeTruthy()
  for (const name of ["Показники", "Групування"]) expect(screen.queryByRole("group", { name })).toBeNull()
  expect(screen.queryByText("Додатково", { selector: "summary" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Скинути" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "Особливі звіти" })).toHaveProperty("disabled", false))
  for (const name of ["Показники", "Групування"]) expect(screen.queryByRole("group", { name })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Додати умову" }))
  fireEvent.click(within(screen.getByRole("group", { name: "Умова відбору 1" })).getByRole("combobox", { name: "Поле" }))
  expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(choices.map(choice => choice.label))
})
it("submits all four selected identities through the existing inline sales-style controls", async () => {
  await open()
  changeReportPeriod({ from: "2026-10-01", to: "2026-10-27" })
  for (const [index, choice] of choices.entries()) {
    fireEvent.click(screen.getByRole("button", { name: "Додати умову" }))
    const row = within(screen.getByRole("group", { name: `Умова відбору ${index + 1}` }))
    fireEvent.click(row.getByRole("combobox", { name: "Поле" }))
    fireEvent.click(await screen.findByRole("option", { name: choice.label }))
    fireEvent.click(row.getByRole("combobox", { name: "Значення" }))
    fireEvent.click(await screen.findByRole("option", { name: choice.name }))
  }
  fireEvent.click(screen.getByRole("button", { name: "Застосувати й показати" }))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 39, from: "2026-10-01", to: "2026-10-27",
    selections: choices.map(choice => ({ SelectedField: { Type: choice.field }, FilterCondition: { Type: 0 }, Values: [{ Data: choice.data }] })) })
})
it("preserves the preset product group under nomenclature and accepts several exact warehouses", async () => {
  vi.mocked(searchDatasetReportValues).mockImplementation(async (source, field) => source === 39 && field === 4
    ? [{ Id: "4317", Name: "AL-KO [4317]" }] : [])
  vi.mocked(searchAnalysisValues).mockImplementation(async field => field === 21 ? [choices[0],
    { id: "id:2973", name: "Автопарк Конкорд [2973]", data: { Id: 2973 } }] : [])
  await open()
  changeReportPeriod({ from: "2026-10-01", to: "2026-10-27" })
  await waitFor(() => expect(searchAnalysisValues).toHaveBeenCalledWith(4, "", "2026-10-01", "2026-10-27", undefined, expect.any(AbortSignal)))
  const group = within(screen.getByRole("group", { name: "Умова відбору 1" }))
  expect(group.getByRole("combobox", { name: "Поле" })).toHaveProperty("value", "Номенклатура")
  expect(group.getByRole("combobox", { name: "Умова" })).toHaveProperty("value", "У групі")
  expect(group.getByText("Група: AL-KO [4317]")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Додати умову" }))
  const row = within(screen.getByRole("group", { name: "Умова відбору 2" }))
  fireEvent.click(row.getByRole("combobox", { name: "Поле" }))
  fireEvent.click(screen.getByRole("option", { name: "Склад" }))
  for (const [index, name] of [choices[0].name, "Автопарк Конкорд [2973]"].entries()) {
    fireEvent.click(row.getByRole("combobox", { name: "Значення" }))
    await waitFor(() => {
      fireEvent.click(row.getByRole("option", { name }))
      expect(row.getByRole("button", { name: `Вибрано: ${index + 1}` })).toBeTruthy()
    })
  }
  expect(row.getByRole("combobox", { name: "Умова" })).toHaveProperty("value", "У списку")
  fireEvent.click(screen.getByRole("button", { name: "Застосувати й показати" }))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(previewStockReport).mock.calls[0][0].selections).toMatchObject([
    { SelectedField: { Type: 1 }, FilterCondition: { Type: 6 }, Values: [{ Data: { kind: "productGroup", id: "4317" } }] },
    { SelectedField: { Type: 21 }, FilterCondition: { Type: 2 }, Values: [{ Data: { Id: 2962 } }, { Data: { Id: 2973 } }] },
  ])
})
