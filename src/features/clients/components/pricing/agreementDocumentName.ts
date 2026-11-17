export type AgreementDocumentKind = 'contract' | 'warranty'

/** «Друк договору» and «Друк гарантійних умов» download under distinct, readable names. */
export function agreementDocumentFileBaseName(kind: AgreementDocumentKind, name: string): string {
  const prefix = kind === 'warranty' ? 'Гарантійні_умови' : 'Договір'
  const safeName = name.trim().replace(/[^\p{L}\p{N}-]+/gu, '_').replace(/^_+|_+$/g, '')

  return safeName ? `${prefix}_${safeName}` : prefix
}

export function agreementDocumentTitle(kind: AgreementDocumentKind): string {
  return kind === 'warranty' ? 'Друк гарантійних умов' : 'Друк договору'
}
