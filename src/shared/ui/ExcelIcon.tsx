import excelIconUrl from '../../assets/brand/excel-icon.png'

export function ExcelIcon({ size = 18 }: { size?: number }) {
  return (
    <img
      src={excelIconUrl}
      alt="Excel"
      width={size}
      height={size}
      style={{ display: 'block', objectFit: 'contain' }}
    />
  )
}
