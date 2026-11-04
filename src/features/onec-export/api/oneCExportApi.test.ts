import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportToOneC, fileNameFromDisposition } from './oneCExportApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('1C export api', () => {
  it('reads the file name from content disposition', () => {
    expect(fileNameFromDisposition('attachment; filename=gba-1c-fenix-20261101-20261104.xml; filename*=UTF-8\'\'gba-1c-fenix-20261101-20261104.xml', 'x.xml'))
      .toBe('gba-1c-fenix-20261101-20261104.xml')
    expect(fileNameFromDisposition('attachment; filename="gba-1c-20261101-20261104.zip"', 'x.xml')).toBe('gba-1c-20261101-20261104.zip')
    expect(fileNameFromDisposition(null, 'x.xml')).toBe('x.xml')
  })

  it('posts the request and returns the downloaded file', async () => {
    const fetchMock = vi.fn(async () => new Response('<xml/>', {
      status: 200,
      headers: {
        'Content-Disposition': 'attachment; filename=gba-1c-amg-20261101-20261101.xml',
        'X-Gba-Export-Batch': 'batch-1',
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const file = await exportToOneC({ bases: ['Amg'], from: '2026-11-01', to: null, types: ['Sale'] })

    expect(file.fileName).toBe('gba-1c-amg-20261101-20261101.xml')
    expect(file.batchNetUid).toBe('batch-1')
    expect(await file.blob.text()).toBe('<xml/>')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/integration/onec-export/export')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ bases: ['Amg'], from: '2026-11-01', to: null, types: ['Sale'] })
  })

  it('surfaces the server message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ Message: 'Оберіть хоча б одну базу 1С.' }), { status: 400 })))

    await expect(exportToOneC({ bases: [], from: '2026-11-01', to: null, types: [] })).rejects.toThrow('Оберіть хоча б одну базу 1С.')
  })
})
