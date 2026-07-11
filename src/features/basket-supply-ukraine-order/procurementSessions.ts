import type { ReorderSuggestion } from './procurementTypes'

// Saved procurement-constructor sessions. Persisted locally per browser for now; the
// module is the single seam — swap the four functions for a server API (per-user table)
// later without touching the UI.

export type ProcurementSessionBasketLine = { suggestion: ReorderSuggestion; qty: number }

export type ProcurementSession = {
  id: string
  name: string
  savedAt: string
  lens: 'warehouse' | 'producer'
  producerId: string | null
  draftQty: Record<number, number>
  basket: ProcurementSessionBasketLine[]
}

const STORAGE_KEY = 'gba.procurement.sessions.v1'

function readAll(): ProcurementSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)

    return Array.isArray(parsed) ? (parsed as ProcurementSession[]) : []
  } catch {
    return []
  }
}

function writeAll(sessions: ProcurementSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // storage full / disabled — best effort
  }
}

export function listSessions(): ProcurementSession[] {
  return readAll().sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export function saveSession(session: Omit<ProcurementSession, 'id' | 'savedAt'>): ProcurementSession {
  const all = readAll()
  const existing = all.find((item) => item.name === session.name)
  const record: ProcurementSession = {
    ...session,
    id: existing?.id ?? `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    savedAt: new Date().toISOString(),
  }
  const next = existing
    ? all.map((item) => (item.id === existing.id ? record : item))
    : [record, ...all]
  writeAll(next)

  return record
}

export function removeSession(id: string): void {
  writeAll(readAll().filter((item) => item.id !== id))
}
