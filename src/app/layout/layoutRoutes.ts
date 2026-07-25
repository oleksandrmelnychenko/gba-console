export function isBudgetCartRoute(pathname: string): boolean {
  return pathname.replace(/\/+$/, '') === '/basket-supply-ukraine-order/budget-cart'
}
