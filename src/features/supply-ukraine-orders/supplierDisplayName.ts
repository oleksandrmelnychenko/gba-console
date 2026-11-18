type SupplierLike = {
  FullName?: string
  Id?: number
  LastName?: string
  Name?: string
  NetUid?: string
  SourceAmgCode?: number | null
  SourceFenixCode?: number | null
}

export function getSupplierBaseName(supplier: SupplierLike | null | undefined): string {
  return supplier?.Name?.trim() || supplier?.FullName?.trim() || supplier?.LastName?.trim() || ''
}

export function buildSupplierDisplayNames(suppliers: Array<SupplierLike | null | undefined>): Map<string, string> {
  const names = new Map<string, string>()
  const byKey = new Map<string, SupplierLike>()

  for (const supplier of suppliers) {
    const key = getSupplierKey(supplier)

    if (supplier && key && !byKey.has(key)) {
      byKey.set(key, supplier)
    }
  }

  const byName = new Map<string, Array<[string, SupplierLike]>>()

  for (const entry of byKey.entries()) {
    const baseName = getSupplierBaseName(entry[1])
    const groupKey = baseName.toLocaleLowerCase('uk-UA')
    byName.set(groupKey, [...(byName.get(groupKey) || []), entry])
  }

  for (const group of byName.values()) {
    if (group.length === 1) {
      names.set(group[0][0], getSupplierBaseName(group[0][1]))
      continue
    }

    const codes = group.map(([, supplier]) => {
      const code = supplier.SourceFenixCode ?? supplier.SourceAmgCode

      return code === null || code === undefined ? undefined : String(code)
    })

    group.forEach(([key, supplier], index) => {
      const code = codes[index]
      const isUnique = code !== undefined && codes.filter((candidate) => candidate === code).length === 1
      const suffix = isUnique ? code : String(supplier.Id ?? supplier.NetUid ?? '')

      names.set(key, suffix ? `${getSupplierBaseName(supplier)} (${suffix})` : getSupplierBaseName(supplier))
    })
  }

  return names
}

export function getSupplierKey(supplier: SupplierLike | null | undefined): string | undefined {
  if (!supplier) {
    return undefined
  }

  if (supplier.Id !== undefined && supplier.Id !== null) {
    return `id:${supplier.Id}`
  }

  return supplier.NetUid ? `net:${supplier.NetUid.toLowerCase()}` : undefined
}
