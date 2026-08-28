export const AUTH_PERMISSIONS_CHANGED_EVENT =
  'gba-console-auth-permissions-changed'

export function notifyAuthPermissionsChanged(): void {
  window.dispatchEvent(new CustomEvent(AUTH_PERMISSIONS_CHANGED_EVENT))
}
