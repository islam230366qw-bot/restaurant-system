import { Hono } from 'hono'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import type { Env } from '../index'
import { getDB } from '../db'
import { validateStr } from '../validate'

const app = new Hono<{ Bindings: Env }>()

app.get('/', auth, requireRole('manager', 'cashier'), async (c) => {
  const db = getDB(c.env)
  const categories = await db.prepare(
    'SELECT * FROM categories ORDER BY display_order, id'
  ).all()
  return c.json(categories.results)
})

app.post('/', auth, requireRole('manager'), async (c) => {
  const { name, displayOrder } = await c.req.json()
  if (!name) return c.json({ error: 'اسم التصنيف مطلوب' }, 400)

  const db = getDB(c.env)
  const result = await db.prepare(
    'INSERT INTO categories (name, display_order) VALUES (?, ?)'
  ).bind(validateStr(name, 100), displayOrder || 0).run()

  return c.json({ id: result.meta.last_row_id, message: 'تم إضافة التصنيف' }, 201)
})

app.put('/:id', auth, requireRole('manager'), async (c) => {
  const id = parseInt(c.req.param('id'))
  if (!id) return c.json({ error: 'معرف غير صالح' }, 400)
  const { name, displayOrder } = await c.req.json()
  const db = getDB(c.env)
  const existing = await db.prepare('SELECT id FROM categories WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'التصنيف غير موجود' }, 404)
  await db.prepare('UPDATE categories SET name = ?, display_order = ? WHERE id = ?')
    .bind(validateStr(name, 100), displayOrder || 0, id).run()
  return c.json({ message: 'تم تحديث التصنيف' })
})

app.delete('/:id', auth, requireRole('manager'), async (c) => {
  const id = parseInt(c.req.param('id'))
  if (!id) return c.json({ error: 'معرف غير صالح' }, 400)
  const db = getDB(c.env)

  const existing = await db.prepare('SELECT id FROM categories WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'التصنيف غير موجود' }, 404)

  const hasItems = await db.prepare(
    'SELECT COUNT(*) as count FROM menu_items WHERE category_id = ?'
  ).bind(id).first<{ count: number }>()

  if (hasItems && hasItems.count > 0) {
    return c.json({ error: 'لا يمكن حذف التصنيف لأنه يحتوي على أصناف' }, 400)
  }

  await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run()
  return c.json({ message: 'تم حذف التصنيف' })
})

export default app
