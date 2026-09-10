import { describe, expect, it } from 'vitest'
import type { ReportCatalogue, ReportDataset } from '../types'
import { catalogueLaunchOptions, resolveCatalogueLaunch } from './reportCatalogueLaunch'
import { migrationFixture } from './reportMigration.test-fixtures'
import { currentDebtDataset, grossDataset, netDataset, placementDataset, purchaseDataset, stockDataset } from './reportDatasets.test-fixtures'
import { paymentDataset } from './paymentComparison.test-fixtures'
import { buyerShareDataset } from './buyerSalesShare.test-fixtures'
import { marginDataset } from './marginComparison.test-fixtures'
import { rateDataset } from './rateComparison.test-fixtures'
import { returnDataset } from './returnComparison.test-fixtures'
import { revenueDataset } from './revenueComparison.test-fixtures'
import { salesXyzDataset } from './salesXyz.test-fixtures'

const period = { from: '2026-06-01', to: '2026-06-30' }
const debt = ['builtin:ЗадолженностьПоКонтрагентам', '0e9ed1d2-a9c6-4865-89bc-2f25c8b7ebd3'] as const
const places = ['builtin:ОтчетПоМестамХраненияНоменклатуры', '9f693421-5a01-40b2-bf49-52d15132d3cb'] as const
const custom = (id: string) => [`custom:fenix:${id}`, id] as const
// Bounded exact catalogue identities; synthetic proof fields exercise the published manifest contract.
function fixture(identity: readonly [string, string] = debt, dataSources = [10], worlds = ['amg', 'fenix']): ReportCatalogue {
  return { CapturedOn: '2026-09-09', Presentations: [], Reports: [{ Id: identity[0], Name: identity[0], Title: 'Знайомий звіт 1С',
    Kind: identity[0].startsWith('builtin:') ? 'builtin' : 'indicator', Sources: worlds.map(World => ({
      World, SourceId: identity[1], DefinitionSha256: 'c'.repeat(64), Attributes: [],
      Migration: { ...migrationFixture('native_partial'), NativeDataSources: dataSources },
    })) }], Migration: { Version: 'launch-fixture-v1', GeneratedAtUtc: '2026-09-09T00:00:00Z', Summary: {
      CatalogueEntries: 1, SourceImplementations: worlds.length, BuiltinImplementations: identity[0].startsWith('builtin:') ? worlds.length : 0,
      FullyVerifiedEntries: 0, ByStatus: { Captured: 0, NativePartial: worlds.length, ParityVerified: 0, Unassessed: 0 },
    } } }
}
function open(catalogue: ReportCatalogue, dataset: ReportDataset, world = catalogue.Reports[0].Sources[0].World) {
  return resolveCatalogueLaunch(catalogue, { reportId: catalogue.Reports[0].Id, world,
    sourceId: catalogue.Reports[0].Sources[0].SourceId, dataSource: dataset.DataSource }, [dataset], period)
}
function data(catalogue: ReportCatalogue, dataset: ReportDataset) {
  const result = open(catalogue, dataset)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.message)
  return result.template.Data
}

