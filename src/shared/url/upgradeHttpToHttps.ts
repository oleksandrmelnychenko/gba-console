export function upgradeHttpToHttps(url: string | null | undefined): string {
  if (!url) {
    return ''
  }

  if (typeof window === 'undefined' || window.location.protocol !== 'https:') {
    return url
  }

  return url.indexOf('http://') === 0 ? 'https://' + url.substring(7) : url
}
