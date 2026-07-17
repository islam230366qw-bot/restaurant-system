import type { Context, Next } from 'hono'
import type { Env } from '../index'

export function requireRole(...roles: string[]) {
  return async function (c: Context<{ Bindings: Env }>, next: Next) {
    const userRole = c.get('userRole')
    if (!userRole || !roles.includes(userRole)) {
      return c.json({ error: 'ليس لديك صلاحية للوصول إلى هذه الصفحة' }, 403)
    }
    await next()
  }
}
