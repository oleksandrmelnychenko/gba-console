const MAX_PRIORITY = 2_147_483_647

export type TransporterFormInput = {
  CssClass: string
  ImageFile: File | null
  ImageUrl: string
  Name: string
  Priority: string
}

/** Field-level checks the server applies too; returns the first problem in Ukrainian. */
export function validateTransporterForm(values: TransporterFormInput): string | null {
  if (!values.Name.trim()) {
    return 'Вкажіть назву перевізника'
  }

  const priority = values.Priority.trim()

  if (priority && (!/^\d+$/.test(priority) || Number(priority) > MAX_PRIORITY)) {
    return 'Пріоритет — ціле число від 0 до 2 147 483 647'
  }

  if (values.CssClass.trim() && !/^[\w\s-]+$/.test(values.CssClass.trim())) {
    return 'CSS клас може містити лише літери, цифри, пробіли, «-» та «_»'
  }

  const imageUrl = values.ImageUrl.trim()

  if (imageUrl && !/^https?:\/\//i.test(imageUrl) && !imageUrl.startsWith('/')) {
    return 'URL зображення має починатися з http://, https:// або /'
  }

  if (values.ImageFile && !values.ImageFile.type.startsWith('image/')) {
    return 'Зображення має бути файлом PNG, JPEG, GIF або WEBP'
  }

  return null
}
