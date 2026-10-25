declare module 'pdfmake/build/pdfmake' {
  const pdfMake: {
    addVirtualFileSystem: (vfs: Record<string, string>) => void
    createPdf: (definition: unknown, options?: unknown) => {
      getBlob: () => Promise<Blob>
      getBuffer: () => Promise<Uint8Array>
    }
  }
  export default pdfMake
}

declare module 'pdfmake/build/vfs_fonts' {
  const vfs: Record<string, string>
  export default vfs
}
