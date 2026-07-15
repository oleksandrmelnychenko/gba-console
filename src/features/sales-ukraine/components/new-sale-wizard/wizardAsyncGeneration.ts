export type WizardAsyncGenerationToken = {
  context: string
  generation: number
  signal: AbortSignal
}

export type WizardAsyncGenerationGuard = {
  begin: (context: string) => WizardAsyncGenerationToken
  invalidate: () => void
  isCurrent: (token: WizardAsyncGenerationToken, currentContext: string) => boolean
}

export function createWizardAsyncGenerationGuard(): WizardAsyncGenerationGuard {
  let generation = 0
  let controller: AbortController | null = null

  return {
    begin(context) {
      controller?.abort()
      controller = new AbortController()
      generation += 1

      return { context, generation, signal: controller.signal }
    },
    invalidate() {
      generation += 1
      controller?.abort()
      controller = null
    },
    isCurrent(token, currentContext) {
      return !token.signal.aborted && token.generation === generation && token.context === currentContext
    },
  }
}
