import type { Context, Next } from 'hono'
import type { Env } from '../index'

const requestCounts = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(maxReqs: number, windowMs: number) {
  return async function (c: Context<{ Bindings: Env }>, next: Next) {
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || 'unknown'
    const now = Date.now()

    let entry = requestCounts.get(ip)
    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs }
      requestCounts.set(ip, entry)
      await next()
      return
    }

    entry.count++
    if (entry.count > maxReqs) {
      return c.json({ error: 'محاولات كثيرة جداً. حاول بعد دقيقة' }, 429)
    }

    await next()
  }
}
