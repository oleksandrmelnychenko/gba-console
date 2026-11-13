import type { RecommendationProduct } from '../../recommendationsTypes'

export function recommendationFreshnessNotes(
  products: Pick<RecommendationProduct, 'RecommendationAsOfDate' | 'RecommendationDegraded' | 'RecommendationStale'>[],
): string[] {
  const notes: string[] = []
  const stale = products.find((product) => product.RecommendationStale)
  if (stale) {
    const iso = stale.RecommendationAsOfDate
    notes.push(iso
      ? `Список станом на ${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
      : 'Список збережено раніше')
  }
  if (products.some((product) => product.RecommendationDegraded)) {
    notes.push('Тимчасово показано збережений список')
  }
  return notes
}
