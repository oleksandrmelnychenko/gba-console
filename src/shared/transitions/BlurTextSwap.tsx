import { useEffect, useState, type CSSProperties, type Ref } from 'react'

type BlurTextSwapProps = {
  text: string
  className?: string
  style?: CSSProperties
  ref?: Ref<HTMLSpanElement>
}

/**
 * Swaps text with a blur transition: the outgoing value blurs + fades up and
 * out while the incoming value blurs + fades in from below. Mirrors the
 * "text states swap (with blur)" transition from transitions.dev.
 *
 * The passed `className` is applied to BOTH the outgoing and incoming layers so
 * truncation (ellipsis) and typography are preserved during the swap. Forwards
 * a ref to the wrapper so it can be used as a Mantine Tooltip target.
 */
export function BlurTextSwap({ text, className, style, ref }: BlurTextSwapProps) {
  const [current, setCurrent] = useState(text)
  const [previous, setPrevious] = useState<string | null>(null)

  // Adjust state during render when the incoming text changes — React's
  // recommended approach over a useEffect, which would flash a stale frame.
  if (text !== current) {
    setPrevious(current)
    setCurrent(text)
  }

  // Clear the outgoing layer once the blur animation has finished.
  useEffect(() => {
    if (previous == null) {
      return
    }

    const timer = window.setTimeout(() => setPrevious(null), 360)

    return () => window.clearTimeout(timer)
  }, [previous])

  return (
    <span ref={ref} className="tx-blur-swap">
      {previous != null && previous !== current && (
        <span
          key={`out-${previous}`}
          aria-hidden="true"
          className={`tx-blur-swap-layer tx-blur-swap-out${className ? ` ${className}` : ''}`}
          style={style}
        >
          {previous}
        </span>
      )}
      <span key={`in-${current}`} className={`tx-blur-swap-in${className ? ` ${className}` : ''}`} style={style}>
        {current}
      </span>
    </span>
  )
}
