export const publishedReportTabs = [
  { key: 'movement', title: 'Рух товару' },
] as const
export type PublishedReportTab = typeof publishedReportTabs[number]['key']
