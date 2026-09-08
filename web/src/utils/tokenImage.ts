/** Rewrite LAN / absolute token-art URLs to same-origin paths for Vercel (and LAN). */
export function resolveTokenImage(imageUrl: string | undefined | null): string {
  if (!imageUrl) return ''
  const trimmed = imageUrl.trim()
  if (!trimmed) return ''

  // Already relative
  if (trimmed.startsWith('/')) return trimmed

  try {
    const u = new URL(trimmed)
    // http://192.168.x.x:port/token-art/foo.jpg → /token-art/foo.jpg
    if (u.pathname.includes('/token-art/')) {
      return u.pathname + u.search
    }
  } catch {
    // not a URL — maybe bare filename
    if (trimmed.includes('token-art/')) {
      const i = trimmed.indexOf('token-art/')
      return '/' + trimmed.slice(i)
    }
  }

  return trimmed
}
