export const publishedReportTabs = [
  { key: 'responsibles', title: 'Знімок 1С: продажі за відповідальними' },
  { key: 'movement', title: 'Рух товару' },
] as const
export type PublishedReportTab = typeof publishedReportTabs[number]['key']
