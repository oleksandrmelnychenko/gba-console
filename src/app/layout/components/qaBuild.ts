const BUILD_NUMBER = /^(\d{4})\.(\d{2})\.(\d{2})\.(\d{4})$/

export function buildOrder(value: unknown): number | null {
  const match = typeof value === 'string' ? BUILD_NUMBER.exec(value.trim()) : null
  return match ? Number(match.slice(1).join('')) : null
}

/** Only a strictly later QA Desk release makes the running bundle stale; an older or unreadable one never does. */
export function isNewerBuild(remote: unknown, running: unknown): boolean {
  const next = buildOrder(remote), current = buildOrder(running)
  return next !== null && current !== null && next > current
}
