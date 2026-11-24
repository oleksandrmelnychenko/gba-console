export const publishedReportTabs = [
  { key: 'sales-register', title: 'Звірка продажів з 1С' },
  { key: 'movement', title: 'Рух товару' },
] as const
export type PublishedReportTab = typeof publishedReportTabs[number]['key']
