export const ACTION_LABELS: Record<string, string> = {
  discount_or_redistribute: 'Знизити ціну або перемістити запас',
  dead_stock_review: 'Перевірити залишок без продажів',
  fix_margin: 'Переглянути ціну: маржа занадто низька',
  keep_push: 'Підтримувати продажі',
  margin_review: 'Перевірити ціну та маржу',
  monitor: 'Спостерігати за товаром',
  monitor_decline: 'Перевірити причину падіння продажів',
  quality_review: 'Перевірити повернення та якість',
  reorder_check: 'Перевірити потребу в дозамовленні',
  slow_mover_review: 'Вирішити, що робити з повільним запасом',
  to_order_candidate: 'Продавати під замовлення',
}

export const REASON_LABELS: Record<string, string> = {
  dead_stock: 'Товар давно не продавався',
  declining_demand: 'Продажі знижуються',
  healthy_margin: 'Маржа на нормальному рівні',
  high_returns: 'Забагато повернень',
  negative_margin: 'Продажі приносять збиток',
  no_immediate_action: 'Термінових дій не потрібно',
  overstock: 'На складі більше, ніж потрібно',
  slow_mover: 'Товар продається повільно',
  strong_demand: 'Товар добре продається',
  strong_to_order_demand: 'Є попит, але немає запасу',
  understock: 'Запасу може не вистачити',
  unknown_margin: 'Недостатньо даних про маржу',
}
