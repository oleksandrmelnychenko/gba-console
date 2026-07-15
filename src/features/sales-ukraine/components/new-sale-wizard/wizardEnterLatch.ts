export type WizardEnterLatch = {
  isLatched: () => boolean
  release: () => void
  tryAcquire: () => boolean
}

export function createWizardEnterLatch(): WizardEnterLatch {
  let latched = false

  return {
    isLatched: () => latched,
    release() {
      latched = false
    },
    tryAcquire() {
      if (latched) {
        return false
      }

      latched = true

      return true
    },
  }
}
