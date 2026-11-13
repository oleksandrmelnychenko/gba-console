import type { HeadDashboardTeam } from '../types'

export function headChartManagerLabel(team: Pick<HeadDashboardTeam, 'manager_id' | 'manager_name'>, nameById: ReadonlyMap<number, string>): string {
  return nameById.get(team.manager_id) || team.manager_name?.trim() || `#${team.manager_id}`
}
