export const SPECIFICATION_CODES_ACCEPT = '.xlsx,.xls'

const XLSX_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]
const XLS_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value)
}

async function readHead(file: Blob): Promise<Uint8Array> {
  const head = file.slice(0, 8)
  if (typeof head.arrayBuffer === 'function') {
    return new Uint8Array(await head.arrayBuffer())
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(head)
  })
}

/**
 * The import accepts Excel workbooks only (.xlsx, .xls): the extension and the file content
 * must both say so. Returns a Ukrainian reason, or null when the file can be sent.
 */
export async function excelWorkbookFileError(file: File, t: (value: string) => string): Promise<string | null> {
  const name = file.name.toLowerCase()
  const isXlsx = name.endsWith('.xlsx')
  const isXls = name.endsWith('.xls')

  if (!isXlsx && !isXls) {
    return t('Підтримуються лише книги Excel (.xlsx, .xls). CSV не підтримується.')
  }

  try {
    const head = await readHead(file)
    if ((isXlsx && startsWith(head, XLSX_SIGNATURE)) || (isXls && startsWith(head, XLS_SIGNATURE))) {
      return null
    }
  } catch {
    // Unreadable: reported below like a wrong format.
  }

  return t('Файл не є коректною книгою Excel (.xlsx).')
}
