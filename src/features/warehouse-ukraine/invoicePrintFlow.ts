export async function printAfterPersistingStatus({
  loadDocument,
  persistStatus,
  requiresStatusUpdate,
}: {
  loadDocument: () => Promise<void>
  persistStatus: () => Promise<boolean>
  requiresStatusUpdate: boolean
}): Promise<void> {
  if (requiresStatusUpdate && !(await persistStatus())) {
    return
  }

  await loadDocument()
}
