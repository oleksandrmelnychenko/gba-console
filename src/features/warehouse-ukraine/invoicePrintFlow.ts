/**
 * Prints a warehouse document and only then records it as printed. The «Роздруковано» flag used to be set before the
 * document was generated, so a failed print left the invoice marked printed with no way back.
 */
export async function printThenPersistStatus({
  loadDocument,
  persistStatus,
  requiresStatusUpdate,
}: {
  /** Resolves true when the document was generated and offered to the user. */
  loadDocument: () => Promise<boolean>
  persistStatus: () => Promise<boolean>
  requiresStatusUpdate: boolean
}): Promise<void> {
  const printed = await loadDocument()

  if (printed && requiresStatusUpdate) {
    await persistStatus()
  }
}

const CYRILLIC = /[Ѐ-ӿ]/

/** A print failure for the user: the server text when it is Ukrainian, otherwise the given Ukrainian fallback. */
export function printFailureMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : ''

  return message && CYRILLIC.test(message) ? message : fallback
}
