export const publishedReportTabs = [
  { key: 'responsibles', title: 'Продажі за відповідальними' },
  { key: 'movement', title: 'Рух товару' },
] as const
export type PublishedReportTab = typeof publishedReportTabs[number]['key']
