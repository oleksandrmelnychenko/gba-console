/** Keep intact words from a damaged source label; never guess lost letters. */
export function saleAgreementLabel(name?: string | null): string {
  if (!name) return ''
  if (!name.includes('\uFFFD')) return name.trim()
  return name.split(/\s+/u).filter(word => !word.includes('\uFFFD')).join(' ').trim() || 'Назва договору недоступна'
}

export function saleAgreementTitle(name?: string | null): string {
  const label = saleAgreementLabel(name)
  return name?.includes('\uFFFD') ? `${label} · Назва договору пошкоджена у джерелі` : label
}
