import { use } from 'react'
import { NavigationContext } from '../NavigationContext'

export function useNavigation() {
  const value = use(NavigationContext)

  if (!value) {
    throw new Error('useNavigation must be used inside NavigationProvider')
  }

  return value
}
