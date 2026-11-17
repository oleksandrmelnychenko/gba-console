/**
 * Title and body for a realtime toast. The server often sends only a title, or the same text
 * twice; showing it as both title and body read "Оновлено замовлення Оновлено замовлення".
 */
export function toastTitleAndMessage(title: string, message: string): { message: string; title?: string } {
  const body = message.trim()

  return body && body !== title.trim() ? { message: body, title } : { message: title }
}
