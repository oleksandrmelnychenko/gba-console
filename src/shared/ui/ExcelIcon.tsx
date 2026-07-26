export function ExcelIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      width={size}
      height={size}
      viewBox="0 0 24 24"
    >
      <rect width="15" height="20" x="7" y="2" fill="#107c41" rx="3" />
      <path fill="#21a366" d="M13 2h6a3 3 0 0 1 3 3v6h-9V2Z" />
      <path fill="#33c481" d="M13 11h9v8a3 3 0 0 1-3 3h-6V11Z" />
      <rect width="14" height="14" x="1" y="5" fill="#185c37" rx="2.5" />
      <path
        fill="#fff"
        d="M4.35 8h2.3L8 10.42 9.35 8h2.3l-2.4 4 2.55 4H9.47L8 13.5 6.53 16H4.2l2.55-4-2.4-4Z"
      />
    </svg>
  )
}
