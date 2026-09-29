import { readFileSync, writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { ReportCatalogue, ReportDataset } from '../src/features/reports/types'
import { catalogueLaunchOptions, resolveCatalogueLaunch } from '../src/features/reports/data/reportCatalogueLaunch'
import { datasetConfigurationError } from '../src/features/reports/data/reportDatasets'
import { normalizeNativeExactFilterDataset } from '../src/features/reports/data/nativeExactFilters'
import { normalizePriceTypeSalesComparisonDataset } from '../src/features/reports/data/priceTypeSalesComparison'

const catalogueFile = process.env.REPORT_CATALOGUE_AUDIT_CATALOGUE
const datasetsFile = process.env.REPORT_CATALOGUE_AUDIT_DATASETS
const requestsFile = process.env.REPORT_CATALOGUE_AUDIT_REQUESTS

/** Explicit cross-repository gate; ordinary tests do not depend on a server checkout. */
it.skipIf(!catalogueFile || !datasetsFile)('matches actual server catalogue choices and exports constructor requests', () => {
  const catalogue = JSON.parse(readFileSync(catalogueFile!, 'utf8')) as ReportCatalogue
  const datasets = (JSON.parse(readFileSync(datasetsFile!, 'utf8')) as Record<string, unknown>[])
    .map(item => normalizePriceTypeSalesComparisonDataset(
      normalizeNativeExactFilterDataset(item)! as unknown as Record<string, unknown>)!) as ReportDataset[]
  const missing: string[] = []
  const generated: Array<{ reportId: string; world: string; request: unknown; configurationError: string | null }> = []
  let implementations = 0
  for (const report of catalogue.Reports) {
    const choices = catalogueLaunchOptions(catalogue, report.Id, datasets)
    for (const source of report.Sources) {
      if (source.Migration?.Status !== 'native_partial') continue
      implementations++
      if (!choices.some(option => option.choice.world === source.World && option.choice.sourceId === source.SourceId))
        missing.push(`${report.Id}:${source.World}:${source.SourceId}`)
    }
    for (const option of choices) {
      if (option.choice.dataSource === 1) continue // dedicated 1C turnover panel
      const launch = resolveCatalogueLaunch(catalogue, option.choice, datasets,
        { from: '2026-06-01', to: '2026-06-30' })
      if (!launch.ok) { missing.push(`${report.Id}:${option.choice.world}:${launch.message}`); continue }
      generated.push({ reportId: report.Id, world: option.choice.world, request: launch.template.Data,
        configurationError: datasetConfigurationError(launch.template.Data, launch.dataset) })
    }
  }
  expect(implementations).toBe(105)
  expect(missing).toEqual([])
  expect(generated).toHaveLength(124)
  expect(generated.filter(item => item.configurationError === null)).toHaveLength(106)
  expect(new Set(generated.filter(item => item.configurationError === null)
    .map(item => JSON.stringify(item.request))).size).toBe(22)
  if (requestsFile) writeFileSync(requestsFile, JSON.stringify(generated))
})
