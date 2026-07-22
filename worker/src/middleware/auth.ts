import type { Context, Next } from 'hono'
import { jwtVerify } from 'jose'
import type { Env } from '../index'
import { getDB } from '../db'

export interface JwtPayload {
  userId: number
  role: string
  fullName: string
  jti?: string
}

export async function auth(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'غير مصرح به. يرجى تسجيل الدخول' }, 401)
  }

  const token = authHeader.slice(7)
  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    const jti = payload.jti as string | undefined

    if (jti) {
      const db = getDB(c.env)
      const blacklisted = await db.prepare(
        'SELECT id FROM token_blacklist WHERE jti = ? AND expires_at > datetime(\'now\')'
      ).bind(jti).first()
      if (blacklisted) {
        return c.json({ error: 'الجلسة منتهية. يرجى تسجيل الدخول مرة أخرى' }, 401)
      }
      const user = await db.prepare('SELECT current_jti, is_active FROM users WHERE id = ?').bind(payload.userId).first<{ current_jti: string | null; is_active: number }>()
      if (!user) {
        return c.json({ error: 'المستخدم غير موجود' }, 401)
      }
      if (!user.is_active) {
        return c.json({ error: 'تم تعطيل حسابك. يرجى التواصل مع المدير' }, 401)
      }
      if (user.current_jti && user.current_jti !== jti) {
        return c.json({ error: 'تم تسجيل الدخول من جهاز آخر. يرجى إعادة تسجيل الدخول' }, 401)
      }
    }

    c.set('userId', payload.userId as number)
    c.set('userRole', payload.role as string)
    c.set('userName', payload.fullName as string)
    c.set('jti', jti || null)
    await next()
  } catch {
    return c.json({ error: 'الجلسة منتهية. يرجى تسجيل الدخول مرة أخرى' }, 401)
  }
}
