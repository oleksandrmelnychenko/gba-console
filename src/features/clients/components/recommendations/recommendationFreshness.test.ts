import { expect, it } from 'vitest'
import { recommendationFreshnessNotes } from './recommendationFreshness'

it('says nothing for a fresh list', () => {
  expect(recommendationFreshnessNotes([{ RecommendationAsOfDate: '2026-11-13' }, {}])).toEqual([])
  expect(recommendationFreshnessNotes([])).toEqual([])
})

it('dates a stale list and names a degraded one', () => {
  expect(recommendationFreshnessNotes([{ RecommendationAsOfDate: '2026-11-10', RecommendationStale: true }]))
    .toEqual(['Список станом на 10.11.2026'])
  expect(recommendationFreshnessNotes([{ RecommendationDegraded: true }]))
    .toEqual(['Тимчасово показано збережений список'])
  expect(recommendationFreshnessNotes([{ RecommendationAsOfDate: '2026-11-10', RecommendationStale: true, RecommendationDegraded: true }]))
    .toEqual(['Список станом на 10.11.2026', 'Тимчасово показано збережений список'])
  expect(recommendationFreshnessNotes([{ RecommendationStale: true }])).toEqual(['Список збережено раніше'])
})
