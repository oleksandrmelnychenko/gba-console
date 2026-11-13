export function formatMonthLabel(value: string | null | undefined): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])(?:-\d{2})?(?:T.*)?$/.exec(value ?? '')
  return match ? `${match[2]}.${match[1]}` : value ?? ''
}
