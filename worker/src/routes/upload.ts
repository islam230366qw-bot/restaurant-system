import { Hono } from 'hono'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import type { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

app.post('/', auth, requireRole('manager'), async (c) => {
  return c.json({ message: 'رفع الصور غير متاح حالياً. ارجع للإعدادات لاحقًا بعد تفعيل R2.' })
})

export default app
