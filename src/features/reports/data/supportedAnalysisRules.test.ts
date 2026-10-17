import { expect, it } from 'vitest'
import { supportedAnalysisRules } from './supportedAnalysisRules'
import { defaultDatasetRequest } from './reportDatasets'
import { profitDayDataset } from './profitReadMode.test-fixtures'

it('hides every rule the dataset does not offer and the request does not carry', () => {
  const data = defaultDatasetRequest(profitDayDataset, '2026-09-01', '2026-09-30')
  expect(supportedAnalysisRules(data, profitDayDataset)).toEqual({ topGroups: false, threshold: false, abc: false, ordering: false, filterExpression: false })
})

it('keeps a rule that a saved request already carries so it can still be cleared', () => {
  const data = { ...defaultDatasetRequest(profitDayDataset, '2026-09-01', '2026-09-30'), ordering: { Version: 1 } }
  expect(supportedAnalysisRules(data, profitDayDataset).ordering).toBe(true)
})
