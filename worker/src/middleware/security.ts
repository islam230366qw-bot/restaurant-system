import type { Context, Next } from 'hono'
import type { Env } from '../index'

const MAX_BODY_SIZE = 1024 * 1024

const VALID_CONTENT_TYPES = [
  'application/json',
  'multipart/form-data',
]

export async function bodyLimit(c: Context<{ Bindings: Env }>, next: Next) {
  const contentLength = parseInt(c.req.header('Content-Length') || '0')
  if (contentLength > MAX_BODY_SIZE) {
    return c.json({ error: 'حجم الطلب كبير جداً' }, 413)
  }
  await next()
}

export async function validateContentType(c: Context<{ Bindings: Env }>, next: Next) {
  const method = c.req.method
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const contentType = c.req.header('Content-Type') || ''
    const isFormData = contentType.includes('multipart/form-data')
    const isJson = contentType.includes('application/json')
    if (!isFormData && !isJson && contentType !== '') {
      return c.json({ error: 'نوع المحتوى غير مدعوم' }, 415)
    }
  }
  await next()
}

export async function securityHeaders(c: Context<{ Bindings: Env }>, next: Next) {
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('X-XSS-Protection', '0')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self' https://restaurant-api.restaurant-system-api.workers.dev; frame-src 'none'; object-src 'none'")
  await next()
}
