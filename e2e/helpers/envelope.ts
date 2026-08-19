export function bodyOf<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'Body' in (payload as Record<string, unknown>)) {
    return (payload as { Body: T }).Body;
  }
  return payload as T;
}
