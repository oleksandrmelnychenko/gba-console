/**
 * Local stand-in for a product picture that fails to load (e.g. a shop image on another host that
 * the browser blocks). Inline SVG, so the fallback itself never makes a network request.
 */
export const PRODUCT_IMAGE_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">'
  + '<rect width="160" height="120" fill="#f1f3f5"/>'
  + '<path d="M52 78l20-24 16 18 10-12 14 18z" fill="#ced4da"/>'
  + '<circle cx="104" cy="46" r="8" fill="#ced4da"/>'
  + '</svg>',
)}`
