import { type ComponentPropsWithoutRef, type CSSProperties, type Ref } from 'react'
import './ios-loader.css'

const BARS = [0, 1, 2, 3, 4, 5, 6, 7]

export function IosLoader({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<'span'> & { ref?: Ref<HTMLSpanElement> }) {
  return (
    <span ref={ref} className={`ios-loader${className ? ` ${className}` : ''}`} {...props}>
      {BARS.map((index) => (
        <span key={index} className="ios-loader-bar" style={{ '--ios-i': index } as CSSProperties} />
      ))}
    </span>
  )
}
