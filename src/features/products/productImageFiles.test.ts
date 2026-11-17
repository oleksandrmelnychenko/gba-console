import { describe, expect, it } from 'vitest'
import { detectProductImageKind, partitionProductImageFiles, PRODUCT_IMAGE_MAX_BYTES } from './productImageFiles'

const t = (value: string) => value
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function fileOf(name: string, head: number[] | string, size = 200): File {
  const start = typeof head === 'string' ? new TextEncoder().encode(head) : new Uint8Array(head)
  const bytes = new Uint8Array(Math.max(size, start.length))
  bytes.set(start)
  return new File([bytes], name)
}

describe('detectProductImageKind', () => {
  it('recognizes JPEG, PNG, GIF and WEBP by content', () => {
    expect(detectProductImageKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg')
    expect(detectProductImageKind(new Uint8Array(PNG_HEAD))).toBe('png')
    expect(detectProductImageKind(new TextEncoder().encode('GIF89a'))).toBe('gif')
    expect(detectProductImageKind(new TextEncoder().encode('RIFF\u0000\u0000\u0000\u0000WEBP'))).toBe('webp')
    expect(detectProductImageKind(new TextEncoder().encode('just some text'))).toBeNull()
  })
})

describe('partitionProductImageFiles', () => {
  it('keeps real images and explains each rejected file', async () => {
    const { accepted, errors } = await partitionProductImageFiles([
      fileOf('photo.png', PNG_HEAD),
      fileOf('fake.jpg', 'this is text, not a jpeg'),
      fileOf('empty.png', PNG_HEAD, 1),
    ], t)

    expect(accepted.map((file) => file.name)).toEqual(['photo.png'])
    expect(errors).toEqual([
      'Файл «fake.jpg»: не є зображенням JPEG, PNG, GIF або WEBP',
      'Файл «empty.png»: порожній або пошкоджений (менше 100 байт)',
    ])
  })

  it('rejects files over 10 MB', async () => {
    const big = fileOf('big.png', PNG_HEAD)
    Object.defineProperty(big, 'size', { value: PRODUCT_IMAGE_MAX_BYTES + 1 })
    const { accepted, errors } = await partitionProductImageFiles([big], t)
    expect(accepted).toEqual([])
    expect(errors).toEqual(['Файл «big.png»: більший за 10 МБ'])
  })
})
