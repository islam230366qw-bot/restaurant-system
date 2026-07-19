import { Hono } from 'hono'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import type { Env } from '../index'
import { getDB } from '../db'
import { validateStr } from '../validate'

const app = new Hono<{ Bindings: Env }>()

app.get('/', auth, requireRole('manager', 'cashier'), async (c) => {
  const db = getDB(c.env)
  const items = await db.prepare(
    `SELECT m.*, c.name as category_name, i.name as inventory_name
     FROM menu_items m
     LEFT JOIN categories c ON m.category_id = c.id
     LEFT JOIN inventory i ON m.inventory_item_id = i.id
     ORDER BY c.display_order, m.name`
  ).all()
  return c.json(items.results)
})

app.get('/active', auth, requireRole('manager', 'cashier'), async (c) => {
  const db = getDB(c.env)
  const items = await db.prepare(
    `SELECT m.*, c.name as category_name, i.name as inventory_name
     FROM menu_items m
     LEFT JOIN categories c ON m.category_id = c.id
     LEFT JOIN inventory i ON m.inventory_item_id = i.id
     WHERE m.is_available = 1
     ORDER BY c.display_order, m.name`
  ).all()
  return c.json(items.results)
})

app.post('/', auth, requireRole('manager'), async (c) => {
  const body = await c.req.json()
  const { name, nameEn, description, price, categoryId, options, isAvailable, inventoryItemId, imageUrl } = body

  if (!name || price === undefined || price < 0) {
    return c.json({ error: 'اسم الصنف والسعر مطلوب (يجب أن يكون السعر أكبر من صفر)' }, 400)
  }

  const db = getDB(c.env)
  const result = await db.prepare(
    `INSERT INTO menu_items (category_id, name, name_en, description, price, options, is_available, inventory_item_id, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    categoryId || null,
    validateStr(name, 100),
    validateStr(nameEn || null, 100),
    validateStr(description || null, 500),
    price,
    options ? JSON.stringify(options) : null,
    isAvailable !== undefined ? (isAvailable ? 1 : 0) : 1,
    inventoryItemId || null,
    imageUrl || null
  ).run()

  return c.json({ id: result.meta.last_row_id, message: 'تم إضافة الصنف بنجاح' }, 201)
})

app.put('/:id', auth, requireRole('manager'), async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id) || id < 1) return c.json({ error: 'معرف غير صالح' }, 400)
  const body = await c.req.json()
  const { name, nameEn, description, price, categoryId, options, isAvailable, inventoryItemId, imageUrl } = body

  const db = getDB(c.env)
  const existing = await db.prepare('SELECT id FROM menu_items WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'الصنف غير موجود' }, 404)

  await db.prepare(
    `UPDATE menu_items
     SET category_id = ?, name = ?, name_en = ?, description = ?, price = ?, options = ?, is_available = ?, inventory_item_id = ?, image_url = ?
     WHERE id = ?`
  ).bind(
    categoryId || null,
    validateStr(name, 100),
    validateStr(nameEn || null, 100),
    validateStr(description || null, 500),
    price,
    options ? JSON.stringify(options) : null,
    isAvailable !== undefined ? (isAvailable ? 1 : 0) : 1,
    inventoryItemId || null,
    imageUrl || null,
    id
  ).run()

  return c.json({ message: 'تم تحديث الصنف بنجاح' })
})

app.delete('/:id', auth, requireRole('manager'), async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id) || id < 1) return c.json({ error: 'معرف غير صالح' }, 400)
  const db = getDB(c.env)
  const existing = await db.prepare('SELECT id FROM menu_items WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'الصنف غير موجود' }, 404)
  await db.prepare('DELETE FROM menu_items WHERE id = ?').bind(id).run()
  return c.json({ message: 'تم حذف الصنف بنجاح' })
})

app.patch('/:id/availability', auth, requireRole('manager'), async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id) || id < 1) return c.json({ error: 'معرف غير صالح' }, 400)
  const { isAvailable } = await c.req.json()
  const db = getDB(c.env)
  const existing = await db.prepare('SELECT id FROM menu_items WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'الصنف غير موجود' }, 404)
  await db.prepare('UPDATE menu_items SET is_available = ? WHERE id = ?')
    .bind(isAvailable ? 1 : 0, id).run()
  return c.json({ message: 'تم تحديث التوفر' })
})

export default app
