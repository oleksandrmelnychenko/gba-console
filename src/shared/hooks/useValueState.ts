import { useReducer, type Dispatch, type SetStateAction } from 'react'

function resolveInitialState<TState>(initialState: TState | (() => TState)): TState {
  return typeof initialState === 'function' ? (initialState as () => TState)() : initialState
}

function valueStateReducer<TState>(state: TState, action: SetStateAction<TState>): TState {
  return typeof action === 'function' ? (action as (currentState: TState) => TState)(state) : action
}

export function useValueState<TState>(initialState: TState | (() => TState)): [TState, Dispatch<SetStateAction<TState>>] {
  return useReducer(valueStateReducer<TState>, initialState, resolveInitialState)
}
