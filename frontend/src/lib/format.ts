const AR = '٠١٢٣٤٥٦٧٨٩'

function ar(s: string): string {
  return s.replace(/[0-9]/g, (d) => AR[+d])
}

export function toArabicDigits(s: string | number | undefined | null): string {
  if (s === undefined || s === null) return ''
  return ar(String(s))
}

export function toApiDate(v: string): string {
  const n = v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  const m = n.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : n
}

export function toDisplayDate(v: string): string {
  return v.replace(/-/g, '/')
}

export function formatDate(d: string | number | Date | undefined | null): string {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return ar(`${day}/${month}/${year}`)
}

export function formatDateTime(d: string | number | Date | undefined | null): string {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return ar(`${day}/${month}/${year} ${hours}:${minutes}`)
}

export function fmtCurrency(n: number | undefined | null | string): string {
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (v === undefined || v === null || isNaN(v)) return ar('0.00')
  return ar(v.toFixed(2))
}
