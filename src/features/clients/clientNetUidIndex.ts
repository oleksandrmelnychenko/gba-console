type ClientNetUidItem = {
  ClientNetUid: string
}

export function clientNetUidKey(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

export function indexByClientNetUid<T extends ClientNetUidItem>(
  items: readonly T[],
): Map<string, T> {
  return new Map(
    items
      .map((item) => [clientNetUidKey(item.ClientNetUid), item] as const)
      .filter(([key]) => Boolean(key)),
  )
}
