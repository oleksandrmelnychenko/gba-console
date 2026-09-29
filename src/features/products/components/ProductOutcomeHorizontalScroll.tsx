import { type ReactNode, useEffect, useRef, useState } from 'react'

type Props = {
  children: ReactNode
  label: string
}

export function ProductOutcomeHorizontalScroll({ children, label }: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [maxScroll, setMaxScroll] = useState(0)
  const [position, setPosition] = useState(0)

  useEffect(() => {
    const scroll = frameRef.current?.querySelector<HTMLDivElement>('.data-table-scroll')
    const table = scroll?.querySelector('table')
    if (!scroll || !table) return
    scrollRef.current = scroll

    const measure = () => {
      setMaxScroll(Math.max(0, scroll.scrollWidth - scroll.clientWidth))
      setPosition(scroll.scrollLeft)
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(scroll)
    observer?.observe(table)
    scroll.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    const animationFrame = requestAnimationFrame(measure)
    measure()

    return () => {
      cancelAnimationFrame(animationFrame)
      observer?.disconnect()
      scroll.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      scrollRef.current = null
    }
  }, [])

  return (
    <div ref={frameRef} className="product-outcome-scroll-frame">
      {children}
      {maxScroll > 0 && (
        <input
          aria-label={label}
          className="product-outcome-scroll-control"
          type="range"
          min={0}
          max={maxScroll}
          step={1}
          value={Math.min(position, maxScroll)}
          onChange={(event) => {
            const next = Number(event.currentTarget.value)
            if (scrollRef.current) scrollRef.current.scrollLeft = next
            setPosition(next)
          }}
        />
      )}
    </div>
  )
}
