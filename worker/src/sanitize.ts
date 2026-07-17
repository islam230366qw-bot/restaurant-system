export function sanitize(s: string | undefined | null): string {
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

export function sanitizeObject(obj: Record<string, any>, fields: string[]): Record<string, any> {
  const result = { ...obj }
  for (const key of Object.keys(result)) {
    if (fields.includes(key) && typeof result[key] === 'string') {
      result[key] = sanitize(result[key])
    }
  }
  return result
}
