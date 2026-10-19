export type DataEnvironment = 'dev' | 'qa'

export interface DataEnvironmentState {
  active: DataEnvironment
  qaAvailable: boolean
}

export const DATA_ENVIRONMENT_COOKIE = 'gba_env'
export const DATA_ENVIRONMENT_URL = '/gba-env.json'

export async function fetchDataEnvironment(): Promise<DataEnvironmentState | null> {
  try {
    const response = await fetch(DATA_ENVIRONMENT_URL, { cache: 'no-store', credentials: 'same-origin' })
    if (!response.ok) return null
    const payload = (await response.json()) as Partial<DataEnvironmentState>
    if (payload.qaAvailable !== true) return null
    return { active: payload.active === 'qa' ? 'qa' : 'dev', qaAvailable: true }
  } catch {
    return null
  }
}

export function writeDataEnvironmentCookie(environment: DataEnvironment): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = environment === 'qa'
    ? `${DATA_ENVIRONMENT_COOKIE}=qa; Path=/; Max-Age=31536000; SameSite=Strict${secure}`
    : `${DATA_ENVIRONMENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Strict${secure}`
}

export function markDocumentEnvironment(environment: DataEnvironment): void {
  document.documentElement.dataset.gbaEnv = environment
}
