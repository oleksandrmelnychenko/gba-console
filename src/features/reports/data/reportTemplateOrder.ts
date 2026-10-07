import type { ReportTemplate } from '../types'

export type ReportTemplateOrderItem = { Id: string; Name: string; Revision: number; DisplayOrder: number }
export type ReportTemplateOrderState = { ListRevision: number; Items: ReportTemplateOrderItem[] }
export type ReportTemplateOrderCommand = { Operation: 'move_up' | 'move_down' | 'transfer' | 'sort_name_asc' | 'sort_name_desc'; Id?: string; Position?: number }
export const invalidTemplateOrder = () => new Error('Список шаблонів змінився або недоступний. Оновіть його та повторіть дію.')
const guid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i
const validId = (value: unknown): value is string => typeof value === 'string' && guid.test(value) && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value)
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

export function normalizeTemplateOrder(value: unknown): ReportTemplateOrderState {
  if (!record(value) || Object.keys(value).length !== 2 || !Number.isSafeInteger(value.ListRevision)
    || (value.ListRevision as number) < 0 || !Array.isArray(value.Items) || value.Items.length > 200) throw invalidTemplateOrder()
  const ids = new Set<string>()
  const Items = value.Items.map((item, index): ReportTemplateOrderItem => {
    if (!record(item) || Object.keys(item).length !== 4 || !validId(item.Id)
      || typeof item.Name !== 'string' || !item.Name.trim() || item.Name.length > 120 || /\p{Cc}/u.test(item.Name)
      || Array.from(item.Name).some(char => { const code = char.codePointAt(0)!; return code >= 0xd800 && code <= 0xdfff })
      || !Number.isSafeInteger(item.Revision) || (item.Revision as number) < 1 || (item.Revision as number) > 2147483647
      || item.DisplayOrder !== index + 1 || ids.has(item.Id.toLowerCase())) throw invalidTemplateOrder()
    ids.add(item.Id.toLowerCase())
    return { Id: item.Id, Name: item.Name, Revision: item.Revision as number, DisplayOrder: item.DisplayOrder as number }
  })
  return { ListRevision: value.ListRevision as number, Items }
}

/** Order summaries confer no new definition: every stored definition must match exactly. */
export function templatesInAuthoritativeOrder(templates: readonly ReportTemplate[], state: ReportTemplateOrderState): ReportTemplate[] {
  const validated = normalizeTemplateOrder(state), byId = new Map<string, ReportTemplate>()
  for (const template of templates) {
    if (!validId(template.Id) || byId.has(template.Id.toLowerCase())) throw invalidTemplateOrder()
    byId.set(template.Id.toLowerCase(), template)
  }
  if (templates.length !== validated.Items.length) throw invalidTemplateOrder()
  return validated.Items.map(item => {
    const template = byId.get(item.Id.toLowerCase())
    if (!template || template.Revision !== item.Revision || template.Name !== item.Name) throw invalidTemplateOrder()
    return template
  })
}

export function templateOrderRequest(command: ReportTemplateOrderCommand, expectedListRevision: number) {
  if (!Number.isSafeInteger(expectedListRevision) || expectedListRevision < 0 || expectedListRevision >= Number.MAX_SAFE_INTEGER)
    throw invalidTemplateOrder()
  const row = command.Operation === 'move_up' || command.Operation === 'move_down' || command.Operation === 'transfer'
  const sort = command.Operation === 'sort_name_asc' || command.Operation === 'sort_name_desc'
  if ((!row && !sort) || (row ? !validId(command.Id) : command.Id !== undefined)
    || (command.Operation === 'transfer' ? !Number.isSafeInteger(command.Position) || command.Position! < 1 || command.Position! > 200
      : command.Position !== undefined)) throw invalidTemplateOrder()
  return { Operation: command.Operation, Id: command.Id ?? null, Position: command.Position ?? null, ExpectedListRevision: expectedListRevision }
}
