const MONTH_NAMES = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру']

export function formatMonthLabel(value: string | null | undefined): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])(?:-\d{2})?(?:T.*)?$/.exec(value ?? '')
  return match ? `${MONTH_NAMES[Number(match[2]) - 1]} ${match[1]}` : value ?? ''
}
