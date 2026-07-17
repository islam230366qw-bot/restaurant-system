import type { Context, Next } from 'hono'
import type { Env } from '../index'
import { getDB } from '../db'

export async function requireSubscription(c: Context<{ Bindings: Env }>, next: Next) {
  const db = getDB(c.env)
  const settings = await db.prepare(
    'SELECT trial_mode, trial_until, subscription_status, subscription_expires_at FROM settings WHERE id = 1'
  ).first<{ trial_mode: number; trial_until: string | null; subscription_status: string | null; subscription_expires_at: string | null }>()

  if (settings?.subscription_status === 'expired') {
    return c.json({ error: 'انتهت صلاحية الاشتراك. يرجى التواصل مع الإدارة', code: 'SUBSCRIPTION_EXPIRED' }, 402)
  }

  if (settings?.trial_mode && settings?.trial_until) {
    const now = new Date().toISOString()
    if (now > settings.trial_until) {
      await db.prepare(
        "UPDATE settings SET subscription_status = 'expired' WHERE id = 1"
      ).run()
      return c.json({ error: 'انتهت الفترة التجريبية. يرجى التواصل مع الإدارة', code: 'TRIAL_EXPIRED' }, 402)
    }
  }

  await next()
}
