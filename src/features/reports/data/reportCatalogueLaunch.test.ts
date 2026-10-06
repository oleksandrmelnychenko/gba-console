import { describe, expect, it } from 'vitest'
import type { ReportCatalogue, ReportDataset } from '../types'
import { catalogueLaunchOptions, isOneCTurnoverCatalogueChoice, resolveCatalogueLaunch } from './reportCatalogueLaunch'
import { migrationFixture } from './reportMigration.test-fixtures'
import { currentDebtDataset, grossDataset, lotDataset, netDataset, placementDataset, purchaseDataset, stockDataset } from './reportDatasets.test-fixtures'
import { paymentDataset } from './paymentComparison.test-fixtures'
import { buyerShareDataset } from './buyerSalesShare.test-fixtures'
import { marginDataset } from './marginComparison.test-fixtures'
import { rateDataset } from './rateComparison.test-fixtures'
import { returnDataset } from './returnComparison.test-fixtures'
import { revenueDataset } from './revenueComparison.test-fixtures'
import { salesXyzDataset } from './salesXyz.test-fixtures'
import { priceTypeSalesComparisonDataset } from './priceTypeSalesComparison.test-fixtures'
import { accountBalanceDataset } from './accountBalances.test-fixtures'
import { importedPaymentsDataset } from './importedPayments.test-fixtures'
import { datasetConfigurationError } from './reportDatasets'

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
  it.each([
    ['builtin:ВаловаяПрибыль', '65fb1537-c992-4962-9f97-5d9f96b9a034', 35, [3, 4], [2, 3, 4, 6, 7, 8, 10, 12, 14, 15], [0, 1, 2, 6, 9]],
    ['builtin:ОтчетВпаривание', '069dfc76-74b6-491d-b039-f7fb54e0ea81', 36, [5], [80, 81, 82], [1, 5]],
    ['builtin:ВаловаяПрибыльПоПоставщикам', 'f84e7b02-b6fe-40ca-bc7f-ea508d6ec41a', 38, [73, 4, 21], [0, 2, 3, 4, 6, 7, 8, 10, 12, 14], [0, 17]],
  ] as const)('opens bounded BUG-1274 Fenix native slice %s with its exact groups', (reportId, sourceId, source, rows, measures, filters) => {
    const dataset: ReportDataset = { DataSource: source, Name: reportId, Description: 'Зріз GBA',
      PeriodRequired: true, PeriodSupported: true, Limitations: [],
      Groupings: rows.map(Type => ({ Type, Name: String(Type) })),
      Measurements: measures.map(Type => ({ Type, Name: String(Type) })),
      Filters: filters.map(Type => ({ Type, Name: String(Type) })),
    }
    const catalogue = fixture([reportId, sourceId], [source], ['fenix'])
    const options = catalogueLaunchOptions(catalogue, reportId, [dataset])
    expect(options).toHaveLength(1)
    const result = open(catalogue, dataset)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.message)
    expect(result.template.Data.sorted.Row.map(item => item.type)).toEqual(rows)
    expect(result.notice).toContain('Часткове покриття GBA')
    expect(catalogueLaunchOptions(catalogue, reportId, [{ ...dataset, Groupings: [] }])).toEqual([])
  })

  it('opens only the exact Fenix gross-profit source in the dedicated panel', () => {
    const identity = ['builtin:ВаловаяПрибыль', '65fb1537-c992-4962-9f97-5d9f96b9a034'] as const
    const catalogue = fixture(identity, [1], ['fenix'])
    const options = catalogueLaunchOptions(catalogue, identity[0], [])
    expect(options.map(option => option.choice.world)).toEqual(['fenix'])
    expect(options[0].label).toBe('Консолідований оборот 1С')
    expect(isOneCTurnoverCatalogueChoice(catalogue, options[0].choice)).toBe(true)
    expect(isOneCTurnoverCatalogueChoice(catalogue, { ...options[0].choice, world: 'amg' })).toBe(false)
    expect(isOneCTurnoverCatalogueChoice(catalogue, { ...options[0].choice, sourceId: 'wrong' })).toBe(false)
    catalogue.Reports[0].Sources[0].Migration!.NativeDataSources = []
    expect(catalogueLaunchOptions(catalogue, identity[0], [])).toEqual([])
  })

  it.each([
    ['builtin:АнализСкидокНаценокНоменклатуры', '0ac4605f-8ff9-4d0e-b694-8bdc55dc485a', 23, [57, 55, 53], [64], 'discountMarkup', 'DateEnd'],
    ['builtin:ПредоставленныеСкидки', 'fa0ec96c-9345-4faf-8e35-747fc5f8e679', 24, [57, 55, 53], [65, 66], 'providedDiscounts', null],
    ['builtin:ОтчетПоСкидкам', '56e2ad4b-9f75-4461-a742-eb54ae01823f', 25, [55, 53, 62, 58], [64], 'discountMarkup', 'DateEnd'],
    ['builtin:АнализЦен', '991292be-2c3a-41cd-a32f-26467b589a1f', 28, [68, 69], [72, 73], 'priceAnalysis', 'AsOf'],
  ] as const)('binds the exact source world for specialized catalogue report %s', (reportId, sourceId, source, rows, measures, key, dateKey) => {
    const worlds = source === 28 ? ['fenix'] : ['amg', 'fenix']
    const dataset: ReportDataset = { DataSource: source, Name: 'Спеціальний звіт 1С', Description: 'Локальні дані',
      PeriodRequired: source === 24, PeriodSupported: source === 24, Limitations: [], Filters: [],
      Groupings: rows.map(Type => ({ Type, Name: String(Type) })),
      Measurements: measures.map(Type => ({ Type, Name: String(Type) })),
      [key]: { Version: 1, SourceWorlds: source === 28 ? [1] : [1, 2],
        ...(source === 28 ? { CoverageStatus: 'native_partial', AgreementPricingSupported: false, RecommendationEligible: false } : {}) },
    }
    const catalogue = fixture([reportId, sourceId], [source], worlds)
    const options = catalogueLaunchOptions(catalogue, reportId, [dataset])
    expect(options).toHaveLength(worlds.length)
    if (dateKey) expect(options[0].notice).toContain('Вкажіть дату стану')
    const result = open(catalogue, dataset)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.message)
    expect((result.template.Data as unknown as Record<string, unknown>)[key]).toMatchObject({ SourceWorld: worlds[0] === 'amg' ? 2 : 1 })
    expect(result.template.Data.sorted.Row.map(item => item.type)).toEqual(rows)
    expect(result.template.Data.sorted.Measurements.map(item => item.Type)).toEqual(measures)
    if (dateKey) expect(result.template.Data.from).toBe('')
    else expect(result.template.Data.from).toBe(period.from)
  })

  it('offers both explicit worlds and current debt by currency/client/exact agreement without historical dates', () => {
    const catalogue = fixture(), before = structuredClone(catalogue)
    const options = catalogueLaunchOptions(catalogue, debt[0], [currentDebtDataset])
    expect(options.map(option => option.choice.world)).toEqual(['amg', 'fenix'])
    const result = open(catalogue, currentDebtDataset)
    expect(result).toMatchObject({ ok: true, title: 'Знайомий звіт 1С', template: { Name: 'Знайомий звіт 1С', Data: {
      dataSource: 10, from: '', to: '', selections: [], sorted: { Row: [{ type: 36 }, { type: 12 }, { type: 15 }], Col: [], Measurements: [{ Type: 23 }] },
    } } })
    if (!result.ok) throw new Error(result.message)
    expect(result.notice).toContain('повна відповідність первинному звіту не підтверджена')
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
    ['builtin:АнализОстатковДенежныхСредствПоДням', '2c5251d4-80f7-4c2d-bc6a-449ef0fcc6e9', accountBalanceDataset],
    ['builtin:ВедомостьПартииТоваровНаСкладахВесовойУчет', '614bb6c2-8932-48ba-a099-162aadead2e2', lotDataset],
    ['builtin:ДвиженияДенежныхСредств', 'ecd83b31-5546-4832-bd65-daea9ef61431', importedPaymentsDataset],
    ['builtin:ДебиторскаяЗадолженностьПоИнтервалам', 'a9e8721c-8b9a-4145-8a78-2ee4495c1528', currentDebtDataset],
    ['builtin:ЗадолженностьДиаграмма', 'f0433565-4e50-4480-92b1-8955b8f4deb9', currentDebtDataset],
    ['builtin:НаличиеПроданныхТоваровЗаПериод', '798e67f3-60cc-446a-9dee-c72c2a31fffc', stockDataset],
    ['builtin:ОстаткиДенежныхСредствДиаграмма', 'dea7fe07-af34-40f1-b8cc-58ff90b29539', accountBalanceDataset],
    ['builtin:ПросроченнаяЗадолженностьПоСрокамДолга', '9dc84c04-db69-4684-8a0e-ee86dd77c454', currentDebtDataset],
    ['builtin:СравнительныйАнализДвиженияДенежныхСредств', '438b0286-b34b-419f-83ea-90b997bac6ee', importedPaymentsDataset],
    ['builtin:СтоимостнаяОценкаСкладаВЦенахНоменклатуры', '5356b590-bc98-49ab-b406-ca86b82ba7f5', stockDataset],
  ] as const)('keeps native scope explicit for %s', (reportId, sourceId, dataset) => {
    const catalogue = fixture([reportId, sourceId], [dataset.DataSource])
    const result = open(catalogue, dataset)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.notice).toContain('Часткове покриття GBA')
  })

  it.each([
    ['builtin:ГрафикЗакупокПродажНоменклатуры', 'aea10fb6-b60b-451d-94db-78870bef2a7f', purchaseDataset],
    ['builtin:ГрафикЗакупокПродажНоменклатуры', 'aea10fb6-b60b-451d-94db-78870bef2a7f', grossDataset],
    ['builtin:ПланФактныйАнализЗакупок', '6e29b8f4-04ab-4bb5-afca-f94305bd6e32', purchaseDataset],
    ['builtin:ПланФактныйАнализПродаж', '973ca751-f6ba-4853-982f-3df673cd57a8', grossDataset],
    ['builtin:ПродажиДиаграмма', 'cdffe709-2fc4-41fa-b4d1-6b908277a701', netDataset],
  ] as const)('opens only a named native actual-data slice for %s and dataset %s', (reportId, sourceId, dataset) => {
    const catalogue = fixture([reportId, sourceId], [dataset.DataSource])
    expect(open(catalogue, dataset).ok).toBe(true)
  })

  it('opens the exact Fenix sales comparison by global price type', () => {
    const catalogue = fixture(['builtin:ПродажиСравнениеПоТипуЦен', '5543ce7d-61fa-45e2-8b85-5cd40abaccb6'], [27], ['fenix'])
    const result = open(catalogue, priceTypeSalesComparisonDataset)
    expect(result).toMatchObject({ ok: true, template: { Data: { dataSource: 27 } } })
    if (!result.ok) throw new Error(result.message)
    expect(result.notice).toContain('глобальним типом ціни')
    expect(result.notice).toContain('локальне покриття Fenix')
    expect(result.notice).toContain('повна відповідність первинному звіту не підтверджена')
    const incomplete = structuredClone(priceTypeSalesComparisonDataset)
    incomplete.priceTypeSalesComparison = undefined
    expect(catalogueLaunchOptions(catalogue, catalogue.Reports[0].Id, [incomplete])).toEqual([])
    expect(catalogueLaunchOptions(fixture(custom('0xabe8005056c0000811e03e97ca0bd65d'), [27], ['fenix']),
      'custom:fenix:0xabe8005056c0000811e03e97ca0bd65d', [priceTypeSalesComparisonDataset])).toEqual([])
  })

  it('opens captured ABC sales with fixed product grain and explicit percentages', () => {
    const dataset: ReportDataset = { DataSource: 26, Name: '1С: ABC-аналіз продажів', Description: 'ABC за товаром',
      Groupings: [{ Type: 46, Name: 'ABC-клас' }, { Type: 5, Name: 'Товар' }],
      Measurements: [{ Type: 4, Name: 'Виручка з ПДВ' }, { Type: 2, Name: 'Виручка без ПДВ' }],
      Filters: [{ Type: 1, Name: 'Товар' }, { Type: 2, Name: 'Група товару' }], Limitations: [], PeriodRequired: true,
      PeriodSupported: true, AbcClassification: { Version: 1, MaximumRules: 1, Axes: [1], GeneratedGrouping: 46,
        GroupingTypes: [5], RankingMeasures: [4, 2], PercentMinimum: 0, PercentMaximum: 100, PercentScale: 0,
        PercentTotal: 100, Scope: 'CapturedOneCProductScope', ClassBasis: 'AscendingCumulativeIncludingCurrentWithRoundedCentThresholds',
        UnknownScores: 'Reject', NegativeScores: 'Preserve', TotalsScope: 'AllRetainedFacts', TieBreak: 'TypedKeyAscending' } }
    const catalogue = fixture(['builtin:ABCАнализПродаж', '87d9f899-0eef-4879-ba0f-f76dcbf5ad93'], [26])
    const body = data(catalogue, dataset)
    expect(body.sorted.Row.map(item => item.type)).toEqual([46, 5])
    expect(body.sorted.Measurements.map(item => item.Type)).toEqual([4, 2])
    expect(body.abcClassification).toMatchObject({ Grouping: 5, Measure: 4, PercentA: 80, PercentB: 15, PercentC: 5 })
    expect(datasetConfigurationError(body, dataset)).toBeNull()
  })

  it.each([
    ['builtin:АнализДоступностиДенежныхСредств', '0742f621-fa58-46bb-9819-e4bc51a03f14', accountBalanceDataset, [45, 44, 41, 40], [24]],
    ['builtin:АнализОстатковПартийТоваровНаСкладах', 'a820d1c6-3eb2-4283-9aa2-de7e80ad0c42', lotDataset, [34, 29, 28], [20]],
    ['builtin:АнализОстатковТоваровНаСкладах', '5ec8b517-58d5-4309-9d31-381d89acdcad', stockDataset, [29, 28], [17, 18, 19]],
    ['builtin:ВедомостьВзаиморасчетыСКонтрагентами', '8fde42fc-6e49-4a8e-9096-74bbe14fe901', currentDebtDataset, [36, 12, 15], [23]],
  ] as const)('opens the bounded current server slice for %s in both worlds', (reportId, sourceId, dataset, rows, measures) => {
    const catalogue = fixture([reportId, sourceId], [dataset.DataSource])
    expect(catalogueLaunchOptions(catalogue, reportId, [dataset])).toHaveLength(2)
    const body = data(catalogue, dataset)
    expect(body.sorted.Row.map(item => item.type)).toEqual(rows)
    expect(body.sorted.Measurements.map(item => item.Type)).toEqual(measures)
    expect(body.from).toBe('')
    expect(body.to).toBe('')
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

  it('offers return-only only with the server capability and retains its bounded request', () => {
    const catalogue = fixture(['builtin:ОтчетПоВозвратам', '0ec7344c-690f-4b13-af08-78b26a0f13f3'], [2])
    expect(catalogueLaunchOptions(catalogue, catalogue.Reports[0].Id, [netDataset])).toEqual([])
    const capable = { ...netDataset, returnsOnly: true }
    expect(catalogueLaunchOptions(catalogue, catalogue.Reports[0].Id, [capable])).toHaveLength(2)
    const body = data(catalogue, capable)
    expect(body.returnsOnly).toBe(true)
    expect(body.sorted.Row.map(item => item.type)).toEqual([12, 5, 3])
    expect(body.sorted.Measurements.map(item => item.Type)).toEqual([0])
    expect(datasetConfigurationError(body, capable)).toBeNull()
    expect(datasetConfigurationError({ ...body, sorted: { ...body.sorted, Row: body.sorted.Row.slice(0, 2) } }, capable)).toContain('лише повернень')
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
