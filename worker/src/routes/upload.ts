import { Hono } from 'hono'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import type { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

app.post('/', auth, requireRole('manager'), async (c) => {
  const bucket = c.env.RESTAURANT_IMAGES
  if (!bucket) {
    return c.json({ error: 'مخزن الصور غير مفعل. أضف binding R2 في Cloudflare Dashboard' }, 501)
  }

  const formData = await c.req.formData()
  const file = formData.get('image') as File | null
  if (!file) {
    return c.json({ error: 'ملف الصورة مطلوب' }, 400)
  }

  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: 'حجم الصورة يجب أن يكون أقل من 5MB' }, 400)
  }

  const ext = file.name.split('.').pop() || 'png'
  const key = `restaurant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

  await bucket.put(key, await file.bytes(), {
    httpMetadata: { contentType: file.type || 'image/png' },
  })

  return c.json({ key, message: 'تم رفع الصورة بنجاح' })
})

app.get('/:key', auth, requireRole('manager'), async (c) => {
  const bucket = c.env.RESTAURANT_IMAGES
  if (!bucket) return c.json({ error: 'مخزن الصور غير مفعل' }, 501)

  const key = c.req.param('key')
  const object = await bucket.get(key)
  if (!object) return c.json({ error: 'الصورة غير موجودة' }, 404)

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'public, max-age=31536000')

  return new Response(object.body, { headers })
})

export default app
