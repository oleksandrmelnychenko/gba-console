import { forwardRef, type ComponentPropsWithoutRef, type CSSProperties } from 'react'
import './ios-loader.css'

const BARS = [0, 1, 2, 3, 4, 5, 6, 7]

export const IosLoader = forwardRef<HTMLSpanElement, ComponentPropsWithoutRef<'span'>>(
  ({ className, ...props }, ref) => (
    <span ref={ref} className={`ios-loader${className ? ` ${className}` : ''}`} {...props}>
      {BARS.map((index) => (
        <span key={index} className="ios-loader-bar" style={{ '--ios-i': index } as CSSProperties} />
      ))}
    </span>
  ),
)

IosLoader.displayName = 'IosLoader'
