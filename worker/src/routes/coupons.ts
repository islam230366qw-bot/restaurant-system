import { Hono } from 'hono'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import type { Env } from '../index'
import { getDB } from '../db'
import { validateStr } from '../validate'

const app = new Hono<{ Bindings: Env }>()

app.get('/', auth, requireRole('manager'), async (c) => {
  const db = getDB(c.env)
  const { results } = await db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all()
  return c.json(results)
})

app.get('/:code', auth, requireRole('manager', 'cashier'), async (c) => {
  const code = c.req.param('code')
  const db = getDB(c.env)

  const coupon = await db.prepare(
    'SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > datetime(\'now\')) AND (max_uses = 0 OR used_count < max_uses)'
  ).bind(code).first<{ id: number; code: string; discount_type: string; discount_value: number; min_order: number }>()

  if (!coupon) {
    return c.json({ error: 'الكوبون غير صالح أو منتهي' }, 404)
  }
  return c.json(coupon)
})

app.post('/', auth, requireRole('manager'), async (c) => {
  const { code, discountType, discountValue, minOrder, maxUses, expiresAt } = await c.req.json()
  if (!code || !discountType || discountValue === undefined) {
    return c.json({ error: 'الكود ونوع الخصم وقيمته مطلوبة' }, 400)
  }
  const db = getDB(c.env)

  const existing = await db.prepare('SELECT id FROM coupons WHERE code = ?').bind(code.toUpperCase()).first()
  if (existing) {
    return c.json({ error: 'كود الكوبون موجود بالفعل' }, 409)
  }

  await db.prepare(
    'INSERT INTO coupons (code, discount_type, discount_value, min_order, max_uses, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(validateStr(code.toUpperCase(), 50), discountType, discountValue, minOrder || 0, maxUses || 0, expiresAt || null).run()

  return c.json({ message: 'تم إنشاء الكوبون' }, 201)
})

app.put('/:id', auth, requireRole('manager'), async (c) => {
  const id = parseInt(c.req.param('id'))
  if (!id) return c.json({ error: 'معرف غير صالح' }, 400)
  const { code, discountType, discountValue, minOrder, maxUses, expiresAt, isActive } = await c.req.json()
  const db = getDB(c.env)
  const existing = await db.prepare('SELECT id FROM coupons WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'الكوبون غير موجود' }, 404)

  await db.prepare(
    'UPDATE coupons SET code = ?, discount_type = ?, discount_value = ?, min_order = ?, max_uses = ?, expires_at = ?, is_active = ? WHERE id = ?'
  ).bind(validateStr(code?.toUpperCase() || '', 50), discountType, discountValue, minOrder || 0, maxUses || 0, expiresAt || null, isActive ? 1 : 0, id).run()

  return c.json({ message: 'تم تحديث الكوبون' })
})

app.delete('/:id', auth, requireRole('manager'), async (c) => {
  const id = parseInt(c.req.param('id'))
  if (!id) return c.json({ error: 'معرف غير صالح' }, 400)
  const db = getDB(c.env)
  const existing = await db.prepare('SELECT id FROM coupons WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'الكوبون غير موجود' }, 404)
  await db.prepare('DELETE FROM coupons WHERE id = ?').bind(id).run()
  return c.json({ message: 'تم حذف الكوبون' })
})

export default app
