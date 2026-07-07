export function WordIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-label="Word"
      height={size}
      style={{ display: 'block' }}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#2B579A" height="19" rx="2.5" width="19" x="2.5" y="2.5" />
      <path
        d="M6 9l1.6 6h1.5L12 10.6 13.9 15h1.5L17 9h-1.5l-1 4.2L12.8 9h-1.6l-1.7 4.2L8.5 9z"
        fill="#ffffff"
      />
    </svg>
  )
}
