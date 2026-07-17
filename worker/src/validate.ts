export function validateStr(s: string | undefined | null, maxLen = 500): string {
  if (!s) return ''
  const trimmed = s.trim()
  if (trimmed.length > maxLen) return trimmed.slice(0, maxLen)
  return trimmed
}

export function validatePhone(s: string | undefined | null): string {
  if (!s) return ''
  return s.replace(/[^0-9+\-() ]/g, '').trim()
}

export function validateInt(s: string | undefined | null): number | null {
  if (!s) return null
  const n = parseInt(s)
  return isNaN(n) ? null : n
}

export function escapeHtml(s: string | undefined | null): string {
  if (!s) return ''
  return s.replace(/[&<>"']/g, function (c) {
    switch (c) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#39;'
      default: return c
    }
  })
}
