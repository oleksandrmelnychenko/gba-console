let ownSupplyOrderEchoUntil = 0

/**
 * The page that saves an order shows its own confirmation; the server also broadcasts
 * «Оновлено замовлення» to everyone, including this tab, so one save produced two toasts.
 * Call this right before saving: the next broadcast within the window is not toasted here.
 */
export function expectOwnSupplyOrderEcho(windowMs = 8000, now = Date.now()): void {
  ownSupplyOrderEchoUntil = now + windowMs
}

export function consumeOwnSupplyOrderEcho(now = Date.now()): boolean {
  if (now < ownSupplyOrderEchoUntil) {
    ownSupplyOrderEchoUntil = 0
    return true
  }

  return false
}
