declare module 'pdfmake/build/pdfmake' {
  const pdfMake: {
    createPdf: (definition: unknown, layouts?: unknown, fonts?: unknown, vfs?: Record<string, string>) => {
      getBlob: (callback: (result: Blob) => void) => void
      getBuffer: (callback: (result: Uint8Array) => void) => void
    }
  }
  export default pdfMake
}

declare module 'pdfmake/build/vfs_fonts' {
  const vfs: Record<string, string>
  export default vfs
}
