import { use } from 'react'
import { AuthContext } from './AuthContext'

export function useAuth() {
  const value = use(AuthContext)

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return value
}
