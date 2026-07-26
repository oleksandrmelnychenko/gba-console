export type RequestToken<TKey> = {
  id: number
  key: TKey
}

export type LatestRequestGuard<TKey> = {
  finish: (token: RequestToken<TKey>) => boolean
  invalidate: () => void
  isActive: (key: TKey) => boolean
  isCurrent: (token: RequestToken<TKey>) => boolean
  start: (key: TKey) => RequestToken<TKey>
}

export function createLatestRequestGuard<TKey>(): LatestRequestGuard<TKey> {
  let nextId = 0
  let activeToken: RequestToken<TKey> | null = null

  return {
    finish(token) {
      if (activeToken !== token) {
        return false
      }

      activeToken = null
      return true
    },
    invalidate() {
      nextId += 1
      activeToken = null
    },
    isActive(key) {
      return activeToken !== null && Object.is(activeToken.key, key)
    },
    isCurrent(token) {
      return activeToken === token
    },
    start(key) {
      const token = {
        id: ++nextId,
        key,
      }

      activeToken = token
      return token
    },
  }
}
