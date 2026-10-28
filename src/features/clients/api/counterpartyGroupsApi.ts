import { apiRequest } from '../../../shared/api/apiClient'

export type CounterpartyGroupNode = {
  NetUid: string
  ParentNetUid: string | null
  Key: string
  Name: string
  Code: number | null
  RegionCode: string | null
  IsSystem: boolean
  IsUngrouped: boolean
  IsFromOneC: boolean
  IsManuallyEdited: boolean
  ClientCount: number
}

export type CounterpartyGroupMember = {
  ClientNetUid: string
  Name: string
  RegionCode: string | null
  Usreou: string | null
  IsPlaced: boolean
  IsManuallyPlaced: boolean
}

export type CounterpartyGroupMemberPage = {
  Items: CounterpartyGroupMember[]
  HasMore: boolean
}

export type ClientCounterpartyGroupPlacement = {
  ClientNetUid: string
  GroupNetUid: string
  GroupName: string
  GroupPath: string
  IsPlaced: boolean
  IsManuallyPlaced: boolean
}

export type CounterpartyGroupDraft = {
  ParentNetUid: string | null
  Name: string
  RegionCode: string | null
}

const BASE = '/clients/counterparty-groups'
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null)

const guid = (value: unknown): string | null => (typeof value === 'string' && GUID.test(value) ? value : null)

export function toCounterpartyGroupNode(value: unknown): CounterpartyGroupNode | null {
  if (!record(value)) return null
  const netUid = guid(value.NetUid)
  const name = text(value.Name)
  const key = text(value.Key)
  if (!netUid || name === null || !key) return null
  return {
    NetUid: netUid,
    ParentNetUid: guid(value.ParentNetUid),
    Key: key,
    Name: name,
    Code: typeof value.Code === 'number' ? value.Code : null,
    RegionCode: text(value.RegionCode),
    IsSystem: value.IsSystem === true,
    IsUngrouped: value.IsUngrouped === true,
    IsFromOneC: value.IsFromOneC === true,
    IsManuallyEdited: value.IsManuallyEdited === true,
    ClientCount: typeof value.ClientCount === 'number' ? value.ClientCount : 0,
  }
}

function toMember(value: unknown): CounterpartyGroupMember | null {
  if (!record(value)) return null
  const clientNetUid = guid(value.ClientNetUid)
  if (!clientNetUid) return null
  return {
    ClientNetUid: clientNetUid,
    Name: text(value.Name) ?? '',
    RegionCode: text(value.RegionCode),
    Usreou: text(value.Usreou),
    IsPlaced: value.IsPlaced === true,
    IsManuallyPlaced: value.IsManuallyPlaced === true,
  }
}

export async function getCounterpartyGroupTree(signal?: AbortSignal): Promise<CounterpartyGroupNode[]> {
  const result = await apiRequest<unknown>(`${BASE}/tree`, signal ? { signal } : {})
  if (!Array.isArray(result)) throw new Error('Сервер повернув некоректний довідник груп контрагентів.')
  return result.map(toCounterpartyGroupNode).filter((node): node is CounterpartyGroupNode => node !== null)
}

export async function getCounterpartyGroupMembers(groupNetUid: string, search: string, offset: number, limit: number,
  signal?: AbortSignal): Promise<CounterpartyGroupMemberPage> {
  const result = await apiRequest<unknown>(`${BASE}/members`, {
    query: { groupNetUid, search, offset, limit },
    ...(signal ? { signal } : {}),
  })
  if (!record(result) || !Array.isArray(result.Items)) throw new Error('Сервер повернув некоректний список контрагентів групи.')
  return {
    Items: result.Items.map(toMember).filter((member): member is CounterpartyGroupMember => member !== null),
    HasMore: result.HasMore === true,
  }
}

export async function getClientCounterpartyGroup(clientNetUid: string,
  signal?: AbortSignal): Promise<ClientCounterpartyGroupPlacement | null> {
  const result = await apiRequest<unknown>(`${BASE}/client`, {
    query: { clientNetUid },
    ...(signal ? { signal } : {}),
  })
  if (!record(result)) return null
  const groupNetUid = guid(result.GroupNetUid)
  if (!groupNetUid) return null
  return {
    ClientNetUid: guid(result.ClientNetUid) ?? clientNetUid,
    GroupNetUid: groupNetUid,
    GroupName: text(result.GroupName) ?? '',
    GroupPath: text(result.GroupPath) ?? text(result.GroupName) ?? '',
    IsPlaced: result.IsPlaced === true,
    IsManuallyPlaced: result.IsManuallyPlaced === true,
  }
}

export async function createCounterpartyGroup(draft: CounterpartyGroupDraft): Promise<CounterpartyGroupNode | null> {
  return toCounterpartyGroupNode(await apiRequest<unknown>(`${BASE}/create`, { method: 'POST', body: draft }))
}

export async function updateCounterpartyGroup(netUid: string, draft: CounterpartyGroupDraft): Promise<CounterpartyGroupNode | null> {
  return toCounterpartyGroupNode(await apiRequest<unknown>(`${BASE}/update`, {
    method: 'POST',
    body: { NetUid: netUid, ...draft },
  }))
}

export async function deleteCounterpartyGroup(netUid: string): Promise<void> {
  await apiRequest<unknown>(`${BASE}/delete`, { method: 'POST', body: { NetUid: netUid } })
}

export async function moveClientsToCounterpartyGroup(clientNetUids: string[], groupNetUid: string): Promise<number> {
  const result = await apiRequest<unknown>(`${BASE}/move-clients`, {
    method: 'POST',
    body: { ClientNetUids: [...new Set(clientNetUids)], GroupNetUid: groupNetUid },
  })
  return typeof result === 'number' ? result : 0
}
