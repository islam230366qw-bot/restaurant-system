import type { Context, Next } from 'hono'
import type { Env } from '../index'
import { getDB } from '../db'

let cachedStatus: { trial_mode: number; trial_until: string | null; subscription_status: string | null; subscription_expires_at: string | null } | null = null
let cacheExpiry = 0

export async function requireSubscription(c: Context<{ Bindings: Env }>, next: Next) {
  const now = Date.now()
  if (!cachedStatus || now > cacheExpiry) {
    const db = getDB(c.env)
    cachedStatus = await db.prepare(
      'SELECT trial_mode, trial_until, subscription_status, subscription_expires_at FROM settings WHERE id = 1'
    ).first<{ trial_mode: number; trial_until: string | null; subscription_status: string | null; subscription_expires_at: string | null }>()
    cacheExpiry = now + 60_000
  }

  const settings = cachedStatus

  if (settings?.subscription_status === 'expired') {
    return c.json({ error: 'انتهت صلاحية الاشتراك. يرجى التواصل مع الإدارة', code: 'SUBSCRIPTION_EXPIRED' }, 402)
  }

  if (settings?.trial_mode && settings?.trial_until) {
    const db = getDB(c.env)
    const now2 = new Date().toISOString()
    if (now2 > settings.trial_until) {
      await db.prepare(
        "UPDATE settings SET subscription_status = 'expired' WHERE id = 1"
      ).run()
      cachedStatus = null
      return c.json({ error: 'انتهت الفترة التجريبية. يرجى التواصل مع الإدارة', code: 'TRIAL_EXPIRED' }, 402)
    }
  }

  await next()
}
