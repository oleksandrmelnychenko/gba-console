import { useCallback, useEffect, useRef, useState } from 'react'
import { formatLocalDate } from '../../../../shared/date/dateTime'
import { realtimeEvents, useRealtimeEvent } from '../../../../shared/realtime/events'
import { getSalesUkraineEditSaleStatistic, getSalesUkraineSaleAudit } from '../../../../shared/sale-audit/saleAuditApi'
import type { SalesUkraineSale } from '../../types'
import { getWizardSalesRegister, mapWizardSaleRegisterItems, WIZARD_SALE_REGISTER_STATUS_ALL,
  type WizardSaleRegisterQuery, type WizardSaleRegisterStatistic } from './wizardClientStepApi'

type RegisterRequest = { key: string; controller: AbortController; promise: Promise<void> }

export function useWizardClientSalesRegister() {
  const [registryItems, setRegistryItems] = useState<WizardSaleRegisterStatistic[]>([])
  const [isRegistryLoading, setRegistryLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState(WIZARD_SALE_REGISTER_STATUS_ALL)
  const [saleSearch, setSaleSearch] = useState('')
  const [dateFrom, setDateFrom] = useState(() => formatLocalDate(getDateDaysAgo(7)))
  const [dateTo, setDateTo] = useState(() => formatLocalDate(new Date()))
  const argsRef = useRef<WizardSaleRegisterQuery>({ clientNetId: '', from: dateFrom, to: dateTo, type: statusFilter, value: saleSearch })
  const requestRef = useRef<RegisterRequest | null>(null)
  const generationRef = useRef(0)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current)
    if (realtimeTimerRef.current !== null) clearTimeout(realtimeTimerRef.current)
    searchTimerRef.current = null
    realtimeTimerRef.current = null
  }, [])
  const retireRequest = useCallback(() => {
    generationRef.current += 1
    requestRef.current?.controller.abort()
    requestRef.current = null
  }, [])
  useEffect(() => () => { clearTimers(); retireRequest() }, [clearTimers, retireRequest])

  const resetRegister = useCallback((clientNetId = '', loading = false) => {
    clearTimers()
    retireRequest()
    argsRef.current = { ...argsRef.current, clientNetId }
    setRegistryItems([])
    setRegistryLoading(loading && Boolean(clientNetId))
  }, [clearTimers, retireRequest])

  const fetchRegister = useCallback((overrides?: Partial<WizardSaleRegisterQuery>): Promise<void> => {
    const args = { ...argsRef.current, ...overrides }
    if (!args.clientNetId || args.clientNetId !== argsRef.current.clientNetId) return Promise.resolve()
    clearTimers()
    const key = JSON.stringify([args.clientNetId, args.from, args.to, args.type, args.value.trim()])
    if (requestRef.current?.key === key) return requestRef.current.promise
    retireRequest()
    setRegistryLoading(true)
    const controller = new AbortController()
    const request: RegisterRequest = { key, controller, promise: Promise.resolve() }
    requestRef.current = request
    request.promise = (async () => {
      try {
        const items = await getWizardSalesRegister(args, controller.signal)
        if (!controller.signal.aborted) setRegistryItems(mapWizardSaleRegisterItems(items))
      } catch {
        if (!controller.signal.aborted) setRegistryItems([])
      } finally {
        if (requestRef.current === request) {
          requestRef.current = null
          setRegistryLoading(false)
        }
      }
    })()
    return request.promise
  }, [clearTimers, retireRequest])

  const handleStatusChange = useCallback((value: number) => {
    argsRef.current = { ...argsRef.current, type: value }
    setStatusFilter(value)
    setRegistryItems([])
    void fetchRegister()
  }, [fetchRegister])
  const handleSaleSearchChange = useCallback((value: string) => {
    argsRef.current = { ...argsRef.current, value }
    setSaleSearch(value)
    clearTimers()
    retireRequest()
    setRegistryLoading(Boolean(argsRef.current.clientNetId))
    searchTimerRef.current = setTimeout(() => { searchTimerRef.current = null; void fetchRegister() }, 200)
  }, [clearTimers, retireRequest, fetchRegister])
  const handleDateFromChange = useCallback((value: string) => {
    const from = value || formatLocalDate(getDateDaysAgo(7))
    argsRef.current = { ...argsRef.current, from }
    setDateFrom(from)
    void fetchRegister()
  }, [fetchRegister])
  const handleDateToChange = useCallback((value: string) => {
    const to = value || formatLocalDate(new Date())
    argsRef.current = { ...argsRef.current, to }
    setDateTo(to)
    void fetchRegister()
  }, [fetchRegister])

  const replaceRegistryRow = useCallback((statistic: WizardSaleRegisterStatistic, _autoExpand: boolean) => {
    void _autoExpand
    const netId = statistic.Sale?.NetUid
    if (!netId) return
    setRegistryItems((current) => {
      const index = current.findIndex((item) => item.Sale?.NetUid === netId)
      if (index < 0 || current[index] === statistic) return current
      const next = [...current]
      next[index] = statistic
      return next
    })
  }, [])
  const refreshRegistryRow = useCallback(async (sale: SalesUkraineSale, autoExpand: boolean, semantic: 'audit' | 'edit' = 'edit') => {
    if (!sale.NetUid) return
    const generation = generationRef.current
    const load = semantic === 'audit' ? getSalesUkraineSaleAudit : getSalesUkraineEditSaleStatistic
    const statistic = await load(sale.NetUid).catch(() => null)
    if (generationRef.current === generation && statistic?.Sale) {
      replaceRegistryRow(statistic as unknown as WizardSaleRegisterStatistic, autoExpand)
    }
  }, [replaceRegistryRow])

  const scheduleRealtimeRegister = useCallback(() => {
    if (!argsRef.current.clientNetId) return
    if (realtimeTimerRef.current !== null) clearTimeout(realtimeTimerRef.current)
    realtimeTimerRef.current = setTimeout(() => { realtimeTimerRef.current = null; void fetchRegister() }, 400)
  }, [fetchRegister])
  useRealtimeEvent(realtimeEvents.saleAdded, scheduleRealtimeRegister)
  useRealtimeEvent(realtimeEvents.saleUpdated, scheduleRealtimeRegister)

  return { registryItems, isRegistryLoading, statusFilter, saleSearch, dateFrom, dateTo, resetRegister, fetchRegister,
    handleStatusChange, handleSaleSearchChange, handleDateFromChange, handleDateToChange, replaceRegistryRow, refreshRegistryRow }
}

function getDateDaysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}
