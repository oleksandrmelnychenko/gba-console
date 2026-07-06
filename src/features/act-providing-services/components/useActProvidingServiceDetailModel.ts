import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  getActProvidingService,
  updateActProvidingService,
} from '../api/actProvidingServicesApi'
import type { ActProvidingService } from '../types'
import { toActProvidingServiceDisplayModel } from '../utils'

type ActProvidingServiceDetailState = {
  act: ActProvidingService | null
  comment: string
  error: string | null
  fromDate: string
  isDirty: boolean
  isLoading: boolean
  isSaving: boolean
}

const INITIAL_ACT_PROVIDING_SERVICE_DETAIL_STATE: ActProvidingServiceDetailState = {
  act: null,
  comment: '',
  error: null,
  fromDate: '',
  isDirty: false,
  isLoading: false,
  isSaving: false,
}

export type ActProvidingServiceDetailModel = ReturnType<typeof useActProvidingServiceDetailModel>

export function useActProvidingServiceDetailModel(id: string | undefined) {
  const { t } = useI18n()
  const [state, setState] = useValueState<ActProvidingServiceDetailState>(INITIAL_ACT_PROVIDING_SERVICE_DETAIL_STATE)
  const requestRef = useRef(0)
  const saveRequestRef = useRef(0)
  const { act, comment, error, fromDate, isDirty, isLoading, isSaving } = state
  const displayModel = useMemo(() => (act ? toActProvidingServiceDisplayModel(act, t) : null), [act, t])

  const loadAct = useCallback(() => {
    let isActive = true

    if (!id) {
      requestRef.current += 1
      setState((currentState) => ({
        ...currentState,
        act: null,
        error: t('Акт надання послуг не вибрано'),
        isLoading: false,
      }))
      return () => {
        isActive = false
      }
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setState((currentState) => ({ ...currentState, error: null, isLoading: true }))

    void getActProvidingService(id)
      .then((loadedAct) => {
        if (!isActive || requestRef.current !== requestId) {
          return
        }

        if (!loadedAct) {
          setState((currentState) => ({
            ...currentState,
            act: null,
            error: t('Обраний акт надання послуг не існує'),
            isLoading: false,
          }))
          return
        }

        setState((currentState) => ({
          ...currentState,
          act: loadedAct,
          comment: loadedAct.Comment || '',
          error: null,
          fromDate: toDateTimeLocal(loadedAct.FromDate),
          isDirty: false,
          isLoading: false,
        }))
      })
      .catch((loadError: unknown) => {
        if (isActive && requestRef.current === requestId) {
          setState((currentState) => ({
            ...currentState,
            act: null,
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити акт надання послуг'),
            isLoading: false,
          }))
        }
      })

    return () => {
      isActive = false
    }
  }, [id, setState, t])

  useEffect(() => {
    return loadAct()
  }, [loadAct])

  const updateComment = useCallback(
    (value: string) => {
      setState((currentState) => ({ ...currentState, comment: value, isDirty: true }))
    },
    [setState],
  )
  const updateFromDate = useCallback(
    (value: string) => {
      setState((currentState) => ({ ...currentState, fromDate: value, isDirty: true }))
    },
    [setState],
  )
  const save = useCallback(() => {
    if (!act) {
      return
    }

    const nextDate = new Date(fromDate)

    if (!fromDate || Number.isNaN(nextDate.getTime())) {
      setState((currentState) => ({ ...currentState, error: t('Оберіть коректну дату акта') }))
      return
    }

    const requestId = saveRequestRef.current + 1
    saveRequestRef.current = requestId
    setState((currentState) => ({ ...currentState, error: null, isSaving: true }))

    void updateActProvidingService({
      ...act,
      Comment: comment,
      FromDate: nextDate.toISOString(),
    })
      .then((savedAct) => {
        if (saveRequestRef.current !== requestId) {
          return
        }

        if (!savedAct) {
          setState((currentState) => ({
            ...currentState,
            error: t('Backend не повернув оновлений акт надання послуг'),
            isSaving: false,
          }))
          return
        }

        setState((currentState) => ({
          ...currentState,
          act: savedAct,
          comment: savedAct.Comment || '',
          error: null,
          fromDate: toDateTimeLocal(savedAct.FromDate),
          isDirty: false,
          isSaving: false,
        }))
        notifications.show({ color: 'green', message: t('Акт надання послуг оновлено') })
      })
      .catch((saveError: unknown) => {
        if (saveRequestRef.current === requestId) {
          setState((currentState) => ({
            ...currentState,
            error: saveError instanceof Error ? saveError.message : t('Не вдалося оновити акт надання послуг'),
            isSaving: false,
          }))
        }
      })
  }, [act, comment, fromDate, setState, t])

  return {
    act,
    comment,
    displayModel,
    error,
    fromDate,
    isDirty,
    isLoading,
    isSaving,
    loadAct,
    save,
    updateComment,
    updateFromDate,
  }
}

function toDateTimeLocal(value?: string): string {
  const date = value ? new Date(value) : new Date()

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)

  return offsetDate.toISOString().slice(0, 16)
}
