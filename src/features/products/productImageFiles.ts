export const PRODUCT_IMAGE_MIN_BYTES = 100
// Same ceiling the server applies to other uploaded images (RetailPaymentImageItemUploadPolicy).
export const PRODUCT_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const PRODUCT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp'

export type ProductImageKind = 'jpeg' | 'png' | 'gif' | 'webp'

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value)
}

const ascii = (text: string) => Array.from(text, (character) => character.charCodeAt(0))

/** The image type by its magic bytes, or null when the content is not JPEG/PNG/GIF/WEBP. */
export function detectProductImageKind(bytes: Uint8Array): ProductImageKind | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) return 'gif'
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'webp'
  return null
}

function readHead(file: Blob, length: number): Promise<Uint8Array> {
  const head = file.slice(0, length)

  if (typeof head.arrayBuffer === 'function') {
    return head.arrayBuffer().then((buffer) => new Uint8Array(buffer))
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(head)
  })
}

/** A Ukrainian reason the file cannot be uploaded as a product image, or null when it can. */
export async function validateProductImageFile(file: File, t: (value: string) => string): Promise<string | null> {
  const name = `«${file.name}»`

  if (file.size < PRODUCT_IMAGE_MIN_BYTES) {
    return `${t('Файл')} ${name}: ${t('порожній або пошкоджений (менше 100 байт)')}`
  }

  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return `${t('Файл')} ${name}: ${t('більший за 10 МБ')}`
  }

  try {
    if (detectProductImageKind(await readHead(file, 12))) {
      return null
    }
  } catch {
    // An unreadable file is reported like a wrong format below.
  }

  return `${t('Файл')} ${name}: ${t('не є зображенням JPEG, PNG, GIF або WEBP')}`
}

/** Splits picked files into the uploadable ones and the reasons the others were rejected. */
export async function partitionProductImageFiles(
  files: File[],
  t: (value: string) => string,
): Promise<{ accepted: File[]; errors: string[] }> {
  const verdicts = await Promise.all(files.map((file) => validateProductImageFile(file, t)))

  return {
    accepted: files.filter((_, index) => verdicts[index] === null),
    errors: verdicts.filter((verdict): verdict is string => verdict !== null),
  }
}
