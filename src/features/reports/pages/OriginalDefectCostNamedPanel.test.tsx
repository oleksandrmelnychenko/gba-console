import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readDefectCost, readDefectCostChoices } from '../api/originalDefectCostApi'
import { defectCostRequest, type DefectCostChoicesResult } from '../data/originalDefectCost'
import { defectCostCapability, defectCostChoices, defectCostResponse, defectDivision, defectArticle, namedDefectCost } from '../testing/originalDefectCostFixtures'
import { OriginalDefectCostPanel } from './OriginalDefectCostPanel'
vi.mock('../api/originalDefectCostApi', () => ({ readDefectCost: vi.fn(), readDefectCostChoices: vi.fn() }))
const panel = (caller: string | null = 'caller1', allowed = true) => <MantineProvider env="test"><I18nProvider><OriginalDefectCostPanel capability={defectCostCapability}
  callerKey={caller} canGenerate={allowed} initialFrom="2026-09-10" initialThrough="2026-09-12" /></I18nProvider></MantineProvider>
async function load() { fireEvent.click(screen.getByRole('button', { name: 'Завантажити назви' })); await waitFor(() => expect((screen.getByRole('combobox', { name: 'Підрозділи' }) as HTMLInputElement).disabled).toBe(false)) }
async function select(label: string, option: string) { fireEvent.click(screen.getByRole('combobox', { name: label })); fireEvent.click(await screen.findByRole('option', { name: option })) }
it('enables typed selectors only after both current named families and submits their exact witness', async () => {
  vi.clearAllMocks(); vi.mocked(readDefectCostChoices).mockImplementation(async request => defectCostChoices(request)); vi.mocked(readDefectCost).mockImplementation(async request => namedDefectCost(request))
  render(panel()); await load(); await select('Підрозділи', 'Цех'); await select('Статті витрат', 'Потери')
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); const table = await screen.findByRole('table')
  expect(within(table).getAllByText('Цех').length).toBeGreaterThan(0); expect(within(table).getByText('Потери')).toBeTruthy()
  expect(vi.mocked(readDefectCost).mock.calls[0][0]).toMatchObject({ Divisions: [defectDivision], CostArticles: [defectArticle], NamedChoicesWitnessSha256: 'd'.repeat(64) })
  expect(vi.mocked(readDefectCostChoices).mock.calls[0][0]).toMatchObject({ Divisions: [], CostArticles: [], Measures: ['НачОст', 'Приход', 'Расход', 'КонОст'] })
})
it('optional money columns retain canonical names while a selection edit clears completed exports', async () => {
  vi.clearAllMocks(); vi.mocked(readDefectCostChoices).mockImplementation(async request => defectCostChoices(request)); vi.mocked(readDefectCost).mockImplementation(async request => namedDefectCost(request))
  render(panel()); await load(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  await select('Показники', 'Початковий залишок · ПДВ'); expect(screen.queryByRole('table')).toBeNull(); expect(readDefectCostChoices).toHaveBeenCalledTimes(1)
  expect((screen.getByRole('combobox', { name: 'Підрозділи' }) as HTMLInputElement).disabled).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table'); await select('Підрозділи', 'Цех')
  expect(screen.queryByRole('table')).toBeNull(); expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(true)
})
it('complete empty choices are available without synthetic options while missing names keep unfiltered amounts', async () => {
  vi.clearAllMocks(); vi.mocked(readDefectCostChoices).mockImplementationOnce(async request => ({ ...defectCostChoices(request), Choices: { Подразделение: [], СтатьяЗатрат: [] } }))
    .mockImplementationOnce(async request => ({ ...defectCostChoices(request), Available: false, NamedChoicesWitnessSha256: null, MissingFamilies: ['Подразделение', 'СтатьяЗатрат'],
      Choices: { Подразделение: [], СтатьяЗатрат: [] }, Dependency: { Kind: 'named_catalogue_publication_unavailable', MissingMonth: null } }))
  vi.mocked(readDefectCost).mockResolvedValue(defectCostResponse()); render(panel()); await load()
  await screen.findByText('Назви перевірено. Для цього періоду немає доступних варіантів відбору.')
  fireEvent.click(screen.getByRole('button', { name: 'Завантажити назви' })); await screen.findByText(/Назви підрозділів або статей витрат ще недоступні/)
  expect((screen.getByRole('combobox', { name: 'Підрозділи' }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table'); expect(vi.mocked(readDefectCost).mock.calls[0][0].Divisions).toEqual([])
})
it('caller ABA replacement aborts old named requests and late names cannot enable selectors', async () => {
  vi.clearAllMocks(); let finish!: (result: DefectCostChoicesResult) => void
  vi.mocked(readDefectCostChoices).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Завантажити назви' })); await waitFor(() => expect(readDefectCostChoices).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readDefectCostChoices).mock.calls[0][1]; view.rerender(panel('caller2')); view.rerender(panel('caller1')); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(defectCostChoices(defectCostRequest(defectCostCapability, '2026-09-10', '2026-09-12'))) })
  expect((screen.getByRole('combobox', { name: 'Підрозділи' }) as HTMLInputElement).disabled).toBe(true); expect(screen.queryByRole('option', { name: 'Цех' })).toBeNull()
})
it('a current name reload clears prior selected scope and rejects the old completed result', async () => {
  vi.clearAllMocks(); vi.mocked(readDefectCostChoices).mockImplementationOnce(async request => defectCostChoices(request))
    .mockImplementationOnce(async request => { const next = defectCostChoices(request); next.NamedChoicesWitnessSha256 = 'e'.repeat(64); next.Choices.Подразделение[0].Caption = 'Новый цех'; return next })
  vi.mocked(readDefectCost).mockImplementation(async request => { const result = namedDefectCost(request);
    if (request.NamedChoicesWitnessSha256 === 'e'.repeat(64)) { result.NamedChoicesWitnessSha256 = request.NamedChoicesWitnessSha256; result.Choices.Подразделение[0].Caption = 'Новый цех'; result.Rows[0].Caption = 'Новый цех' }
    return result }); render(panel()); await load(); await select('Підрозділи', 'Цех')
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table'); await load()
  expect(screen.queryByRole('table')).toBeNull(); expect((screen.getByRole('button', { name: 'XLSX' }) as HTMLButtonElement).disabled).toBe(true)
  await select('Підрозділи', 'Новый цех'); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readDefectCost).toHaveBeenCalledTimes(2))
  expect(vi.mocked(readDefectCost).mock.calls[1][0]).toMatchObject({ Divisions: [defectDivision], NamedChoicesWitnessSha256: 'e'.repeat(64) })
})
it('absent permission or caller prevents named choice loading and generation', () => {
  vi.clearAllMocks(); const view = render(panel('caller1', false)); fireEvent.click(screen.getByRole('button', { name: 'Завантажити назви' })); expect(readDefectCostChoices).not.toHaveBeenCalled()
  view.rerender(panel(null)); fireEvent.click(screen.getByRole('button', { name: 'Завантажити назви' })); expect(readDefectCostChoices).not.toHaveBeenCalled(); expect(readDefectCost).not.toHaveBeenCalled()
})
