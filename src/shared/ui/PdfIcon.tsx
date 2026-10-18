export function PdfIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" fill="none" width={size} height={size} viewBox="0 0 24 24">
      <path fill="#e03131" d="M9 2h7l6 6v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
      <path fill="#ffa8a8" d="M16 2v4a2 2 0 0 0 2 2h4l-6-6Z" />
      <rect x="1" y="9" width="19" height="11" rx="2" fill="#b02525" />
      <path
        stroke="#fff" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"
        d="M4 17v-5h1.5a1.5 1.5 0 0 1 0 3H4m5 2v-5h1a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H9m6 0v-5h2.5M15 14.5h2"
      />
    </svg>
  )
}