describe('exact named catalogue launches', () => {
  it('offers both explicit worlds and current debt by currency/client/exact agreement without historical dates', () => {
    const catalogue = fixture(), before = structuredClone(catalogue)
    const options = catalogueLaunchOptions(catalogue, debt[0], [currentDebtDataset])
    expect(options.map(option => option.choice.world)).toEqual(['amg', 'fenix'])
    const result = open(catalogue, currentDebtDataset)
    expect(result).toMatchObject({ ok: true, title: 'Знайомий звіт 1С', template: { Name: 'Знайомий звіт 1С', Data: {
      dataSource: 10, from: '', to: '', selections: [], sorted: { Row: [{ type: 36 }, { type: 12 }, { type: 15 }], Col: [], Measurements: [{ Type: 23 }] },
    } } })
    if (!result.ok) throw new Error(result.message)
    expect(result.notice).toContain('повна відповідність звіту 1С не підтверджена')
    expect(result.template).not.toHaveProperty('Id')
    expect(result.template).not.toHaveProperty('Revision')
    expect(result.template.Data).not.toHaveProperty('oneC')
    expect(result.template.Data).not.toHaveProperty('valuationClientAgreementId')
    expect(catalogue).toEqual(before)
    expect(result.dataset).not.toBe(currentDebtDataset)
  })

  it('keeps all four exact storage world/dataset choices and revalidates selected capabilities', () => {
    const catalogue = fixture(places, [4, 5])
    const options = catalogueLaunchOptions(catalogue, places[0], [stockDataset, placementDataset])
    expect(options.map(option => [option.choice.world, option.choice.dataSource])).toEqual([['amg', 4], ['amg', 5], ['fenix', 4], ['fenix', 5]])
    expect(resolveCatalogueLaunch(catalogue, options[1].choice, [stockDataset], period).ok).toBe(false)
    expect(data(catalogue, placementDataset).sorted.Row.map(item => item.type)).toEqual([29, 30, 31, 32, 28])
  })

  it.each([
    ['0xb4b500055d78a52511ddfe606a8c1461', 1],
    ['0xb4b500055d78a52511ddfe606a8c1463', 2],
  ] as const)('fixes payment direction from exact source %s, leaving comparison period explicit', (id, Direction) => {
    const catalogue = fixture(custom(id), [21], ['fenix'])
    const body = data(catalogue, paymentDataset)
    expect(body.paymentComparison).toMatchObject({ Version: 1, Direction, From: '', To: '' })
    expect(body.sorted.Row.map(item => item.type)).toEqual([41, 12, 15])
    expect(body.sorted.Measurements.map(item => item.Type)).toEqual([59, 60, 61, 62])
    expect(body.selections).toEqual([])
    expect(body.from).toBe(period.from)
    expect(catalogueLaunchOptions(catalogue, catalogue.Reports[0].Id, [paymentDataset])[0].notice).toContain('період порівняння')
  })

  it.each([
    ['0xa6b50007e90a504c11de0990eefaedb3', [39, 40, 41, 42]],
    ['0xa6b50007e90a504c11de0990eefaedb5', [43, 44, 45, 46]],
  ] as const)('selects exactly the named buyer share %s', (id, measures) => {
    const body = data(fixture(custom(id), [17], ['fenix']), buyerShareDataset)
    expect(body.sorted.Measurements.map(item => item.Type)).toEqual(measures)
    expect(body.sorted.Row.map(item => item.type)).toEqual([12, 15])
    expect(body.buyerSalesShare).toMatchObject({ BaseResource: 4, From: '', To: '' })
  })

  it('uses margin percentages and percentage points, independently of sales or monetary margin', () => {
    const body = data(fixture(custom('0xa6b50007e90a504c11de0962351b1edd'), [20], ['fenix']), marginDataset)
    expect(body.sorted.Measurements.map(item => item.Type)).toEqual([55, 56, 57, 58])
    expect(body.marginComparison).toMatchObject({ BaseResource: 14, From: '', To: '', RoundingPolicy: 'NativeNetMarginFinalAwayFromZero2' })
  })

  it('keeps unknown currency series and both as-of dates empty', () => {
    const body = data(fixture(custom('0xb4b500055d78a52511ddfdbede3b0526'), [19], ['fenix']), rateDataset)
    expect(body).toMatchObject({ from: '', to: '', rateComparison: { RateDefinitionId: '', CurrentAsOf: '', PreviousAsOf: '' } })
    expect(body.sorted.Measurements.map(item => item.Type)).toEqual([51, 52, 53, 54])
  })

  it.each([
    [custom('0xb4b500055d78a52511ddfe9d4aaca7ff'), returnDataset, [47, 48, 49, 50]],
    [custom('0xb4b500055d78a52511ddfc172c5097fe'), revenueDataset, [35, 36, 37, 38]],
  ] as const)('uses the registered comparison resources %#', (identity, dataset, measures) => {
    expect(data(fixture(identity, [dataset.DataSource], ['fenix']), dataset).sorted.Measurements.map(item => item.Type)).toEqual(measures)
  })

  it('builds XYZ source policy without pretending the source ABC/XYZ constructor was imported', () => {
    const catalogue = fixture(['builtin:XYZABCАнализПродаж', '970aa31b-9852-4036-99ed-53aa94566304'], [15])
    const result = open(catalogue, salesXyzDataset)
    expect(result).toMatchObject({ ok: true, template: { Data: { xyz: { CalendarPolicy: 'NativeClosedCalendarMonths', PeriodCount: 3 } } } })
    if (result.ok) expect(result.notice).toContain('Перевірте повні закриті місяці')
  })

  it.each([
    ['builtin:ГрафикЗакупокНоменклатуры', '817c9f2f-ebc7-4656-a543-515931fe1bb4', purchaseDataset, [3, 5, 28], [0, 2]],
    ['builtin:ГрафикПродажНоменклатуры', 'b63e6d14-b0a8-4c33-8e91-9fb397aee4f1', netDataset, [3, 5, 28], [0, 4]],
    ['builtin:ГрафикПродажНоменклатурыПоПериодам', 'cb2964a3-59a3-431e-b3e2-fec3ab5e279f', grossDataset, [2, 5, 28], [0, 4]],
  ] as const)('opens graph source %s as an explicitly labelled table', (reportId, sourceId, dataset, rows, measures) => {
    const catalogue = fixture([reportId, sourceId], [dataset.DataSource])
    const body = data(catalogue, dataset)
    expect(body.sorted.Row.map(item => item.type)).toEqual(rows)
    expect(body.sorted.Measurements.map(item => item.Type)).toEqual(measures)
    expect(catalogueLaunchOptions(catalogue, reportId, [dataset])[0].label).toContain('Таблиця')
  })

  it('keeps sales and purchases grouped by their distinct agreement identities', () => {
    const sales = data(fixture(['builtin:Продажи', '1d3b4053-a6fa-4c32-83be-269e93f7e853'], [0]), grossDataset)
    const purchases = data(fixture(['builtin:Закупки', 'ed77c5cc-6688-4316-a631-2ad0b237140d'], [3]), purchaseDataset)
    expect(sales.sorted.Row.map(item => item.type)).toEqual([12, 15, 5, 28])
    expect(purchases.sorted.Row.map(item => item.type)).toEqual([21, 25, 5, 28])
    expect(sales.selections).toEqual([])
    expect(purchases.selections).toEqual([])
  })

  it('selects only the recorded reserve even when the mapped stock source offers other measures', () => {
    const body = data(fixture(['builtin:ТоварыВРезервеНаСкладах', '91ef0806-a3fa-4bac-be65-5614d5ef270a'], [4]), stockDataset)
    expect(body.sorted.Measurements.map(item => item.Type)).toEqual([19])
  })

  it('refuses return-only on a generic net-sales mapping with a concrete reason', () => {
    const catalogue = fixture(['builtin:ОтчетПоВозвратам', '0ec7344c-690f-4b13-af08-78b26a0f13f3'], [2])
    expect(catalogueLaunchOptions(catalogue, catalogue.Reports[0].Id, [netDataset])).toEqual([])
    expect(open(catalogue, netDataset)).toMatchObject({ ok: false, message: expect.stringContaining('лише про повернення') })
  })

  it.each(['report', 'source', 'world', 'mapping', 'summary', 'proof', 'duplicate', 'unrelated-proof'] as const)('refuses altered %s despite familiar title', change => {
    const catalogue = fixture()
    if (change === 'report') catalogue.Reports[0].Id = 'builtin:Debt'
    if (change === 'source') catalogue.Reports[0].Sources[0].SourceId = 'other'
    if (change === 'world') catalogue.Reports[0].Sources[0].World = 'other'
    if (change === 'mapping') catalogue.Reports[0].Sources[0].Migration!.NativeDataSources = [8]
    if (change === 'summary') catalogue.Migration!.Summary.SourceImplementations++
    if (change === 'proof') catalogue.Reports[0].Sources[0].Migration!.Validation!.SourceRevisionSha256 = 'd'.repeat(64)
    if (change === 'duplicate') catalogue.Reports[0].Sources.push(structuredClone(catalogue.Reports[0].Sources[0]))
    if (change === 'unrelated-proof') {
      catalogue.Reports[0].Sources[1].Migration!.Validation!.NativeRevision = 'main'
      catalogue.Migration!.Summary.ByStatus.NativePartial = 1
      catalogue.Migration!.Summary.ByStatus.Unassessed = 1
    }
    expect(open(catalogue, currentDebtDataset).ok).toBe(false)
  })

  it.each(['row', 'measure', 'disabled-row', 'disabled-measure', 'duplicate', 'dates'] as const)('does not fall back when required %s capability changes', change => {
    const dataset = structuredClone(currentDebtDataset)
    if (change === 'row') dataset.Groupings = dataset.Groupings.filter(field => field.Type !== 15)
    if (change === 'measure') dataset.Measurements = [{ Type: 24, Name: 'Інша сума' }]
    if (change === 'disabled-row') dataset.Groupings[0].Selectable = false
    if (change === 'disabled-measure') dataset.Measurements[0].Selectable = false
    if (change === 'duplicate') dataset.Measurements.push({ ...dataset.Measurements[0] })
    if (change === 'dates') dataset.PeriodSupported = true
    expect(catalogueLaunchOptions(fixture(), debt[0], [dataset])).toEqual([])
    expect(open(fixture(), dataset).ok).toBe(false)
  })

  it('rechecks specialized capability, dataset ambiguity and malformed catalogue before applying', () => {
    const catalogue = fixture(custom('0xb4b500055d78a52511ddfe606a8c1461'), [21], ['fenix'])
    const option = catalogueLaunchOptions(catalogue, catalogue.Reports[0].Id, [paymentDataset])[0]
    expect(resolveCatalogueLaunch(catalogue, option.choice, [{ ...paymentDataset, paymentComparison: undefined }], period).ok).toBe(false)
    expect(resolveCatalogueLaunch(catalogue, option.choice, [paymentDataset, paymentDataset], period).ok).toBe(false)
    expect(resolveCatalogueLaunch(null, option.choice, [paymentDataset], period).ok).toBe(false)
  })

  it('returns independent fresh settings on every launch with no shared mutation', () => {
    const catalogue = fixture(custom('0xb4b500055d78a52511ddfe606a8c1461'), [21], ['fenix'])
    const body = data(catalogue, paymentDataset)
    ;(body.paymentComparison as { Direction: number }).Direction = 2
    body.sorted.Row[0].label = 'Edited'
    body.valuationClientAgreementId = 9001
    const next = data(catalogue, paymentDataset)
    expect(next.paymentComparison).toMatchObject({ Direction: 1 })
    expect(next.sorted.Row[0].label).not.toBe('Edited')
    expect(next).not.toHaveProperty('valuationClientAgreementId')
  })
})
